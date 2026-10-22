import { describe, expect, it } from 'vitest';
import {
  createGroupInvite,
  endOfDay,
  GROUP_INVITE_MAX_USES,
  groupInviteState,
  isGroupMaxUses,
  lastDay,
  listGroupInvites,
  toGroupInvites,
  type GroupInvite,
} from '@/entities/invite';
import { createGroupInviteCode, setGroupInviteStopped } from '@/features/user/grant-invites';
import { auditsOf, fakeDb, NOW, withoutAudits } from '../shared/fakeDb';

const T = Date.parse('2026-10-22T03:00:00Z'); // 서울 10-22 12:00
const g = (x: Partial<GroupInvite> = {}): GroupInvite => ({
  code: 'INVT-AAAA-AAAA',
  createdAt: 1,
  maxUses: 3,
  usedCount: 0,
  expiresAt: null,
  stoppedAt: null,
  note: '',
  ...x,
});

describe('여러 명 초대 코드 — 판정', () => {
  it('인원 범위 — 1 ~ 5000 정수만', () => {
    expect([1, 500, GROUP_INVITE_MAX_USES].every(isGroupMaxUses)).toBe(true);
    expect([0, -1, 5001, 1.5, NaN].some(isGroupMaxUses)).toBe(false);
  });

  it('상태 — 앱 closedReason 과 같은 순서(중지 · 마감 · 인원)', () => {
    expect(groupInviteState(g({ usedCount: 2 }), T)).toBe('open');
    expect(groupInviteState(g({ usedCount: 3 }), T)).toBe('full');
    expect(groupInviteState(g({ expiresAt: T + 1 }), T)).toBe('open');
    expect(groupInviteState(g({ expiresAt: T }), T)).toBe('expired');
    expect(groupInviteState(g({ stoppedAt: 5, usedCount: 3, expiresAt: 1 }), T)).toBe('stopped');
  });

  it('마감 날짜 — 서울 그날 밤 12시까지 · 거꾸로 보이는 날도 같은 날', () => {
    const end = endOfDay('2026-10-31')!;
    expect(new Date(end).toISOString()).toBe('2026-10-31T15:00:00.000Z');
    expect(lastDay(end)).toBe('2026-10-31');
    expect(endOfDay('')).toBeNull();
    expect(endOfDay('2026-1-3')).toBeNull();
  });

  it('목록 — 최근 것부터 · 모양이 깨진 줄은 뺀다 · 빈 칸은 기본값', () => {
    const rows = toGroupInvites({
      'INVT-AAAA-AAAA': { createdAt: 1, maxUses: 3, usedCount: 1 },
      'INVT-BBBB-BBBB': { createdAt: 9, maxUses: 500, expiresAt: 100, stoppedAt: 50, note: '봄' },
      'INVT-CCCC-CCCC': { createdAt: 5 },
      'INVT-DDDD-DDDD': null,
    });
    expect(rows.map((r) => r.code)).toEqual(['INVT-BBBB-BBBB', 'INVT-AAAA-AAAA']);
    expect(rows[0]).toMatchObject({ maxUses: 500, usedCount: 0, expiresAt: 100, stoppedAt: 50, note: '봄' });
    expect(rows[1]).toMatchObject({ expiresAt: null, stoppedAt: null, note: '' });
    expect(toGroupInvites(null)).toEqual([]);
  });
});

describe('여러 명 초대 코드 — 쓰기', () => {
  it('만들기 — 규칙 모양 그대로 · 빈 마감 · 메모는 칸을 안 만든다', async () => {
    const { db, writes } = fakeDb();
    const code = await createGroupInvite(
      db,
      { maxUses: 500, expiresAt: null, note: '  ' },
      T,
      () => 'INVT-AAAA-AAAA',
    );
    expect(code).toBe('INVT-AAAA-AAAA');
    expect(writes).toEqual([
      [
        'transaction',
        'groupInvites/INVT-AAAA-AAAA',
        { issuedBy: 'admin', createdAt: T, maxUses: 500, usedCount: 0 },
      ],
    ]);
  });

  it('만들기 — 마감 · 메모(40자에서 자름)', async () => {
    const { db, writes } = fakeDb();
    await createGroupInvite(
      db,
      { maxUses: 2, expiresAt: T + 5, note: 'a'.repeat(50) },
      T,
      () => 'INVT-AAAA-AAAA',
    );
    expect(writes[0][2]).toMatchObject({ expiresAt: T + 5, note: 'a'.repeat(40) });
  });

  it('한 명짜리 · 여러 명짜리 어느 쪽과도 겹치면 새 코드로', async () => {
    const { db, writes } = fakeDb({
      'invites/INVT-AAAA-AAAA': { issuedBy: 'u1', createdAt: 1 },
      'groupInvites/INVT-BBBB-BBBB': { issuedBy: 'admin', createdAt: 1, maxUses: 2, usedCount: 0 },
    });
    const codes = ['INVT-AAAA-AAAA', 'INVT-BBBB-BBBB', 'INVT-CCCC-CCCC'];
    expect(
      await createGroupInvite(db, { maxUses: 2, expiresAt: null, note: '' }, T, () => codes.shift()!),
    ).toBe('INVT-CCCC-CCCC');
    expect(writes.map((w) => w[1])).toEqual(['groupInvites/INVT-CCCC-CCCC']);
  });

  it('범위 밖 인원 · 지난 마감은 쓰기 전에 막는다', async () => {
    const { db, writes } = fakeDb();
    await expect(createGroupInvite(db, { maxUses: 0, expiresAt: null, note: '' }, T)).rejects.toThrow();
    await expect(createGroupInvite(db, { maxUses: 5001, expiresAt: null, note: '' }, T)).rejects.toThrow();
    await expect(createGroupInvite(db, { maxUses: 5, expiresAt: T, note: '' }, T)).rejects.toThrow(/지났/);
    expect(writes).toEqual([]);
  });

  it('목록 읽기는 groupInvites 하나', async () => {
    const { db } = fakeDb({ groupInvites: { 'INVT-AAAA-AAAA': { createdAt: 1, maxUses: 3, usedCount: 2 } } });
    expect((await listGroupInvites(db))[0]).toMatchObject({ code: 'INVT-AAAA-AAAA', usedCount: 2 });
  });

  it('만든 뒤 기록 — 코드 대신 메모 · 인원 · 마지막 날', async () => {
    const { db, writes } = fakeDb();
    await createGroupInviteCode(db, { maxUses: 500, expiresAt: endOfDay('2026-10-31'), note: '10월 모집' });
    expect(auditsOf(writes)).toEqual([
      {
        at: NOW,
        by: 'admin-uid',
        action: 'invite.groupCreate',
        target: '10월 모집',
        detail: '500명 · 2026-10-31까지',
      },
    ]);
    expect(JSON.stringify(auditsOf(writes))).not.toContain('INVT-');
  });

  it('중지 · 다시 열기 — 기록과 한 묶음', async () => {
    const { db, writes } = fakeDb();
    await setGroupInviteStopped(db, g({ usedCount: 7, maxUses: 500 }), true);
    await setGroupInviteStopped(db, g(), false);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'groupInvites/INVT-AAAA-AAAA/stoppedAt', NOW],
      ['commit', 'groupInvites/INVT-AAAA-AAAA/stoppedAt', null],
    ]);
    expect(auditsOf(writes).map((a) => [a.action, a.target, a.detail])).toEqual([
      ['invite.groupStop', '메모 없음', '7/500명'],
      ['invite.groupResume', '메모 없음', '0/3명'],
    ]);
    expect(writes.every((w) => w[0] === 'commit')).toBe(true);
  });
});
