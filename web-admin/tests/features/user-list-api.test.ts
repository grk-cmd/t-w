import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildUserRows,
  pageFromRows,
  queryUsers,
  rowFromApi,
  statsFromApi,
  userSourceNote,
  type ApiUserPage,
  type ApiUserRow,
  type UserPageView,
  type UserQuery,
  type UserRow,
} from '@/entities/user';
import {
  CODES_MAX,
  fetchAllUsers,
  fetchLicenseUsers,
  fetchUserPage,
  fetchUsersByCode,
  fetchUserStats,
  loadAllRowsFrom,
  queryParams,
  refreshUsers,
  USERS_BATCH,
  USERS_PATH,
} from '@/features/user/user-rows';
import { ApiError, type Api, type ApiParams } from '@/shared/api';
import { fakeDb } from '../shared/fakeDb';
import { accounts, friendCodes, licenses } from '../shared/userFixtures';

// 예전 방식(RTDB 통째 → 화면에서 거름)의 줄 — 같은 것을 API(서버 사본)가 돌려준다고 보고 두 길의 결과를 견준다.
const ROWS = buildUserRows(
  { ...accounts, u5: { name: '자차', license: ' key-1 ', ts: 25, ver: '0.11.0' } },
  friendCodes,
  licenses,
);
const ALL: UserQuery = { filter: 'all', q: '', ver: undefined };

/** 서버가 내보내는 모양(t-w-server UserResponse.DirectoryRow). */
const toApi = (r: UserRow): ApiUserRow => ({
  userCode: r.userCode,
  name: r.name,
  friendCode: r.friendCode,
  license: r.license,
  licenseState: r.licenseState,
  hasAccount: r.hasAccount,
  lastSeen: r.lastSeen ? new Date(r.lastSeen).toISOString() : null,
  focusTotalSec: r.focusTotalSec,
  ver: r.ver,
  licenseUsers: r.licenseUsers,
});

/** 서버처럼 거르고 자른다 — 화면 쪽 규칙(queryUsers)을 그대로 쓴 가짜. */
function serverPage(params: ApiParams = {}): ApiUserPage {
  const ver = params.ver === undefined ? undefined : params.ver === 'none' ? null : String(params.ver);
  let rows = queryUsers(ROWS, {
    filter: (params.filter as UserQuery['filter']) ?? 'all',
    q: String(params.q ?? ''),
    ver,
  });
  if (params.codes) rows = rows.filter((r) => String(params.codes).split(',').includes(r.userCode));
  if (params.license) rows = rows.filter((r) => r.license === params.license);
  const size = Number(params.size ?? 20);
  const page = Number(params.page ?? 1);
  return {
    items: rows.slice((page - 1) * size, page * size).map(toApi),
    page,
    size,
    total: rows.length,
    totalPages: Math.ceil(rows.length / size),
  };
}

function fakeApi(respond: (path: string, params?: ApiParams) => unknown = (_, p) => serverPage(p)) {
  const calls: [string, ApiParams | undefined][] = [];
  const api: Api = {
    get: async <T>(path: string, params?: ApiParams) => {
      calls.push([path, params]);
      return respond(path, params) as T;
    },
  };
  return { api, calls };
}

const failing = (e: ApiError): Api => ({
  get: async () => {
    throw e;
  },
});

const loadAllSpy = () => vi.fn(async () => ROWS);
const withoutSource = (v: UserPageView) => ({ ...v, source: undefined });

afterEach(() => {
  vi.useRealTimers();
});

