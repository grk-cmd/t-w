import { describe, expect, it } from 'vitest';
import { createServerAdminNamePort } from '@/entities/admin/name/api/server';
import { createServerTodoPort } from '@/entities/admin/todo';
import { draftOf, emptyDraft, type Todo } from '@/entities/admin/todo';
import { createServerApplyReleasePort } from '@/features/admin-todo/apply-release/api/server';
import { createServerEditNotePort } from '@/features/admin-todo/edit-note/api/server';
import { createServerEditTodoPort } from '@/features/admin-todo/edit-todo/api/server';
import { ApiError, isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);

const wireTodo = (id: string, over: Record<string, unknown> = {}) => ({
  todoId: id,
  title: `제목 ${id}`,
  memo: null,
  status: 'todo',
  type: null,
  assignee: null,
  assigneeName: null,
  reports: [],
  release: null,
  createdBy: 'a1',
  createdAt: '2026-11-01T00:00:00Z',
  updatedBy: 'a1',
  updatedAt: '2026-11-02T00:00:00Z',
  version: 3,
  ...over,
});

const names = new Map([['a1', '민수']]);

describe('관리자 이름표 — API 판', () => {
  it('이름이 있는 관리자만 담는다(이름 null 은 뺀다)', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/admins': () => [
        { authUid: 'a1', name: ' 민수 ' },
        { authUid: 'a2', name: null },
      ],
    });
    expect([...(await createServerAdminNamePort(s.api).names())]).toEqual([['a1', '민수']]);
  });

  it('줄이 약속과 다르면 빈 표로 덮지 않고 던진다', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/admins': () => [{ authUid: 'a1' }] });
    const e = await caught(createServerAdminNamePort(s.api).names());
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('서버에 닿지 못하면 PortError 로 던진다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/admins': () => {
        throw new ApiError('unavailable', 0, '', '끊김');
      },
    });
    const e = await caught(createServerAdminNamePort(s.api).names());
    expect(isPortError(e, 'unreachable')).toBe(true);
  });
});

describe('할 일 읽기 — API 판', () => {
  it('끝까지 이어 받고 줄을 화면 모양으로 바꾼다(version → rev · null → 비움) — 진행 중이 앞', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/todos': (c) =>
        c.query?.cursor === undefined
          ? { items: [wireTodo('t1')], nextCursor: 'c1' }
          : {
              items: [
                wireTodo('t2', {
                  status: 'doing',
                  type: 'bug',
                  memo: '메모',
                  assignee: 'a1',
                  assigneeName: '민수',
                  reports: ['B-1116-1'],
                  release: '0.13.1',
                }),
              ],
              nextCursor: null,
            },
    });
    const list = await createServerTodoPort(s.api).list();
    expect(list.map((t) => t.id)).toEqual(['t2', 't1']);
    expect(list[0]).toMatchObject({
      rev: 3,
      type: 'bug',
      memo: '메모',
      assignee: 'a1',
      assigneeName: '민수',
      reports: ['B-1116-1'],
      release: '0.13.1',
      updatedAt: Date.parse('2026-11-02T00:00:00Z'),
    });
    expect(list[1]).toMatchObject({ memo: '', type: null, assignee: null, assigneeName: '', release: '' });
    expect(s.calls.map((c) => c.query)).toEqual([
      { cursor: undefined, limit: 200 },
      { cursor: 'c1', limit: 200 },
    ]);
  });

  it('모르는 상태 · 빠진 칸은 줄을 버리지 않고 던진다', async () => {
    for (const bad of [wireTodo('t1', { status: 'ZZZ' }), { ...wireTodo('t1'), version: undefined }]) {
      const s = fakeApiOf({ 'GET /v2/admin/todos': () => ({ items: [bad], nextCursor: null }) });
      const e = await caught(createServerTodoPort(s.api).list());
      expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
    }
  });

  it('공용 메모 — 쓴 적 없으면 null, 있으면 번호를 rev 로', async () => {
    const never = fakeApiOf({
      'GET /v2/admin/todo-note': () => ({ text: '', version: 0, updatedBy: null, updatedAt: null }),
    });
    expect(await createServerTodoPort(never.api).note()).toBeNull();
    const written = fakeApiOf({
      'GET /v2/admin/todo-note': () => ({
        text: '메모',
        version: 4,
        updatedBy: 'a1',
        updatedAt: '2026-11-02T00:00:00Z',
      }),
    });
    expect(await createServerTodoPort(written.api).note()).toEqual({
      text: '메모',
      rev: 4,
      updatedBy: 'a1',
      updatedAt: Date.parse('2026-11-02T00:00:00Z'),
    });
  });

  it('메모가 쓴 적 없다면서 번호가 0 이 아니면 던진다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/todo-note': () => ({ text: '', version: 2, updatedBy: null, updatedAt: null }),
    });
    const e = await caught(createServerTodoPort(s.api).note());
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});

