import { describe, expect, it } from 'vitest';
import { addMonths } from '@/entities/secret-room';
import { grantSecretRoom, prepareSecretGrant, secretRoomMessage } from '@/features/license/grant-secret-room';
import { fakeDb } from '../shared/fakeDb';

const NOW = new Date(2026, 4, 10, 12).getTime();
const DAY = 86_400_000;

// 살아 있는 계정 — 최근 접속 · 거울이 친구코드와 같다.
const alive = {
  'friendCodes/MATE-AB12': { userId: 'u1' },
  'users/u1/profile/name': '철수',
  'users/u1/presence/lastSeen': NOW - DAY,
  'users/u1/friendCode': 'MATE-AB12',
};

const input = (over: Partial<{ target: string; want: string; months: string }> = {}) => ({
  target: 'AB12',
  want: '',
  months: '',
  ...over,
});

describe('시크릿룸 발급 — 확인', () => {
  it('읽기만 하고, 살아 있는 계정 · 자동 코드면 경고 없이 바로 낼 수 있다', async () => {
    const { db, writes } = fakeDb(alive);
    const r = await prepareSecretGrant(db, input({ months: '3' }), NOW, () => 'SCRT-ZZZZ');
    expect(r).toEqual({
      ok: true,
      plan: {
        uid: 'u1',
        name: '철수',
        code: 'SCRT-ZZZZ',
        months: 3,
        expMs: addMonths(NOW, 3),
        mode: 'new',
        confusing: false,
        warnings: [],
      },
    });
    expect(writes).toEqual([]);
  });

  it('입력 오류는 아무것도 읽기 전에 막는다', async () => {
    const { db } = fakeDb(alive);
    expect(await prepareSecretGrant(db, input({ target: ' ' }))).toMatchObject({ ok: false });
    expect(await prepareSecretGrant(db, input({ months: '3개월' }))).toMatchObject({ ok: false });
    expect(await prepareSecretGrant(db, input({ want: 'AB' }))).toMatchObject({ ok: false });
    expect(await prepareSecretGrant(db, input({ target: 'ZZ99' }))).toEqual({
      ok: false,
      error: '해당 친구코드를 가진 유저를 찾을 수 없어요',
    });
  });

  it('오래된 계정이면 경고 — 유저 코드를 직접 넣으면 묻지 않는다', async () => {
    const { db } = fakeDb({ ...alive, 'users/u1/presence/lastSeen': NOW - 30 * DAY });
    const viaCode = await prepareSecretGrant(db, input(), NOW, () => 'SCRT-ZZZZ');
    expect(viaCode.ok && viaCode.plan.warnings).toEqual([expect.stringMatching(/30일째 접속이 없어요/)]);

    const uid = 'uabcdefghijkl1';
    const { db: db2 } = fakeDb({ [`users/${uid}/presence/lastSeen`]: NOW - 30 * DAY });
    const direct = await prepareSecretGrant(db2, input({ target: uid }), NOW, () => 'SCRT-ZZZZ');
    expect(direct.ok && direct.plan).toMatchObject({ uid, warnings: [] });
  });

  it('뒤 4자리로 넣어도 거울은 찾은 친구코드와 비교한다', async () => {
    const { db } = fakeDb({
      ...alive,
      'friendCodes/MATE-AB12': undefined,
      'friendCodes/COZY-AB12': { userId: 'u1' },
    });
    const r = await prepareSecretGrant(db, input(), NOW, () => 'SCRT-ZZZZ');
    expect(r.ok && r.plan.warnings).toEqual([expect.stringMatching(/적힌 친구코드는 MATE-AB12/)]);
  });

  it('원하는 코드가 이미 내 것이면 경고하고, 남은 기간에 이어붙인 계획을 낸다', async () => {
    const exp = NOW + 10 * DAY;
    const { db } = fakeDb({ ...alive, 'secretRooms/SCRT-AB10/pub': { owner: 'u1', ts: 0, exp } });
    const r = await prepareSecretGrant(db, input({ want: 'ab10', months: '1' }), NOW);
    expect(r.ok && r.plan).toMatchObject({
      code: 'SCRT-AB10',
      mode: 'extend',
      expMs: addMonths(exp, 1),
      confusing: true,
      warnings: [expect.stringMatching(/남은 기간에 이어붙입니다/)],
    });
  });

  it('자동 코드가 이미 쓰이면 다시 뽑는다', async () => {
    const { db } = fakeDb({ ...alive, 'secretRooms/SCRT-AAAA/pub': { owner: 'u9', ts: 0 } });
    const codes = ['SCRT-AAAA', 'SCRT-BBBB'];
    const r = await prepareSecretGrant(db, input(), NOW, () => codes.shift()!);
    expect(r.ok && r.plan.code).toBe('SCRT-BBBB');
  });
});

