import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { REPLICA_LAG_MS } from '@/shared/api';
import type { License } from '../model/license';
import type { LicensePageQuery, LicensePageView, LicenseStatsView } from '../model/licenseView';
import { LICENSES_KEY } from './firebase';
import { useLicensePort } from './index';

const STATS_KEY = ['licenseStats'];
const PAGE_KEY = ['licensePage'];

export function useLicenses() {
  const port = useLicensePort();
  return useQuery({ queryKey: LICENSES_KEY, queryFn: () => port.list() });
}

/** 필요할 때만 통째 목록을 받는 함수 — 화면을 열기만 해서 받지 않게(일괄 발급은 파일을 고른 뒤에만). */
export function useLoadAllLicenses(): () => Promise<Record<string, License>> {
  const port = useLicensePort();
  return () => port.all();
}

export function useLicenseStats() {
  const port = useLicensePort();
  return useQuery({ queryKey: STATS_KEY, queryFn: () => port.stats() });
}

export function useLicensePage(query: LicensePageQuery) {
  const port = useLicensePort();
  return useQuery({
    queryKey: [...PAGE_KEY, query.page, query.size, query.q.trim()],
    queryFn: () => port.page(query),
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
