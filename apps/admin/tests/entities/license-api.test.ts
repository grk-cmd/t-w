import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchLicensePage,
  fetchLicenseStats,
  patchLicenseRows,
  refreshLicenses,
  rowFromApi,
  sourceNote,
  type ApiLicensePage,
  type License,
  type LicensePageView,
  type LicenseStatsView,
} from '@/entities/license';
import { ApiError, type Api, type ApiParams } from '@/shared/api';

// RTDB 통째 목록(예전 방식) — 같은 것을 API 가 돌려준다고 보고 두 길의 결과를 견준다.
const ALL: Record<string, License> = {
  'AAAA-0001': { valid: true, note: '철수', createdAt: 1000, redeemedAt: 5000 },
  'BBBB-0002': { valid: true, note: '', createdAt: 3000, redeemedAt: null },
  'CCCC-0003': { valid: false, note: '영희', createdAt: 2000, revokedAt: 6000 },
};

const iso = (ms: number) => new Date(ms).toISOString();

const STATS = {
  total: 3,
  valid: 2,
  used: 1,
  unused: 1,
  revoked: 1,
  holders: 1,
  syncedAt: '2026-10-13T01:02:03Z',
  snapshotAt: '2026-10-13T01:00:00Z',
};

const PAGE: ApiLicensePage = {
  items: [
    {
      key: 'BBBB-0002',
      status: 'unused',
      note: null,
      createdAt: iso(3000),
      redeemedAt: null,
      revokedAt: null,
      users: [],
    },
    {
      key: 'CCCC-0003',
      status: 'revoked',
      note: '영희',
      createdAt: iso(2000),
      redeemedAt: null,
      revokedAt: iso(6000),
      users: [],
    },
  ],
  page: 1,
  size: 2,
  total: 3,
  totalPages: 2,
};

