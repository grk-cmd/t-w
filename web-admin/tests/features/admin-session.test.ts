import { describe, expect, it } from 'vitest';
import { checkAdmin } from '@/features/auth';
import { ApiError, type Api, type ApiSendMethod } from '@/shared/api';

interface Sent {
  method: ApiSendMethod;
  path: string;
  body: unknown;
}

function fakeApi(me: () => unknown) {
  const sent: Sent[] = [];
  const api: Api = {
    get: async <T>(path: string) => {
      expect(path).toBe('/v1/admin/admins/me');
      return me() as T;
    },
    send: async <T>(method: ApiSendMethod, path: string, options: { body?: unknown } = {}) => {
      const body = options?.body as { name: string };
      sent.push({ method, path, body });
      return { name: body.name, version: 2 } as T;
    },
  };
  return { api, sent };
}

describe('관리자 확인', () => {
  it('관리자면 admin — 이름이 있으면 쓰지 않는다', async () => {
    const { api, sent } = fakeApi(() => ({ name: '가나', grantedAt: 't', version: 5 }));
    expect(await checkAdmin(api, '구글 이름')).toEqual({ state: 'admin', name: '가나', version: 5 });
    expect(sent).toEqual([]);
  });

  it('이름이 비었으면 로그인 이름으로 PATCH 한 번(40자까지) — 판을 싣는다', async () => {
    const { api, sent } = fakeApi(() => ({ name: '', grantedAt: 't', version: 1 }));
    const check = await checkAdmin(api, `  ${'x'.repeat(50)}  `);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      method: 'PATCH',
      path: '/v1/admin/admins/me',
      body: { version: 1, name: 'x'.repeat(40) },
    });
    expect(check).toEqual({ state: 'admin', name: 'x'.repeat(40), version: 2 });
  });

  it('로그인 이름도 없으면 쓰지 않는다 · 이름 저장이 실패해도 관리자다', async () => {
    const a = fakeApi(() => ({ name: '', version: 1 }));
    expect((await checkAdmin(a.api, null)).state).toBe('admin');
    expect(a.sent).toEqual([]);

    const failing: Api = {
      get: async <T>() => ({ name: '', version: 1 }) as T,
      send: async () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '');
      },
    };
    expect(await checkAdmin(failing, '이름')).toEqual({ state: 'admin', name: '', version: 1 });
  });

  it('403 은 denied', async () => {
    const { api } = fakeApi(() => {
      throw new ApiError('auth', 403, 'ACCESS_DENIED', '');
    });
    expect(await checkAdmin(api, '이름')).toEqual({ state: 'denied' });
  });

  it('닿지 못함 · 5xx · 401 · 주소 없음은 unreachable — admin 으로 두지 않는다', async () => {
    for (const error of [
      new ApiError('unavailable', 0, '', 'API 에 연결하지 못했어요'),
      new ApiError('unavailable', 502, '', 'API 오류'),
      new ApiError('auth', 401, 'AUTH_REQUIRED', ''),
    ]) {
      const { api } = fakeApi(() => {
        throw error;
      });
      expect((await checkAdmin(api, '이름')).state).toBe('unreachable');
    }
    expect((await checkAdmin(null, '이름')).state).toBe('unreachable');
  });
});
