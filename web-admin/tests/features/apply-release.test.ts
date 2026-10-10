import { describe, expect, it } from 'vitest';
import type { Todo } from '@/entities/admin/todo';
import { BUG_PRV_NOTICE_BODY, toBugItem, type BugItem } from '@/entities/bug-board';
import {
  applyReleaseFixes,
  checkTemplate,
  fillTemplate,
  fixTargets,
  getReleaseTpl,
  previewReleaseFixes,
  releasedReports,
  RELEASE_TPL_DEFAULT,
  RELEASE_TPL_PATH,
  releaseTplWrite,
  tplVars,
} from '@/features/admin-todo/apply-release';
import { auditsOf, fakeDb, NOW, withoutAudits, type Write } from '../shared/fakeDb';

const R1 = '-OaAAAAAAAAAAAAAAAA1';
const R2 = '-OaAAAAAAAAAAAAAAAA2';
const R3 = '-OaAAAAAAAAAAAAAAAA3';
const R4 = '-OaAAAAAAAAAAAAAAAA4';

const todo = (id: string, extra: Partial<Todo> = {}): Todo => ({
  id,
  title: `할 일 ${id}`,
  memo: '',
  status: 'done',
  assignee: null,
  assigneeName: '',
  reports: [],
  release: '0.11.3',
  createdBy: 'a',
  createdAt: 1,
  updatedBy: 'a',
  updatedAt: 1,
  rev: 0,
  ...extra,
});

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
  no: 'B-1010-1',
  ...extra,
});

const item = (id: string, extra: Record<string, unknown> = {}) => toBugItem(id, entry(extra)) as BugItem;

const inboxOf = (writes: Write[]) =>
  writes
    .filter((w) => w[1].startsWith('inbox/'))
    .map((w) => [w[1], w[2] as Record<string, unknown>] as const);
const pathsOf = (writes: Write[]) => withoutAudits(writes).map((w) => w[1]);

describe('릴리스 반영 — 고를 제보', () => {
  it('완료 · 버전이 최신 이하인 할 일만 — 출시 전 · 진행 중 · 버전 없음은 뺀다', () => {
    const fixes = releasedReports(
      [
        todo('t1', { reports: [R1], release: '0.11.3' }),
        todo('t2', { reports: [R2], release: '0.11.4' }),
        todo('t3', { reports: [R3], status: 'doing' }),
        todo('t4', { reports: [R4], release: '' }),
      ],
      '0.11.3',
    );
    expect(fixes).toEqual([{ rid: R1, release: '0.11.3', todo: '할 일 t1' }]);
  });

  it('베타 버전도 정식이 나왔으면 출시됨 · 최신을 모르면 아무것도', () => {
    const list = [todo('t1', { reports: [R1], release: '0.11.3-beta.1' })];
    expect(releasedReports(list, '0.11.3').map((f) => f.rid)).toEqual([R1]);
    expect(releasedReports(list, '0.11.2')).toEqual([]);
    expect(releasedReports(list, null)).toEqual([]);
  });

  it('여러 할 일에 걸린 제보는 하나로 — 먼저 나간 버전', () => {
    const fixes = releasedReports(
      [
        todo('t1', { reports: [R1, R2], release: '0.11.2' }),
        todo('t2', { reports: [R1], release: '0.11.1' }),
        todo('t3', { reports: [R2], release: '0.11.3' }),
      ],
      '0.11.3',
    );
    expect(fixes).toEqual([
      { rid: R1, release: '0.11.1', todo: '할 일 t2' },
      { rid: R2, release: '0.11.2', todo: '할 일 t1' },
    ]);
  });

  it('미해결(접수 · 확인 중)만 — 수정 완료 · 재현 안 됨 · 지워진 글은 건드리지 않는다, 오래된 글부터', () => {
    const fixes = [R1, R2, R3, R4, 'gone'].map((rid) => ({ rid, release: '0.11.3', todo: 'x' }));
    const items = new Map<string, BugItem | null>([
      [R1, item(R1, { status: 'checking', ts: 300 })],
      [R2, item(R2, { status: 'fixed' })],
      [R3, item(R3, { status: 'norepro' })],
      [R4, item(R4, { status: 'new', ts: 200 })],
      ['gone', null],
    ]);
    expect(fixTargets(fixes, items).map((t) => t.rid)).toEqual([R4, R1]);
  });

  it('미리 보기 — 할 일을 새로 받고 걸린 제보 줄만 읽는다', async () => {
    const { db } = fakeDb({
      adminTodos: {
        t1: { title: '고침', status: 'done', release: '0.11.3', reports: { [R1]: true, [R2]: true }, rev: 1 },
        t2: { title: '나중', status: 'done', release: '0.12.0', reports: { [R3]: true }, rev: 1 },
      },
      [`bugBoard/list/${R1}`]: entry(),
      [`bugBoard/list/${R2}`]: entry({ status: 'fixed' }),
      [`bugBoard/list/${R3}`]: entry(),
    });
    const got = await previewReleaseFixes(db, '0.11.3');
    expect(got.map((t) => [t.rid, t.release, t.todo])).toEqual([[R1, '0.11.3', '고침']]);
  });
});

