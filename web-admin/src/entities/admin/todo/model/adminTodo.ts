/*
 * 📋 관리자 할 일 — adminTodos/{id}. 관리자만 읽고 쓴다(규칙). 앱 · 제보 공개 칸과는 따로다.
 *   { title, memo?, status, assignee?, assigneeName?, reports?: { <제보 id>: true },
 *     createdBy, createdAt, updatedBy, updatedAt, rev }
 * rev — 고칠 때마다 +1. 규칙이 «지금 rev + 1» 만 받아서, 화면에서 본 뒤 남이 먼저 고쳤으면 내 쓰기가 거절된다.
 */
export const TODO_ROOT = 'adminTodos';
// 규칙 adminTodos/$id 와 같다.
export const TODO_TITLE_MAX = 120;
export const TODO_MEMO_MAX = 2000;
// 제보 id 는 앱이 push 로 만든 20자 키 — 규칙 reports/$rid 와 같은 모양.
export const REPORT_ID_RE = /^[A-Za-z0-9_-]{20}$/;
// 화면에서만 거는 상한 — 한 할 일에 제보를 끝없이 붙이지 않게.
export const TODO_REPORTS_MAX = 30;

export type TodoStatus = 'todo' | 'doing' | 'done';
export const TODO_STATUS: Record<TodoStatus, string> = {
  todo: '할 일',
  doing: '진행 중',
  done: '완료',
};
export const TODO_STATUSES = Object.keys(TODO_STATUS) as TodoStatus[];
// 목록 순서 — 진행 중 → 할 일 → 완료.
const ORDER: Record<TodoStatus, number> = { doing: 0, todo: 1, done: 2 };

export interface Todo {
  id: string;
  title: string;
  memo: string;
  status: TodoStatus;
  assignee: string | null;
  assigneeName: string;
  reports: string[];
  createdBy: string;
  createdAt: number;
  updatedBy: string;
  updatedAt: number;
  rev: number;
}

/** 입력칸에서 고칠 수 있는 칸. */
export interface TodoDraft {
  title: string;
  memo: string;
  status: TodoStatus;
  assignee: string | null;
  reports: string[];
}

const isStatus = (v: unknown): v is TodoStatus => typeof v === 'string' && Object.hasOwn(TODO_STATUS, v);

/** 한 건 — 모양이 틀리면 null. */
export function toTodo(id: string, v: unknown): Todo | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.title !== 'string' || typeof r.rev !== 'number' || !isStatus(r.status)) return null;
  const reports =
    r.reports && typeof r.reports === 'object'
      ? Object.keys(r.reports as Record<string, unknown>).filter((k) => REPORT_ID_RE.test(k))
      : [];
  return {
    id,
    title: r.title,
    memo: typeof r.memo === 'string' ? r.memo : '',
    status: r.status,
    assignee: typeof r.assignee === 'string' ? r.assignee : null,
    assigneeName: typeof r.assigneeName === 'string' ? r.assigneeName : '',
    reports,
    createdBy: String(r.createdBy ?? ''),
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : 0,
    updatedBy: String(r.updatedBy ?? ''),
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
    rev: r.rev,
  };
}

/** 진행 중 → 할 일 → 완료, 같은 상태는 최근에 고친 것부터. */
export function sortTodos(list: readonly Todo[]): Todo[] {
  return [...list].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : 1),
  );
}

export function toTodos(raw: unknown): Todo[] {
  if (!raw || typeof raw !== 'object') return [];
  return sortTodos(
    Object.entries(raw as Record<string, unknown>)
      .map(([id, v]) => toTodo(id, v))
      .filter((t): t is Todo => !!t),
  );
}

/**
 * 제보 id → 그 제보에 걸린 할 일 중 대표 하나(진행 중 > 할 일). 완료만 걸렸으면 없음.
 * 제보 목록이 할 일 전체를 한 번 받아 이걸로 줄마다 찾는다(줄마다 읽지 않는다).
 */
export function todoByReport(list: readonly Todo[]): Map<string, Todo> {
  const out = new Map<string, Todo>();
  for (const t of sortTodos(list)) {
    if (t.status === 'done') continue;
    for (const rid of t.reports) if (!out.has(rid)) out.set(rid, t);
  }
  return out;
}

export interface TodoFilter {
  status: TodoStatus | 'all';
  /** 'all' · 'none'(작업자 없음) · 관리자 uid */
  assignee: string;
  mine: boolean;
}

export const ALL_TODOS: TodoFilter = { status: 'all', assignee: 'all', mine: false };

