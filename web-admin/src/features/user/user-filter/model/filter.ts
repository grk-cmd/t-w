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

export const USER_FILTERS: { id: UserFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'licensed', label: '라이선스 사용 중' },
  { id: 'revoked', label: '회수 · 없는 키' },
  { id: 'no-license', label: '라이선스 없음' },
  { id: 'no-account', label: '계정 없음' },
  { id: 'dup-license', label: '키 중복' },
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
