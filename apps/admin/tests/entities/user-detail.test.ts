import { describe, expect, it } from 'vitest';
import { inviterKind } from '@/entities/invite';
import { countUserReports } from '@/entities/report';
import { getUserSecretRoomInfo, secretRoomState } from '@/entities/secret-room';
import { buildUserRows, getUserFocusSec, isBadLicense, sameLicenseUsers } from '@/entities/user';
import { formatHours } from '@/shared/lib';
import { fakeDb } from '../shared/fakeDb';
import { accounts, friendCodes, licenses } from '../shared/userFixtures';

describe('사용자 상세 — 칸 가공', () => {
  it('같은 키를 쓰는 다른 사람 — 본인은 빼고, 키가 없으면 아무도 없다', () => {
    const rows = buildUserRows(
      { ...accounts, u5: { name: '자차', license: ' key-1 ', ts: 1 } },
      friendCodes,
      licenses,
    );
    const at = (uid: string) => rows.find((r) => r.userCode === uid)!;
    expect(sameLicenseUsers(rows, at('u1')).map((r) => r.userCode)).toEqual(['u5']);
    expect(sameLicenseUsers(rows, at('u5')).map((r) => r.userCode)).toEqual(['u1']);
    expect(sameLicenseUsers(rows, at('u2'))).toEqual([]);
    expect(sameLicenseUsers(rows, at('u3'))).toEqual([]);
  });

  it('회수됐거나 없는 키만 경고', () => {
    expect([isBadLicense('used'), isBadLicense('unused'), isBadLicense('none')]).toEqual([
      false,
      false,
      false,
    ]);
    expect([isBadLicense('revoked'), isBadLicense('unknown')]).toEqual([true, true]);
  });

  it('가입 경로 — 초대한 사람 없음 = 기존, admin = 웹 관리자, 그 밖은 사용자코드', () => {
    expect(inviterKind(null)).toBe('existing');
    expect(inviterKind('admin')).toBe('admin');
    expect(inviterKind('uabc000000001')).toBe('user');
  });

  it('시크릿룸 — 주인 · 만료를 pub 로 맞춰 본다', () => {
    const now = 1_000;
    expect(secretRoomState({ owner: 'u1', ts: 1 }, 'u1', now)).toEqual({ kind: 'active', exp: null });
    expect(secretRoomState({ owner: 'u1', ts: 1, exp: 2_000 }, 'u1', now)).toEqual({
      kind: 'active',
      exp: 2_000,
    });
    expect(secretRoomState({ owner: 'u1', ts: 1, exp: 500 }, 'u1', now)).toEqual({
      kind: 'expired',
      exp: 500,
    });
    expect(secretRoomState({ owner: 'u2', ts: 1 }, 'u1', now)).toEqual({ kind: 'not-owner', owner: 'u2' });
    expect(secretRoomState(null, 'u1', now)).toEqual({ kind: 'not-owner', owner: null });
  });

  it('집중 시간은 시간 단위 한 자리', () => {
    expect(formatHours(0)).toBe('—');
    expect(formatHours(5400)).toBe('1.5시간');
  });
});

describe('사용자 상세 — 그 사람 몫의 작은 칸만 읽는다', () => {
  it('신고 수는 reports/{uid} 의 키 수', async () => {
    const { db } = fakeDb({ 'reports/u1': { r1: true, r2: true } });
    expect(await countUserReports(db, 'u1')).toBe(2);
    expect(await countUserReports(db, 'u2')).toBe(0);
  });

  it('집중 누적은 focus/totalSec 한 칸 — 없거나 이상하면 0', async () => {
    const { db } = fakeDb({ 'users/u1/focus/totalSec': 7200, 'users/u2/focus/totalSec': 'x' });
    expect(await getUserFocusSec(db, 'u1')).toBe(7200);
    expect(await getUserFocusSec(db, 'u2')).toBe(0);
    expect(await getUserFocusSec(db, 'u3')).toBe(0);
  });

  it('시크릿룸은 사용자 칸의 코드 → 그 코드의 pub', async () => {
    const pub = { owner: 'u1', ts: 1, exp: 9 };
    const { db } = fakeDb({ 'users/u1/secretRoom': 'SCRT-AAAA', 'secretRooms/SCRT-AAAA/pub': pub });
    expect(await getUserSecretRoomInfo(db, 'u1')).toEqual({ code: 'SCRT-AAAA', pub });
    expect(await getUserSecretRoomInfo(db, 'u2')).toBeNull();
  });

  it('시크릿룸 칸을 읽지 못하면 «없음» 으로 삼키지 않는다', async () => {
    const { db } = fakeDb();
    db.get = () => Promise.reject(new Error('permission_denied'));
    await expect(getUserSecretRoomInfo(db, 'u1')).rejects.toThrow();
  });
});