describe('사용자 목록 — API 로 읽기', () => {
  it('쪽 · 개수 · 조건을 쿼리로 넘기고, 기본값(전체 · 빈 검색어 · 버전 없음)은 보내지 않는다', async () => {
    const { api, calls } = fakeApi();
    const loadAll = loadAllSpy();

    const view = await fetchUserPage(api, loadAll, ALL, 2, 2);

    expect(calls).toEqual([
      [USERS_PATH, { q: undefined, filter: undefined, ver: undefined, page: 2, size: 2 }],
    ]);
    expect(view.source).toEqual({ via: 'api' });
    expect(view.items.map((r) => r.userCode)).toEqual(['u2', 'u3']);
    expect(view.total).toBe(ROWS.length);
    expect(view.pageCount).toBe(3);
    expect(loadAll).not.toHaveBeenCalled();
  });

  it('검색어는 앞뒤 공백을 빼고 100자까지 · 버전 «기록 없음» 은 none', () => {
    expect(queryParams({ filter: 'dup-license', q: `  ${'가'.repeat(120)} `, ver: null })).toEqual({
      q: '가'.repeat(100),
      filter: 'dup-license',
      ver: 'none',
    });
    expect(queryParams({ filter: 'all', q: ' ', ver: '0.11.0' })).toEqual({
      q: undefined,
      filter: undefined,
      ver: '0.11.0',
    });
  });

  it('마지막 접속 오래된 순만 sort 로 보낸다 · «키 중복» 은 서버의 키 순서 그대로', () => {
    expect(queryParams({ ...ALL, order: 'asc' }).sort).toBe('lastSeen,asc');
    expect(queryParams({ ...ALL, order: 'desc' }).sort).toBeUndefined();
    expect(queryParams({ ...ALL, filter: 'dup-license', order: 'asc' }).sort).toBeUndefined();
  });

  it('예전 방식도 오래된 순이면 최근 순을 뒤집는다', () => {
    const desc = queryUsers(ROWS, ALL).map((r) => r.userCode);
    expect(queryUsers(ROWS, { ...ALL, order: 'asc' }).map((r) => r.userCode)).toEqual([...desc].reverse());
  });

  it('같은 조건이면 API 와 예전 방식(통째 → 화면에서 거름)이 같은 줄 · 같은 개수', async () => {
    const queries: UserQuery[] = [
      ALL,
      { filter: 'licensed', q: '', ver: undefined },
      { filter: 'revoked', q: '', ver: undefined },
      { filter: 'no-license', q: '', ver: undefined },
      { filter: 'no-account', q: '', ver: undefined },
      { filter: 'dup-license', q: '', ver: undefined },
      { filter: 'all', q: 'key-1', ver: undefined },
      { filter: 'all', q: '', ver: null },
      { filter: 'all', q: '', ver: '0.11.0' },
    ];
    for (const query of queries) {
      const viaApi = await fetchUserPage(fakeApi().api, loadAllSpy(), query, 1, 20);
      const viaRtdb = await fetchUserPage(null, loadAllSpy(), query, 1, 20);
      expect(withoutSource(viaApi)).toEqual(withoutSource(viaRtdb));
    }
  });

  it('줄 모양 — 시각은 ms, 모르는 라이선스 상태는 키가 있으면 «없는 키», 없으면 none', () => {
    const base = toApi(ROWS[0]);
    expect(rowFromApi(base)).toEqual(ROWS[0]);
    expect(rowFromApi({ ...base, licenseState: 'future', license: 'K' }).licenseState).toBe('unknown');
    expect(rowFromApi({ ...base, licenseState: 'future', license: null }).licenseState).toBe('none');
    expect(rowFromApi({ ...base, lastSeen: null, ver: 'x'.repeat(21) })).toMatchObject({
      lastSeen: 0,
      ver: null,
    });
  });

  it('통계 — 버전별 수에 몫을 붙여 큰 버전부터 · 기록 없음은 맨 뒤 · 기준 시각', async () => {
    const { api } = fakeApi(() => ({
      total: 6500,
      accounts: 4000,
      versions: [
        { ver: null, count: 1 },
        { ver: '0.10.3', count: 1 },
        { ver: '0.11.0', count: 2 },
      ],
      syncedAt: '2026-10-13T01:02:03Z',
      snapshotAt: '2026-10-13T01:00:00Z',
    }));
    const stats = await fetchUserStats(api, loadAllSpy());

    expect(stats.total).toBe(6500);
    expect(stats.versions.map((v) => [v.ver, v.count, v.share])).toEqual([
      ['0.11.0', 2, 0.5],
      ['0.10.3', 1, 0.25],
      [null, 1, 0.25],
    ]);
    expect(stats.syncedAt).toBe(Date.parse('2026-10-13T01:02:03Z'));
    expect(
      statsFromApi({
        total: 0,
        accounts: 0,
        versions: [],
        syncedAt: null,
        snapshotAt: null,
      }),
    ).toMatchObject({ syncedAt: null, versions: [], recent: null, source: { via: 'api' } });
    // 최근 7일 줄은 따로 — 몫도 그 줄 안에서
    expect(
      statsFromApi({
        total: 0,
        accounts: 0,
        versions: [{ ver: '0.11.3', count: 9 }],
        recentVersions: [
          { ver: '0.11.3', count: 3 },
          { ver: null, count: 1 },
        ],
        syncedAt: null,
        snapshotAt: null,
      }).recent?.map((v) => [v.ver, v.count, v.share]),
    ).toEqual([
      ['0.11.3', 3, 0.75],
      [null, 1, 0.25],
    ]);
  });

  it('조건에 맞는 사람 전부 — 500명씩 쪽을 넘겨 순서대로 모은다', async () => {
    const pages: ApiUserPage[] = [1, 2, 3].map((page) => ({
      items: [toApi({ ...ROWS[0], userCode: `p${page}` })],
      page,
      size: USERS_BATCH,
      total: 3,
      totalPages: 3,
    }));
    const { api, calls } = fakeApi((_, p) => pages[Number(p?.page) - 1]);

    const all = await fetchAllUsers(api, loadAllSpy(), { filter: 'licensed', q: '', ver: undefined });

    expect(all.rows.map((r) => r.userCode)).toEqual(['p1', 'p2', 'p3']);
    expect(all.source).toEqual({ via: 'api' });
    expect(calls.map(([, p]) => [p?.page, p?.size, p?.filter])).toEqual([
      [1, USERS_BATCH, 'licensed'],
      [2, USERS_BATCH, 'licensed'],
      [3, USERS_BATCH, 'licensed'],
    ]);
  });

  it('사용자코드로 찾기 — 겹침 없이 100개씩 나눠 묻고, 없는 사람은 빠진다 · 빈 목록은 묻지 않는다', async () => {
    const { api, calls } = fakeApi();
    const codes = ['u1', 'u9', 'u1', 'nope', ...Array.from({ length: CODES_MAX }, (_, i) => `x${i}`)];

    const found = await fetchUsersByCode(api, loadAllSpy(), codes);

    expect(calls).toHaveLength(2);
    expect(String(calls[0][1]?.codes).split(',')).toHaveLength(CODES_MAX);
    expect([...found.keys()].sort()).toEqual(['u1', 'u9']);
    expect(found.get('u9')?.hasAccount).toBe(false);

    const empty = fakeApi();
    expect((await fetchUsersByCode(empty.api, loadAllSpy(), [])).size).toBe(0);
    expect(empty.calls).toHaveLength(0);
  });

  it('같은 키를 쓰는 사람 — license 로 묻는다 · 예전 방식도 같은 사람', async () => {
    const { api, calls } = fakeApi();
    const viaApi = await fetchLicenseUsers(api, loadAllSpy(), 'KEY-1');
    const viaRtdb = await fetchLicenseUsers(null, loadAllSpy(), 'KEY-1');

    expect(calls[0][1]).toMatchObject({ license: 'KEY-1' });
    expect(viaApi.map((r) => r.userCode)).toEqual(['u1', 'u5']);
    expect(viaRtdb.map((r) => r.userCode)).toEqual(['u1', 'u5']);
  });
});

