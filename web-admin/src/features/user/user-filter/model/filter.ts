import { NO_PERIOD, type Period, type PeriodField, type UserFilter } from '@/entities/user';

// 칩의 거르기 규칙(filterUsers)은 API 와 예전 방식이 같이 써야 해서 entities/user 에 있다 — 여기는 칩 이름만.
export {
  filterUsers,
  hasPeriod,
  inPeriod,
  NO_PERIOD,
  periodRange,
  type Period,
  type PeriodField,
  type UserFilter,
} from '@/entities/user';

export interface FilterChip {
  id: UserFilter;
  label: string;
}

export const USER_FILTERS: FilterChip[] = [
  { id: 'all', label: '전체' },
  { id: 'licensed', label: '라이선스 사용 중' },
  { id: 'revoked', label: '회수 · 없는 키' },
  { id: 'no-license', label: '라이선스 없음' },
  { id: 'no-account', label: '계정 없음' },
  { id: 'dup-license', label: '키 중복' },
];

/** API 판 칩 — 서버 모델에 «계정 없음» · «키 중복» 이 없다(모든 계정에 로그인이 있고 키 주인은 한 명). */
export const SERVER_USER_FILTERS: FilterChip[] = [
  { id: 'all', label: '전체' },
  { id: 'licensed', label: '라이선스 사용 중' },
  { id: 'revoked', label: '회수된 키' },
  { id: 'no-license', label: '라이선스 없음' },
];

export const PERIOD_FIELDS: { id: PeriodField; label: string }[] = [
  { id: 'joined', label: '가입일' },
  { id: 'seen', label: '마지막 접속' },
];

export interface UserSearch {
  text: string;
  period: Period;
}

export const NO_SEARCH: UserSearch = { text: '', period: NO_PERIOD };