describe('릴리스 반영 — 템플릿', () => {
  it('변수 채우기 — 비공개 글은 제목 빈칸 · 겹친 빈칸 정리', () => {
    const tpl = '{version} 에서 «{title}» 고침 ({todo})';
    const pub = { release: '0.11.3', todo: '할 일', item: item(R1) };
    expect(fillTemplate(tpl, tplVars(pub))).toBe('0.11.3 에서 «공개 제목» 고침 (할 일)');
    const prv = { ...pub, item: item(R1, { vis: 'prv', title: '비밀 제목' }) };
    expect(fillTemplate('{title} {version} 고침', tplVars(prv))).toBe('0.11.3 고침');
    expect(fillTemplate(RELEASE_TPL_DEFAULT, tplVars(pub))).toMatch(/^0\.11\.3 에서 수정되어/);
    expect(fillTemplate('{version}$&$1', tplVars(pub))).toBe('0.11.3$&$1');
  });

  it('입력 확인 — 빈 값 · 1000자 넘음', () => {
    expect(checkTemplate('  ')).toMatch(/필요/);
    expect(checkTemplate('x'.repeat(1001))).toMatch(/1000자/);
    expect(checkTemplate('x'.repeat(1000))).toBeNull();
  });

  it('저장 · 기본으로 되돌리기 — 같은 묶음에 작업 기록, 읽기는 없거나 빈 값이면 null', async () => {
    const { db } = fakeDb({ [RELEASE_TPL_PATH]: '  ' });
    expect(await getReleaseTpl(db)).toBeNull();
    const w = releaseTplWrite(db, '  {version} 고침  ');
    expect(w[RELEASE_TPL_PATH]).toBe('{version} 고침');
    expect(Object.values(w)[1]).toMatchObject({ action: 'todo.releaseTpl', target: '템플릿 저장' });
    const r = releaseTplWrite(db, null);
    expect(r[RELEASE_TPL_PATH]).toBeNull();
    expect(Object.values(r)[1]).toMatchObject({ action: 'todo.releaseTpl', target: '기본 문구로 되돌림' });
  });
});

