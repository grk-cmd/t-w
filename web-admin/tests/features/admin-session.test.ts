import { describe, expect, it } from 'vitest';
import { createFirebaseAuthPort } from '@/features/auth/api/firebase';
import { createServerAuthPort, NOT_READY_TEXT } from '@/features/auth/api/server';
import type { AdminCheck, AuthPort } from '@/features/auth';
import { ApiError, type Api, type ApiSendMethod, type Db } from '@/shared/api';
import { fakeDb } from '../shared/fakeDb';
import { unusedWrites } from '../shared/fakeApi';

const USER = { uid: 'u1', email: 'a@b.c', displayName: '구글 이름' };

interface Sent {
  method: ApiSendMethod;
  path: string;
  body: unknown;
}

function fakeApi(me: () => unknown) {
  const sent: Sent[] = [];
  const api: Api = {
    get: async <T>(path: string) => {
      expect(path).toBe('/v2/admin/admins/me');
      return me() as T;
    },
    send: async <T>(method: ApiSendMethod, path: string, options: { body?: unknown } = {}) => {
      sent.push({ method, path, body: options.body });
      return undefined as T;
    },
    upload: unusedWrites.upload,
  };
  return { api, sent };
}

const failing = (error: unknown) =>
  fakeApi(() => {
    throw error;
  });

// 같은 판정 한 벌을 두 판에 — 관리자 · 거절 · 못 닿음
function dbWith(probe: () => Promise<void>): Db {
  const { db } = fakeDb();
  return { ...db, probe };
}
const editions: [string, (outcome: 'admin' | 'denied' | 'unreachable') => AuthPort][] = [
  [
    'Firebase 판',
    (outcome) =>
      createFirebaseAuthPort(
        dbWith(async () => {
          if (outcome === 'denied') throw { code: 'PERMISSION_DENIED' };
          if (outcome === 'unreachable') throw new Error('network');
        }),
      ),
  ],
  [
    'API 판',
    (outcome) =>
      createServerAuthPort(
        outcome === 'admin'
          ? fakeApi(() => ({ name: '가나', version: 1 })).api
          : failing(
              outcome === 'denied'
                ? new ApiError('auth', 403, 'ACCESS_DENIED', '')
                : new ApiError('unavailable', 502, '', 'API 오류'),
            ).api,
      ),
  ],
];

describe.each(editions)('관리자 확인 — %s', (_name, make) => {
  it('관리자면 admin', async () => {
    expect(await make('admin').checkAdmin(USER)).toEqual({ state: 'admin' });
  });

  it('거절이면 denied — 등록할 uid 를 보인다', async () => {
    const check = await make('denied').checkAdmin(USER);
    expect(check.state).toBe('denied');
    expect((check as Exclude<AdminCheck, { state: 'admin' }>).message).toContain('등록할 uid: u1');
  });

  it('닿지 못하면 unreachable — admin 으로 두지 않는다', async () => {
    expect((await make('unreachable').checkAdmin(USER)).state).toBe('unreachable');
  });
});

describe('관리자 확인 — 판마다 다른 것', () => {
  it('Firebase 판은 거절하면 로그아웃시키고, API 판은 «다시 시도 · 로그아웃» 화면에 둔다', () => {
    expect(createFirebaseAuthPort(fakeDb().db).signOutOnRefusal).toBe(true);
    expect(createServerAuthPort(null).signOutOnRefusal).toBe(false);
  });

  it('Firebase 판은 관리자면 구글 이름을 이름 칸에 채운다(같으면 쓰지 않는다)', async () => {
    const { db, writes } = fakeDb();
    await createFirebaseAuthPort(db).checkAdmin(USER);
    await Promise.resolve();
    expect(writes.map((w) => w[1])).toEqual(['adminNames/u1']);
    const same = fakeDb({ 'adminNames/u1': { name: '구글 이름' } });
    await createFirebaseAuthPort(same.db).checkAdmin(USER);
    await Promise.resolve();
    expect(same.writes).toEqual([]);
  });

  it('API 판: 501 은 notReady — 관리자 화면이 아니다', async () => {
    const check = await createServerAuthPort(failing(new ApiError('notReady', 501, '', '')).api).checkAdmin(
      USER,
    );
    expect(check).toEqual({ state: 'notReady', message: NOT_READY_TEXT });
  });

  it('API 판: 이름이 비었을 때만 PATCH 한 번(40자까지) — 판을 싣는다', async () => {
    const { api, sent } = fakeApi(() => ({ name: '', grantedAt: 't', version: 1 }));
    const check = await createServerAuthPort(api).checkAdmin({
      ...USER,
      displayName: `  ${'x'.repeat(50)}  `,
    });
    expect(check).toEqual({ state: 'admin' });
    expect(sent).toEqual([
      { method: 'PATCH', path: '/v2/admin/admins/me', body: { version: 1, name: 'x'.repeat(40) } },
    ]);

    const named = fakeApi(() => ({ name: '가나', version: 5 }));
    await createServerAuthPort(named.api).checkAdmin(USER);
    expect(named.sent).toEqual([]);

    const noName = fakeApi(() => ({ name: '', version: 1 }));
    await createServerAuthPort(noName.api).checkAdmin({ ...USER, displayName: null });
    expect(noName.sent).toEqual([]);
  });

  it('API 판: 이름 저장이 실패해도 관리자다', async () => {
    const api: Api = {
      get: async <T>() => ({ name: '', version: 1 }) as T,
      send: async () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '');
      },
      upload: unusedWrites.upload,
    };
    expect(await createServerAuthPort(api).checkAdmin(USER)).toEqual({ state: 'admin' });
  });

  it('API 판: 주소 없음은 unreachable', async () => {
    expect((await createServerAuthPort(null).checkAdmin(USER)).state).toBe('unreachable');
  });
});
