import { describe, expect, it } from 'vitest';
import { ACTION_LABEL } from '@/entities/admin-log';
import {
  BUG_BODY_MAX,
  BUG_TITLE_MAX,
  checkEdit,
  editChanges,
  editWrite,
  type BugAnswer,
  type BugContent,
  type EditInput,
} from '@/entities/bug-board';
import { editAsk, editPost } from '@/features/bug-board/edit-post';
import { auditsOf, fakeDb, NOW, withoutAudits } from '../shared/fakeDb';

const item = { id: 'p1', vis: 'pub' as const, authUid: 'uid1', cat: 'bug', notice: false };
const content: BugContent = { title: '옛 제목', body: '옛 본문', env: 'Windows 11' };
const input = (extra: Partial<EditInput> = {}): EditInput => ({
  title: '새 제목',
  body: '새 본문',
  cat: 'bug',
  vis: 'pub',
  ...extra,
});
const pubAns: BugAnswer = {
  id: 'r1',
  vis: 'pub',
  text: '공개 답',
  ts: 10,
  kakao: 'https://open.kakao.com/o/x',
};
const prvAns: BugAnswer = { id: 'r2', vis: 'prv', text: '비공개 답', ts: 20 };

describe('수정 입력 확인 — 앱 checkPost · 규칙 길이와 같다', () => {
  it('빈 칸 · 길이 · 분류 · 공지 비공개', () => {
    expect(checkEdit(item, input())).toBeNull();
    expect(checkEdit(item, input({ title: '  ' }))).toBe('제목 필요');
    expect(checkEdit(item, input({ body: '' }))).toBe('본문 필요');
    expect(checkEdit(item, input({ title: 'a'.repeat(BUG_TITLE_MAX) }))).toBeNull();
    expect(checkEdit(item, input({ title: 'a'.repeat(BUG_TITLE_MAX + 1) }))).toMatch(/60자/);
    expect(checkEdit(item, input({ body: 'a'.repeat(BUG_BODY_MAX + 1) }))).toMatch(/2000자/);
    expect(checkEdit(item, input({ cat: 'nope' }))).toBe('분류 필요');
    expect(checkEdit(item, input({ cat: 'toString' }))).toBe('분류 필요');
    expect(checkEdit({ notice: true }, input({ vis: 'prv' }))).toBe('공지는 공개 글만');
  });
});

describe('수정 쓰기 — 경로', () => {
  it('공개 그대로: 목록 줄 vis · cat · title + 내용(env 유지)만, ts · status · no 등은 안 건드림', () => {
    const w = editWrite(item, content, [pubAns], input({ title: ' 새 제목 ', cat: 'ui' }));
    expect(w).toEqual({
      'bugBoard/list/p1/vis': 'pub',
      'bugBoard/list/p1/cat': 'ui',
      'bugBoard/list/p1/title': '새 제목',
      'bugBoard/pub/p1': { title: '새 제목', body: '새 본문', env: 'Windows 11' },
    });
  });

  it('공개 → 비공개: 목록 제목 지움 · 내용 prv 로 이사 · 공개 답변도 prv 로', () => {
    const w = editWrite(item, content, [pubAns, prvAns], input({ vis: 'prv' }));
    expect(w).toEqual({
      'bugBoard/list/p1/vis': 'prv',
      'bugBoard/list/p1/cat': 'bug',
      'bugBoard/list/p1/title': null,
      'bugBoard/prv/uid1/p1': { title: '새 제목', body: '새 본문', env: 'Windows 11' },
      'bugBoard/pub/p1': null,
      'bugBoard/ans/prv/p1/r1': { text: '공개 답', ts: 10, kakao: 'https://open.kakao.com/o/x' },
      'bugBoard/ans/pub/p1': null,
    });
  });

  it('비공개 → 공개: 목록에 제목 되살림 · 내용 pub 로 · 비공개 답변은 그대로', () => {
    const prvItem = { ...item, vis: 'prv' as const };
    const w = editWrite(prvItem, { title: 'a', body: 'b' }, [prvAns], input({ vis: 'pub' }));
    expect(w).toEqual({
      'bugBoard/list/p1/vis': 'pub',
      'bugBoard/list/p1/cat': 'bug',
      'bugBoard/list/p1/title': '새 제목',
      'bugBoard/pub/p1': { title: '새 제목', body: '새 본문' },
      'bugBoard/prv/uid1/p1': null,
    });
  });

  it('비공개 그대로: 목록 줄에 제목을 넣지 않는다', () => {
    const prvItem = { ...item, vis: 'prv' as const };
    const w = editWrite(prvItem, content, [], input({ vis: 'prv' }));
    expect(w['bugBoard/list/p1/title']).toBeNull();
    expect(w['bugBoard/prv/uid1/p1']).toEqual({ title: '새 제목', body: '새 본문', env: 'Windows 11' });
    expect(Object.keys(w)).not.toContain('bugBoard/pub/p1');
  });

  it('넘치는 길이는 잘라서 쓴다', () => {
    const w = editWrite(item, null, [], input({ title: 'a'.repeat(99), body: 'b'.repeat(3000) }));
    expect(w['bugBoard/pub/p1']).toEqual({
      title: 'a'.repeat(BUG_TITLE_MAX),
      body: 'b'.repeat(BUG_BODY_MAX),
    });
  });

  it('바뀐 칸 이름 — 글자는 넣지 않는다', () => {
    expect(editChanges(item, content, input({ title: '옛 제목', body: '옛 본문' }))).toEqual([]);
    expect(editChanges(item, content, input({ cat: 'etc', vis: 'prv' }))).toEqual([
      '제목',
      '본문',
      '분류 오류 · 멈춤 → 기타',
      '공개 → 비공개',
    ]);
  });
});

