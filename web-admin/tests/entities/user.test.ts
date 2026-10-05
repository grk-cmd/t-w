import { describe, expect, it } from 'vitest';
import { findUserByFriendCode, friendCodeCandidates } from '@/entities/user';
import { fakeDb } from '../shared/fakeDb';

describe('친구코드', () => {
  it('뒤 4자리만 넣으면 두 접두어를 다 찾아본다', () => {
    expect(friendCodeCandidates(' ab12 ')).toEqual(['MATE-AB12', 'COZY-AB12']);
    expect(friendCodeCandidates('cozy-ab12')).toEqual(['COZY-AB12']);
    expect(friendCodeCandidates('')).toEqual([]);
  });

  it('주인을 찾으면 사용자코드와 실제 코드를 돌려준다', async () => {
    const { db } = fakeDb({ 'friendCodes/COZY-AB12': { userId: 'u1' } });
    expect(await findUserByFriendCode(db, 'ab12')).toEqual({ uid: 'u1', code: 'COZY-AB12' });
    expect(await findUserByFriendCode(db, 'zzzz')).toBeNull();
  });
});
