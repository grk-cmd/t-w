// Firebase 판 — 지금 코드 그대로: 통째 목록 읽기 · 통계 · 목록 한 쪽(API 를 못 쓸 때 통째 폴백) · 키 쓰기 내용.
import type { QueryClient } from '@tanstack/react-query';
import { maskKey, viaApiOr, withAudit, type Api, type Db } from '@/shared/api';
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
import { LICENSES_KEY } from './keys';
import type { LicensePort } from './port';

// licenses 는 통째로 받는 노드다(요금 = 내려받은 바이트) — 구독하지 않고 캐시해 두었다가 쓰기 직후에만 다시 받는다.
// 라이선스 화면은 API 로 읽고, 이 통째 읽기는 API 를 못 쓸 때(폴백) · 사용자 화면 · 일괄 발급의 이력 확인에만 쓴다.
export async function listLicenses(db: Db): Promise<Record<string, License>> {
  return (await db.get<Record<string, License>>('licenses')) ?? {};
}

/** 통째 목록을 캐시에서(없거나 무효면 받아서) — 통계 · 목록 폴백 · 일괄 발급이 같은 한 번을 나눠 쓴다. */
export function loadAllFrom(client: QueryClient, db: Db) {
  return () =>
    client.fetchQuery({ queryKey: LICENSES_KEY, queryFn: () => listLicenses(db), staleTime: Infinity });
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

export function createFirebaseLicensePort(db: Db, api: Api | null, client: QueryClient): LicensePort {
  const all = loadAllFrom(client, db);
  return {
    stats: () => fetchLicenseStats(api, all),
    page: (query) => fetchLicensePage(api, all, query),
  };
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
