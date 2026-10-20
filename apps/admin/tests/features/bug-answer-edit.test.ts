import { describe, expect, it } from 'vitest';
import { ACTION_LABEL } from '@/entities/admin-log';
import { answerEditChanges, answerEditWrite, BUG_ANS_MAX, type BugAnswer } from '@/entities/bug-board';
import { editAnswer } from '@/features/bug-board/edit-answer';
import { auditsOf, fakeDb, NOW, withoutAudits } from '../shared/fakeDb';

const pubAns: BugAnswer = {
  id: 'r1',
  vis: 'pub',
  text: '옛 답',
  ts: 10,
  kakao: 'https://open.kakao.com/o/x',
};
const prvAns: BugAnswer = { id: 'r2', vis: 'prv', text: '비밀 답', ts: 20 };

describe('답변 수정 쓰기 — 경로', () => {
  it('같은 자리에 통째로 · ts 는 그대로 · 링크를 비우면 kakao 칸이 빠진다', () => {
    expect(answerEditWrite('p1', pubAns, { text: ' 새 답 ', kakao: pubAns.kakao })).toEqual({
      'bugBoard/ans/pub/p1/r1': { text: '새 답', ts: 10, kakao: 'https://open.kakao.com/o/x' },
    });
    expect(answerEditWrite('p1', pubAns, { text: '새 답', kakao: '  ' })).toEqual({
      'bugBoard/ans/pub/p1/r1': { text: '새 답', ts: 10 },
    });
    expect(answerEditWrite('p1', prvAns, { text: 'a'.repeat(BUG_ANS_MAX + 5) })).toEqual({
      'bugBoard/ans/prv/p1/r2': { text: 'a'.repeat(BUG_ANS_MAX), ts: 20 },
    });
  });

  it('바뀐 칸 이름 — 글자는 넣지 않는다', () => {
    expect(answerEditChanges(pubAns, { text: '옛 답', kakao: pubAns.kakao })).toEqual([]);
    expect(answerEditChanges(pubAns, { text: '새 답', kakao: '' })).toEqual(['내용', '오픈카톡 링크']);
    expect(answerEditChanges(prvAns, { text: '비밀 답', kakao: 'https://open.kakao.com/o/y' })).toEqual([
      '오픈카톡 링크',
    ]);
  });
});

describe('답변 수정 — 한 묶음 + 작업 기록', () => {
  const data = () => ({
    'bugBoard/ans/pub/p1/r1': { text: '옛 답', ts: 10, kakao: 'https://open.kakao.com/o/x' },
    'bugBoard/ans/prv/p1/r2': { text: '비밀 답', ts: 20 },
  });

  it('답변 한 줄만 · ansN · 상태 · lastReplyTs · 우편함은 건드리지 않음', async () => {
    const { db, writes } = fakeDb(data());
    const r = await editAnswer(db, 'p1', prvAns, { text: '새 비밀 답' }, 'B-0101-1');
    expect(r).toEqual({ ok: true });
    expect(writes.every((w) => w[0] === 'commit')).toBe(true);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'bugBoard/ans/prv/p1/r2', { text: '새 비밀 답', ts: 20 }],
    ]);
    expect(auditsOf(writes)).toEqual([
      {
        at: NOW,
        by: 'admin-uid',
        action: 'bug.answerEdit',
        target: 'B-0101-1',
        detail: '비공개 답변 · 내용',
      },
    ]);
    expect(JSON.stringify(auditsOf(writes))).not.toContain('비밀');
  });

  it('바뀐 것은 서버에 있는 답변 기준으로 센다', async () => {
    const { db } = fakeDb(data());
    const stale = { ...pubAns, text: '화면에 남은 옛 글자' };
    expect(await editAnswer(db, 'p1', stale, { text: '옛 답', kakao: pubAns.kakao }, 'x')).toEqual({
      ok: false,
      reason: '바뀐 것 없음',
    });
  });

  it('지워졌거나 옮겨진 답변 · 글쓴이 답글 · 잘못된 입력은 쓰지 않는다', async () => {
    const { db, writes } = fakeDb(data());
    const moved = { ...pubAns, vis: 'prv' as const };
    expect((await editAnswer(db, 'p1', moved, { text: '새 답' }, 'x')).ok).toBe(false);
    expect((await editAnswer(db, 'gone', pubAns, { text: '새 답' }, 'x')).ok).toBe(false);
    expect((await editAnswer(db, 'p1', { ...pubAns, byAuthor: true }, { text: '새 답' }, 'x')).ok).toBe(
      false,
    );
    expect((await editAnswer(db, 'p1', pubAns, { text: '  ' }, 'x')).ok).toBe(false);
    expect(
      (await editAnswer(db, 'p1', pubAns, { text: '새 답', kakao: 'https://evil.example' }, 'x')).ok,
    ).toBe(false);
    expect(writes).toEqual([]);
  });

  it('기록 이름', () => {
    expect(ACTION_LABEL['bug.answerEdit']).toBe('답변 수정');
  });
});
