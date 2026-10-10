import { describe, expect, it } from 'vitest';
import { commitTodo, draftOf, emptyDraft, type Todo } from '@/entities/admin/todo';
import { conflictMessage, deleteTodo, linkReport, saveTodo } from '@/features/admin-todo/edit-todo';
import type { Db } from '@/shared/api';
import { ADMIN_UID, auditsOf, fakeDb, NOW, withoutAudits } from '../shared/fakeDb';

const R1 = '-OaAAAAAAAAAAAAAAAA1';
const R2 = '-OaAAAAAAAAAAAAAAAA2';
const names = new Map([
  [ADMIN_UID, '나관리'],
  ['other', '다른이'],
]);

const stored = (extra: Record<string, unknown> = {}) => ({
  title: '고치기',
  status: 'todo',
  createdBy: 'other',
  createdAt: 10,
  updatedBy: 'other',
  updatedAt: 10,
  rev: 2,
  ...extra,
});

/**
 * 규칙처럼 구는 commit — adminTodos/{id} 를 쓰면 «지금 rev + 1» (새로 만들면 0)만 받는다.
 * beforeCommit 으로 «읽은 뒤 · 쓰기 전» 에 남의 쓰기를 끼워 넣는다.
 */
function rulesDb(data: Record<string, unknown>, beforeCommit?: () => void) {
  const fake = fakeDb(data);
  const db: Db = {
    ...fake.db,
    commit: async (updates) => {
      beforeCommit?.();
      for (const [path, value] of Object.entries(updates)) {
        if (!path.startsWith('adminTodos/') || value === null) continue;
        const cur = data[path] as { rev?: number } | undefined;
        const want = cur ? (cur.rev ?? 0) + 1 : 0;
        if ((value as { rev?: number }).rev !== want)
          throw Object.assign(new Error('PERMISSION_DENIED: Permission denied'), {
            code: 'PERMISSION_DENIED',
          });
      }
      await fake.db.commit(updates);
      for (const [path, value] of Object.entries(updates)) data[path] = value;
    },
  };
  return { db, writes: fake.writes, data };
}

const seenOf = (id: string, v: Record<string, unknown>): Todo => ({
  id,
  title: String(v.title),
  memo: '',
  status: v.status as Todo['status'],
  assignee: (v.assignee as string) ?? null,
  assigneeName: (v.assigneeName as string) ?? '',
  reports: Object.keys((v.reports as object) ?? {}),
  release: (v.release as string) ?? '',
  createdBy: String(v.createdBy),
  createdAt: Number(v.createdAt),
  updatedBy: String(v.updatedBy),
  updatedAt: Number(v.updatedAt),
  rev: Number(v.rev),
});

