import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiBaseUrl,
  apiErrorText,
  CONFLICT_TEXT,
  createApi,
  isApiAuthError,
  isApiConflict,
  PROD_API_BASE_URL,
  shouldFallback,
} from '@/shared/api';
import { errorMessage } from '@/shared/lib';

const BASE = 'https://api.example';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function api(respond: (url: URL, init: RequestInit) => Promise<Response> | Response, token = 'tok') {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, init: init ?? {} });
    return respond(url, init ?? {});
  }) as unknown as typeof globalThis.fetch;
  return {
    client: createApi({ baseUrl: BASE, token: async () => token || null, fetch, timeoutMs: 50 }),
    calls,
  };
}

async function failure(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    return e as ApiError;
  }
  throw new Error('실패해야 하는데 성공했다');
}

describe('API 주소', () => {
  it('운영 프로젝트만 운영 API, dev · e2e 는 없음', () => {
    expect(apiBaseUrl('together-working')).toBe(PROD_API_BASE_URL);
    expect(apiBaseUrl('together-working-dev')).toBeNull();
    expect(apiBaseUrl('demo-tw')).toBeNull();
  });

  it('빌드 값(VITE_API_BASE_URL)이 있으면 그것 — 끝 슬래시는 떼고, 빈 값은 «없음»', () => {
    expect(apiBaseUrl('together-working-dev', 'https://api-dev.example/')).toBe('https://api-dev.example');
    expect(apiBaseUrl('together-working', '  ')).toBeNull();
  });
});