function fakeApi(respond: (path: string, params?: ApiParams) => unknown) {
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

const unavailable = new ApiError('unavailable', 0, '', 'API 에 연결하지 못했어요');
const forbidden = new ApiError('auth', 403, 'ACCESS_DENIED', '접근 권한이 없습니다.');

describe('라이선스 통계 — API · 폴백', () => {
  it('API 숫자를 그대로, 기준 시각은 syncedAt', async () => {
    const loadAll = vi.fn(async () => ALL);
    const { api, calls } = fakeApi(() => STATS);

    const view = await fetchLicenseStats(api, loadAll);

    expect(calls).toEqual([['/v1/admin/licenses/stats', undefined]]);
    expect(view.counts).toEqual({ total: 3, valid: 2, used: 1, unused: 1, revoked: 1 });
    expect(view.syncedAt).toBe(Date.parse('2026-10-13T01:02:03Z'));
    expect(view.source).toEqual({ via: 'api' });
    // API 로 읽으면 RTDB 통째 읽기를 하지 않는다
    expect(loadAll).not.toHaveBeenCalled();
  });

  it('예전 방식으로 센 숫자와 같다', async () => {
    const viaApi = await fetchLicenseStats(fakeApi(() => STATS).api, async () => ALL);
    const viaRtdb = await fetchLicenseStats(null, async () => ALL);
    expect(viaRtdb.counts).toEqual(viaApi.counts);
  });

  it('API 가 없으면(dev) · 닿지 못하면 통째 읽기로, 이유를 남긴다', async () => {
    const none = await fetchLicenseStats(null, async () => ALL);
    const down = await fetchLicenseStats(failing(unavailable), async () => ALL);
    expect(none.source).toEqual({ via: 'rtdb', fallback: 'no-api' });
    expect(down.source).toEqual({ via: 'rtdb', fallback: 'unavailable' });
    expect(down.syncedAt).toBeNull();
  });

  it('권한 오류(401 · 403)는 폴백하지 않고 그대로 던진다', async () => {
    const loadAll = vi.fn(async () => ALL);
    await expect(fetchLicenseStats(failing(forbidden), loadAll)).rejects.toBe(forbidden);
    expect(loadAll).not.toHaveBeenCalled();
  });
});

describe('라이선스 목록 — API · 폴백', () => {
  it('쪽 · 개수 · 검색어(앞뒤 공백 뺌) · 최근 발급부터 정렬로 묻고, 칸을 화면 모양으로 바꾼다', async () => {
    const { api, calls } = fakeApi(() => PAGE);

    const view = await fetchLicensePage(api, async () => ALL, { page: 1, size: 2, q: '  영희 ' });

    expect(calls).toEqual([['/v1/admin/licenses', { page: 1, size: 2, q: '영희', sort: 'createdAt,desc' }]]);
    expect(view.items).toEqual([
      {
        key: 'BBBB-0002',
        status: 'unused',
        note: '',
        createdAt: 3000,
        redeemedAt: undefined,
        revokedAt: undefined,
      },
      {
        key: 'CCCC-0003',
        status: 'revoked',
        note: '영희',
        createdAt: 2000,
        redeemedAt: undefined,
        revokedAt: 6000,
      },
    ]);
    expect([view.page, view.pageCount, view.total]).toEqual([1, 2, 3]);
  });

  it('검색어가 비면 q 를 싣지 않는다 · 100자 넘으면 자른다', async () => {
    const { api, calls } = fakeApi(() => PAGE);
    await fetchLicensePage(api, async () => ALL, { page: 1, size: 20, q: '   ' });
    await fetchLicensePage(api, async () => ALL, { page: 1, size: 20, q: 'x'.repeat(150) });
    expect(calls[0][1]?.q).toBeUndefined();
    expect(String(calls[1][1]?.q)).toHaveLength(100);
  });

  it('폴백은 예전처럼 키 · 메모 검색 · 최근 발급부터 · 쪽 자르기 — API 첫 쪽과 같은 줄', async () => {
    const viaApi = await fetchLicensePage(fakeApi(() => PAGE).api, async () => ALL, {
      page: 1,
      size: 2,
      q: '',
    });
    const viaRtdb = await fetchLicensePage(failing(unavailable), async () => ALL, {
      page: 1,
      size: 2,
      q: '',
    });
    expect(viaRtdb.items.map((r) => [r.key, r.status, r.createdAt])).toEqual(
      viaApi.items.map((r) => [r.key, r.status, r.createdAt]),
    );
    expect([viaRtdb.total, viaRtdb.pageCount]).toEqual([3, 2]);
    expect(viaRtdb.source).toEqual({ via: 'rtdb', fallback: 'unavailable' });

    const searched = await fetchLicensePage(null, async () => ALL, { page: 1, size: 20, q: '철수' });
    expect(searched.items.map((r) => r.key)).toEqual(['AAAA-0001']);
    // 넘친 쪽은 끝 쪽으로
    const over = await fetchLicensePage(null, async () => ALL, { page: 9, size: 2, q: '' });
    expect([over.page, over.items.map((r) => r.key)]).toEqual([2, ['AAAA-0001']]);
  });

  it('권한 오류는 폴백하지 않는다', async () => {
    await expect(
      fetchLicensePage(failing(forbidden), async () => ALL, { page: 1, size: 20, q: '' }),
    ).rejects.toBe(forbidden);
  });

  it('모르는 상태가 오면 시각 칸으로 짐작한다', () => {
    const base = { key: 'K', note: null, createdAt: null, redeemedAt: null, revokedAt: null, users: [] };
    expect(rowFromApi({ ...base, status: 'expired', revokedAt: iso(1) }).status).toBe('revoked');
    expect(rowFromApi({ ...base, status: 'expired', redeemedAt: iso(1) }).status).toBe('used');
    expect(rowFromApi({ ...base, status: 'expired' }).status).toBe('unused');
  });
});

describe('어디서 읽었는지 안내', () => {
  it('API 면 기준 시각, 폴백이면 이유', () => {
    expect(sourceNote({ via: 'api' }, new Date(2026, 9, 13, 9, 5, 7).getTime())).toBe('기준 09:05:07');
    expect(sourceNote({ via: 'api' }, null)).toContain('기준 시각 없음');
    expect(sourceNote({ via: 'rtdb', fallback: 'unavailable' }, null)).toBe(
      'API 연결 안 됨 — 예전 방식으로 읽는 중',
    );
    expect(sourceNote({ via: 'rtdb', fallback: 'no-api' }, null)).toContain('예전 방식으로 읽는 중');
  });
});

describe('쓰기 뒤 목록 맞추기', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const pageView = (via: 'api' | 'rtdb'): LicensePageView => ({
    items: [
      { key: 'A', status: 'unused', note: '' },
      { key: 'B', status: 'used', note: '' },
    ],
    page: 1,
    pageCount: 1,
    total: 2,
    source: via === 'api' ? { via: 'api' } : { via: 'rtdb', fallback: 'no-api' },
  });

  it('회수는 받아 둔 줄을 바로 회수됨으로, 삭제는 줄을 뺀다(낙관적 갱신)', () => {
    const client = new QueryClient();
    client.setQueryData(['licensePage', 1, 20, ''], pageView('api'));

    patchLicenseRows(client, ['A'], 'revoked', 99);
    expect(client.getQueryData<LicensePageView>(['licensePage', 1, 20, ''])?.items[0]).toEqual({
      key: 'A',
      status: 'revoked',
      note: '',
      revokedAt: 99,
    });

    patchLicenseRows(client, ['B', 'Z'], 'removed');
    const after = client.getQueryData<LicensePageView>(['licensePage', 1, 20, '']);
    expect([after?.items.map((r) => r.key), after?.total]).toEqual([['A'], 1]);
  });

  it('API 로 읽고 있었으면 사본이 따라올 때까지 기다렸다 다시 읽고, 예전 방식이면 바로', () => {
    vi.useFakeTimers();
    const stale = (client: QueryClient, key: unknown[]) => client.getQueryState(key)?.isInvalidated;

    const viaApi = new QueryClient();
    viaApi.setQueryData(['licenseStats'], { source: { via: 'api' } } as LicenseStatsView);
    viaApi.setQueryData(['licenses'], ALL);
    refreshLicenses(viaApi, 3000);
    expect(stale(viaApi, ['licenses'])).toBe(true); // 원본은 바로
    expect(stale(viaApi, ['licenseStats'])).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(stale(viaApi, ['licenseStats'])).toBe(true);

    const viaRtdb = new QueryClient();
    viaRtdb.setQueryData(['licensePage', 1, 20, ''], pageView('rtdb'));
    refreshLicenses(viaRtdb, 3000);
    expect(stale(viaRtdb, ['licensePage', 1, 20, ''])).toBe(true);
  });
});
