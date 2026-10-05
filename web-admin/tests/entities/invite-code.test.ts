import { describe, expect, it } from 'vitest';
import { createInviteCode, genInviteCode, INVITE_CODE_RE } from '@/entities/invite';
import { createInviteCodes } from '@/features/user/grant-invites';
import { fakeDb, withoutAudits } from '../shared/fakeDb';

describe('초대 코드', () => {
  it('앱 _genInviteCode 와 같은 모양 — 0 · O · 1 · I 는 나오지 않는다', () => {
    for (let i = 0; i < 200; i++) expect(genInviteCode()).toMatch(INVITE_CODE_RE);
    expect(genInviteCode(() => 0)).toBe('INVT-AAAA-AAAA');
    expect(genInviteCode(() => 0.999)).toBe('INVT-9999-9999');
  });

  it('없을 때만 만든다 — 이미 있는 코드는 덮지 않고 새 코드로 다시', async () => {
    const taken = { issuedBy: 'u1', createdAt: 1, usedBy: 'u2' };
    const { db, writes } = fakeDb({ 'invites/INVT-AAAA-AAAA': taken });
    const codes = ['INVT-AAAA-AAAA', 'INVT-BBBB-BBBB'];
    expect(await createInviteCode(db, 5, () => codes.shift()!)).toBe('INVT-BBBB-BBBB');
    expect(withoutAudits(writes)).toEqual([
      ['transaction', 'invites/INVT-BBBB-BBBB', { issuedBy: 'admin', createdAt: 5 }],
    ]);
  });

  it('여러 개는 하나씩 알리고, 범위 밖 개수는 쓰기 전에 막는다', async () => {
    const { db, writes } = fakeDb();
    const seen: string[] = [];
    const codes = await createInviteCodes(db, 3, (c) => seen.push(c));
    expect(codes).toHaveLength(3);
    expect(seen).toEqual(codes);
    expect(new Set(codes).size).toBe(3);
    await expect(createInviteCodes(db, 11)).rejects.toThrow();
    await expect(createInviteCodes(db, 0)).rejects.toThrow();
    expect(withoutAudits(writes)).toHaveLength(3);
  });
});
