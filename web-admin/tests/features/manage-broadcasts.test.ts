import { describe, expect, it } from 'vitest';
import type { InboxBroadcast } from '@/entities/inbox';
import { deleteBroadcasts, pinTargets, setBroadcastsPinned } from '@/features/notice/manage-broadcast';
import { auditsOf, fakeDb, withoutAudits } from '../shared/fakeDb';

const b = (id: string, pinned: boolean): InboxBroadcast => ({
  id,
  pinned,
  tag: 'notice',
  title: id,
  body: '',
  ts: 1,
});

describe('선택 공지', () => {
  it('고정 · 해제는 상태가 바뀌는 것만 고른다', () => {
    const list = [b('a', true), b('b', false), b('c', false)];
    expect(pinTargets(list, true)).toEqual(['b', 'c']);
    expect(pinTargets(list, false)).toEqual(['a']);
  });

  it('고정은 pinned: true, 해제는 키를 지운다 — 한 묶음, 기록은 묶음마다 한 줄', async () => {
    const { db, writes } = fakeDb();
    expect(await setBroadcastsPinned(db, ['a', 'b'], true)).toBe(2);
    expect(await setBroadcastsPinned(db, ['c'], false)).toBe(1);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'inboxBroadcast/a/pinned', true],
      ['commit', 'inboxBroadcast/b/pinned', true],
      ['commit', 'inboxBroadcast/c/pinned', null],
    ]);
    expect(auditsOf(writes).map((a) => [a.action, a.target, a.detail])).toEqual([
      ['notice.pin', '2개', 'a, b'],
      ['notice.unpin', 'c', undefined],
    ]);
  });

  it('삭제는 공지 노드를 한 묶음으로 지우고, 하나라도 막히면 아무것도 지우지 않는다(기록도)', async () => {
    const ok = fakeDb();
    expect(await deleteBroadcasts(ok.db, ['a', 'b'])).toBe(2);
    expect(withoutAudits(ok.writes)).toEqual([
      ['commit', 'inboxBroadcast/a', null],
      ['commit', 'inboxBroadcast/b', null],
    ]);
    expect(auditsOf(ok.writes).map((a) => a.action)).toEqual(['notice.broadcastDelete']);

    const denied = fakeDb({}, (p) => p === 'inboxBroadcast/b');
    await expect(deleteBroadcasts(denied.db, ['a', 'b'])).rejects.toThrow();
    expect(denied.writes).toEqual([]);
  });

  it('대상이 없으면 아무것도 보내지 않는다', async () => {
    const { db, writes } = fakeDb({}, () => true);
    expect(await setBroadcastsPinned(db, [], true)).toBe(0);
    expect(await deleteBroadcasts(db, [])).toBe(0);
    expect(writes).toEqual([]);
  });
});