describe('시크릿룸 발급 — 쓰기', () => {
  const plan = {
    uid: 'u1',
    name: '철수',
    code: 'SCRT-NEW1',
    months: 0,
    expMs: 0,
    mode: 'new' as const,
    confusing: false,
    warnings: [],
  };

  it('새 코드 → 옛 코드 만료 → 사용자 칸 → 수령함 순서, 열쇠는 secretRooms 에만', async () => {
    const { db, writes } = fakeDb({
      'users/u1/secretRoom': 'SCRT-OLD1',
      'secretRooms/SCRT-OLD1/pub': { owner: 'u1', ts: 1 },
    });
    const r = await grantSecretRoom(db, plan, 'KEY', NOW);
    expect(r).toEqual({
      ok: true,
      code: 'SCRT-NEW1',
      period: '영구',
      sent: true,
      linked: true,
      expiredOld: 'SCRT-OLD1',
      expireFailed: '',
    });
    expect(writes.map(([op, path]) => [op, path.replace(/\/m[^/]+$/, '/m…')])).toEqual([
      ['set', 'secretRooms/SCRT-NEW1'],
      ['set', 'secretRooms/SCRT-OLD1'],
      ['set', 'users/u1/secretRoom'],
      ['commit', 'inbox/u1/m…'],
    ]);
    expect(writes[1][2]).toEqual({ k: 'KEY', pub: { owner: 'u1', ts: 1, exp: NOW - 1000 } });
    expect(JSON.stringify(writes.slice(2))).not.toContain('KEY');
  });

  it('열쇠가 틀려 거부되면 그 뒤는 아무것도 하지 않는다', async () => {
    const denied = Object.assign(new Error('PERMISSION_DENIED: Permission denied'), {
      code: 'PERMISSION_DENIED',
    });
    const { db, writes } = fakeDb();
    db.set = async () => {
      throw denied;
    };
    expect(await grantSecretRoom(db, plan, 'WRONG', NOW)).toEqual({ ok: false, denied: true });
    expect(writes).toEqual([]);
  });

  it('옛 코드가 그새 남에게 갔으면 만료시키지 않는다 · 같은 코드면 연장이라 손대지 않는다', async () => {
    const { db, writes } = fakeDb({
      'users/u1/secretRoom': 'SCRT-OLD1',
      'secretRooms/SCRT-OLD1/pub': { owner: 'u2', ts: 1 },
    });
    await grantSecretRoom(db, plan, 'KEY', NOW);
    expect(writes.some(([, p]) => p === 'secretRooms/SCRT-OLD1')).toBe(false);

    const { db: db2, writes: w2 } = fakeDb({ 'users/u1/secretRoom': 'SCRT-NEW1' });
    await grantSecretRoom(db2, plan, 'KEY', NOW);
    expect(w2.filter(([, p]) => p.startsWith('secretRooms/'))).toHaveLength(1);
  });

  it('사용자 칸 · 수령함이 거부돼도 발급은 유효하고 결과에 알린다', async () => {
    const { db } = fakeDb({}, (p) => p.startsWith('users/') || p.startsWith('inbox/'));
    expect(await grantSecretRoom(db, plan, 'KEY', NOW)).toMatchObject({
      ok: true,
      sent: false,
      linked: false,
    });
  });

  it('수령함 문구 — 기간 · 옛 코드 안내', () => {
    const exp = new Date(2026, 7, 31, 23, 59).getTime();
    const m = secretRoomMessage('SCRT-NEW1', exp, 'SCRT-OLD1');
    expect(m.tag).toBe('reward');
    expect(m.body).toContain('2026-08-31 까지 내 전용 투게더룸');
    expect(m.body).toContain('예전 코드 SCRT-OLD1');
    expect(m.body.length).toBeLessThanOrEqual(600);
    expect(secretRoomMessage('SCRT-NEW1', 0, '').body).toContain('언제든');
  });
});
