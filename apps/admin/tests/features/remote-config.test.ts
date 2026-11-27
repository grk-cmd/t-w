import { describe, expect, it } from 'vitest';
import { ACTION_LABEL } from '@/entities/admin-log';
import { parseRoomLimits, ROOM_MAX_PEOPLE_DEFAULT, roomMaxPeopleOf, totalLimitOf } from '@/entities/room';
import {
  getRoomLimits,
  getRoomMaxPeople,
  saveRoomLimits,
  saveRoomMaxPeople,
} from '@/entities/room/api/firebase';
import { flagConfirmText, parseFlag, SIGNUP_FLAGS } from '@/entities/signup-flag';
import { getSignupFlags, setSignupFlag } from '@/entities/signup-flag/api/firebase';
import {
  checkRoomLimits,
  checkRoomMaxPeople,
  roomLimitsConfirmText,
  roomMaxPeopleConfirmText,
} from '@/features/settings/edit-room-config';
import { AUDIT_ACTIONS } from '@/shared/api';
import { auditsOf, fakeDb, withoutAudits } from '../shared/fakeDb';

const brief = (writes: Parameters<typeof auditsOf>[0]) =>
  auditsOf(writes).map((a) => [a.action, a.target, a.detail]);

describe('전체 방 상한 — config/roomLimits(Firebase 판) · room.limits(API 판)', () => {
  const fb = (saved: { workingroom: number | null; togetherroom: number | null }) => ({
    saved,
    defaults: { workingroom: 300, togetherroom: 300 },
  });
  const api = (saved: { workingroom: number; togetherroom: number }) => ({
    saved,
    defaults: { workingroom: 500, togetherroom: 500 },
  });

  it('Firebase 판은 예전처럼 비면 옛 앱 기본 300 · 범위(1~10000 정수) 밖 칸은 버린다', async () => {
    const empty = await getRoomLimits(fakeDb().db);
    expect(empty).toEqual({
      saved: { workingroom: null, togetherroom: null },
      defaults: { workingroom: 300, togetherroom: 300 },
    });
    expect(totalLimitOf(empty, 'workingroom')).toBe(300);
    expect(totalLimitOf(undefined, 'workingroom')).toBeNull(); // 아직 못 읽음
    expect(parseRoomLimits({ workingroom: 10_000, togetherroom: 10_001 })).toEqual({
      workingroom: 10_000,
      togetherroom: null,
    });
    for (const bad of [0, -1, 2.5, '300', true, null])
      expect(parseRoomLimits({ workingroom: bad }).workingroom).toBeNull();
    const saved = await getRoomLimits(
      fakeDb({ 'config/roomLimits': { workingroom: 400, togetherroom: 1 } }).db,
    );
    expect(saved.saved).toEqual({ workingroom: 400, togetherroom: 1 });
    expect(totalLimitOf(saved, 'togetherroom')).toBe(1);
    // 저장된 칸이 없으면 서버가 알려 준 기본값
    expect(
      totalLimitOf(
        { saved: { workingroom: null, togetherroom: 7 }, defaults: { workingroom: 500, togetherroom: 500 } },
        'workingroom',
      ),
    ).toBe(500);
  });

  it('입력 검사 — 두 칸 다 1~10000 정수 · 같은 값은 저장 안 함', () => {
    const none = fb({ workingroom: null, togetherroom: null });
    expect(checkRoomLimits(none, { workingroom: '0', togetherroom: '300' })).toEqual({
      ok: false,
      error: '워킹룸 — 1~10000 사이 정수',
    });
    expect(checkRoomLimits(none, { workingroom: '300', togetherroom: '10001' })).toEqual({
      ok: false,
      error: '투게더룸 — 1~10000 사이 정수',
    });
    expect(checkRoomLimits(none, { workingroom: '2.5', togetherroom: '300' }).ok).toBe(false);
    // 칸이 비어 있으면 어떤 숫자든 처음 저장은 된다
    expect(checkRoomLimits(none, { workingroom: '500', togetherroom: '500' })).toEqual({
      ok: true,
      next: { workingroom: 500, togetherroom: 500 },
    });
    const saved = api({ workingroom: 400, togetherroom: 500 });
    expect(checkRoomLimits(saved, { workingroom: ' 400 ', togetherroom: '500' })).toEqual({
      ok: false,
      error: '지금 값과 같음',
    });
    expect(checkRoomLimits(saved, { workingroom: '400', togetherroom: '10000' })).toEqual({
      ok: true,
      next: { workingroom: 400, togetherroom: 10_000 },
    });
  });

  it('확인 창 — 바뀐 채널만 «지금 → 새 값» · 칸이 없으면 기본값으로', () => {
    expect(
      roomLimitsConfirmText(api({ workingroom: 400, togetherroom: 500 }), {
        workingroom: 400,
        togetherroom: 600,
      }),
    ).toBe(
      '전체 방 상한 투게더룸 500 → 600 — 이미 열린 방은 그대로이고 새 방부터 적용돼요. 앱은 바로 · 방 서버는 1분 안에 반영.',
    );
    expect(
      roomLimitsConfirmText(fb({ workingroom: 400, togetherroom: null }), {
        workingroom: 400,
        togetherroom: 600,
      }),
    ).toContain('투게더룸 300 → 600');
  });

  it('두 채널을 한 객체로 쓰고 기록과 한 묶음 · 바뀐 게 없으면 쓰지 않는다', async () => {
    const { db, writes } = fakeDb();
    await saveRoomLimits(db, await getRoomLimits(db), { workingroom: 400, togetherroom: 300 });
    await saveRoomLimits(db, fb({ workingroom: 400, togetherroom: 300 }), {
      workingroom: 400,
      togetherroom: 300,
    });
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'config/roomLimits', { workingroom: 400, togetherroom: 300 }],
    ]);
    expect(brief(writes)).toEqual([
      ['settings.roomLimits', 'roomLimits', '워킹룸 300 → 400 · 투게더룸 300 → 300'],
    ]);
    expect(ACTION_LABEL['settings.roomLimits']).toBe('전체 방 상한');
  });
});

