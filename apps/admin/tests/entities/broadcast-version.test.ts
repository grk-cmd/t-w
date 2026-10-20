import { describe, expect, it } from 'vitest';
import { BROADCAST_META, broadcastCommit, sendBroadcast, withBroadcastVersion } from '@/entities/inbox';
import { deleteBroadcasts, setBroadcastsPinned } from '@/features/notice/manage-broadcast';
import type { Db } from '@/shared/api';
import { fakeDb, NOW } from '../shared/fakeDb';

const denied = (db: Db, commits: Record<string, unknown>[]): Db => ({
  ...db,
  commit: async (u) => {
    if (BROADCAST_META in u) {
      throw Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });
    }
    commits.push(u);
  },
});

const quiet = async (run: () => Promise<unknown>) => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    await run();
  } finally {
    console.warn = warn;
  }
};

describe('공용 공지 버전(inboxBroadcastMeta)', () => {
  it('공지 경로를 건드리는 묶음에 버전(서버 시각)을 얹는다 — 원래 묶음은 건드리지 않는다', () => {
    const updates = { 'inboxBroadcast/b1/pinned': true };
    expect(withBroadcastVersion(updates, NOW)).toEqual({
      'inboxBroadcast/b1/pinned': true,
      inboxBroadcastMeta: NOW,
    });
    expect(updates).toEqual({ 'inboxBroadcast/b1/pinned': true });
  });

  it('공지 경로가 없으면 묶음을 그대로 돌려준다 — 이름만 비슷한 경로도', () => {
    const updates = { 'inbox/u1/m1': null, 'inboxBroadcastX/b1': null };
    expect(withBroadcastVersion(updates, NOW)).toBe(updates);
  });

  it('보내기 · 고정 · 삭제가 모두 공지와 버전을 한 번의 db.commit 으로 보낸다', async () => {
    const commits: Record<string, unknown>[] = [];
    const { db } = fakeDb();
    const spy: Db = { ...db, commit: async (u) => void commits.push(u) };
    await sendBroadcast(spy, { tag: 'notice', title: '공지', body: '본문' }, false, 'b1');
    await setBroadcastsPinned(spy, ['b1'], true);
    await deleteBroadcasts(spy, ['b1']);
    expect(commits).toHaveLength(3);
    for (const c of commits) expect(c[BROADCAST_META]).toBe(NOW);
    expect(commits[0]).toHaveProperty(['inboxBroadcast/b1']);
    expect(commits[1]).toHaveProperty(['inboxBroadcast/b1/pinned'], true);
    expect(commits[2]).toHaveProperty(['inboxBroadcast/b1'], null);
  });

  it('빈 묶음이면 아무것도 보내지 않는다', async () => {
    const { db, writes } = fakeDb();
    await broadcastCommit(db, {});
    expect(writes).toEqual([]);
  });

  it('규칙에 inboxBroadcastMeta 가 없어 거절되면(운영 규칙 배포 전) 공지만 다시 쓴다', async () => {
    const commits: Record<string, unknown>[] = [];
    const { db } = fakeDb();
    await quiet(() => deleteBroadcasts(denied(db, commits), ['b1']));
    expect(commits).toHaveLength(1);
    expect(commits[0]).toHaveProperty(['inboxBroadcast/b1'], null);
    expect(commits[0]).not.toHaveProperty([BROADCAST_META]);
  });

  it('권한 말고 다른 이유로 실패하면 다시 쓰지 않고 그대로 실패한다', async () => {
    let calls = 0;
    const { db } = fakeDb();
    const broken: Db = {
      ...db,
      commit: async () => {
        calls++;
        throw new Error('network');
      },
    };
    await expect(broadcastCommit(broken, { 'inboxBroadcast/b1': null })).rejects.toThrow('network');
    expect(calls).toBe(1);
  });
});