describe('사용자 목록 — 예전 방식으로 넘어가기', () => {
  it('이 환경에 API 가 없으면(dev) 통째로 받아 화면에서 — 쪽은 끝 쪽으로 맞춘다', async () => {
    const view = await fetchUserPage(null, loadAllSpy(), ALL, 9, 2);
    expect(view.source).toEqual({ via: 'rtdb', fallback: 'no-api' });
    expect(view.page).toBe(3);
    expect(view).toEqual(pageFromRows(ROWS, ALL, 9, 2, 'no-api'));
  });

  it('닿지 못하면(네트워크 · 5xx · 404 · 타임아웃) 통째 읽기로 — 목록 · 통계 · 전부 · 찾기 · 같은 키 모두', async () => {
    const api = failing(new ApiError('unavailable', 503, '', 'down'));
    const loadAll = loadAllSpy();

    expect((await fetchUserPage(api, loadAll, ALL, 1, 20)).source).toEqual({
      via: 'rtdb',
      fallback: 'unavailable',
    });
    const stats = await fetchUserStats(api, loadAll);
    expect(stats).toMatchObject({ total: ROWS.length, syncedAt: null, source: { via: 'rtdb' } });
    expect((await fetchAllUsers(api, loadAll, ALL)).rows).toEqual(ROWS);
    expect([...(await fetchUsersByCode(api, loadAll, ['u2'])).keys()]).toEqual(['u2']);
    expect(await fetchLicenseUsers(api, loadAll, 'KEY-2')).toHaveLength(1);
    expect(loadAll).toHaveBeenCalledTimes(5);
  });

  it('401 · 403 · 400 은 넘어가지 않고 그대로 던진다(권한 문제를 RTDB 로 덮지 않게)', async () => {
    const loadAll = loadAllSpy();
    for (const e of [
      new ApiError('auth', 401, 'AUTH_REQUIRED', ''),
      new ApiError('auth', 403, 'ACCESS_DENIED', ''),
      new ApiError('request', 400, 'INVALID_REQUEST', ''),
    ]) {
      await expect(fetchUserPage(failing(e), loadAll, ALL, 1, 20)).rejects.toBe(e);
      await expect(fetchUserStats(failing(e), loadAll)).rejects.toBe(e);
    }
    expect(loadAll).not.toHaveBeenCalled();
  });

  it('통째 읽기는 세 노드를 한 번만 받아 캐시해 둔다(사용자 화면 · 방 서버 · 라이선스가 같은 키)', async () => {
    const { db } = fakeDb({ accountSnap: accounts, friendCodes, licenses });
    const get = vi.spyOn(db, 'get');
    const client = new QueryClient();
    const loadAll = loadAllRowsFrom(client, db);

    expect((await loadAll()).map((r) => r.userCode)).toEqual(['u1', 'u2', 'u3', 'u4', 'u9']);
    await loadAll();
    expect(get.mock.calls.map(([p]) => p).sort()).toEqual(['accountSnap', 'friendCodes', 'licenses']);
  });

  it('어디서 읽었는지 알리는 말', () => {
    expect(userSourceNote({ via: 'api' }, null)).toContain('기준 시각 없음');
    expect(userSourceNote({ via: 'api' }, new Date(2026, 0, 1, 9, 5, 7).getTime())).toBe('기준 09:05:07');
    expect(userSourceNote({ via: 'rtdb', fallback: 'no-api' }, null)).toContain('API 없음');
    expect(userSourceNote({ via: 'rtdb', fallback: 'unavailable' }, null)).toContain('API 연결 안 됨');
  });
});

