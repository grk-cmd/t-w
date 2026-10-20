import { describe, expect, it } from 'vitest';
import { adminNameOf, adminNameWrite, adminOptions, toAdminNames } from '@/entities/admin/name';
import {
  ALL_TODOS,
  becomesDone,
  checkDraft,
  compareRelease,
  draftOf,
  emptyDraft,
  filterTodos,
  nextRelease,
  releasesOf,
  releaseState,
  searchTodos,
  searchWords,
  todoByReport,
  todoChanges,
  todoValue,
  toTodo,
  toTodos,
  type Todo,
} from '@/entities/admin/todo';
import { hashParam, hashParts, withHashParam } from '@/shared/lib';

const R1 = '-OaAAAAAAAAAAAAAAAA1';
const R2 = '-OaAAAAAAAAAAAAAAAA2';

const todo = (id: string, extra: Partial<Todo> = {}): Todo => ({
  id,
  title: `제목 ${id}`,
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
  rev: 0,
  ...extra,
});

describe('할 일 — 읽기 · 정렬 · 거르기', () => {
  it('모양이 틀린 건 빼고, 제보 id 모양이 틀린 키도 뺀다', () => {
    expect(toTodo('x', { title: 't', status: 'nope', rev: 0 })).toBeNull();
    expect(toTodo('x', { title: 't', status: 'todo' })).toBeNull();
    const t = toTodo('x', { title: 't', status: 'doing', rev: 2, reports: { [R1]: true, bad: true } });
    expect(t).toMatchObject({
      status: 'doing',
      rev: 2,
      reports: [R1],
      memo: '',
      assignee: null,
      release: '',
    });
  });

  it('진행 중 → 할 일 → 완료, 같은 상태는 최근 것부터', () => {
    const raw = {
      a: { title: 'a', status: 'done', rev: 0, updatedAt: 9 },
      b: { title: 'b', status: 'todo', rev: 0, updatedAt: 1 },
      c: { title: 'c', status: 'doing', rev: 0, updatedAt: 1 },
      d: { title: 'd', status: 'todo', rev: 0, updatedAt: 5 },
    };
    expect(toTodos(raw).map((t) => t.id)).toEqual(['c', 'd', 'b', 'a']);
  });

  it('상태 · 작업자(없음 포함) · 내 것', () => {
    const list = [todo('1', { assignee: 'me' }), todo('2', { assignee: 'b', status: 'doing' }), todo('3')];
    expect(filterTodos(list, ALL_TODOS, 'me')).toHaveLength(3);
    expect(filterTodos(list, { ...ALL_TODOS, status: 'doing' }, 'me').map((t) => t.id)).toEqual(['2']);
    expect(filterTodos(list, { ...ALL_TODOS, assignee: 'none' }, 'me').map((t) => t.id)).toEqual(['3']);
    expect(filterTodos(list, { ...ALL_TODOS, assignee: 'b' }, 'me').map((t) => t.id)).toEqual(['2']);
    expect(filterTodos(list, { ...ALL_TODOS, mine: true }, 'me').map((t) => t.id)).toEqual(['1']);
    expect(filterTodos(list, { ...ALL_TODOS, mine: true }, null)).toEqual([]);
  });

  it('제보 → 대표 할 일: 진행 중이 할 일보다 먼저, 완료는 배지 없음', () => {
    const map = todoByReport([
      todo('t', { reports: [R1, R2] }),
      todo('d', { status: 'doing', reports: [R1] }),
      todo('x', { status: 'done', reports: [R2, '-OaAAAAAAAAAAAAAAAA3'] }),
    ]);
    expect(map.get(R1)?.id).toBe('d');
    expect(map.get(R2)?.id).toBe('t');
    expect(map.has('-OaAAAAAAAAAAAAAAAA3')).toBe(false);
  });
});

