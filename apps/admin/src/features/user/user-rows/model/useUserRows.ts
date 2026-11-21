import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { listAccountSnaps } from '@/entities/account';
import { listLicenses } from '@/entities/license';
import { buildUserRows, listFriendCodes, type UserQuery, type UserRow } from '@/entities/user';
import { REPLICA_LAG_MS, useApi, useDb, type Db } from '@/shared/api';
import {
  fetchAllUsers,
  fetchLicenseUsers,
  fetchUserPage,
  fetchUsersByCode,
  fetchUserStats,
  type AllUsersView,
  type LoadAllRows,
} from '../api/userList';

/** API 로 읽은 화면들 — 쓰기 직후에는 사본이 따라올 때까지 기다렸다가 다시 읽는다. */
const USERS_KEY = ['users'];

// 예전 방식 · 폴백의 원본 셋. 사용자 화면 · 방 서버 화면 · 라이선스 화면이 같은 캐시를 나눠 쓴다(같은 키).
const RTDB_KEYS = [['accountSnap'], ['friendCodes'], ['licenses']];

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

function useLoadAll(): LoadAllRows {
  return loadAllRowsFrom(useQueryClient(), useDb());
}

// 버전: undefined(좁히지 않음) · null(기록 없음) · 버전 — 셋이 키에서 갈리게.
const queryKeyOf = (query: UserQuery) => [
  query.filter,
  query.q.trim(),
  query.ver === undefined ? '' : (query.ver ?? null),
  query.order ?? 'desc',
];

/** 한 쪽 — API 는 서버가 거르고 자른다, 폴백은 통째로 받아 화면에서. */
export function useUserPage(query: UserQuery, page: number, size: number, enabled = true) {
  const api = useApi();
  const loadAll = useLoadAll();
  return useQuery({
    queryKey: [...USERS_KEY, 'page', ...queryKeyOf(query), page, size],
    queryFn: () => fetchUserPage(api, loadAll, query, page, size),
    // 쪽 · 조건을 바꾸는 동안 앞 목록을 두어 화면이 비었다 찼다 하지 않게
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 전체 사람 수 · 버전별 수. */
export function useUserStats() {
  const api = useApi();
  const loadAll = useLoadAll();
  return useQuery({
    queryKey: [...USERS_KEY, 'stats'],
    queryFn: () => fetchUserStats(api, loadAll),
  });
}

/** 조건에 맞는 사람 전부 — 기간 검색을 걸었을 때만. */
export function useAllUsers(query: UserQuery, enabled: boolean) {
  const api = useApi();
  const loadAll = useLoadAll();
  return useQuery<AllUsersView>({
    queryKey: [...USERS_KEY, 'all', ...queryKeyOf(query)],
    queryFn: () => fetchAllUsers(api, loadAll, query),
    enabled,
  });
}

/** 사용자코드로 찾기 — 목록에 없는 사람(다른 쪽 · 초대한 사람 · 방 서버 지정)을 한 줄로. */
export function useUsersByCode(codes: readonly string[]) {
  const api = useApi();
  const loadAll = useLoadAll();
  const sorted = [...new Set(codes)].sort();
  return useQuery({
    queryKey: [...USERS_KEY, 'codes', sorted.join(',')],
    queryFn: () => fetchUsersByCode(api, loadAll, sorted),
    enabled: sorted.length > 0,
  });
}

/** 한 사람. uid 가 null 이면 묻지 않는다. 찾지 못하면 null. */
export function useUserByCode(uid: string | null) {
  const found = useUsersByCode(uid ? [uid] : []);
  return { ...found, data: uid && found.data ? (found.data.get(uid) ?? null) : undefined };
}

/** 같은 키를 쓰는 다른 사람들(본인 빼고). 키가 없으면 묻지 않는다. */
export function useSameLicenseUsers(row: UserRow) {
  const api = useApi();
  const loadAll = useLoadAll();
  const license = row.license;
  const q = useQuery({
    queryKey: [...USERS_KEY, 'license', license],
    queryFn: () => fetchLicenseUsers(api, loadAll, license!),
    enabled: !!license,
  });
  return { ...q, data: q.data?.filter((r) => r.userCode !== row.userCode) };
}

/** 받아 둔 사용자 목록 중 API 로 읽은 게 있나 — 그렇다면 쓰기 직후 사본이 늦으니 기다렸다 다시 읽는다. */
function readViaApi(client: QueryClient): boolean {
  return client
    .getQueriesData<{ source?: { via: string } }>({ queryKey: USERS_KEY })
    .some(([, data]) => data?.source?.via === 'api');
}

/**
 * 다시 읽기. RTDB 통째 캐시 · 상세 창 칸은 바로 무효로(원본이라 바로 맞다).
 * 목록은 예전 방식으로 읽고 있었으면 바로, API 로 읽고 있었으면 사본이 따라올 때까지 기다렸다 다시 읽는다.
 */
export function refreshUsers(client: QueryClient, lagMs: number = REPLICA_LAG_MS): void {
  // 상세 창만 쓰는 칸(집중 · 시크릿룸 · 신고 수)도 함께 — 열려 있는 창은 바로 다시 읽는다.
  const keys = [...RTDB_KEYS, ['userName'], ['userFocus'], ['userSecretRoom'], ['reports']];
  for (const queryKey of keys) void client.invalidateQueries({ queryKey });
  const again = () => void client.invalidateQueries({ queryKey: USERS_KEY });
  if (lagMs > 0 && readViaApi(client)) setTimeout(again, lagMs);
  else again();
}

/** 계정 삭제 같은 쓰기 뒤. */
export function useRefreshUsers() {
  const client = useQueryClient();
  return () => refreshUsers(client);
}

/** 새로고침 단추 — 사본을 기다릴 까닭이 없으니 지금 바로 전부. */
export function useReloadUsers() {
  const client = useQueryClient();
  return () => refreshUsers(client, 0);
}