describe('제보 수정 — 한 묶음 + 작업 기록', () => {
  const data = () => ({
    'bugBoard/list/p1': {
      vis: 'pub',
      status: 'fixed',
      cat: 'bug',
      name: '가나',
      authUid: 'uid1',
      code: 'u1',
      ts: 100,
      title: '옛 제목',
      no: 'B-0101-1',
      ansN: 1,
    },
    'bugBoard/pub/p1': { title: '옛 제목', body: '옛 본문' },
    'bugBoard/ans/pub/p1': { r1: { text: '공개 답', ts: 10 } },
  });

  it('공개 → 비공개 — 모든 쓰기가 commit 하나 · 기록엔 번호와 바뀐 칸만', async () => {
    const { db, writes } = fakeDb(data());
    const r = await editPost(db, 'p1', input({ title: '비밀 제목', vis: 'prv' }), 'B-0101-1');
    expect(r).toEqual({ ok: true });
    expect(writes.every((w) => w[0] === 'commit')).toBe(true);
    const paths = withoutAudits(writes).map((w) => w[1]);
    expect(paths).toEqual(
      expect.arrayContaining([
        'bugBoard/list/p1/title',
        'bugBoard/prv/uid1/p1',
        'bugBoard/pub/p1',
        'bugBoard/ans/prv/p1/r1',
        'bugBoard/ans/pub/p1',
      ]),
    );
    expect(paths.some((p) => /\/(ts|status|no|ansN|likeN|openTs)$/.test(p))).toBe(false);
    expect(auditsOf(writes)).toEqual([
      {
        at: NOW,
        by: 'admin-uid',
        action: 'bug.edit',
        target: 'B-0101-1',
        detail: '제목 · 본문 · 공개 → 비공개',
      },
    ]);
    expect(JSON.stringify(auditsOf(writes))).not.toContain('비밀 제목');
  });

  it('바뀐 것 없음 · 없는 글 · 잘못된 입력은 쓰지 않는다', async () => {
    const { db, writes } = fakeDb(data());
    expect(await editPost(db, 'p1', input({ title: '옛 제목', body: '옛 본문' }), 'x')).toEqual({
      ok: false,
      reason: '바뀐 것 없음',
    });
    expect((await editPost(db, 'nope', input(), 'x')).ok).toBe(false);
    expect((await editPost(db, 'p1', input({ title: '' }), 'x')).ok).toBe(false);
    expect(writes).toEqual([]);
  });

  it('기록 이름 · 확인 문구', () => {
    expect(ACTION_LABEL['bug.edit']).toBe('제보 수정');
    expect(editAsk('B-0101-1', ['제목'], false)).toBe('B-0101-1 제보를 고칠까요? (제목)');
    expect(editAsk('B-0101-1', ['공개 → 비공개'], true)).toMatch(/우편함 알림/);
  });
});