describe('할 일 — 릴리스 버전', () => {
  it('칸이 없던 옛 할 일 · 모양이 틀린 값은 «버전 없음»', () => {
    expect(toTodo('x', { title: 't', status: 'done', rev: 0, release: '0.11.3' })?.release).toBe('0.11.3');
    expect(toTodo('x', { title: 't', status: 'done', rev: 0, release: '0.11.3 릴리스 대기' })?.release).toBe(
      '',
    );
    expect(toTodo('x', { title: 't', status: 'done', rev: 0, release: 11 })?.release).toBe('');
  });

  it('입력 확인 — 빈 값은 통과, 0.11.3 · 0.12.0-beta.1 모양만', () => {
    const d = { ...emptyDraft(), title: 't' };
    expect(checkDraft({ ...d, release: '' })).toBeNull();
    expect(checkDraft({ ...d, release: ' 0.11.3 ' })).toBeNull();
    expect(checkDraft({ ...d, release: '0.12.0-beta.1' })).toBeNull();
    for (const bad of ['v0.11.3', '0.11', '0.11.3-beta', '0.11.3-Beta.1', '0.11.3 대기'])
      expect(checkDraft({ ...d, release: bad })).toMatch(/릴리스 버전/);
    expect(checkDraft({ ...d, release: '1000000.0.0-beta.1000' })).toMatch(/20자/);
  });

  it('저장 값 — 있으면 다듬어 넣고, 비면 칸을 두지 않는다', () => {
    expect(todoValue({ ...emptyDraft(), title: 't', release: ' 0.11.3 ' }, null, 'me', '', 0)).toMatchObject({
      release: '0.11.3',
    });
    expect(todoValue({ ...emptyDraft(), title: 't', release: '  ' }, null, 'me', '', 0)).not.toHaveProperty(
      'release',
    );
    expect(draftOf(todo('t', { release: '0.11.3' })).release).toBe('0.11.3');
  });

  it('바뀐 것 요약에 버전', () => {
    const names = (uid: string) => uid;
    const prev = todo('t');
    expect(todoChanges(prev, { ...draftOf(prev), release: '0.11.3' }, names)).toBe('릴리스 없음 → 0.11.3');
    expect(
      todoChanges(todo('t', { release: '0.11.3' }), { ...draftOf(prev), release: '0.11.4' }, names),
    ).toBe('릴리스 0.11.3 → 0.11.4');
    expect(todoChanges(null, { ...emptyDraft(), title: 't', release: '0.11.3' }, names)).toBe(
      '할 일 · 릴리스 0.11.3',
    );
  });

  it('버전 순서 · 목록의 버전(새 것부터 · 중복 · 빈 값 빼고)', () => {
    expect(compareRelease('0.11.3', '0.11.10')).toBeLessThan(0);
    expect(compareRelease('0.11.3-beta.1', '0.11.3')).toBeLessThan(0);
    expect(compareRelease('0.11.3-beta.2', '0.11.3-beta.10')).toBeLessThan(0);
    expect(compareRelease('0.12.0', '0.11.9')).toBeGreaterThan(0);
    expect(compareRelease('0.11.3', '0.11.3')).toBe(0);
    const list = [
      todo('a', { release: '0.11.3' }),
      todo('b', { release: '0.11.10' }),
      todo('c'),
      todo('d', { release: '0.11.3' }),
      todo('e', { release: '0.12.0-beta.1' }),
    ];
    expect(releasesOf(list)).toEqual(['0.12.0-beta.1', '0.11.10', '0.11.3']);
  });

  it('버전으로 거르기 — 전체 · 버전 없음 · 한 버전', () => {
    const list = [todo('a', { release: '0.11.3' }), todo('b'), todo('c', { release: '0.11.4' })];
    expect(filterTodos(list, ALL_TODOS, null)).toHaveLength(3);
    expect(filterTodos(list, { ...ALL_TODOS, release: 'none' }, null).map((t) => t.id)).toEqual(['b']);
    expect(filterTodos(list, { ...ALL_TODOS, release: '0.11.3' }, null).map((t) => t.id)).toEqual(['a']);
  });

  it('출시 여부 — 최신 공개 릴리스 이하면 출시됨, 모르면 null', () => {
    expect(releaseState('0.11.3', '0.11.2')).toBe('pending');
    expect(releaseState('0.11.3', '0.11.3')).toBe('released');
    expect(releaseState('0.11.2', '0.11.3')).toBe('released');
    // 베타로 먼저 나갔어도 같은 번호 정식이 나왔으면 그 안에 실려 나갔다.
    expect(releaseState('0.11.3-beta.1', '0.11.3')).toBe('released');
    expect(releaseState('0.11.4-beta.1', '0.11.3')).toBe('pending');
    expect(releaseState('0.11.10', '0.11.9')).toBe('pending');
    expect(releaseState('0.11.3', undefined)).toBeNull();
    expect(releaseState('0.11.3', null)).toBeNull();
    expect(releaseState('', '0.11.3')).toBeNull();
  });

  it('다음 버전 제안 — 최신의 다음 patch, 모르면 빈 값', () => {
    expect(nextRelease('0.11.2')).toBe('0.11.3');
    expect(nextRelease('v0.11.9')).toBe('0.11.10');
    expect(nextRelease(undefined)).toBe('');
    expect(nextRelease('latest')).toBe('');
  });
});

