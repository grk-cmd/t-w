import { describe, expect, it } from 'vitest';
import { grantByFriendCode } from '@/features/grant-by-code';
import { fakeDb } from '../shared/fakeDb';

describe('친구코드로 발급', () => {
  it('주인을 못 찾으면 아무것도 쓰지 않는다', async () => {
    const { db, writes } = fakeDb();
    expect(await grantByFriendCode(db, 'AB12', () => 'KEY')).toEqual({ ok: false, reason: 'not-found' });
    expect(writes).toEqual([]);
  });

  it('찾으면 이름 · 친구코드를 메모로 남기고 키와 수령함 메시지를 한 묶음으로 쓴다', async () => {
    const { db, writes } = fakeDb({
      'friendCodes/COZY-AB12': { userId: 'u1' },
      'users/u1/profile/name': '테스터',
    });
    expect(await grantByFriendCode(db, 'ab12', () => 'KEY')).toEqual({
      ok: true,
      key: 'KEY',
      code: 'COZY-AB12',
      name: '테스터',
    });
    expect((writes[0][2] as { note: string }).note).toBe('테스터 · 친구코드 COZY-AB12');
    expect(writes[1][1]).toMatch(/^inbox\/u1\//);
  });

  it('수령함 쓰기가 거부되면 키도 남지 않는다', async () => {
    const { db, writes } = fakeDb({ 'friendCodes/MATE-AB12': { userId: 'u1' } }, (p) =>
      p.startsWith('inbox/'),
    );
    await expect(grantByFriendCode(db, 'MATE-AB12', () => 'KEY')).rejects.toThrow();
    expect(writes).toEqual([]);
  });
});
