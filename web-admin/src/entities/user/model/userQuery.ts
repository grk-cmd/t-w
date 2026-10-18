import type { UserRow } from './userRow';
import { matchesVer } from './version';

// 사용자 목록의 거르기 · 검색 — API(읽기 사본)와 예전 방식(RTDB 통째)이 같은 결과를 내야 해서 여기 한 곳에 둔다.
// 서버 쪽 같은 규칙: t-w-server api/ UserDirectoryRepositoryImpl.

export type UserFilter = 'all' | 'licensed' | 'revoked' | 'no-license' | 'no-account' | 'dup-license';

/** undefined = 버전으로 좁히지 않음 · null = 버전 기록 없음. */
export type VerFilter = string | null | undefined;

function matchesFilter(row: UserRow, filter: UserFilter): boolean {
  switch (filter) {
    case 'dup-license':
      return row.licenseUsers > 1;
    case 'licensed':
      return row.licenseState === 'unused' || row.licenseState === 'used';
    case 'revoked':
      return row.licenseState === 'revoked' || row.licenseState === 'unknown';
    case 'no-license':
      return row.hasAccount && row.licenseState === 'none';
    case 'no-account':
      return !row.hasAccount;
    default:
      return true;
  }
}

/** 키 중복 여부(licenseUsers)는 rows 전체로 센 값 — 글자 검색으로 좁혀도 전체 기준이다. */
export function filterUsers(rows: UserRow[], filter: UserFilter, search: string): UserRow[] {
  const needle = search.trim().toLowerCase();
  const found = rows.filter(
    (row) =>
      matchesFilter(row, filter) &&
      (!needle ||
        [row.name, row.friendCode, row.userCode, row.license].some((v) => v?.toLowerCase().includes(needle))),
  );
  // 같은 키끼리 붙여 본다. sort 는 안정 정렬이라 키 안에서는 원래(최근 순) 순서가 남는다.
  if (filter === 'dup-license') found.sort((a, b) => (a.license ?? '').localeCompare(b.license ?? ''));
  return found;
}

/** 목록 조건 — 칩 · 검색어 · 버전 칩. */
/** 마지막 접속 순서 — 기본은 최근부터. */
export type LastSeenOrder = 'desc' | 'asc';

export interface UserQuery {
  filter: UserFilter;
  q: string;
  ver: VerFilter;
  /** 없으면 desc. «키 중복» 은 같은 키끼리 붙이는 순서가 먼저다. */
  order?: LastSeenOrder;
}

export const ALL_USERS: UserQuery = { filter: 'all', q: '', ver: undefined };

/** 서버 검색어 상한(UserRequest.MAX_QUERY) — 넘기면 400 이라 미리 자른다. */
export const USER_QUERY_MAX = 100;

export function queryUsers(rows: UserRow[], query: UserQuery): UserRow[] {
  const found = filterUsers(rows, query.filter, query.q.slice(0, USER_QUERY_MAX));
  const byVer =
    query.ver === undefined ? found : found.filter((r) => matchesVer(r, query.ver as string | null));
  // rows 는 최근 순으로 온다(buildUserRows) — 오래된 순은 뒤집기만 한다.
  return query.order === 'asc' && query.filter !== 'dup-license' ? [...byVer].reverse() : byVer;
}