describe('할 일 — 입력 · 저장 값', () => {
  it('제목 필수 · 길이 · 제보 id 모양', () => {
    expect(checkDraft(emptyDraft())).toBe('제목 필요');
    expect(checkDraft({ ...emptyDraft(), title: 'x'.repeat(121) })).toMatch(/120/);
    expect(checkDraft({ ...emptyDraft([R1]), title: '고치기' })).toBeNull();
    expect(checkDraft({ ...emptyDraft(['p1']), title: '고치기' })).toMatch(/제보/);
  });

  it('새로 만들면 rev 0 · 만든 사람 = 나, 빈 칸은 두지 않는다', () => {
    const v = todoValue({ ...emptyDraft(), title: ' 제목 ', memo: '  ' }, null, 'me', '', 'NOW');
    expect(v).toEqual({
      title: '제목',
      status: 'todo',
      createdBy: 'me',
      createdAt: 'NOW',
      updatedBy: 'me',
      updatedAt: 'NOW',
      rev: 0,
    });
  });

  it('고치면 만든 사람 · 시각은 그대로, rev + 1 · 작업자 이름 · 제보 묶음', () => {
    const prev = todo('t', { createdBy: 'a1', createdAt: 5, rev: 3 });
    const v = todoValue(
      { title: 't', memo: 'm', status: 'doing', type: null, assignee: 'b', reports: [R1, R1], release: '' },
      prev,
      'me',
      '비',
      'NOW',
    );
    expect(v).toMatchObject({
      createdBy: 'a1',
      createdAt: 5,
      updatedBy: 'me',
      rev: 4,
      assignee: 'b',
      assigneeName: '비',
      memo: 'm',
      reports: { [R1]: true },
    });
    // 이름을 모르면 이름 칸은 뺀다(규칙이 빈 글자를 받지 않는다).
    expect(todoValue({ ...emptyDraft(), title: 't', assignee: 'b' }, null, 'me', '', 0)).not.toHaveProperty(
      'assigneeName',
    );
  });

  it('바뀐 것 요약 · 완료로 바뀌는 순간', () => {
    const prev = todo('t', { assignee: 'a', reports: [R1] });
    const names = (uid: string) => ({ a: '에이', b: '비' })[uid] ?? uid;
    expect(todoChanges(prev, { ...prev, status: 'doing', assignee: 'b', reports: [R2] }, names)).toBe(
      '할 일 → 진행 중 · 작업자 에이 → 비 · 제보 +1 · 제보 -1',
    );
    expect(todoChanges(null, { ...emptyDraft([R1]), title: 't', assignee: 'a' }, names)).toBe(
      '할 일 · 작업자 에이 · 제보 1건',
    );
    expect(becomesDone(prev, { status: 'done' })).toBe(true);
    expect(becomesDone({ status: 'done' }, { status: 'done' })).toBe(false);
    expect(becomesDone(null, { status: 'done' })).toBe(true);
  });
});

