import { describe, expect, it } from 'vitest';
import { ACTION_LABEL } from '@/entities/admin-log';
import { answerDeleteWrite, type BugAnswer } from '@/entities/bug-board';
import { deleteAnswer } from '@/features/bug-board/delete-answer';
import { AUDIT_ACTIONS } from '@/shared/api';
import { auditsOf, fakeDb, NOW, withoutAudits } from '../shared/fakeDb';

const pubAns: BugAnswer = { id: 'r1', vis: 'pub', text: '공개 답', ts: 10 };
const prvAns: BugAnswer = { id: 'r2', vis: 'prv', text: '비밀 답', ts: 30 };

const listRow = (vis: 'pub' | 'prv', extra: Record<string, unknown> = {}) => ({
  vis,
  status: 'checking',
  cat: 'bug',
  name: '철수',
  authUid: 'u1',
  code: 'MATE-AB12',
  ts: 1,
  ansN: 2,
  lastReplyTs: 30,
  ...extra,
});

describe('답변 삭제 쓰기 — 경로 · ansN · lastReplyTs', () => {
  it('답변 null + 남은 운영자 답변 수 · 가장 늦은 ts', () => {
    expect(answerDeleteWrite('p1', prvAns, [pubAns, { ts: 20 }])).toEqual({
      'bugBoard/ans/prv/p1/r2': null,
      'bugBoard/list/p1/ansN': 2,
      'bugBoard/list/p1/lastReplyTs': 20,
    });
  });

  it('마지막 답변이면 ansN 0 · lastReplyTs 칸을 비운다', () => {
    expect(answerDeleteWrite('p1', pubAns, [])).toEqual({
      'bugBoard/ans/pub/p1/r1': null,
      'bugBoard/list/p1/ansN': 0,
      'bugBoard/list/p1/lastReplyTs': null,
    });
  });

  it('글쓴이 답글은 남은 수 · 시각에 넣지 않는다', () => {
    expect(answerDeleteWrite('p1', pubAns, [{ ts: 99, byAuthor: true }])).toMatchObject({
      'bugBoard/list/p1/ansN': 0,
      'bugBoard/list/p1/lastReplyTs': null,
    });
  });
});

describe('답변 삭제 — 한 묶음 + 작업 기록', () => {
  it('공개 글 — 서버에서 다시 읽은 답변 기준으로 다시 센다', async () => {
    const { db, writes } = fakeDb({
      'bugBoard/list/p1': listRow('pub', { ansN: 7 }),
      'bugBoard/ans/pub/p1': { r1: { text: '공개 답', ts: 10 } },
      // 화면을 연 뒤 다른 관리자가 단 답변도 남은 수에 들어간다
      'bugBoard/ans/prv/p1': { r2: { text: '비밀 답', ts: 30 }, r3: { text: '새 답', ts: 40 } },
    });
    expect(await deleteAnswer(db, 'p1', prvAns, 'B-0101-1')).toEqual({ ok: true });
    expect(writes.every((w) => w[0] === 'commit')).toBe(true);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'bugBoard/ans/prv/p1/r2', null],
      ['commit', 'bugBoard/list/p1/ansN', 2],
      ['commit', 'bugBoard/list/p1/lastReplyTs', 40],
    ]);
    expect(auditsOf(writes)).toEqual([
      {
        at: NOW,
        by: 'admin-uid',
        action: 'bug.answerDelete',
        target: 'B-0101-1',
        detail: '비공개 답변 · 남은 답변 2',
      },
    ]);
    expect(JSON.stringify(auditsOf(writes))).not.toContain('비밀');
  });

  it('비공개 글 — prv 갈래만 읽고 지운다(남은 공개 답변 칸은 세지 않음)', async () => {
    const { db, writes } = fakeDb({
      'bugBoard/list/p2': listRow('prv'),
      'bugBoard/ans/pub/p2': { old: { text: '옛 공개 답', ts: 50 } },
      'bugBoard/ans/prv/p2': { r2: { text: '비밀 답', ts: 30 } },
    });
    expect(await deleteAnswer(db, 'p2', prvAns, 'B-0101-2')).toEqual({ ok: true });
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'bugBoard/ans/prv/p2/r2', null],
      ['commit', 'bugBoard/list/p2/ansN', 0],
      ['commit', 'bugBoard/list/p2/lastReplyTs', null],
    ]);
  });

  it('비공개 글의 공개 답변 · 없는 답변 · 없는 글 · 글쓴이 답글은 쓰지 않는다', async () => {
    const { db, writes } = fakeDb({
      'bugBoard/list/p2': listRow('prv'),
      'bugBoard/ans/pub/p2': { r1: { text: '공개 답', ts: 10 } },
      'bugBoard/ans/prv/p2': { r2: { text: '비밀 답', ts: 30 } },
    });
    expect((await deleteAnswer(db, 'p2', pubAns, 'x')).ok).toBe(false);
    expect((await deleteAnswer(db, 'p2', { ...prvAns, id: 'gone' }, 'x')).ok).toBe(false);
    expect((await deleteAnswer(db, 'nope', prvAns, 'x')).ok).toBe(false);
    expect((await deleteAnswer(db, 'p2', { ...prvAns, byAuthor: true }, 'x')).ok).toBe(false);
    expect(writes).toEqual([]);
  });

  it('기록 이름 · 허용 목록', () => {
    expect(ACTION_LABEL['bug.answerDelete']).toBe('답변 삭제');
    expect(AUDIT_ACTIONS).toContain('bug.answerDelete');
  });
});
