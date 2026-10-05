import { describe, expect, it } from 'vitest';
import { checkBroadcast, listBroadcasts, sendBroadcast, sortBroadcasts } from '@/entities/inbox';
import { fakeDb, withoutAudits, NOW } from '../shared/fakeDb';

const msg = { tag: 'update' as const, title: ' 새 버전 ', body: ' 고친 점 ' };

describe('수령함 전체 공지', () => {
  it('공용 노드 한 곳에 한 묶음으로 쓴다 — 고정이 아니면 pinned 키가 없다', async () => {
    const { db, writes } = fakeDb();
    await sendBroadcast(db, msg, false, 'b1');
    expect(withoutAudits(writes)).toEqual([
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

  it('목록 — 고정이 맨 위, 그 안에서 최근 것부터, 모르는 태그는 공지로', async () => {
    const { db } = fakeDb({
      inboxBroadcast: {
        old: { tag: 'notice', title: '옛', ts: 1 },
        new: { tag: 'reward', title: '새', body: '내용', ts: 3 },
        pin: { tag: 'weird', title: '고정', ts: 2, pinned: true },
      },
    });
    const { items: list, hasMore } = await listBroadcasts(db);
    expect(list.map((b) => b.id)).toEqual(['pin', 'new', 'old']);
    expect(list[0]).toEqual({ id: 'pin', tag: 'notice', title: '고정', body: '', ts: 2, pinned: true });
    expect(hasMore).toBe(false);
    expect(await listBroadcasts(fakeDb().db)).toEqual({ items: [], hasMore: false });
    expect(sortBroadcasts({})).toEqual([]);
  });

  it('목록 — 최근 n 개만 받고, 오래된 고정 공지는 개수와 상관없이 함께 받는다', async () => {
    const all = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`b${i}`, { tag: 'notice', title: `${i}`, ts: i }]),
    );
    const { db } = fakeDb({
      inboxBroadcast: { ...all, pinOld: { tag: 'notice', title: '옛 고정', ts: -1, pinned: true } },
    });
    const asked: unknown[] = [];
    const { getLast, getEqual } = db;
    db.getLast = (path, child, n) => (asked.push(['last', path, child, n]), getLast(path, child, n));
    db.getEqual = (path, child, v) => (asked.push(['equal', path, child, v]), getEqual(path, child, v));
    db.get = async () => {
      throw new Error('통째로 받지 않는다');
    };

    const first = await listBroadcasts(db, 2);
    expect(first.items.map((b) => b.id)).toEqual(['pinOld', 'b4', 'b3']);
    expect(first.hasMore).toBe(true);
    expect(asked).toEqual([
      ['last', 'inboxBroadcast', 'ts', 2],
      ['equal', 'inboxBroadcast', 'pinned', true],
    ]);
    const more = await listBroadcasts(db, 8);
    expect(more.items).toHaveLength(6);
    expect(more.hasMore).toBe(false);
  });

  it('규칙에 .indexOn 이 없어 범위 조회가 거절되면 통째로 받아 같은 결과를 낸다', async () => {
    const { db } = fakeDb({
      inboxBroadcast: {
        a: { tag: 'notice', title: 'a', ts: 1 },
        b: { tag: 'notice', title: 'b', ts: 2 },
        c: { tag: 'notice', title: 'c', ts: 3 },
        p: { tag: 'notice', title: 'p', ts: 0, pinned: true },
      },
    });
    const missing = async () => {
      throw new Error('Index not defined, add ".indexOn": "ts", for path "/inboxBroadcast", to the rules');
    };
    db.getLast = missing;
    db.getEqual = missing;
    const r = await listBroadcasts(db, 2);
    expect(r.items.map((b) => b.id)).toEqual(['p', 'c', 'b']);
    expect(r.hasMore).toBe(true);
    db.getLast = async () => {
      throw new Error('Permission denied');
    };
    await expect(listBroadcasts(db, 2)).rejects.toThrow('Permission denied');
  });

  it('제목 · 내용 둘 다 있어야 보낸다', () => {
    expect(checkBroadcast({ tag: 'notice', title: '', body: '내용' })).not.toBeNull();
    expect(checkBroadcast({ tag: 'notice', title: '제목', body: ' ' })).not.toBeNull();
    expect(checkBroadcast({ tag: 'notice', title: '제목', body: '내용' })).toBeNull();
  });
});
