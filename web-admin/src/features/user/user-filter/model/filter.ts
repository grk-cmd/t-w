import { licenseUseCounts, type UserRow } from '@/entities/user';

export type UserFilter = 'all' | 'licensed' | 'revoked' | 'no-license' | 'no-account' | 'dup-license';

export const USER_FILTERS: { id: UserFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'licensed', label: '라이선스 사용 중' },
  { id: 'revoked', label: '회수 · 없는 키' },
  { id: 'no-license', label: '라이선스 없음' },
  { id: 'no-account', label: '계정 없음' },
  { id: 'dup-license', label: '키 중복' },
];

function matchesFilter(row: UserRow, filter: UserFilter, counts: Map<string, number>): boolean {
  switch (filter) {
    case 'dup-license':
      return Boolean(row.license && (counts.get(row.license) ?? 0) > 1);
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

/** counts 는 rows 전체로 센 키별 사용자 수 — 글자 검색으로 좁혀도 중복 여부는 전체 기준이다. */
export function filterUsers(
  rows: UserRow[],
  filter: UserFilter,
  search: string,
  counts: Map<string, number> = licenseUseCounts(rows),
): UserRow[] {
  const needle = search.trim().toLowerCase();
  const found = rows.filter(
    (row) =>
      matchesFilter(row, filter, counts) &&
      (!needle ||
        [row.name, row.friendCode, row.userCode, row.license].some((v) => v?.toLowerCase().includes(needle))),
  );
  // 같은 키끼리 붙여 본다. sort 는 안정 정렬이라 키 안에서는 원래(최근 순) 순서가 남는다.
  if (filter === 'dup-license') found.sort((a, b) => (a.license ?? '').localeCompare(b.license ?? ''));
  return found;
}

export type PeriodField = 'joined' | 'seen';

export const PERIOD_FIELDS: { id: PeriodField; label: string }[] = [
  { id: 'joined', label: '가입일' },
  { id: 'seen', label: '마지막 접속' },
];

/** 날짜 칸 값(YYYY-MM-DD, 비면 열림). 끝 날짜는 그날 끝까지 — 이 컴퓨터 시간대로. */
export interface Period {
  field: PeriodField;
  from: string;
  to: string;
}

export const NO_PERIOD: Period = { field: 'joined', from: '', to: '' };

export const hasPeriod = (p: Period) => Boolean(p.from || p.to);

export function periodRange(p: Period): { start: number; end: number } {
  const day = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  return {
    start: p.from ? day(p.from) : -Infinity,
    end: p.to ? day(p.to) + 24 * 60 * 60 * 1000 - 1 : Infinity,
  };
}

/** 기록이 없는(null) 사람은 기간을 걸면 빠진다. */
export function inPeriod(ts: number | null | undefined, p: Period): boolean {
  if (!hasPeriod(p)) return true;
  if (typeof ts !== 'number') return false;
  const { start, end } = periodRange(p);
  return ts >= start && ts <= end;
}

export interface UserSearch {
  text: string;
  period: Period;
}

export const NO_SEARCH: UserSearch = { text: '', period: NO_PERIOD };