describe('API 통로', () => {
  it('토큰을 Bearer 로 싣고, 빈 값은 빼고 쿼리를 붙이고, 봉투의 data 만 돌려준다', async () => {
    const { client, calls } = api(() => json(200, { success: true, data: { n: 1 }, message: null }));

    await expect(client.get('/v1/x', { page: 2, q: '', sort: undefined, s: 'a b' })).resolves.toEqual({
      n: 1,
    });

    expect(calls[0].url.origin + calls[0].url.pathname).toBe(`${BASE}/v1/x`);
    expect([...calls[0].url.searchParams]).toEqual([
      ['page', '2'],
      ['s', 'a b'],
    ]);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('로그인 전(토큰 없음)이면 부르지 않고 401 오류', async () => {
    const { client, calls } = api(() => json(200, { success: true, data: 1 }), '');
    const e = await failure(client.get('/v1/x'));
    expect([e.kind, e.status, e.code]).toEqual(['auth', 401, 'AUTH_REQUIRED']);
    expect(calls).toHaveLength(0);
  });

  it('401 · 403 은 권한 오류 — 폴백하지 않는다', async () => {
    const e401 = await failure(
      api(() =>
        json(401, { success: false, data: null, code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' }),
      ).client.get('/v1/x'),
    );
    const e403 = await failure(
      api(() =>
        json(403, { success: false, data: null, code: 'ACCESS_DENIED', message: '접근 권한이 없습니다.' }),
      ).client.get('/v1/x'),
    );
    expect([e401.kind, e401.code, e401.message]).toEqual(['auth', 'AUTH_REQUIRED', '로그인이 필요합니다.']);
    expect([e403.kind, e403.code]).toEqual(['auth', 'ACCESS_DENIED']);
    expect(shouldFallback(e401) || shouldFallback(e403)).toBe(false);
    expect(isApiAuthError(e403)).toBe(true);
    // 화면 문구: 401 은 다시 로그인, 403 은 권한
    expect(errorMessage(e401, '실패')).toContain('다시 로그인');
    expect(errorMessage(e403, '실패')).toContain('권한이 없어요');
  });

  it('5xx · 봉투가 아닌 응답은 «닿지 못함» — 폴백한다', async () => {
    const e500 = await failure(
      api(() => json(500, { success: false, code: 'INTERNAL_ERROR', message: '서버 오류' })).client.get(
        '/v1/x',
      ),
    );
    const e502 = await failure(
      api(() => new Response('<html>Bad Gateway</html>', { status: 502 })).client.get('/v1/x'),
    );
    const weird = await failure(api(() => new Response('ok', { status: 200 })).client.get('/v1/x'));
    for (const e of [e500, e502, weird]) {
      expect(e.kind).toBe('unavailable');
      expect(shouldFallback(e)).toBe(true);
    }
    expect([e500.status, e500.code]).toEqual([500, 'INTERNAL_ERROR']);
  });

  it('404 는 그 자원의 «없음»(request) — 닿지 못함이 아니다. 옮기는 동안만 옛 길로 넘어간다', async () => {
    const e = await failure(
      api(() => json(404, { success: false, code: 'BUG_NOT_FOUND', message: '없는 글' })).client.get('/v1/x'),
    );
    expect([e.kind, e.status, e.code]).toEqual(['request', 404, 'BUG_NOT_FOUND']);
    // 옮기는 동안(D12-9 에서 걷는다)만 404 도 옛 길로 — 다른 4xx 는 아니다
    expect(shouldFallback(e)).toBe(true);
    expect(
      shouldFallback(
        await failure(
          api(() => json(409, { success: false, code: 'CONCURRENT_UPDATE' })).client.get('/v1/x'),
        ),
      ),
    ).toBe(false);
  });

  it('네트워크(CORS 거절 포함) 실패 · 타임아웃도 폴백', async () => {
    const net = await failure(
      api(() => {
        throw new TypeError('Failed to fetch');
      }).client.get('/v1/x'),
    );
    expect([net.kind, net.status]).toEqual(['unavailable', 0]);

    // 응답을 끝내 주지 않는 서버 — signal 이 끊기면 fetch 처럼 AbortError 로 끝난다
    const slow = await failure(
      api(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) =>
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
          ),
      ).client.get('/v1/x'),
    );
    expect(slow.kind).toBe('unavailable');
    expect(slow.message).toContain('늦어요');
  });

  it('그 밖의 4xx(보낸 값이 틀림)는 폴백하지 않는다', async () => {
    const e = await failure(
      api(() =>
        json(400, {
          success: false,
          code: 'INVALID_REQUEST',
          message: '요청이 올바르지 않습니다. (size 는 1~100)',
        }),
      ).client.get('/v1/x'),
    );
    expect([e.kind, e.code]).toEqual(['request', 'INVALID_REQUEST']);
    expect(shouldFallback(e)).toBe(false);
    expect(shouldFallback(new Error('x'))).toBe(false);
  });
});

describe('쓰기(send)', () => {
  it('본문은 JSON 으로, 쿼리는 빈 값 빼고 붙인다 — 봉투의 data 를 돌려준다', async () => {
    const { client, calls } = api(() => json(200, { success: true, data: { version: 4 } }));

    await expect(
      client.send('PUT', '/v1/admin/config/x', { body: { version: 3, value: { a: 1 } }, query: { q: '' } }),
    ).resolves.toEqual({ version: 4 });

    expect(calls[0].init.method).toBe('PUT');
    expect(calls[0].init.body).toBe(JSON.stringify({ version: 3, value: { a: 1 } }));
    expect((calls[0].init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(calls[0].url.search).toBe('');
  });

  it('DELETE 는 본문 없이 ?version= 만', async () => {
    const { client, calls } = api(() => json(200, { success: true, data: null }));

    await client.send('DELETE', '/v1/admin/todos/t1', { body: { ignored: true }, query: { version: 7 } });

    expect(calls[0].init.method).toBe('DELETE');
    expect(calls[0].init.body).toBeUndefined();
    expect(calls[0].url.searchParams.get('version')).toBe('7');
    expect((calls[0].init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('204(본문 없음)는 성공', async () => {
    const { client } = api(() => new Response(null, { status: 204 }));
    await expect(client.send('DELETE', '/v1/x', { query: { version: 1 } })).resolves.toBeUndefined();
  });

  it('409 는 덮지 않은 것 — 그대로 던지고 isApiConflict 로 알아본다 · 실패 봉투의 items 를 싣는다', async () => {
    const e = await failure(
      api(() =>
        json(409, { success: false, code: 'CONCURRENT_UPDATE', message: '다른 곳에서 바꿨어요', items: [1] }),
      ).client.send('PATCH', '/v1/x/1', { body: { version: 1 } }),
    );
    expect([e.kind, e.status]).toEqual(['request', 409]);
    expect(isApiConflict(e)).toBe(true);
    expect(e.items).toEqual([1]);
    expect(shouldFallback(e)).toBe(false);
    expect(errorMessage(e, '실패')).toBe(CONFLICT_TEXT);
  });
});

describe('서버 오류 문구 표', () => {
  it('표에 있는 code 는 그 문구, 없는 서버 오류는 서버 message, 닿지 못함 · 오류 아님은 fallback', () => {
    const known = new ApiError('request', 400, 'OPS_VERSION_ABOVE_LATEST', '서버 문구');
    const unknown = new ApiError('request', 400, 'SOMETHING_NEW', '서버가 준 문구');
    const down = new ApiError('unavailable', 502, '', 'API 오류');
    expect(apiErrorText(known, '실패')).toBe('공개된 최신 릴리스보다 높아요');
    expect(apiErrorText(unknown, '실패')).toBe('서버가 준 문구');
    expect(apiErrorText(down, '못 불러왔어요')).toBe('못 불러왔어요');
    expect(apiErrorText(new Error('x'), '실패')).toBe('실패');
    expect(errorMessage(unknown, '실패')).toBe('서버가 준 문구');
  });
});