describe('할 일 쓰기 — 본 rev 그대로일 때만', () => {
  it('릴리스 버전을 넣으면 rev + 1 로 저장 · 기록에 남는다, 모양이 틀리면 쓰지 않는다', async () => {
    const { db, writes, data } = rulesDb({ 'adminTodos/t1': stored() });
    const seen = seenOf('t1', stored());
    const bad = await saveTodo(db, {
      id: 't1',
      seen,
      draft: { ...draftOf(seen), release: '0.11.3 대기' },
      names,
    });
    expect(bad).toMatchObject({ ok: false, reason: expect.stringMatching(/릴리스 버전/) });
    expect(writes).toEqual([]);
    const r = await saveTodo(db, {
      id: 't1',
      seen,
      draft: { ...draftOf(seen), status: 'done', release: '0.11.3' },
      names,
    });
    expect(r).toMatchObject({ ok: true });
    expect(data['adminTodos/t1']).toMatchObject({ rev: 3, status: 'done', release: '0.11.3' });
    expect(auditsOf(writes)[0]).toMatchObject({
      action: 'todo.update',
      detail: '할 일 → 완료 · 릴리스 없음 → 0.11.3',
    });
  });

  it('같은 rev 면 쓴다 — rev + 1 · 작업 기록이 한 묶음', async () => {
    const { db, writes } = rulesDb({ 'adminTodos/t1': stored() });
    const seen = seenOf('t1', stored());
    const r = await saveTodo(db, {
      id: 't1',
      seen,
      draft: { title: '고치기', memo: '', status: 'doing', assignee: ADMIN_UID, reports: [], release: '' },
      names,
    });
    expect(r).toEqual({ ok: true, id: 't1', fixed: 0 });
    expect(writes.every((w) => w[0] === 'commit')).toBe(true);
    const [todo] = withoutAudits(writes);
    expect(todo[1]).toBe('adminTodos/t1');
    expect(todo[2]).toMatchObject({
      rev: 3,
      status: 'doing',
      assignee: ADMIN_UID,
      assigneeName: '나관리',
      createdBy: 'other',
      createdAt: 10,
      updatedBy: ADMIN_UID,
      updatedAt: NOW,
    });
    expect(auditsOf(writes)).toEqual([
      {
        at: NOW,
        by: ADMIN_UID,
        action: 'todo.update',
        target: '고치기',
        detail: '할 일 → 진행 중 · 작업자 없음 → 나관리',
      },
    ]);
  });

  it('★ 화면에서 본 뒤 남이 먼저 고쳤으면 쓰지 않고 최신 값을 돌려준다', async () => {
    const latest = stored({ rev: 3, status: 'doing', updatedBy: 'other' });
    const { db, writes } = rulesDb({ 'adminTodos/t1': latest });
    const r = await saveTodo(db, {
      id: 't1',
      seen: seenOf('t1', stored()),
      draft: { ...emptyDraft(), title: '내 수정' },
      names,
    });
    expect(r).toMatchObject({ ok: false, conflict: true, latest: { rev: 3, status: 'doing' } });
    expect(writes).toEqual([]);
    if (!r.ok && 'conflict' in r)
      expect(conflictMessage(r.latest, names, ADMIN_UID)).toMatch(/다른이님이 바꿨어요/);
  });

  it('★ 읽은 뒤 · 쓰기 직전에 끼어든 쓰기 — 규칙이 거절하면 다시 읽어 충돌로', async () => {
    const data: Record<string, unknown> = { 'adminTodos/t1': stored() };
    const { db, writes } = rulesDb(data, () => {
      data['adminTodos/t1'] = stored({ rev: 3, title: '남의 수정' });
    });
    const r = await saveTodo(db, {
      id: 't1',
      seen: seenOf('t1', stored()),
      draft: { ...emptyDraft(), title: '내 수정' },
      names,
    });
    expect(r).toMatchObject({ ok: false, conflict: true, latest: { rev: 3, title: '남의 수정' } });
    expect(writes).toEqual([]);
  });

  it('권한 거절인데 rev 가 그대로면 충돌이 아니라 오류로 올린다', async () => {
    const { db: base } = rulesDb({ 'adminTodos/t1': stored() });
    const db: Db = {
      ...base,
      commit: async () => {
        throw Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' });
      },
    };
    await expect(commitTodo(db, 't1', 2, { rev: 3 })).rejects.toThrow(/Permission/);
  });

  it('새로 만들기 — 같은 id 가 이미 있으면 충돌, 없으면 rev 0', async () => {
    const { db } = rulesDb({ 'adminTodos/t1': stored() });
    expect(
      await saveTodo(db, { id: 't1', seen: null, draft: { ...emptyDraft(), title: 'x' }, names }),
    ).toMatchObject({
      ok: false,
      conflict: true,
    });
    const fresh = rulesDb({});
    const r = await saveTodo(fresh.db, {
      id: 't2',
      seen: null,
      draft: { ...emptyDraft([R1]), title: '새 일' },
      names,
    });
    expect(r).toEqual({ ok: true, id: 't2', fixed: 0 });
    expect(fresh.data['adminTodos/t2']).toMatchObject({
      rev: 0,
      createdBy: ADMIN_UID,
      reports: { [R1]: true },
    });
    expect(auditsOf(fresh.writes)[0]).toMatchObject({
      action: 'todo.create',
      target: '새 일',
      detail: '할 일 · 제보 1건',
    });
  });

  it('입력이 틀리면 아무것도 쓰지 않는다', async () => {
    const { db, writes } = rulesDb({});
    expect(await saveTodo(db, { id: 't', seen: null, draft: emptyDraft(), names })).toEqual({
      ok: false,
      reason: '제목 필요',
    });
    expect(writes).toEqual([]);
  });

  it('지우기 — 본 rev 그대로일 때만', async () => {
    const { db, writes } = rulesDb({ 'adminTodos/t1': stored({ rev: 5 }) });
    expect(await deleteTodo(db, seenOf('t1', stored()))).toMatchObject({ ok: false, conflict: true });
    expect(writes).toEqual([]);
    expect(await deleteTodo(db, seenOf('t1', stored({ rev: 5 })))).toMatchObject({ ok: true });
    expect(withoutAudits(writes)).toEqual([['commit', 'adminTodos/t1', null]]);
    expect(auditsOf(writes)[0]).toMatchObject({ action: 'todo.delete', target: '고치기' });
  });

  it('지워진 할 일과 충돌하면 그렇게 알려 준다', () => {
    expect(conflictMessage(null, names, ADMIN_UID)).toMatch(/지웠어요/);
  });
});