const seenTodo = (over: Partial<Todo> = {}): Todo => ({
  id: 't1',
  title: '옛 제목',
  memo: '',
  status: 'todo',
  type: null,
  assignee: null,
  assigneeName: '',
  reports: [],
  release: '',
  createdBy: 'a1',
  createdAt: 1,
  updatedBy: 'a1',
  updatedAt: 1,
  rev: 3,
  ...over,
});

describe('할 일 쓰기 — API 판', () => {
  it('만들기 — version 없이 칸을 그대로(자르지 않고) POST, 서버가 준 id 로 알린다', async () => {
    const s = fakeApiOf({ 'POST /v2/admin/todos': () => wireTodo('srv-1', { version: 0 }) });
    const port = createServerEditTodoPort(s.api);
    const long = 'x'.repeat(500);
    const r = await port.save({
      id: 'client-id',
      seen: null,
      draft: { ...emptyDraft(['B-1116-1'], long, 'bug'), assignee: 'a1', memo: '  메모  ' },
      names,
    });
    expect(r).toEqual({ ok: true, id: 'srv-1', fixed: 0 });
    expect(s.calls[0].body).toEqual({
      title: long,
      memo: '  메모  ',
      status: 'todo',
      type: 'bug',
      assignee: 'a1',
      assigneeName: '민수',
      reports: ['B-1116-1'],
      release: '',
    });
  });

  it('고치기 — 본 version 을 싣는다 · 제보는 건드리지 않는다(markFixed 없이)', async () => {
    const s = fakeApiOf({ 'PATCH /v2/admin/todos/t1': () => wireTodo('t1', { status: 'done', version: 4 }) });
    const port = createServerEditTodoPort(s.api);
    expect(port.fixesReports).toBe(true);
    const seen = seenTodo({ reports: ['B-1116-1'] });
    const r = await port.save({ id: 't1', seen, draft: { ...draftOf(seen), status: 'done' }, names });
    expect(r).toEqual({ ok: true, id: 't1', fixed: 0 });
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].body).toMatchObject({ version: 3, status: 'done', reports: ['B-1116-1'] });
  });

  const done = async (handlers: Parameters<typeof fakeApiOf>[0]) => {
    const s = fakeApiOf({
      'PATCH /v2/admin/todos/t1': () => wireTodo('t1', { status: 'done', version: 4 }),
      ...handlers,
    });
    const seen = seenTodo({ reports: ['B-1116-1', 'B-1116-2', 'B-1116-3'] });
    const r = await createServerEditTodoPort(s.api).save({
      id: 't1',
      seen,
      draft: { ...draftOf(seen), status: 'done' },
      names,
      markFixed: true,
    });
    return { s, r };
  };
  const bug = (status: string, version = 7) => ({ number: 'x', status, version });

  it('완료 + markFixed — 미해결 제보만 읽은 version 으로 FIXED, 다 된 글 · 지워진 글은 건너뛴다', async () => {
    const { s, r } = await done({
      'GET /v2/bugs/B-1116-1': () => bug('NEW', 7),
      'GET /v2/bugs/B-1116-2': () => bug('FIXED'),
      'GET /v2/bugs/B-1116-3': () => {
        throw new ApiError('notFound', 404, 'BUG_NOT_FOUND', '없음');
      },
      'PATCH /v2/admin/bugs/B-1116-1': () => ({}),
    });
    expect(r).toEqual({ ok: true, id: 't1', fixed: 1 });
    const patches = s.calls.filter((c) => c.path.startsWith('/v2/admin/bugs'));
    expect(patches).toHaveLength(1);
    expect(patches[0].body).toEqual({ version: 7, status: 'FIXED' });
  });

  it('일부만 되면 숨기지 않고 안 된 수 · 원인 · 409 여부를 싣는다', async () => {
    const { r } = await done({
      'GET /v2/bugs/B-1116-1': () => bug('NEW'),
      'GET /v2/bugs/B-1116-2': () => bug('CHECKING'),
      'GET /v2/bugs/B-1116-3': () => bug('NEW'),
      'PATCH /v2/admin/bugs/B-1116-1': () => ({}),
      'PATCH /v2/admin/bugs/B-1116-2': () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '다른 곳에서 바꾼 내용을 받아왔어요');
      },
      'PATCH /v2/admin/bugs/B-1116-3': () => {
        throw new ApiError('request', 400, 'INVALID_REQUEST', '안 돼요');
      },
    });
    expect(r).toMatchObject({
      ok: true,
      fixed: 1,
      fixFailed: { count: 2, conflict: true },
    });
  });

  it('서버 400 은 PortError(invalid) 로 서버 문구 그대로 — 미리 거절하지 않는다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/todos': () => {
        throw new ApiError('request', 400, 'OPS_INVALID_TODO', '제목은 1~120자');
      },
    });
    const e = await caught(
      createServerEditTodoPort(s.api).save({ id: 'n', seen: null, draft: emptyDraft([], ''), names }),
    );
    expect(isPortError(e, 'invalid')).toBe(true);
    expect((e as Error).message).toBe('제목은 1~120자');
    expect(s.calls).toHaveLength(1);
  });

  it('409 — 목록을 한 번만 다시 받아 그 할 일의 지금 값을 돌려준다', async () => {
    const s = fakeApiOf({
      'PATCH /v2/admin/todos/t1': () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '충돌');
      },
      'GET /v2/admin/todos': () => ({
        items: [wireTodo('t1', { title: '남의 수정', version: 4 })],
        nextCursor: null,
      }),
    });
    const seen = seenTodo();
    const r = await createServerEditTodoPort(s.api).save({ id: 't1', seen, draft: draftOf(seen), names });
    expect(r).toMatchObject({ ok: false, conflict: true, latest: { title: '남의 수정', rev: 4 } });
    expect(s.calls.filter((c) => c.method === 'GET')).toHaveLength(1);
  });

  it('지우기 — ?version= 으로, 그새 지워졌으면(OPS_TODO_NOT_FOUND) latest null', async () => {
    const ok = fakeApiOf({ 'DELETE /v2/admin/todos/t1': () => null });
    expect(await createServerEditTodoPort(ok.api).delete(seenTodo())).toEqual({
      ok: true,
      id: 't1',
      fixed: 0,
    });
    expect(ok.calls[0].query).toEqual({ version: 3 });
    const gone = fakeApiOf({
      'DELETE /v2/admin/todos/t1': () => {
        throw new ApiError('notFound', 404, 'OPS_TODO_NOT_FOUND', '없음');
      },
      'GET /v2/admin/todos': () => ({ items: [], nextCursor: null }),
    });
    expect(await createServerEditTodoPort(gone.api).delete(seenTodo())).toEqual({
      ok: false,
      conflict: true,
      latest: null,
    });
  });

  it('제보 연결 — 이미 붙어 있으면 보내지 않고, 아니면 제보를 더해 PATCH', async () => {
    const s = fakeApiOf({
      'PATCH /v2/admin/todos/t1': () => wireTodo('t1', { reports: ['B-1116-1', 'B-1116-2'] }),
    });
    const port = createServerEditTodoPort(s.api);
    const todo = seenTodo({ reports: ['B-1116-1'] });
    expect(await port.link(todo, 'B-1116-1', names)).toMatchObject({ ok: true });
    expect(s.calls).toHaveLength(0);
    await port.link(todo, 'B-1116-2', names);
    expect(s.calls[0].body).toMatchObject({ version: 3, reports: ['B-1116-1', 'B-1116-2'] });
  });
});