describe('다시 읽기', () => {
  it('API 로 읽고 있었으면 원본 캐시는 바로, 목록은 사본이 따라올 때까지 기다렸다가', async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    client.setQueryData(['users', 'page'], { source: { via: 'api' } });
    client.setQueryData(['accountSnap'], {});
    const spy = vi.spyOn(client, 'invalidateQueries');

    refreshUsers(client, 3000);
    const keys = () => spy.mock.calls.map(([f]) => JSON.stringify(f?.queryKey));
    expect(keys()).toContain('["accountSnap"]');
    expect(keys()).not.toContain('["users"]');
    vi.advanceTimersByTime(3000);
    expect(keys()).toContain('["users"]');
  });

  it('예전 방식으로 읽고 있었거나 새로고침 단추(0)면 바로', () => {
    const client = new QueryClient();
    client.setQueryData(['users', 'page'], { source: { via: 'rtdb', fallback: 'no-api' } });
    const spy = vi.spyOn(client, 'invalidateQueries');
    refreshUsers(client);
    expect(spy.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))).toContain('["users"]');

    client.setQueryData(['users', 'page'], { source: { via: 'api' } });
    spy.mockClear();
    refreshUsers(client, 0);
    expect(spy.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))).toContain('["users"]');
  });
});

describe('사용자 한 줄 — 키 사용자 수', () => {
  it('정규화한 키로 세어 줄마다 붙인다(키 없으면 0) · 키 중복 칩은 이 수로 고른다', () => {
    const count = Object.fromEntries(ROWS.map((r) => [r.userCode, r.licenseUsers]));
    expect(count).toEqual({ u1: 2, u5: 2, u2: 1, u3: 0, u4: 1, u9: 0 });
    expect(queryUsers(ROWS, { filter: 'dup-license', q: '', ver: undefined }).map((r) => r.userCode)).toEqual(
      ['u1', 'u5'],
    );
  });
});
