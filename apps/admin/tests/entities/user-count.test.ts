import { describe, expect, it } from 'vitest';
import { countLicenses } from '@/entities/license';
import { getUserCount } from '@/entities/user-count';
import { fakeDb } from '../shared/fakeDb';

describe('전체 통계', () => {
  it('키는 redeemedAt · valid 로 센다 — usedBy 는 보지 않는다', () => {
    expect(
      countLicenses({
        A: { valid: true, redeemedAt: 1 },
        B: { valid: true, redeemedAt: null },
        C: { valid: false, redeemedAt: 1 },
        D: { valid: true },
        E: { valid: true, usedBy: 'u1' } as never,
      }),
    ).toEqual({ total: 5, valid: 4, used: 1, unused: 3, revoked: 1 });
  });

  it('가입 수는 stats/userCount 한 칸만 읽고, 없으면 0', async () => {
    expect(await getUserCount(fakeDb({ 'stats/userCount': 42 }).db)).toBe(42);
    expect(await getUserCount(fakeDb().db)).toBe(0);
  });
});
