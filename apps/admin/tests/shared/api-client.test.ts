import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiBaseUrl,
  createApi,
  isApiAuthError,
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
    // 읽기는 본문 · Content-Type 없이 GET 으로 — send 와 request 를 나눠 쓴 뒤에도
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].init.body).toBeUndefined();
    expect((calls[0].init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
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

  it('5xx · 404 · 봉투가 아닌 응답은 «닿지 못함» — 폴백한다', async () => {
    const e500 = await failure(
      api(() => json(500, { success: false, code: 'INTERNAL_ERROR', message: '서버 오류' })).client.get(
        '/v1/x',
      ),
    );
    const e502 = await failure(
      api(() => new Response('<html>Bad Gateway</html>', { status: 502 })).client.get('/v1/x'),
    );
    const e404 = await failure(
      api(() => json(404, { success: false, code: 'NOT_FOUND' })).client.get('/v1/x'),
    );
    const weird = await failure(api(() => new Response('ok', { status: 200 })).client.get('/v1/x'));
    for (const e of [e500, e502, e404, weird]) {
      expect(e.kind).toBe('unavailable');
      expect(shouldFallback(e)).toBe(true);
    }
    expect([e500.status, e500.code]).toEqual([500, 'INTERNAL_ERROR']);
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

describe('API 쓰기(send)', () => {
  it('메서드 · JSON 본문 · Content-Type · 토큰을 싣고 봉투의 data 만 돌려준다', async () => {
    const { client, calls } = api(() => json(200, { success: true, data: { id: 'p1' } }));
    await expect(client.send('POST', '/admin/x', { a: 1 })).resolves.toEqual({ id: 'p1' });
    const init = calls[0].init;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers.Authorization).toBe('Bearer tok');
  });

  it('본문이 없으면(DELETE) 본문 · Content-Type 도 없다', async () => {
    const { client, calls } = api(() => json(200, { success: true, data: null }));
    await client.send('DELETE', '/admin/x/1');
    expect(calls[0].init.method).toBe('DELETE');
    expect(calls[0].init.body).toBeUndefined();
    expect((calls[0].init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('오류 규칙은 읽기와 같다 — 403 권한 · 400 요청 · 로그인 전엔 부르지 않음', async () => {
    const e403 = await failure(
      api(() => json(403, { success: false, code: 'ACCESS_DENIED' })).client.send('PATCH', '/x', {}),
    );
    const e400 = await failure(
      api(() => json(400, { success: false, code: 'BAD', message: 'PNG 가 아니에요' })).client.send(
        'POST',
        '/x',
        {},
      ),
    );
    expect([e403.kind, e403.code]).toEqual(['auth', 'ACCESS_DENIED']);
    expect([e400.kind, e400.message]).toEqual(['request', 'PNG 가 아니에요']);
    const anon = api(() => json(200, { success: true, data: 1 }), '');
    expect((await failure(anon.client.send('POST', '/x', {}))).kind).toBe('auth');
    expect(anon.calls).toHaveLength(0);
  });
});
