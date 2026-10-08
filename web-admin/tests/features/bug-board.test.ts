import { describe, expect, it } from 'vitest';
import { BUG_PRV_NOTICE_BODY } from '@/entities/bug-board';
import { answerPost } from '@/features/bug-board/answer-post';
import { changeStatus } from '@/features/bug-board/change-status';
import { auditsOf, fakeDb, NOW, withoutAudits } from '../shared/fakeDb';

const entry = (extra: Record<string, unknown> = {}) => ({
  vis: 'pub',
  status: 'new',
  cat: 'bug',
  name: '가나',
  authUid: 'uid1',
  code: 'u1',
  ts: 100,
  openTs: 100,
  title: '공개 제목',
  ansN: 1,
  ...extra,
});

const inboxOf = (writes: ReturnType<typeof fakeDb>['writes']) =>
  writes.filter((w) => w[1].startsWith('inbox/')).map((w) => w[2] as Record<string, unknown>);

describe('답변 등록', () => {
  it('답변 · 상태 · 알림 · 기록이 한 묶음 — 공개 글 알림엔 제목', async () => {
    const { db, writes } = fakeDb({ 'bugBoard/list/p1': entry() });
    const r = await answerPost(db, 'p1', { text: '고쳤어요', vis: 'pub', status: 'fixed' }, 'B-0101-1');
    expect(r).toEqual({ ok: true });
    expect(writes.every((w) => w[0] === 'commit')).toBe(true);
    const paths = withoutAudits(writes).map((w) => w[1]);
    expect(paths).toContain('bugBoard/list/p1/ansN');
    expect(paths.find((p) => p.startsWith('bugBoard/ans/pub/p1/'))).toBeTruthy();
    const [msg] = inboxOf(writes);
    expect(msg).toMatchObject({ tag: 'bug', bugId: 'p1', body: '공개 제목', read: false });
    expect(auditsOf(writes)).toEqual([
      { at: NOW, by: 'admin-uid', action: 'bug.answer', target: 'B-0101-1', detail: '공개 답변 · 수정 완료' },
    ]);
  });

  it('비공개 글 — 공개로 골라도 비공개 답변, 알림 본문 · 기록에 제목 없음', async () => {
    const { db, writes } = fakeDb({ 'bugBoard/list/p1': entry({ vis: 'prv', title: undefined }) });
    await answerPost(
      db,
      'p1',
      { text: '확인 중', vis: 'pub', kakao: 'https://open.kakao.com/o/a' },
      'B-0101-1',
    );
    expect(writes.some((w) => w[1].startsWith('bugBoard/ans/pub/'))).toBe(false);
    expect(writes.some((w) => w[1].startsWith('bugBoard/ans/prv/p1/'))).toBe(true);
    const [msg] = inboxOf(writes);
    expect(msg.body).toBe(`${BUG_PRV_NOTICE_BODY}\n💬 오픈카톡 연결이 함께 왔어요`);
    expect(auditsOf(writes)[0].detail).toBe('비공개 답변 · 접수');
  });

  it('입력이 틀리거나 글이 없으면 아무것도 쓰지 않는다', async () => {
    const { db, writes } = fakeDb({ 'bugBoard/list/p1': entry() });
    expect(await answerPost(db, 'p1', { text: 'a', vis: 'pub', kakao: 'https://x.y/' }, 'n')).toMatchObject({
      ok: false,
    });
    expect(await answerPost(db, 'gone', { text: 'a', vis: 'pub' }, 'n')).toMatchObject({ ok: false });
    expect(writes).toEqual([]);
  });

  it('묶음이 거절되면 답변도 알림도 남지 않는다', async () => {
    const { db, writes } = fakeDb({ 'bugBoard/list/p1': entry() }, (p) => p.startsWith('inbox/'));
    await expect(answerPost(db, 'p1', { text: 'a', vis: 'pub' }, 'n')).rejects.toThrow();
    expect(writes).toEqual([]);
  });
});

describe('상태만 변경', () => {
  it('openTs 를 맞추고 기록에 이전 → 다음', async () => {
    const { db, writes } = fakeDb();
    const item = {
      id: 'p1',
      vis: 'pub',
      status: 'new',
      cat: 'bug',
      name: '',
      authUid: 'uid1',
      code: 'u1',
      ts: 100,
      openTs: 100,
    } as const;
    await changeStatus(db, item, 'fixed', 'B-0101-1');
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'bugBoard/list/p1/status', 'fixed'],
      ['commit', 'bugBoard/list/p1/openTs', null],
    ]);
    expect(auditsOf(writes)[0]).toMatchObject({ action: 'bug.status', detail: '접수 → 수정 완료' });
  });
});
