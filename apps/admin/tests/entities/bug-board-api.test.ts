import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bugListFromApi,
  fetchBugList,
  refreshBugBoard,
  toBugItem,
  type ApiBugPage,
  type BugListView,
} from '@/entities/bug-board';
import { ApiError, type Api, type ApiParams } from '@/shared/api';
import { kstDayStart } from '@/shared/lib';
import { fakeDb } from '../shared/fakeDb';

const DAY = kstDayStart('2026-10-08');
const row = (ts: number, extra: Record<string, unknown> = {}) => ({
  vis: 'pub',
  status: 'new',
  cat: 'bug',
  name: '가나',
  authUid: 'uid1',
  code: 'u1',
  ts,
  openTs: ts,
  title: '제목',
  ...extra,
});

// API 한 줄은 웹 관리자 BugItem 과 같은 이름 — 없는 칸은 null 로 온다.
const apiRow = (id: string, ts: number) => ({
  id,
  ...row(ts),
  nts: null,
  notice: false,
  lastReplyTs: null,
  userReplyTs: null,
  ansN: 2,
  likeN: null,
  no: null,
  byAdmin: false,
});

const PAGE: ApiBugPage = {
  items: [apiRow('b', DAY + 2), apiRow('a', DAY + 1), { id: 'junk', ts: DAY }],
  page: 2,
  size: 20,
  total: 43,
  totalPages: 3,
  syncedAt: '2026-10-17T01:02:03Z',
};

function fakeApi(respond: (path: string, params?: ApiParams) => unknown) {
  const calls: [string, ApiParams | undefined][] = [];
  const api: Api = {
    get: async <T>(path: string, params?: ApiParams) => {
      calls.push([path, params]);
      return respond(path, params) as T;
    },
    send: async () => {
      throw new Error('이 시험은 쓰기를 부르지 않는다');
    },
  };
  return { api, calls };
}

const failing = (e: ApiError): Api => ({
  get: async () => {
    throw e;
  },
  send: async () => {
    throw e;
  },
});

const notReady = new ApiError('unavailable', 503, 'BUG_BOARD_NOT_READY', '사본 아직');
const forbidden = new ApiError('auth', 403, 'ACCESS_DENIED', '접근 권한이 없습니다.');

// RTDB 를 읽으면 실패하는 Db — «API 로 읽으면 RTDB 는 안 읽는다» 를 본다.
function noReadDb() {
  const { db } = fakeDb({});
  const read = vi.fn(async () => {
    throw new Error('RTDB 를 읽었다');
  });
  return { db: { ...db, get: read, getLast: read }, read };
}

function rtdbList(n: number) {
  const list: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) list[`k${String(i).padStart(2, '0')}`] = row(DAY + i);
  return fakeDb({ 'bugBoard/list': list }).db;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('제보 목록 — API 쪽 번호', () => {
  it('API 줄은 RTDB 줄과 같은 toBugItem 으로 — null 칸은 없는 칸 · 모양이 틀린 줄은 버린다', () => {
    const view = bugListFromApi(PAGE);
    expect(view).toMatchObject({ via: 'api', page: 2, pageCount: 3, total: 43 });
    if (view.via !== 'api') throw new Error('api');
    expect(view.items.map((it) => it.id)).toEqual(['b', 'a']);
    expect(view.items[1]).toEqual(toBugItem('a', row(DAY + 1, { ansN: 2 })));
    expect(view.syncedAt).toBe(Date.parse('2026-10-17T01:02:03Z'));
  });

  it('쪽이 없으면(0개) 1쪽 · 기준 시각이 없거나 틀리면 null', () => {
    const empty = bugListFromApi({ ...PAGE, items: [], total: 0, totalPages: 0, syncedAt: null });
    expect(empty).toMatchObject({ pageCount: 1, total: 0, syncedAt: null });
    expect(bugListFromApi({ ...PAGE, syncedAt: 'x' })).toMatchObject({ syncedAt: null });
  });

  it('쪽 · 개수 · 필터를 그대로 묻고, RTDB 는 읽지 않는다', async () => {
    const { api, calls } = fakeApi(() => PAGE);
    const { db, read } = noReadDb();
    const view = await fetchBugList(api, db, { filter: 'open', page: 2, size: 50, before: null });
    expect(calls).toEqual([['/v1/admin/bugs', { page: 2, size: 50, filter: 'open' }]]);
    expect(view.via).toBe('api');
    expect(read).not.toHaveBeenCalled();
  });
});

