import { describe, expect, it } from 'vitest';
import { ACTION_LABEL, LOG_GROUPS } from '@/entities/admin-log';
import { NoApiError } from '@/entities/seasonal/xmas-event';
import { dismissXmasReport, removeGotLetter, removeOrnament } from '@/features/xmas/moderate-report';
import { isChangedLetter, returnLetter } from '@/features/xmas/return-letter';
import { ApiError, AUDIT_ACTIONS, createApi, type Api } from '@/shared/api';

/** 가짜 API — 보낸 것을 적고 정한 답을 낸다 */
function fakeApi(reply: unknown = null, fail?: Error) {
  const calls: [string, string, unknown][] = [];
  const api: Api = {
    get: async () => {
      throw new Error('get 은 쓰지 않는다');
    },
    send: async <T>(method: string, path: string, body?: unknown) => {
      calls.push([method, path, body]);
      if (fail) throw fail;
      return reply as T;
    },
    upload: async () => {
      throw new Error('upload 는 쓰지 않는다');
    },
  };
  return { api, calls };
}

describe('편지 반송', () => {
  it('POST /v2/admin/xmas/letters/{userCode}/{lid}/return 에 본 판(version) · 사유 · 메모 — 작업 기록은 서버가', async () => {
    const { api, calls } = fakeApi({ notified: true });
    const r = await returnLetter(api, {
      userCode: 'AB12CD',
      lid: 'l2',
      version: 7,
      reason: 'etc',
      note: '번호',
    });
    expect(calls).toEqual([
      ['POST', '/v2/admin/xmas/letters/AB12CD/l2/return', { version: 7, reason: 'etc', note: '번호' }],
    ]);
    expect(r).toEqual({ notified: true });
  });
  it('그새 고쳐 쓴 편지(409 CONCURRENT_UPDATE)는 isChangedLetter', async () => {
    const err = new ApiError('request', 409, 'CONCURRENT_UPDATE', '다른 요청이 먼저');
    const { api } = fakeApi(null, err);
    await expect(returnLetter(api, { userCode: 'A', lid: 'l1', version: 1, reason: 'spam' })).rejects.toBe(
      err,
    );
    expect(isChangedLetter(err)).toBe(true);
    expect(isChangedLetter(new ApiError('request', 409, 'XMAS_RETURN_CLOSED', ''))).toBe(false);
  });
  it('API 가 없는 환경(dev · e2e)은 보내지 않고 NoApiError', async () => {
    await expect(
      returnLetter(null, { userCode: 'A', lid: 'l1', version: 1, reason: 'spam' }),
    ).rejects.toBeInstanceOf(NoApiError);
  });
});

describe('신고 처리', () => {
  it('장식 지우기 — DELETE …/trees/{t}/ornaments/{s}?version=(본 판)', async () => {
    const { api, calls } = fakeApi();
    await removeOrnament(api, 3, 12, 4);
    expect(calls).toEqual([['DELETE', '/v2/admin/xmas/trees/3/ornaments/12?version=4', undefined]]);
  });
  it('받은 편지 지우기 — DELETE …/received/{받은 사람 코드}/{n}', async () => {
    const { api, calls } = fakeApi();
    await removeGotLetter(api, 'AB12CD', 2);
    expect(calls).toEqual([['DELETE', '/v2/admin/xmas/received/AB12CD/2', undefined]]);
  });
  it('문제없음 — DELETE …/reports/{key}', async () => {
    const { api, calls } = fakeApi();
    await dismissXmasReport(api, 'o-3-12');
    expect(calls).toEqual([['DELETE', '/v2/admin/xmas/reports/o-3-12', undefined]]);
  });
  it('진짜 API 통로(createApi)로 — 서버의 204 빈 본문 지우기 셋이 성공으로 끝난다', async () => {
    const seen: string[] = [];
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(`${init?.method} ${new URL(String(input)).pathname}${new URL(String(input)).search}`);
      return new Response(null, { status: 204 });
    }) as typeof globalThis.fetch;
    const api = createApi({ baseUrl: 'https://api.example', token: async () => 'tok', fetch });
    await expect(removeOrnament(api, 3, 12, 4)).resolves.toBeUndefined();
    await expect(removeGotLetter(api, 'AB12CD', 2)).resolves.toBeUndefined();
    await expect(dismissXmasReport(api, 'o-3-12')).resolves.toBeUndefined();
    expect(seen).toEqual([
      'DELETE /v2/admin/xmas/trees/3/ornaments/12?version=4',
      'DELETE /v2/admin/xmas/received/AB12CD/2',
      'DELETE /v2/admin/xmas/reports/o-3-12',
    ]);
  });
  it('작업 기록 화면 이름 · 묶음은 남는다(서버 감사 기록의 동작 이름과 같다)', () => {
    for (const a of [
      'xmas.returnLetter',
      'xmas.removeOrnament',
      'xmas.removeLetter',
      'xmas.dismiss',
    ] as const) {
      expect(AUDIT_ACTIONS).toContain(a);
      expect(ACTION_LABEL[a]).toBeTruthy();
    }
    expect(LOG_GROUPS.map((g) => g.id)).toContain('xmas');
  });
});