describe('관리자 이름', () => {
  it('목록 · 모르는 uid 는 앞 6자', () => {
    const names = toAdminNames({ u1: { name: ' 가나 ' }, u2: { name: '' }, u3: null, u4: { name: '다라' } });
    expect([...names]).toEqual([
      ['u1', '가나'],
      ['u4', '다라'],
    ]);
    expect(adminNameOf('u1', names)).toBe('가나');
    expect(adminNameOf('abcdefghij', names)).toBe('abcdef…');
    expect(adminOptions(names).map((o) => o.name)).toEqual(['가나', '다라']);
  });

  it('본인 칸 쓰기 — 같거나 비었으면 쓰지 않는다 · 40자', () => {
    expect(adminNameWrite('u1', '가나', '가나', 'NOW')).toBeNull();
    expect(adminNameWrite('u1', '  ', null, 'NOW')).toBeNull();
    expect(adminNameWrite('u1', null, null, 'NOW')).toBeNull();
    expect(adminNameWrite('u1', '새 이름', '가나', 'NOW')).toEqual({
      'adminNames/u1': { name: '새 이름', at: 'NOW' },
    });
    const long = adminNameWrite('u1', 'x'.repeat(50), null, 'NOW') as Record<string, { name: string }>;
    expect(long['adminNames/u1'].name).toHaveLength(40);
  });
});

describe('주소 하위 부분', () => {
  it('#/<화면>/<하위>', () => {
    expect(hashParts('#/todos/t1')).toEqual({ id: 'todos', sub: 't1' });
    expect(hashParts('#/bugs')).toEqual({ id: 'bugs', sub: '' });
    expect(hashParts('')).toEqual({ id: '', sub: '' });
    expect(hashParts('#bugs/-Oa_x')).toEqual({ id: 'bugs', sub: '-Oa_x' });
  });
});

describe('할 일 종류(type)', () => {
  it('읽기 — feat · bug 만, 없거나 틀리면 null(미분류)', () => {
    const base = { title: 't', status: 'todo', rev: 0 };
    expect(toTodo('x', { ...base, type: 'feat' })?.type).toBe('feat');
    expect(toTodo('x', { ...base, type: 'bug' })?.type).toBe('bug');
    expect(toTodo('x', base)?.type).toBeNull();
    expect(toTodo('x', { ...base, type: 'chore' })?.type).toBeNull();
  });

  it('저장 값 — 고르면 칸, 미분류면 칸 없음 · 틀린 값은 입력 확인에서 막는다', () => {
    const d = { ...emptyDraft(), title: 'a' };
    expect(todoValue({ ...d, type: 'feat' }, null, 'me', '', 'NOW')).toMatchObject({ type: 'feat' });
    expect(todoValue(d, null, 'me', '', 'NOW')).not.toHaveProperty('type');
    expect(checkDraft({ ...d, type: 'chore' as never })).toMatch(/종류/);
    expect(checkDraft({ ...d, type: 'bug' })).toBeNull();
    expect(emptyDraft([R1], '제보', 'bug').type).toBe('bug');
    expect(draftOf(todo('t', { type: 'feat' })).type).toBe('feat');
  });

  it('바뀐 것 요약 · 거르기', () => {
    expect(todoChanges(null, { ...emptyDraft(), title: 'a', type: 'bug' }, (u) => u)).toBe('할 일 · 🐞 버그');
    expect(todoChanges(todo('t'), { ...draftOf(todo('t')), type: 'feat' }, (u) => u)).toBe(
      '종류 미분류 → 🆕 기능',
    );
    const list = [todo('1', { type: 'feat' }), todo('2', { type: 'bug' }), todo('3')];
    expect(filterTodos(list, { ...ALL_TODOS, type: 'bug' }, 'me').map((t) => t.id)).toEqual(['2']);
    expect(filterTodos(list, { ...ALL_TODOS, type: 'none' }, 'me').map((t) => t.id)).toEqual(['3']);
    expect(filterTodos(list, ALL_TODOS, 'me')).toHaveLength(3);
  });
});