describe('완료 → 연결된 제보 «수정 완료»', () => {
  const bug = (status: string, extra: Record<string, unknown> = {}) => ({
    vis: 'pub',
    status,
    cat: 'bug',
    name: 'n',
    authUid: 'u',
    code: 'c',
    ts: 100,
    openTs: 100,
    no: 'B-1010-1',
    ...extra,
  });

  it('고르면 미해결 제보만 같은 묶음으로 — 상태 · openTs · 제보 기록', async () => {
    const { db, writes } = rulesDb({
      'adminTodos/t1': stored({ reports: { [R1]: true, [R2]: true } }),
      [`bugBoard/list/${R1}`]: bug('checking'),
      [`bugBoard/list/${R2}`]: bug('norepro', { openTs: undefined, no: 'B-1010-2' }),
    });
    const seen = seenOf('t1', stored({ reports: { [R1]: true, [R2]: true } }));
    const r = await saveTodo(db, {
      id: 't1',
      seen,
      draft: {
        title: '고치기',
        memo: '',
        status: 'done',
        assignee: null,
        reports: [R1, R2, '-OaAAAAAAAAAAAAAAAA3'],
        release: '',
      },
      names,
      markFixed: true,
    });
    expect(r).toEqual({ ok: true, id: 't1', fixed: 1 });
    const paths = Object.fromEntries(withoutAudits(writes).map((w) => [w[1], w[2]]));
    expect(paths[`bugBoard/list/${R1}/status`]).toBe('fixed');
    expect(paths[`bugBoard/list/${R1}/openTs`]).toBeNull();
    expect(paths).not.toHaveProperty(`bugBoard/list/${R2}/status`);
    expect(writes.every((w) => w[0] === 'commit')).toBe(true);
    expect(auditsOf(writes).map((a) => [a.action, a.target])).toEqual(
      expect.arrayContaining([
        ['bug.status', 'B-1010-1'],
        ['todo.update', '고치기'],
      ]),
    );
  });

  it('«아니오» 거나 이미 완료였으면 제보는 그대로', async () => {
    const data = {
      'adminTodos/t1': stored({ reports: { [R1]: true } }),
      [`bugBoard/list/${R1}`]: bug('new'),
    };
    const { db, writes } = rulesDb(data);
    const seen = seenOf('t1', stored({ reports: { [R1]: true } }));
    await saveTodo(db, { id: 't1', seen, draft: { ...emptyDraft([R1]), title: 'a', status: 'done' }, names });
    expect(writes.some((w) => w[1].startsWith('bugBoard/'))).toBe(false);
    const done = rulesDb({ ...data, 'adminTodos/t1': stored({ status: 'done', reports: { [R1]: true } }) });
    const seenDone = seenOf('t1', stored({ status: 'done', reports: { [R1]: true } }));
    await saveTodo(done.db, {
      id: 't1',
      seen: seenDone,
      draft: { ...emptyDraft([R1]), title: 'a', status: 'done' },
      names,
      markFixed: true,
    });
    expect(done.writes.some((w) => w[1].startsWith('bugBoard/'))).toBe(false);
  });

  it('제보 상태가 막히면(묶음 실패) 할 일도 안 바뀐다', async () => {
    const data: Record<string, unknown> = {
      'adminTodos/t1': stored({ reports: { [R1]: true } }),
      [`bugBoard/list/${R1}`]: bug('new'),
    };
    const { db: base, writes } = fakeDb(data, (p) => p.startsWith('bugBoard/'));
    const seen = seenOf('t1', stored({ reports: { [R1]: true } }));
    await expect(
      saveTodo(base, {
        id: 't1',
        seen,
        draft: { ...emptyDraft([R1]), title: 'a', status: 'done' },
        names,
        markFixed: true,
      }),
    ).rejects.toThrow();
    expect(writes).toEqual([]);
  });
});

describe('제보 연결', () => {
  it('붙이기 — rev + 1 로 제보를 더하고, 이미 붙어 있으면 쓰지 않는다', async () => {
    const { db, writes, data } = rulesDb({ 'adminTodos/t1': stored({ reports: { [R1]: true } }) });
    const seen = seenOf('t1', stored({ reports: { [R1]: true } }));
    expect(await linkReport(db, seen, R1, names)).toMatchObject({ ok: true });
    expect(writes).toEqual([]);
    expect(await linkReport(db, seen, R2, names)).toMatchObject({ ok: true });
    expect(data['adminTodos/t1']).toMatchObject({ rev: 3, reports: { [R1]: true, [R2]: true } });
    expect(auditsOf(writes)[0].detail).toBe('제보 +1');
  });

  it('붙여도 릴리스 버전은 그대로', async () => {
    const { db, data } = rulesDb({ 'adminTodos/t1': stored({ release: '0.11.3' }) });
    expect(await linkReport(db, seenOf('t1', stored({ release: '0.11.3' })), R2, names)).toMatchObject({
      ok: true,
    });
    expect(data['adminTodos/t1']).toMatchObject({ rev: 3, release: '0.11.3', reports: { [R2]: true } });
  });

  it('붙이는 사이 남이 고쳤으면 충돌', async () => {
    const { db } = rulesDb({ 'adminTodos/t1': stored({ rev: 7 }) });
    expect(await linkReport(db, seenOf('t1', stored()), R2, names)).toMatchObject({
      ok: false,
      conflict: true,
    });
  });
});
