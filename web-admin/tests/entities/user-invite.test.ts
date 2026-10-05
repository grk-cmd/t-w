import { describe, expect, it } from 'vitest';
import { getUserInvite, listIssuedInvites, toIssuedInvites } from '@/entities/invite';
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

describe('이 사람이 만든 초대 코드', () => {
  it('최근 것부터, 사용자코드면 쓴 사람 · 가입 도중 기기 토큰이면 가입 중', async () => {
    const list = toIssuedInvites({
      'INVT-AAAA-AAAA': { createdAt: 1, usedBy: 'umuqy3f2ghxmywp4h' },
      'INVT-BBBB-BBBB': { createdAt: 3, usedBy: 'tok-9f8e7d' },
      'INVT-CCCC-CCCC': { createdAt: 2, usedBy: null },
    });
    expect(list.map((i) => [i.code, i.usedBy, i.pending])).toEqual([
      ['INVT-BBBB-BBBB', null, true],
      ['INVT-CCCC-CCCC', null, false],
      ['INVT-AAAA-AAAA', 'umuqy3f2ghxmywp4h', false],
    ]);
  });

  it('issuedBy 로 그 사람 몫만 받는다', async () => {
    const { db } = fakeDb({
      invites: {
        'INVT-AAAA-AAAA': { issuedBy: 'u1aaaaaa', createdAt: 1, usedBy: 'u2bbbbbb' },
        'INVT-DDDD-DDDD': { issuedBy: 'admin', createdAt: 2 },
      },
    });
    expect((await listIssuedInvites(db, 'u1aaaaaa')).map((i) => i.code)).toEqual(['INVT-AAAA-AAAA']);
  });
});
