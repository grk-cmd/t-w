import type { UserRow } from '@/entities/user';

export type UserFilter = 'all' | 'licensed' | 'revoked' | 'no-license' | 'no-account';

export const USER_FILTERS: { id: UserFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'licensed', label: '라이선스 사용 중' },
  { id: 'revoked', label: '회수 · 없는 키' },
  { id: 'no-license', label: '라이선스 없음' },
  { id: 'no-account', label: '계정 없음' },
];

function matchesFilter(row: UserRow, filter: UserFilter): boolean {
  switch (filter) {
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

export function filterUsers(rows: UserRow[], filter: UserFilter, search: string): UserRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      matchesFilter(row, filter) &&
      (!needle ||
        [row.name, row.friendCode, row.userCode, row.license].some((v) => v?.toLowerCase().includes(needle))),
  );
}
