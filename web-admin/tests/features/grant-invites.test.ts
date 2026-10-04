import { describe, expect, it } from 'vitest';
import { grantInvites, grantInvitesAll, uniqueUserIds } from '@/features/user/grant-invites';
import { fakeDb } from '../shared/fakeDb';

const left = (uid: string) => `users/${uid}/invite/invitesLeft`;

describe('초대권 지급 — 한 명', () => {
  it('지금 장수에 더해 invite 칸만 고친다', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 2 });
    expect(await grantInvites(db, 'u1', 3)).toEqual({ ok: true, before: 2, after: 5 });
    expect(writes).toEqual([['update', 'users/u1/invite', { invitesLeft: 5 }]]);
  });

  it('규칙 상한 999 에서 자른다', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 998 });
    expect(await grantInvites(db, 'u1', 3)).toEqual({ ok: true, before: 998, after: 999 });
    expect(writes[0][2]).toEqual({ invitesLeft: 999 });
  });

  it('이미 999 면 쓰지 않는다', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 999 });
    expect(await grantInvites(db, 'u1', 1)).toEqual({ ok: false, reason: 'full' });
    expect(writes).toEqual([]);
  });

  it('초대권 칸이 없는 사람에겐 쓰지 않는다', async () => {
    const { db, writes } = fakeDb();
    expect(await grantInvites(db, 'u1', 1)).toEqual({ ok: false, reason: 'no-invite' });
    expect(writes).toEqual([]);
  });

  it('한 번에 1~3장만 — 그 밖은 읽지도 쓰지도 않는다', async () => {
    const { db, writes } = fakeDb({ [left('u1')]: 0 });
    for (const n of [0, 4, 1.5, -1]) await expect(grantInvites(db, 'u1', n)).rejects.toThrow();
    expect(writes).toEqual([]);
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
    expect(writes).toEqual([['update', 'users/a/invite', { invitesLeft: 2 }]]);
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
    expect(writes).toHaveLength(20);
  });

  it('장수가 범위를 벗어나면 아무에게도 쓰지 않는다', async () => {
    const { db, writes } = fakeDb({ [left('a')]: 0 });
    await expect(grantInvitesAll(db, ['a'], 4)).rejects.toThrow();
    expect(writes).toEqual([]);
  });
});