export function filterTodos(list: readonly Todo[], f: TodoFilter, me: string | null): Todo[] {
  return list.filter(
    (t) =>
      (f.status === 'all' || t.status === f.status) &&
      (f.assignee === 'all' || (f.assignee === 'none' ? !t.assignee : t.assignee === f.assignee)) &&
      (!f.mine || (!!me && t.assignee === me)),
  );
}

export const draftOf = (t: Todo): TodoDraft => ({
  title: t.title,
  memo: t.memo,
  status: t.status,
  assignee: t.assignee,
  reports: [...t.reports],
});

export const emptyDraft = (reports: string[] = [], title = ''): TodoDraft => ({
  title,
  memo: '',
  status: 'todo',
  assignee: null,
  reports,
});

/** 입력 확인 — 문제없으면 null. */
export function checkDraft(d: TodoDraft): string | null {
  const title = d.title.trim();
  if (!title) return '제목 필요';
  if (title.length > TODO_TITLE_MAX) return `제목은 ${TODO_TITLE_MAX}자까지`;
  if (d.memo.trim().length > TODO_MEMO_MAX) return `메모는 ${TODO_MEMO_MAX}자까지`;
  if (!isStatus(d.status)) return '상태 필요';
  if (d.reports.some((r) => !REPORT_ID_RE.test(r))) return '제보 id 모양이 틀림';
  if (new Set(d.reports).size > TODO_REPORTS_MAX) return `제보는 ${TODO_REPORTS_MAX}개까지`;
  return null;
}

/**
 * 저장할 값 한 덩어리 — 새로 만들면 rev 0 · 만든 사람 · 만든 시각, 고치면 본 값(prev)의 것을 그대로 두고 rev + 1.
 * 빈 메모 · 작업자 없음 · 제보 없음은 칸을 두지 않는다(규칙이 빈 글자를 받지 않는다).
 */
export function todoValue(
  d: TodoDraft,
  prev: Pick<Todo, 'createdBy' | 'createdAt' | 'rev'> | null,
  me: string,
  assigneeName: string,
  now: unknown,
): Record<string, unknown> {
  const memo = d.memo.trim().slice(0, TODO_MEMO_MAX);
  const reports = [...new Set(d.reports)].filter((r) => REPORT_ID_RE.test(r));
  const name = assigneeName.trim().slice(0, 40);
  return {
    title: d.title.trim().slice(0, TODO_TITLE_MAX),
    ...(memo ? { memo } : {}),
    status: d.status,
    ...(d.assignee ? { assignee: d.assignee, ...(name ? { assigneeName: name } : {}) } : {}),
    ...(reports.length ? { reports: Object.fromEntries(reports.map((r) => [r, true])) } : {}),
    createdBy: prev ? prev.createdBy : me,
    createdAt: prev ? prev.createdAt : now,
    updatedBy: me,
    updatedAt: now,
    rev: prev ? prev.rev + 1 : 0,
  };
}

/** 무엇이 바뀌었나 — 작업 기록 detail. nameOf 는 uid → 이름. */
export function todoChanges(prev: Todo | null, d: TodoDraft, nameOf: (uid: string) => string): string {
  const who = (uid: string | null) => (uid ? nameOf(uid) : '없음');
  if (!prev) {
    const parts = [TODO_STATUS[d.status]];
    if (d.assignee) parts.push(`작업자 ${who(d.assignee)}`);
    if (d.reports.length) parts.push(`제보 ${d.reports.length}건`);
    return parts.join(' · ');
  }
  const out: string[] = [];
  if (prev.status !== d.status) out.push(`${TODO_STATUS[prev.status]} → ${TODO_STATUS[d.status]}`);
  if (prev.assignee !== d.assignee) out.push(`작업자 ${who(prev.assignee)} → ${who(d.assignee)}`);
  if (prev.title !== d.title.trim()) out.push('제목');
  if (prev.memo !== d.memo.trim()) out.push('메모');
  const before = new Set(prev.reports);
  const after = new Set(d.reports);
  const added = [...after].filter((r) => !before.has(r)).length;
  const removed = [...before].filter((r) => !after.has(r)).length;
  if (added) out.push(`제보 +${added}`);
  if (removed) out.push(`제보 -${removed}`);
  return out.join(' · ') || '변경 없음';
}

/** 새 할 일 id — 정렬은 updatedAt 으로 하니 모양만 맞으면 된다(규칙 1~32자). */
export function todoId(): string {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 완료로 바뀌는 순간인가 — 연결된 제보를 «수정 완료» 로 바꿀지 물을 때. */
export const becomesDone = (prev: Pick<Todo, 'status'> | null, d: Pick<TodoDraft, 'status'>) =>
  d.status === 'done' && prev?.status !== 'done';
