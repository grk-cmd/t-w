import { describe, expect, it } from 'vitest';
import {
  checkBroadcast,
  deleteBroadcast,
  listBroadcasts,
  sendBroadcast,
  setBroadcastPinned,
  sortBroadcasts,
} from '@/entities/inbox';
import { fakeDb, NOW } from '../shared/fakeDb';

const msg = { tag: 'update' as const, title: ' 새 버전 ', body: ' 고친 점 ' };

describe('수령함 전체 공지', () => {
  it('공용 노드 한 곳에 한 묶음으로 쓴다 — 고정이 아니면 pinned 키가 없다', async () => {
    const { db, writes } = fakeDb();
    await sendBroadcast(db, msg, false, 'b1');
    expect(writes).toEqual([
      ['commit', 'inboxBroadcast/b1', { tag: 'update', title: '새 버전', body: '고친 점', ts: NOW }],
    ]);
  });

  it('고정이면 pinned: true 를 함께 쓴다', async () => {
    const { db, writes } = fakeDb();
    await sendBroadcast(db, msg, true, 'b1');
    expect(writes[0][2]).toMatchObject({ pinned: true });
  });

  it('id 를 안 주면 b 로 시작하는 새 id 를 만든다', async () => {
    const { db, writes } = fakeDb();
    await sendBroadcast(db, msg, false);
    expect(writes[0][1]).toMatch(/^inboxBroadcast\/b[0-9a-z]+$/);
  });

  it('제목 80자 · 본문 600자로 자른다(규칙 한도)', async () => {
    const { db, writes } = fakeDb();
    await sendBroadcast(db, { tag: 'notice', title: 'a'.repeat(100), body: 'b'.repeat(700) }, false, 'b1');
    const v = writes[0][2] as { title: string; body: string };
    expect(v.title).toHaveLength(80);
    expect(v.body).toHaveLength(600);
  });

  it('고정은 pinned 한 필드만 — 풀 때는 키를 지운다', async () => {
    const { db, writes } = fakeDb();
    await setBroadcastPinned(db, 'b1', true);
    await setBroadcastPinned(db, 'b1', false);
    expect(writes).toEqual([
      ['set', 'inboxBroadcast/b1/pinned', true],
      ['remove', 'inboxBroadcast/b1/pinned', undefined],
    ]);
  });

  it('삭제는 그 공지 하나만', async () => {
    const { db, writes } = fakeDb();
    await deleteBroadcast(db, 'b1');
    expect(writes).toEqual([['remove', 'inboxBroadcast/b1', undefined]]);
  });

  it('목록 — 고정이 맨 위, 그 안에서 최근 것부터, 모르는 태그는 공지로', async () => {
    const { db } = fakeDb({
      inboxBroadcast: {
        old: { tag: 'notice', title: '옛', ts: 1 },
        new: { tag: 'reward', title: '새', body: '내용', ts: 3 },
        pin: { tag: 'weird', title: '고정', ts: 2, pinned: true },
      },
    });
    const list = await listBroadcasts(db);
    expect(list.map((b) => b.id)).toEqual(['pin', 'new', 'old']);
    expect(list[0]).toEqual({ id: 'pin', tag: 'notice', title: '고정', body: '', ts: 2, pinned: true });
    expect(await listBroadcasts(fakeDb().db)).toEqual([]);
    expect(sortBroadcasts({})).toEqual([]);
  });

  it('제목 · 내용 둘 다 있어야 보낸다', () => {
    expect(checkBroadcast({ tag: 'notice', title: '', body: '내용' })).not.toBeNull();
    expect(checkBroadcast({ tag: 'notice', title: '제목', body: ' ' })).not.toBeNull();
    expect(checkBroadcast({ tag: 'notice', title: '제목', body: '내용' })).toBeNull();
  });
});