describe('공용 메모 쓰기 — API 판', () => {
  const stored = { text: '글', version: 1, updatedBy: 'a1', updatedAt: '2026-11-02T00:00:00Z' };

  it('처음이면 version 0 · 글은 끝 공백까지 그대로, 안내 판정은 하지 않는다', async () => {
    const s = fakeApiOf({ 'PUT /v2/admin/todo-note': () => stored });
    const port = createServerEditNotePort(s.api);
    expect(port.check('x'.repeat(5000))).toBeNull();
    expect(await port.save(null, '첫 메모  \n')).toEqual({ ok: true });
    expect(s.calls[0].body).toEqual({ version: 0, text: '첫 메모  \n' });
  });

  it('본 번호로 쓰고, 409 면 메모를 한 번 다시 받아 돌려준다', async () => {
    const s = fakeApiOf({
      'PUT /v2/admin/todo-note': () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '충돌');
      },
      'GET /v2/admin/todo-note': () => ({ ...stored, text: '남의 글', version: 2 }),
    });
    const seen = { text: '글', rev: 1, updatedBy: 'a1', updatedAt: 1 };
    const r = await createServerEditNotePort(s.api).save(seen, '내 글');
    expect(s.calls[0].body).toEqual({ version: 1, text: '내 글' });
    expect(r).toMatchObject({ ok: false, conflict: true, latest: { text: '남의 글', rev: 2 } });
    expect(s.calls.filter((c) => c.method === 'GET')).toHaveLength(1);
  });
});

