import { describe, expect, it } from 'vitest';
import { getUserInvite } from '@/entities/invite';
import { fakeDb } from '../shared/fakeDb';

describe('가입 기록', () => {
  it('invite 세 칸 — 초대한 사람이 없으면 기존 사용자, 칸이 없으면 null', async () => {
    const { db } = fakeDb({
      'users/u1/invite': { invitesLeft: 5, invitedBy: null, joinedAt: 10 },
      'users/u2/invite': { invitesLeft: 0, invitedBy: 'u1', joinedAt: 20 },
      'users/u3/invite': { invitesLeft: 'x' },
    });
    expect(await getUserInvite(db, 'u1')).toEqual({ joinedAt: 10, invitedBy: null, invitesLeft: 5 });
    expect(await getUserInvite(db, 'u2')).toEqual({ joinedAt: 20, invitedBy: 'u1', invitesLeft: 0 });
    expect(await getUserInvite(db, 'u3')).toEqual({ joinedAt: null, invitedBy: null, invitesLeft: null });
    expect(await getUserInvite(db, 'u4')).toBeNull();
  });
});
