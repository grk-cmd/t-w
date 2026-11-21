import { describe, expect, it } from 'vitest';
import {
  grantInvites,
  grantInvitesAll,
  revokeInvitesAll,
  uniqueUserIds,
} from '@/features/user/grant-invites';
import { fakeDb, withoutAudits } from '../shared/fakeDb';

const left = (uid: string) => `users/${uid}/invite/invitesLeft`;

describe('초대권 지급 — 한 명', () => {
  it('지금 장수에 더해 invitesLeft 한 칸만 트랜잭션으로 고친다', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 2 });
    expect(await grantInvites(db, 'u1', 3)).toEqual({ ok: true, before: 2, after: 5 });
    expect(withoutAudits(writes)).toEqual([['transaction', left('u1'), 5]]);
  });

  it('읽은 뒤 본인이 쓴 초대권을 덮지 않는다 — 서버가 거절하면 새 값으로 다시 더한다', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 5 });
    const tx = db.transaction;
    // 첫 시도 땐 5 로 보였지만 그새 본인이 1장 써서 서버는 4 — 실제 트랜잭션처럼 새 값으로 다시 부른다.
    db.transaction = async <T>(path: string, change: (c: T | null) => T | undefined) => {
      change(5 as T);
      return tx<T>(path, (c) => change((c === null ? null : 4) as T | null));
    };
    expect(await grantInvites(db, 'u1', 2)).toEqual({ ok: true, before: 4, after: 6 });
    expect(withoutAudits(writes)).toEqual([['transaction', left('u1'), 6]]);
  });

  it('규칙 상한 999 에서 자른다', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 998 });
    expect(await grantInvites(db, 'u1', 3)).toEqual({ ok: true, before: 998, after: 999 });
    expect(writes[0][2]).toBe(999);
  });

  it('이미 999 면 쓰지 않는다', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 999 });
    expect(await grantInvites(db, 'u1', 1)).toEqual({ ok: false, reason: 'full' });
    expect(withoutAudits(writes)).toEqual([]);
  });

  it('초대권 칸이 없는 사람에겐 쓰지 않는다', async () => {
    const { db, writes } = fakeDb();
    expect(await grantInvites(db, 'u1', 1)).toEqual({ ok: false, reason: 'no-invite' });
    expect(withoutAudits(writes)).toEqual([]);
  });

  it('한 번에 1~3장만 — 그 밖은 읽지도 쓰지도 않는다', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 0 });
    for (const n of [0, 4, 1.5, -1]) await expect(grantInvites(db, 'u1', n)).rejects.toThrow();
    expect(withoutAudits(writes)).toEqual([]);
  });
});

describe('초대권 지급 — 전체', () => {
  it('친구코드를 여럿 가진 사람도 한 번만 센다', () => {
    expect(
      uniqueUserIds({
        'MATE-AAAA': { userId: 'u1' },
        'MATE-OLD1': { userId: 'u1' },
        'COZY-B': { userId: 'u2' },
        X: {},
      }),
    ).toEqual(['u1', 'u2']);
  });

  it('지급 · 건너뜀 · 실패를 따로 세고 진행률을 알린다', async () => {
    const { db, writes } = fakeDb({ [left('a')]: 0, [left('b')]: 999, [left('d')]: 1 }, (p) =>
      p.startsWith('users/d/'),
    );
    const seen: number[] = [];
    const r = await grantInvitesAll(db, ['a', 'b', 'c', 'd'], 2, { onProgress: (done) => seen.push(done) });
    expect(r).toEqual({ total: 4, granted: 1, skipped: 2, failed: 1, stopped: false });
    expect(withoutAudits(writes)).toEqual([['transaction', left('a'), 2]]);
    expect(seen).toEqual([1, 2, 3, 4]);
  });

  it('멈추면 다음 묶음부터 쓰지 않는다', async () => {
    const uids = Array.from({ length: 45 }, (_, i) => `u${i}`);
    const { db, writes } = fakeDb(Object.fromEntries(uids.map((u) => [left(u), 0])));
    let stop = false;
    const r = await grantInvitesAll(db, uids, 1, {
      onProgress: (done) => (stop = done >= 20),
      shouldStop: () => stop,
    });
    expect(r.stopped).toBe(true);
    expect(r.granted).toBe(20);
    expect(withoutAudits(writes)).toHaveLength(20);
  });

  it('장수가 범위를 벗어나면 아무에게도 쓰지 않는다', async () => {
    const { db, writes } = fakeDb({ [left('a')]: 0 });
    await expect(grantInvitesAll(db, ['a'], 4)).rejects.toThrow();
    expect(withoutAudits(writes)).toEqual([]);
  });
});

describe('초대권 지급 — 선택', () => {
  it('고른 사람에게만 쓴다', async () => {
    const { db, writes } = fakeDb({ [left('a')]: 1, [left('b')]: 1, [left('c')]: 1 });
    const r = await grantInvitesAll(db, ['a', 'c'], 3);
    expect(r).toEqual({ total: 2, granted: 2, skipped: 0, failed: 0, stopped: false });
    expect(withoutAudits(writes)).toEqual([
      ['transaction', left('a'), 4],
      ['transaction', left('c'), 4],
    ]);
  });
});

describe('초대권 회수 — 0장으로', () => {
  it('1장 이상만 0으로 · 0장 · 마이너스 · 칸 없음은 건너뛰고 거둔 장수를 센다', async () => {
    const { db, writes } = fakeDb({ [left('a')]: 3, [left('b')]: 0, [left('c')]: -2, [left('e')]: 999 });
    const r = await revokeInvitesAll(db, ['a', 'b', 'c', 'd', 'e']);
    expect(r).toEqual({ total: 5, revoked: 2, taken: 1002, skipped: 3, failed: 0, stopped: false });
    expect(withoutAudits(writes)).toEqual([
      ['transaction', left('a'), 0],
      ['transaction', left('e'), 0],
    ]);
  });

  it('그 사이 본인이 다 써서 0이 됐으면 쓰지 않고 건너뜀으로 센다', async () => {
    const { db, writes } = fakeDb({ [left('a')]: 1 });
    const tx = db.transaction;
    db.transaction = async <T>(path: string, change: (c: T | null) => T | undefined) => {
      change(1 as T);
      return tx<T>(path, (c) => change((c === null ? null : 0) as T | null));
    };
    const r = await revokeInvitesAll(db, ['a']);
    expect(r).toMatchObject({ revoked: 0, skipped: 1 });
    expect(withoutAudits(writes)).toEqual([]);
  });

  it('실패를 따로 세고, 멈추면 다음 묶음부터 쓰지 않는다', async () => {
    const uids = Array.from({ length: 45 }, (_, i) => `u${i}`);
    const { db, writes } = fakeDb(Object.fromEntries(uids.map((u) => [left(u), 2])), (p) =>
      p.startsWith('users/u0/'),
    );
    let stop = false;
    const r = await revokeInvitesAll(db, uids, {
      onProgress: (done) => (stop = done >= 20),
      shouldStop: () => stop,
    });
    expect(r).toMatchObject({ revoked: 19, failed: 1, stopped: true });
    expect(withoutAudits(writes)).toHaveLength(19);
  });
});
