import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { maskKey, REPLICA_LAG_MS, useApi, useDb, viaApiOr, withAudit, type Api, type Db } from '@/shared/api';
import { genLicenseKey, NOTE_MAX, type License } from '../model/license';
import {
  LICENSE_QUERY_MAX,
  pageFromAll,
  pageFromApi,
  statsFromAll,
  statsFromApi,
  type ApiLicensePage,
  type ApiLicenseStats,
  type LicensePageQuery,
  type LicensePageView,
  type LicenseStatsView,
} from '../model/licenseView';

const LICENSES_KEY = ['licenses'];
const STATS_KEY = ['licenseStats'];
const PAGE_KEY = ['licensePage'];

// licenses 는 통째로 받는 노드다(요금 = 내려받은 바이트) — 구독하지 않고 캐시해 두었다가 쓰기 직후에만 다시 받는다.
// 라이선스 화면은 API 로 읽고, 이 통째 읽기는 API 를 못 쓸 때(폴백) · 사용자 화면 · 일괄 발급의 이력 확인에만 쓴다.
export async function listLicenses(db: Db): Promise<Record<string, License>> {
  return (await db.get<Record<string, License>>('licenses')) ?? {};
}

export function useLicenses() {
  const db = useDb();
  return useQuery({ queryKey: LICENSES_KEY, queryFn: () => listLicenses(db) });
}

/** 통째 목록을 캐시에서(없거나 무효면 받아서) — 통계 · 목록 폴백 · 일괄 발급이 같은 한 번을 나눠 쓴다. */
function loadAllFrom(client: QueryClient, db: Db) {
  return () =>
    client.fetchQuery({ queryKey: LICENSES_KEY, queryFn: () => listLicenses(db), staleTime: Infinity });
}

/** 필요할 때만 통째 목록을 받는 함수 — 화면을 열기만 해서 받지 않게(일괄 발급은 파일을 고른 뒤에만). */
export function useLoadAllLicenses() {
  const db = useDb();
  const client = useQueryClient();
  return loadAllFrom(client, db);
}

type LoadAll = () => Promise<Record<string, License>>;

export function fetchLicenseStats(api: Api | null, loadAll: LoadAll): Promise<LicenseStatsView> {
  return viaApiOr(
    api,
    async (a) => statsFromApi(await a.get<ApiLicenseStats>('/v1/admin/licenses/stats')),
    async (fallback) => statsFromAll(await loadAll(), fallback),
  );
}

export function fetchLicensePage(
  api: Api | null,
  loadAll: LoadAll,
  query: LicensePageQuery,
): Promise<LicensePageView> {
  const q = query.q.trim().slice(0, LICENSE_QUERY_MAX);
  return viaApiOr(
    api,
    async (a) =>
      pageFromApi(
        await a.get<ApiLicensePage>('/v1/admin/licenses', {
          page: query.page,
          size: query.size,
          q: q || undefined,
          // 예전 화면(filterLicenses)과 같은 순서 — 최근 발급부터
          sort: 'createdAt,desc',
        }),
      ),
    async (fallback) => pageFromAll(await loadAll(), { ...query, q }, fallback),
  );
}

export function useLicenseStats() {
  const api = useApi();
  const loadAll = useLoadAllLicenses();
  return useQuery({ queryKey: STATS_KEY, queryFn: () => fetchLicenseStats(api, loadAll) });
}

export function useLicensePage(query: LicensePageQuery) {
  const api = useApi();
  const loadAll = useLoadAllLicenses();
  return useQuery({
    queryKey: [...PAGE_KEY, query.page, query.size, query.q.trim()],
    queryFn: () => fetchLicensePage(api, loadAll, query),
    // 쪽 · 검색어를 바꾸는 동안 앞 목록을 두어 화면이 비었다 찼다 하지 않게
    placeholderData: keepPreviousData,
  });
}

/** 받아 둔 것 중 API 로 읽은 게 있나 — 그렇다면 쓰기 직후 사본이 늦으니 기다렸다 다시 읽는다. */
function readViaApi(client: QueryClient): boolean {
  return [STATS_KEY, PAGE_KEY].some((queryKey) =>
    client
      .getQueriesData<LicenseStatsView | LicensePageView>({ queryKey })
      .some(([, data]) => data?.source.via === 'api'),
  );
}

/**
 * 쓰기 뒤 다시 읽기. RTDB 통째 캐시는 바로 무효로(원본이라 바로 맞다).
 * 통계 · 목록은 예전 방식으로 읽고 있었으면 바로, API 로 읽고 있었으면 사본이 따라올 때까지 기다렸다 다시 읽는다.
 */
export function refreshLicenses(client: QueryClient, lagMs: number = REPLICA_LAG_MS): void {
  void client.invalidateQueries({ queryKey: LICENSES_KEY });
  const again = () => {
    void client.invalidateQueries({ queryKey: STATS_KEY });
    void client.invalidateQueries({ queryKey: PAGE_KEY });
  };
  if (readViaApi(client)) setTimeout(again, lagMs);
  else again();
}

export function useRefreshLicenses() {
  const client = useQueryClient();
  return () => refreshLicenses(client);
}

/** 새로고침 단추 — 사본을 기다릴 까닭이 없으니 지금 바로 전부. */
export function useReloadLicenses() {
  const client = useQueryClient();
  return () => refreshLicenses(client, 0);
}

/**
 * 회수 · 삭제를 받아 둔 목록에 먼저 반영한다(낙관적 갱신) — API 사본이 따라오기 전에 줄이 옛 상태로 남아 있지 않게.
 * 몇 초 뒤 refreshLicenses 가 서버 값으로 덮는다.
 */
export function patchLicenseRows(
  client: QueryClient,
  keys: readonly string[],
  change: 'revoked' | 'removed',
  at: number = Date.now(),
): void {
  const hit = new Set(keys);
  client.setQueriesData<LicensePageView>({ queryKey: PAGE_KEY }, (view) => {
    if (!view) return view;
    if (change === 'removed') {
      const items = view.items.filter((row) => !hit.has(row.key));
      return { ...view, items, total: Math.max(0, view.total - (view.items.length - items.length)) };
    }
    return {
      ...view,
      items: view.items.map((row) =>
        hit.has(row.key) ? { ...row, status: 'revoked' as const, revokedAt: row.revokedAt ?? at } : row,
      ),
    };
  });
}

/** 새 키 한 장을 쓸 내용. 다른 쓰기와 한 묶음(db.commit)으로 보낼 수 있게 경로 → 값으로 돌려준다. */
export function newLicenseWrite(db: Db, note: string, genKey: () => string = genLicenseKey) {
  const key = genKey();
  const write = {
    [`licenses/${key}`]: {
      valid: true,
      note: note.slice(0, NOTE_MAX),
      createdAt: db.now(),
      redeemedAt: null,
    },
  };
  return { key, write };
}

export async function createLicense(db: Db, note: string, genKey?: () => string): Promise<string> {
  const { key, write } = newLicenseWrite(db, note, genKey);
  await db.commit(withAudit(db, write, 'license.issue', maskKey(key)));
  return key;
}

/** 여러 키 회수 — 한 묶음(db.commit)으로 보낼 경로 → 값. */
export function revokeLicensesWrite(db: Db, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[`licenses/${key}/valid`] = false;
    out[`licenses/${key}/revokedAt`] = db.now();
  }
  return out;
}

export function removeLicensesWrite(keys: readonly string[]): Record<string, null> {
  return Object.fromEntries(keys.map((key) => [`licenses/${key}`, null]));
}
