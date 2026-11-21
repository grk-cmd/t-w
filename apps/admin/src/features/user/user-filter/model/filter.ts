import type { UserFilter } from '@/entities/user';

// 칩의 거르기 규칙(filterUsers)은 API 와 예전 방식이 같이 써야 해서 entities/user 에 있다 — 여기는 칩 이름만.
export { filterUsers, type UserFilter } from '@/entities/user';

export const USER_FILTERS: { id: UserFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'licensed', label: '라이선스 사용 중' },
  { id: 'revoked', label: '회수 · 없는 키' },
  { id: 'no-license', label: '라이선스 없음' },
  { id: 'no-account', label: '계정 없음' },
  { id: 'dup-license', label: '키 중복' },
];

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