describe('릴리스 반영 — 쓰기', () => {
  const setup = (extra: Record<string, unknown> = {}) =>
    fakeDb({
      [`bugBoard/list/${R1}`]: entry(),
      [`bugBoard/list/${R2}`]: entry({ vis: 'prv', title: undefined, code: 'u2', ts: 200, no: undefined }),
      ...extra,
    });
  const targets = () => [
    { rid: R1, release: '0.11.3', todo: '고침', item: item(R1) },
    { rid: R2, release: '0.11.2', todo: '고침', item: item(R2, { vis: 'prv', title: undefined }) },
  ];

  it('답변 달기 — 상태 · openTs · 답변 · lastReplyTs · ansN · 알림 · 기록이 한 묶음', async () => {
    const { db, writes } = setup();
    const r = await applyReleaseFixes(db, targets(), {
      latest: '0.11.3',
      answer: true,
      template: '{version} 에서 고쳤어요 {title}',
    });
    expect(r).toEqual({ ok: true, applied: 2, skipped: 0, notified: 2 });
    expect(writes.every((w) => w[0] === 'commit')).toBe(true);
    const paths = pathsOf(writes);
    expect(paths).toEqual(
      expect.arrayContaining([
        `bugBoard/list/${R1}/status`,
        `bugBoard/list/${R1}/openTs`,
        `bugBoard/list/${R1}/lastReplyTs`,
        `bugBoard/list/${R1}/ansN`,
        `bugBoard/list/${R2}/status`,
      ]),
    );
    const val = (p: string) => withoutAudits(writes).find((w) => w[1] === p)?.[2];
    expect(val(`bugBoard/list/${R1}/status`)).toBe('fixed');
    expect(val(`bugBoard/list/${R1}/openTs`)).toBeNull();
    expect(val(`bugBoard/list/${R1}/ansN`)).toBe(2);
    expect(val(`bugBoard/list/${R1}/lastReplyTs`)).toEqual(NOW);
    const pubAns = withoutAudits(writes).find((w) => w[1].startsWith(`bugBoard/ans/pub/${R1}/`));
    expect(pubAns?.[2]).toEqual({ text: '0.11.3 에서 고쳤어요 공개 제목', ts: NOW });
    // 비공개 글은 비공개 답변 · 제목 없이
    expect(paths.some((p) => p.startsWith(`bugBoard/ans/pub/${R2}`))).toBe(false);
    const prvAns = withoutAudits(writes).find((w) => w[1].startsWith(`bugBoard/ans/prv/${R2}/`));
    expect(prvAns?.[2]).toEqual({ text: '0.11.2 에서 고쳤어요', ts: NOW });
    // 알림은 한 제보에 한 통 — 답변 알림과 같은 모양
    const inbox = inboxOf(writes);
    expect(inbox).toHaveLength(2);
    expect(inbox[0][0]).toMatch(/^inbox\/u1\//);
    expect(inbox[0][1]).toMatchObject({ tag: 'bug', bugId: R1, body: '공개 제목\n0.11.3 에서 고쳐졌어요' });
    expect(inbox[1][1]).toMatchObject({
      tag: 'bug',
      bugId: R2,
      body: `${BUG_PRV_NOTICE_BODY}\n0.11.2 에서 고쳐졌어요`,
    });
    const audits = auditsOf(writes);
    expect(audits.map((a) => [a.action, a.target, a.detail])).toEqual([
      ['bug.answer', 'B-1010-1', '공개 답변 · 수정 완료 · 0.11.3 릴리스 반영'],
      ['bug.answer', R2, '비공개 답변 · 수정 완료 · 0.11.2 릴리스 반영'],
      ['todo.applyRelease', '0.11.3 릴리스 반영', '제보 2건 수정 완료 · 답변 · 알림 2건'],
    ]);
    expect(JSON.stringify(writes)).not.toContain('비밀');
  });

  it('답변 끄면 상태만 — 답변 · 알림 없음 (손으로 상태 바꿀 때와 같은 칸)', async () => {
    const { db, writes } = setup();
    const r = await applyReleaseFixes(db, targets(), { latest: '0.11.3', answer: false, template: '' });
    expect(r).toEqual({ ok: true, applied: 2, skipped: 0, notified: 0 });
    expect(pathsOf(writes).sort()).toEqual(
      [
        `bugBoard/list/${R1}/openTs`,
        `bugBoard/list/${R1}/status`,
        `bugBoard/list/${R2}/openTs`,
        `bugBoard/list/${R2}/status`,
      ].sort(),
    );
    expect(auditsOf(writes).map((a) => [a.action, a.detail])).toEqual([
      ['bug.status', '접수 → 수정 완료 · 0.11.3 릴리스 반영'],
      ['bug.status', '접수 → 수정 완료 · 0.11.2 릴리스 반영'],
      ['todo.applyRelease', '제보 2건 수정 완료 · 답변 없음'],
    ]);
  });

  it('글쓴이 코드가 없으면 알림 없이 답변만', async () => {
    const { db, writes } = setup({ [`bugBoard/list/${R1}`]: entry({ code: '' }) });
    const r = await applyReleaseFixes(db, targets().slice(0, 1), {
      latest: '0.11.3',
      answer: true,
      template: '{version}',
    });
    expect(r).toMatchObject({ ok: true, applied: 1, notified: 0 });
    expect(inboxOf(writes)).toEqual([]);
    expect(auditsOf(writes)[0].detail).toMatch(/알림 없음$/);
  });

  it('미리 본 뒤 그새 수정 완료 · 삭제된 제보는 건너뛴다 — 하나도 없으면 쓰지 않는다', async () => {
    const some = setup({ [`bugBoard/list/${R1}`]: entry({ status: 'fixed' }) });
    const r = await applyReleaseFixes(some.db, targets(), {
      latest: '0.11.3',
      answer: true,
      template: '{version}',
    });
    expect(r).toEqual({ ok: true, applied: 1, skipped: 1, notified: 1 });
    expect(pathsOf(some.writes).some((p) => p.includes(R1))).toBe(false);

    const none = fakeDb({});
    const r2 = await applyReleaseFixes(none.db, targets(), {
      latest: '0.11.3',
      answer: true,
      template: '{version}',
    });
    expect(r2).toEqual({ ok: true, applied: 0, skipped: 2, notified: 0 });
    expect(none.writes).toEqual([]);
  });

  it('빈 템플릿 · 채우면 빈 답변이면 아무것도 쓰지 않는다', async () => {
    const a = setup();
    expect(
      await applyReleaseFixes(a.db, targets(), { latest: '0.11.3', answer: true, template: ' ' }),
    ).toMatchObject({
      ok: false,
    });
    expect(
      await applyReleaseFixes(a.db, targets(), { latest: '0.11.3', answer: true, template: '{title}' }),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/빈 답변/) });
    expect(a.writes).toEqual([]);
  });

  it('«기본으로 저장» — 템플릿도 같은 묶음에, 하나라도 막히면 아무것도 남지 않는다', async () => {
    const { db, writes } = setup();
    await applyReleaseFixes(db, targets(), {
      latest: '0.11.3',
      answer: true,
      template: '{version} 끝',
      saveTpl: true,
    });
    expect(withoutAudits(writes).find((w) => w[1] === RELEASE_TPL_PATH)?.[2]).toBe('{version} 끝');
    expect(auditsOf(writes).some((a) => a.action === 'todo.releaseTpl')).toBe(true);

    const fail = fakeDb({ [`bugBoard/list/${R1}`]: entry() }, (p) => p.startsWith('inbox/'));
    await expect(
      applyReleaseFixes(fail.db, targets().slice(0, 1), {
        latest: '0.11.3',
        answer: true,
        template: '{version}',
      }),
    ).rejects.toThrow();
    expect(fail.writes).toEqual([]);
  });
});