describe('할 일 검색(searchTodos)', () => {
  const list = [
    todo('a', { title: '채팅 탭 이름 잘림', memo: '줄임표로 처리', release: '0.11.3', reports: [R1] }),
    todo('b', { title: 'Mac 창 제목 크래시', memo: 'getWindowTitle NULL', status: 'done' }),
    todo('c', { title: '이모티콘 채널', reports: [R2], release: '0.12.0-beta.1' }),
  ];
  const nos = new Map([
    [R1, 'B-1009-1'],
    [R2, 'B-1010-12'],
  ]);
  const ids = (q: string) => searchTodos(list, q, nos).map((t) => t.id);

  it('낱말 나누기 — 여러 칸 · 전각 공백 · 앞뒤 공백 무시, 소문자', () => {
    expect(searchWords('  채팅   Tab\u3000x ')).toEqual(['채팅', 'tab', 'x']);
    expect(searchWords('   ')).toEqual([]);
  });

  it('빈 검색어면 그대로(완료 포함)', () => {
    expect(ids('')).toEqual(['a', 'b', 'c']);
    expect(ids('   ')).toEqual(['a', 'b', 'c']);
  });

  it('제목 · 메모 — 대소문자 무시 · 한글', () => {
    expect(ids('mac')).toEqual(['b']);
    expect(ids('GETWINDOWTITLE')).toEqual(['b']);
    expect(ids('줄임표')).toEqual(['a']);
    expect(ids('채')).toEqual(['a', 'c']);
  });

  it('여러 낱말은 모두 들어 있어야(AND) — 칸이 달라도 된다', () => {
    expect(ids('채팅 줄임표')).toEqual(['a']);
    expect(ids('채팅 0.11.3')).toEqual(['a']);
    expect(ids('채팅 크래시')).toEqual([]);
  });

  it('제보 번호 · 제보 id · 릴리스 버전', () => {
    expect(ids('b-1009-1')).toEqual(['a']);
    expect(ids('B-1010')).toEqual(['c']);
    expect(ids(R2)).toEqual(['c']);
    expect(ids('beta')).toEqual(['c']);
    expect(ids('0.1')).toEqual(['a', 'c']);
  });

  it('번호를 모르는 제보(아직 안 받음 · 옛 글)는 번호로 안 걸린다', () => {
    expect(searchTodos(list, 'B-1009-1').map((t) => t.id)).toEqual([]);
  });

  it('완료도 검색된다 · 다른 거르기와 함께', () => {
    const done = filterTodos(list, { ...ALL_TODOS, status: 'done' }, null);
    expect(searchTodos(done, '크래시', nos).map((t) => t.id)).toEqual(['b']);
    expect(searchTodos(done, '채팅', nos)).toEqual([]);
  });

  it('맥에서 붙여 넣은 풀린 한글(NFD)도 같게', () => {
    expect(ids('채팅'.normalize('NFD'))).toEqual(['a']);
  });
});

describe('주소 해시의 검색어(?q=)', () => {
  it('경로와 검색어를 나눠 읽는다', () => {
    expect(hashParts('#/todos?q=%EC%B1%84%ED%8C%85')).toEqual({ id: 'todos', sub: '' });
    expect(hashParts('#/todos/t1?q=a')).toEqual({ id: 'todos', sub: 't1' });
    expect(hashParam('#/todos?q=%EC%B1%84%ED%8C%85+%ED%83%AD', 'q')).toBe('채팅 탭');
    expect(hashParam('#/todos', 'q')).toBe('');
  });

  it('검색어 넣기 · 빼기 — 경로는 그대로', () => {
    expect(withHashParam('#/todos', 'q', '채팅 탭')).toBe('#/todos?q=%EC%B1%84%ED%8C%85+%ED%83%AD');
    expect(withHashParam('#/todos/t1?q=a', 'q', '')).toBe('#/todos/t1');
    expect(hashParam(withHashParam('#/todos', 'q', 'a&b=c'), 'q')).toBe('a&b=c');
  });
});
