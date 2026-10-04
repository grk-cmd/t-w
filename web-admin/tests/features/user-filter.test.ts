import { describe, expect, it } from 'vitest';
import { buildUserRows } from '@/entities/user';
import { filterUsers, type UserFilter } from '@/features/user-filter';
import { accounts, friendCodes, licenses } from '../shared/userFixtures';

const rows = buildUserRows(accounts, friendCodes, licenses);
const ids = (filter: UserFilter, search = '') => filterUsers(rows, filter, search).map((r) => r.userCode);

describe('사용자 필터 · 검색', () => {
  it('필터', () => {
    expect(ids('licensed')).toEqual(['u1']);
    expect(ids('revoked')).toEqual(['u2', 'u4']);
    expect(ids('no-license')).toEqual(['u3']);
    expect(ids('no-account')).toEqual(['u9']);
  });

  it('검색은 이름 · 친구코드 · 사용자코드 · 키', () => {
    expect(ids('all', '다라')).toEqual(['u2']);
    expect(ids('all', 'cccc')).toEqual(['u3']);
    expect(ids('all', 'key-1')).toEqual(['u1']);
  });
});