describe('방 정원 — config/roomMaxPeople', () => {
  it('없거나 범위(2~50 정수) 밖이면 null → 기본 10', async () => {
    expect(ROOM_MAX_PEOPLE_DEFAULT).toBe(10);
    expect(await getRoomMaxPeople(fakeDb().db)).toBeNull();
    expect(roomMaxPeopleOf(null)).toBe(10);
    expect(await getRoomMaxPeople(fakeDb({ 'config/roomMaxPeople': 20 }).db)).toBe(20);
    for (const bad of [1, 51, 2.5, '20'])
      expect(await getRoomMaxPeople(fakeDb({ 'config/roomMaxPeople': bad }).db)).toBeNull();
  });

  it('입력 검사 — 2~50 정수 · 같은 값은 저장 안 함', () => {
    expect(checkRoomMaxPeople(null, '2')).toEqual({ ok: true, next: 2 });
    expect(checkRoomMaxPeople(null, '50')).toEqual({ ok: true, next: 50 });
    for (const bad of ['1', '51', '', 'abc', '3.5'])
      expect(checkRoomMaxPeople(null, bad)).toEqual({ ok: false, error: '2~50 사이 정수' });
    expect(checkRoomMaxPeople(12, '12')).toEqual({ ok: false, error: '지금 값과 같음' });
    expect(roomMaxPeopleConfirmText(null, 12)).toContain('방 정원 10명 → 12명');
  });

  it('한 칸과 기록을 한 묶음으로 — 기록은 «기본 10 → 12»', async () => {
    const { db, writes } = fakeDb();
    await saveRoomMaxPeople(db, null, 12);
    await saveRoomMaxPeople(db, 12, 8);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'config/roomMaxPeople', 12],
      ['commit', 'config/roomMaxPeople', 8],
    ]);
    expect(brief(writes)).toEqual([
      ['settings.roomMaxPeople', '정원 12명', '기본 10 → 12'],
      ['settings.roomMaxPeople', '정원 8명', '12 → 8'],
    ]);
  });
});

describe('가입 스위치 — config/flags', () => {
  it('없거나 bool 이 아니면 켜짐(true) · 두 칸만 읽는다', async () => {
    expect(SIGNUP_FLAGS).toEqual(['inviteGate', 'existingSignup']);
    expect(await getSignupFlags(fakeDb().db)).toEqual({ inviteGate: true, existingSignup: true });
    expect(
      await getSignupFlags(
        fakeDb({ 'config/flags/inviteGate': false, 'config/flags/existingSignup': 'no' }).db,
      ),
    ).toEqual({ inviteGate: false, existingSignup: true });
    expect(parseFlag(0)).toBe(true);
  });

  it('켜기 · 끄기 — 한 칸과 기록을 한 묶음으로 · 확인 창에 결과 설명', async () => {
    const { db, writes } = fakeDb();
    await setSignupFlag(db, 'inviteGate', false);
    await setSignupFlag(db, 'existingSignup', true);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'config/flags/inviteGate', false],
      ['commit', 'config/flags/existingSignup', true],
    ]);
    expect(brief(writes)).toEqual([
      ['settings.inviteGate', 'inviteGate', '끄기'],
      ['settings.existingSignup', 'existingSignup', '켜기'],
    ]);
    expect(flagConfirmText('inviteGate', false)).toContain('초대 코드 없이 누구나 가입');
    expect(flagConfirmText('existingSignup', true)).toContain('가입을 마쳐야');
  });
});

describe('작업 기록 이름', () => {
  it('새 동작은 규칙 형식(영문 «종류.동작») · 화면 이름이 있다', () => {
    const added = [
      'settings.roomLimits',
      'settings.roomMaxPeople',
      'settings.inviteGate',
      'settings.existingSignup',
      'roomServer.registerIndex',
    ] as const;
    for (const a of added) {
      expect(AUDIT_ACTIONS).toContain(a);
      expect(a).toMatch(/^[a-z][A-Za-z]{0,19}[.][a-z][A-Za-z]{0,19}$/);
      expect(ACTION_LABEL[a]).toBeTruthy();
    }
  });
});
