import { describe, expect, it } from 'vitest';
import { countLicenses } from '@/entities/license';
import { checkUserCount, getUserCount, setUserCount } from '@/entities/user-count';
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

  it('보정은 숫자만, 지금 값보다 작으면 막는다(규칙이 거부한다)', () => {
    expect(checkUserCount(' 120 ', 100)).toEqual({ ok: true, value: 120 });
    expect(checkUserCount('100', 100)).toEqual({ ok: true, value: 100 });
    expect(checkUserCount('99', 100)).toEqual({ ok: false, reason: 'below-current' });
    expect(checkUserCount('-1', 0)).toEqual({ ok: false, reason: 'not-number' });
    expect(checkUserCount('1.5', 0)).toEqual({ ok: false, reason: 'not-number' });
    expect(checkUserCount('', 0)).toEqual({ ok: false, reason: 'not-number' });
  });

  it('보정 쓰기는 stats/userCount 한 칸', async () => {
    const { db, writes } = fakeDb();
    await setUserCount(db, 7);
    expect(writes).toEqual([['set', 'stats/userCount', 7]]);
  });
});