const wireBug = (number: string, over: Record<string, unknown> = {}) => ({
  number,
  visibility: 'PUBLIC',
  category: 'BUG',
  title: `글 ${number}`,
  status: 'NEW',
  createdAt: '2026-11-10T00:00:00Z',
  lastAnswerAt: null,
  ...over,
});

const doneTodos = {
  items: [
    wireTodo('t1', { status: 'done', release: '0.13.1', reports: ['B-1110-1', 'B-1110-2', 'B-1110-3'] }),
  ],
  nextCursor: null,
};

describe('릴리스 반영 — API 판', () => {
  it('대상 — 미해결 글만, 지워진 글은 빼고, 본 마지막 답변 시각을 글자 그대로 싣는다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/todos': () => doneTodos,
      'GET /v2/bugs/B-1110-1': () => wireBug('B-1110-1', { lastAnswerAt: '2026-11-11T01:02:03.123456Z' }),
      'GET /v2/bugs/B-1110-2': () => wireBug('B-1110-2', { status: 'FIXED' }),
      'GET /v2/bugs/B-1110-3': () => {
        throw new ApiError('notFound', 404, 'BUG_NOT_FOUND', '없음');
      },
    });
    const targets = await createServerApplyReleasePort(s.api).preview('0.13.1');
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      rid: 'B-1110-1',
      release: '0.13.1',
      seenLastAnswerAt: '2026-11-11T01:02:03.123456Z',
      item: { id: 'B-1110-1', no: 'B-1110-1', vis: 'pub', status: 'new', title: '글 B-1110-1' },
    });
  });

  it('글을 못 읽으면(404 아님) 빈 대상으로 덮지 않고 던진다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/todos': () => doneTodos,
      'GET /v2/bugs/B-1110-1': () => {
        throw new ApiError('unavailable', 0, '', '끊김');
      },
      'GET /v2/bugs/B-1110-2': () => wireBug('B-1110-2'),
      'GET /v2/bugs/B-1110-3': () => wireBug('B-1110-3'),
    });
    expect(
      isPortError(await caught(createServerApplyReleasePort(s.api).preview('0.13.1')), 'unreachable'),
    ).toBe(true);
  });

  const target = (n: string, over: Record<string, unknown> = {}) => ({
    rid: n,
    release: '0.13.1',
    todo: '할 일',
    item: { id: n, no: n, vis: 'pub' as const, status: 'new' as const, title: '제목', ts: 1 },
    seenLastAnswerAt: null,
    ...over,
  });
  const tplFrom = { value: { saved: null, fallback: '기본' }, version: 5 };

  it('반영 — 요청 번호 · 릴리스 · 본 시각 · 채운 답변(자르지 않음)을 보내고 결과를 센다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/bugs/release-fixes': () => ({
        fixed: [
          { number: 'B-1110-1', answered: true },
          { number: 'B-1110-2', answered: true },
        ],
        skipped: [{ number: 'B-1110-3', status: 'FIXED' }],
      }),
    });
    const port = createServerApplyReleasePort(s.api);
    const long = '길게 '.repeat(500);
    const r = await port.apply(
      [
        target('B-1110-1', { seenLastAnswerAt: '2026-11-11T01:02:03.123456Z' }),
        target('B-1110-2'),
        target('B-1110-3'),
      ],
      { latest: '0.13.1', answer: true, template: `{version} ${long}` },
    );
    expect(r).toEqual({ ok: true, applied: 2, skipped: 1, notified: 2 });
    const body = s.calls[0].body as { requestId: string; release: string; items: Record<string, unknown>[] };
    expect(body.requestId).toBeTruthy();
    expect(body.release).toBe('0.13.1');
    expect(body.items[0]).toMatchObject({
      number: 'B-1110-1',
      seenLastAnswerAt: '2026-11-11T01:02:03.123456Z',
    });
    expect(body.items[1]).not.toHaveProperty('seenLastAnswerAt');
    expect((body.items[0].text as string).length).toBeGreaterThan(1000);
  });

  it('답변을 끄면 text 를 보내지 않는다 · 채우고 나면 빈 답변이면 보내지 않고 알린다', async () => {
    const s = fakeApiOf({ 'POST /v2/admin/bugs/release-fixes': () => ({ fixed: [], skipped: [] }) });
    const port = createServerApplyReleasePort(s.api);
    await port.apply([target('B-1110-1')], { latest: '0.13.1', answer: false, template: '' });
    expect(s.calls[0].body).not.toHaveProperty('items.0.text');
    const blank = await port.apply([target('B-1110-1', { item: { ...target('x').item, vis: 'prv' } })], {
      latest: '0.13.1',
      answer: true,
      template: '{title}',
    });
    expect(blank).toMatchObject({ ok: false });
    expect(s.calls).toHaveLength(1);
  });

  it('같은 내용을 닿지 못해 다시 보내면 같은 요청 번호, 서버가 답한 뒤에는 새 번호', async () => {
    let fail = true;
    const s = fakeApiOf({
      'POST /v2/admin/bugs/release-fixes': () => {
        if (fail) throw new ApiError('unavailable', 0, '', '끊김');
        return { fixed: [], skipped: [] };
      },
    });
    const port = createServerApplyReleasePort(s.api);
    const opts = { latest: '0.13.1', answer: false, template: '' };
    await caught(port.apply([target('B-1110-1')], opts));
    fail = false;
    await port.apply([target('B-1110-1')], opts);
    await port.apply([target('B-1110-1')], opts);
    const ids = s.calls.map((c) => (c.body as { requestId: string }).requestId);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[1]);
  });

  it('409 BUG_ANSWER_CONFLICT 는 conflict 로 던진다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/bugs/release-fixes': () => {
        throw new ApiError('request', 409, 'BUG_ANSWER_CONFLICT', '충돌');
      },
    });
    const e = await caught(
      createServerApplyReleasePort(s.api).apply([target('B-1110-1')], {
        latest: '0.13.1',
        answer: false,
        template: '',
      }),
    );
    expect(isPortError(e, 'conflict')).toBe(true);
  });

  it('반영은 됐는데 틀 저장만 실패하면 결과에 그 까닭을 싣는다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/bugs/release-fixes': () => ({
        fixed: [{ number: 'B-1110-1', answered: false }],
        skipped: [],
      }),
      'PUT /v2/admin/config/bug.releaseAnswerTemplate': () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '다른 곳에서 바꾼 내용을 받아왔어요');
      },
    });
    const r = await createServerApplyReleasePort(s.api).apply([target('B-1110-1')], {
      latest: '0.13.1',
      answer: false,
      template: '새 틀',
      saveTpl: true,
      templateFrom: tplFrom,
    });
    expect(r).toMatchObject({ ok: true, applied: 1, templateError: '다른 곳에서 바꾼 내용을 받아왔어요' });
    expect(s.calls[1].body).toEqual({ version: 5, value: '새 틀' });
  });

  it('틀 읽기 — 기본값과 같으면 저장 없음, 다르면 저장된 틀 · 번호를 싣는다', async () => {
    const row = (value: unknown) => [
      { key: 'bug.releaseAnswerTemplate', value, default: '기본 문구', version: 7 },
    ];
    const unsaved = fakeApiOf({ 'GET /v2/admin/config': () => row(null) });
    expect(await createServerApplyReleasePort(unsaved.api).template()).toMatchObject({
      value: { saved: null, fallback: '기본 문구' },
      version: 7,
    });
    const saved = fakeApiOf({ 'GET /v2/admin/config': () => row('내 틀') });
    expect(await createServerApplyReleasePort(saved.api).template()).toMatchObject({
      value: { saved: '내 틀', fallback: '기본 문구' },
      version: 7,
    });
  });

  it('틀 저장 — 길이는 미리 막지 않고 읽은 번호로 보낸다 · null 이면 지운다', async () => {
    const s = fakeApiOf({
      'PUT /v2/admin/config/bug.releaseAnswerTemplate': () => ({
        key: 'bug.releaseAnswerTemplate',
        value: 'x',
        default: 'd',
        version: 8,
      }),
      'DELETE /v2/admin/config/bug.releaseAnswerTemplate': () => ({
        key: 'bug.releaseAnswerTemplate',
        value: null,
        default: 'd',
        version: 9,
      }),
    });
    const port = createServerApplyReleasePort(s.api);
    expect(port.check('x'.repeat(5000))).toBeNull();
    await port.saveTemplate(tplFrom, 'x'.repeat(5000));
    expect((s.calls[0].body as { version: number; value: string }).version).toBe(5);
    expect((s.calls[0].body as { value: string }).value).toHaveLength(5000);
    await port.saveTemplate(tplFrom, null);
    expect(s.calls[1].query).toEqual({ version: 5 });
  });
});
