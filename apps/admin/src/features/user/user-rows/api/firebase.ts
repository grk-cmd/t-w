import type { QueryClient } from '@tanstack/react-query';
import { listAccountSnaps } from '@/entities/account';
import { listLicenses } from '@/entities/license';
import {
  buildUserRows,
  listFriendCodes,
  pageFromApi,
  pageFromRows,
  queryUsers,
  rowFromApi,
  statsFromApi,
  statsFromRows,
  USER_QUERY_MAX,
  type ApiUserPage,
  type ApiUserStats,
  type UserPageView,
  type UserQuery,
  type UserRow,
  type UserSource,
  type UserStatsView,
} from '@/entities/user';
import { viaApiOr, type Api, type ApiParams, type Db } from '@/shared/api';
import type { UserRowsPagedPort } from './port';

// 사용자 목록 읽기 — API(읽기 사본)를 먼저, 닿지 못하면(또는 이 환경에 없으면) 예전 방식(RTDB 통째 → 화면에서 거름)으로.
// 권한 · 요청 오류(401 · 403 · 400)는 넘어가지 않고 그대로 던진다(라이선스 화면과 같은 규칙).

export const USERS_PATH = '/v1/admin/users';
/** 서버 size 상한(UserRequest.MAX_SIZE) — 조건에 맞는 사람을 전부 받을 때(기간 검색) 한 번에 이만큼씩. */
export const USERS_BATCH = 500;
/** 서버 codes 상한(UserRequest.MAX_CODES). */
export const CODES_MAX = 100;

/** 전체 줄을 RTDB 에서(캐시가 있으면 캐시) — 예전 방식 · 폴백 전용. */
export type LoadAllRows = () => Promise<UserRow[]>;

/** 화면 조건 → 쿼리. 기본값(전체 · 빈 검색어 · 버전 없음)은 보내지 않는다. */
export function queryParams(query: UserQuery): ApiParams {
  return {
    q: query.q.trim().slice(0, USER_QUERY_MAX) || undefined,
    filter: query.filter === 'all' ? undefined : query.filter,
    // null = 버전 기록 없는 계정 — 서버는 «none» 으로 받는다
    ver: query.ver === undefined ? undefined : (query.ver ?? 'none'),
    // 기본(최근부터)은 보내지 않는다 — «키 중복» 은 서버가 키 순서로 정한다
    sort: query.order === 'asc' && query.filter !== 'dup-license' ? 'lastSeen,asc' : undefined,
  };
}

export function fetchUserPage(
  api: Api | null,
  loadAll: LoadAllRows,
  query: UserQuery,
  page: number,
  size: number,
): Promise<UserPageView> {
  return viaApiOr(
    api,
    async (a) => pageFromApi(await a.get<ApiUserPage>(USERS_PATH, { ...queryParams(query), page, size })),
    async (fallback) => pageFromRows(await loadAll(), query, page, size, fallback),
  );
}

export function fetchUserStats(api: Api | null, loadAll: LoadAllRows): Promise<UserStatsView> {
  return viaApiOr(
    api,
    async (a) => statsFromApi(await a.get<ApiUserStats>(`${USERS_PATH}/stats`)),
    async (fallback) => statsFromRows(await loadAll(), fallback),
  );
}

export interface AllUsersView {
  rows: UserRow[];
  source: UserSource;
}

/** 조건에 맞는 사람 전부(기간 검색용) — API 는 USERS_BATCH 씩 쪽을 넘겨 모은다. */
export function fetchAllUsers(
  api: Api | null,
  loadAll: LoadAllRows,
  query: UserQuery,
): Promise<AllUsersView> {
  return viaApiOr<AllUsersView>(
    api,
    async (a) => {
      const get = (page: number) =>
        a.get<ApiUserPage>(USERS_PATH, { ...queryParams(query), page, size: USERS_BATCH });
      const first = await get(1);
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => get(i + 2)),
      );
      return { rows: [first, ...rest].flatMap((p) => p.items.map(rowFromApi)), source: { via: 'api' } };
    },
    async (fallback) => ({ rows: queryUsers(await loadAll(), query), source: { via: 'rtdb', fallback } }),
  );
}

/** 사용자코드로 찾기(상세 창). 목록에 없는 사람은 빠진다 — CODES_MAX 씩 나눠 묻는다. */
export function fetchUsersByCode(
  api: Api | null,
  loadAll: LoadAllRows,
  codes: readonly string[],
): Promise<Map<string, UserRow>> {
  const unique = [...new Set(codes)].filter(Boolean);
  if (!unique.length) return Promise.resolve(new Map());
  return viaApiOr(
    api,
    async (a) => {
      const chunks = Array.from({ length: Math.ceil(unique.length / CODES_MAX) }, (_, i) =>
        unique.slice(i * CODES_MAX, (i + 1) * CODES_MAX),
      );
      const pages = await Promise.all(
        chunks.map((chunk) => a.get<ApiUserPage>(USERS_PATH, { codes: chunk.join(','), size: CODES_MAX })),
      );
      return new Map(pages.flatMap((p) => p.items.map((item) => [item.userCode, rowFromApi(item)] as const)));
    },
    async () => {
      const want = new Set(unique);
      return new Map((await loadAll()).filter((r) => want.has(r.userCode)).map((r) => [r.userCode, r]));
    },
  );
}

/** 같은 키를 쓰는 사람들(본인 포함, 최근 접속 순). */
export function fetchLicenseUsers(
  api: Api | null,
  loadAll: LoadAllRows,
  license: string,
): Promise<UserRow[]> {
  return viaApiOr(
    api,
    async (a) => (await a.get<ApiUserPage>(USERS_PATH, { license, size: CODES_MAX })).items.map(rowFromApi),
    async () => (await loadAll()).filter((r) => r.license === license),
  );
}

/** Firebase 판 — 지금 코드 그대로: 옛 API 를 먼저, 닿지 못하면 RTDB 통째 → 화면에서 거름. */
/** 통째 목록 셋을 캐시에서(없거나 무효면 받아서) 사용자 한 줄씩으로 — API 를 못 쓸 때만 불린다. */
export function loadAllRowsFrom(client: QueryClient, db: Db): LoadAllRows {
  return async () => {
    const get = <T>(queryKey: string[], queryFn: () => Promise<T>) =>
      client.fetchQuery({ queryKey, queryFn, staleTime: Infinity });
    const [accounts, friendCodes, licenses] = await Promise.all([
      get(['accountSnap'], () => listAccountSnaps(db)),
      get(['friendCodes'], () => listFriendCodes(db)),
      get(['licenses'], () => listLicenses(db)),
    ]);
    return buildUserRows(accounts, friendCodes, licenses);
  };
}

export function createFirebaseUserRowsPort(api: Api | null, loadAll: LoadAllRows): UserRowsPagedPort {
  return {
    kind: 'paged',
    page: (query, page, size) => fetchUserPage(api, loadAll, query, page, size),
    all: (query) => fetchAllUsers(api, loadAll, query),
    stats: () => fetchUserStats(api, loadAll),
    byCodes: (codes) => fetchUsersByCode(api, loadAll, codes),
    sameLicense: (license) => fetchLicenseUsers(api, loadAll, license),
  };
}