describe('제보 목록 — 폴백(RTDB 커서 20줄)', () => {
  it('API 가 없으면(dev) · 닿지 못하면 · 사본이 아직이면(503) 예전처럼 20줄 · 다음 커서', async () => {
    const none = await fetchBugList(null, rtdbList(30), { filter: 'all', page: 1, size: 50, before: null });
    const down = await fetchBugList(failing(notReady), rtdbList(30), {
      filter: 'all',
      page: 1,
      size: 50,
      before: null,
    });
    expect(none).toMatchObject({ via: 'rtdb', fallback: 'no-api' });
    expect(down).toMatchObject({ via: 'rtdb', fallback: 'unavailable' });
    if (down.via !== 'rtdb') throw new Error('rtdb');
    expect(down.items).toHaveLength(20);
    expect(down.items[0].id).toBe('k29');
    expect(down.next).toEqual({ value: DAY + 10, key: 'k10' });
  });

  it('커서로 넘기는 중이면 API 를 묻지 않는다 — 쪽 번호와 섞이지 않게', async () => {
    const { api, calls } = fakeApi(() => PAGE);
    const view = await fetchBugList(api, rtdbList(30), {
      filter: 'all',
      page: 1,
      size: 50,
      before: { value: DAY + 10, key: 'k10' },
    });
    expect(calls).toEqual([]);
    expect(view).toMatchObject({ via: 'rtdb', fallback: 'unavailable', next: null });
    if (view.via !== 'rtdb') throw new Error('rtdb');
    expect(view.items.map((it) => it.id)).toHaveLength(10);

    const offline = await fetchBugList(null, rtdbList(30), {
      filter: 'all',
      page: 1,
      size: 50,
      before: { value: DAY + 10, key: 'k10' },
    });
    expect(offline).toMatchObject({ via: 'rtdb', fallback: 'no-api' });
  });

  it('권한 오류(401 · 403)는 폴백하지 않고 그대로 던진다', async () => {
    const { db, read } = noReadDb();
    await expect(
      fetchBugList(failing(forbidden), db, { filter: 'all', page: 1, size: 20, before: null }),
    ).rejects.toBe(forbidden);
    expect(read).not.toHaveBeenCalled();
  });
});

describe('제보 목록 다시 받기', () => {
  const key = ['bugBoard', 'list', 'open', 1, 20, null, null];
  const stale = (client: QueryClient, k: unknown[]) => client.getQueryState(k)?.isInvalidated;

  it('API 사본으로 읽고 있었으면 바로 한 번 · 사본이 따라온 뒤 한 번 더', () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    client.setQueryData(key, bugListFromApi(PAGE));
    void refreshBugBoard(client, 3000);
    expect(stale(client, key)).toBe(true);

    client.setQueryData(key, bugListFromApi(PAGE)); // 바로 받은 것(아직 옛 사본)
    expect(stale(client, key)).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(stale(client, key)).toBe(true);
  });

  it('예전 방식이면 바로 한 번만', () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const rtdb: BugListView = { via: 'rtdb', fallback: 'unavailable', items: [], next: null };
    client.setQueryData(key, rtdb);
    void refreshBugBoard(client, 3000);
    expect(stale(client, key)).toBe(true);
    client.setQueryData(key, rtdb);
    vi.advanceTimersByTime(3000);
    expect(stale(client, key)).toBe(false);
  });
});
