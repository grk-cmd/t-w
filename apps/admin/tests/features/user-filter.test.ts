import { describe, expect, it } from 'vitest';
import { buildUserRows } from '@/entities/user';
import { filterUsers, hasPeriod, inPeriod, NO_PERIOD, type UserFilter } from '@/features/user/user-filter';
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

  it('키 중복 — 같은 키를 2명 이상이 쓰는 사람만, 키끼리 모아 그 안은 최근 순', () => {
    const dup = buildUserRows(
      {
        ...accounts,
        u5: { name: '자차', license: ' key-1 ', ts: 25 },
        u6: { name: '카타', license: 'GONE', ts: 1 },
      },
      friendCodes,
      licenses,
    );
    const dupIds = (search = '') => filterUsers(dup, 'dup-license', search).map((r) => r.userCode);
    expect(dupIds()).toEqual(['u4', 'u6', 'u1', 'u5']);
    // 글자로 좁혀도 중복 여부는 전체 기준 — 한 명만 남아도 그 사람은 중복 키를 쓴다.
    expect(dupIds('자차')).toEqual(['u5']);
    expect(ids('dup-license')).toEqual([]);
  });

  it('검색은 이름 · 친구코드 · 사용자코드 · 키', () => {
    expect(ids('all', '다라')).toEqual(['u2']);
    expect(ids('all', 'cccc')).toEqual(['u3']);
    expect(ids('all', 'key-1')).toEqual(['u1']);
  });
});

describe('기간', () => {
  const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime();

  it('시작일 0시부터 종료일 끝까지, 한쪽만 적으면 그쪽만 막힌다', () => {
    const p = { field: 'joined' as const, from: '2026-10-01', to: '2026-10-31' };
    expect(inPeriod(at(2026, 10, 1), p)).toBe(true);
    expect(inPeriod(at(2026, 10, 31, 23), p)).toBe(true);
    expect(inPeriod(at(2026, 9, 30, 23), p)).toBe(false);
    expect(inPeriod(at(2026, 11, 1), p)).toBe(false);
    expect(inPeriod(at(2020, 1, 1), { ...p, from: '' })).toBe(true);
  });

  it('기간을 걸면 기록이 없는 사람은 빠지고, 안 걸면 모두', () => {
    expect(inPeriod(null, { field: 'seen', from: '2026-10-01', to: '' })).toBe(false);
    expect(inPeriod(null, NO_PERIOD)).toBe(true);
    expect(hasPeriod(NO_PERIOD)).toBe(false);
  });
});
