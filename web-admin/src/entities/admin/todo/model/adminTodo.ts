/*
 * 📋 관리자 할 일 — adminTodos/{id}. 관리자만 읽고 쓴다(규칙). 앱 · 제보 공개 칸과는 따로다.
 *   { title, memo?, status, type?, assignee?, assigneeName?, reports?: { <제보 id>: true }, release?,
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
// 릴리스 버전 — 이 일이 실려 나가는(나간) 앱 버전. 규칙 adminTodos/$id/release 와 같은 모양 · 길이.
export const TODO_RELEASE_RE = /^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/;
export const TODO_RELEASE_MAX = 20;

export type TodoStatus = 'todo' | 'doing' | 'done';
export const TODO_STATUS: Record<TodoStatus, string> = {
  todo: '할 일',
  doing: '진행 중',
  done: '완료',
};
export const TODO_STATUSES = Object.keys(TODO_STATUS) as TodoStatus[];

// 종류 — 규칙 adminTodos/$id/type 과 같다. 칸이 없으면(옛 할 일 · 고르지 않음) «미분류».
export type TodoType = 'feat' | 'bug';
export const TODO_TYPE: Record<TodoType, string> = {
  feat: '🆕 기능',
  bug: '🐞 버그',
};
export const TODO_TYPES = Object.keys(TODO_TYPE) as TodoType[];
export const TODO_TYPE_NONE = '미분류';
const isType = (v: unknown): v is TodoType => typeof v === 'string' && Object.hasOwn(TODO_TYPE, v);
const typeLabel = (t: TodoType | null) => (t ? TODO_TYPE[t] : TODO_TYPE_NONE);
// 목록 순서 — 진행 중 → 할 일 → 완료.
const ORDER: Record<TodoStatus, number> = { doing: 0, todo: 1, done: 2 };

export interface Todo {
  id: string;
  title: string;
  memo: string;
  status: TodoStatus;
  /** 종류 — 없으면 null(«미분류»). */
  type: TodoType | null;
  assignee: string | null;
  assigneeName: string;
  reports: string[];
  /** 릴리스 버전 — 없으면 ''. */
  release: string;
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
  type: TodoType | null;
  assignee: string | null;
  reports: string[];
  release: string;
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
    type: isType(r.type) ? r.type : null,
    assignee: typeof r.assignee === 'string' ? r.assignee : null,
    assigneeName: typeof r.assigneeName === 'string' ? r.assigneeName : '',
    reports,
    // 칸이 없던 옛 할 일 · 모양이 틀린 값은 «버전 없음».
    release: typeof r.release === 'string' && TODO_RELEASE_RE.test(r.release) ? r.release : '',
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
  /** 'all' · 'none'(버전 없음) · 버전 */
  release: string;
  /** 'all' · 'none'(미분류) · 종류 */
  type: TodoType | 'all' | 'none';
}

export const ALL_TODOS: TodoFilter = {
  status: 'all',
  assignee: 'all',
  mine: false,
  release: 'all',
  type: 'all',
};

export function filterTodos(list: readonly Todo[], f: TodoFilter, me: string | null): Todo[] {
  return list.filter(
    (t) =>
      (f.status === 'all' || t.status === f.status) &&
      (f.assignee === 'all' || (f.assignee === 'none' ? !t.assignee : t.assignee === f.assignee)) &&
      (!f.mine || (!!me && t.assignee === me)) &&
      (f.release === 'all' || (f.release === 'none' ? !t.release : t.release === f.release)) &&
      (f.type === 'all' || (f.type === 'none' ? !t.type : t.type === f.type)),
  );
}

/** 검색어 → 낱말 — 공백(여러 칸 · 전각 공백 포함)으로 나누고 대소문자 무시. 맥에서 붙여 넣은 풀린 한글(NFD)도 같게. */
export function searchWords(q: string): string[] {
  return q.normalize('NFC').toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * 검색 — 낱말이 모두(AND) 제목 · 메모 · 연결된 제보(번호 B-1009-1 · id) · 릴리스 버전 어딘가에 들어 있는 것만.
 * reportNos 는 제보 id → 번호(B-MMDD-n) — 화면이 이미 받아 둔 것만 넘긴다(검색하려고 따로 읽지 않는다).
 * 낱말이 없으면 그대로.
 */
export function searchTodos(
  list: readonly Todo[],
  q: string,
  reportNos: ReadonlyMap<string, string> = new Map(),
): Todo[] {
  const ws = searchWords(q);
  if (!ws.length) return [...list];
  return list.filter((t) => {
    const hay = [t.title, t.memo, t.release, ...t.reports.flatMap((r) => [r, reportNos.get(r) ?? ''])]
      .join('\n')
      .normalize('NFC')
      .toLowerCase();
    return ws.every((w) => hay.includes(w));
  });
}

const verParts = (v: string) => {
  const [core = '', pre = ''] = v.replace(/^v/i, '').split('-');
  const nums = core.split('.').map((n) => parseInt(n, 10) || 0);
  return { nums: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0], pre };
};

const compareCore = (a: string, b: string) => {
  const x = verParts(a).nums;
  const y = verParts(b).nums;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/** a < b 면 음수 — 같은 번호면 베타(0.11.3-beta.1)가 정식(0.11.3)보다 앞이다. */
export function compareRelease(a: string, b: string): number {
  const c = compareCore(a, b);
  if (c) return c;
  const pa = verParts(a).pre;
  const pb = verParts(b).pre;
  if (pa === pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  const [na = '', ia = '0'] = pa.split('.');
  const [nb = '', ib = '0'] = pb.split('.');
  return na === nb ? parseInt(ia, 10) - parseInt(ib, 10) : na < nb ? -1 : 1;
}

/** 목록에 있는 버전 — 새 버전부터(거르기 칸). */
export function releasesOf(list: readonly Todo[]): string[] {
  return [...new Set(list.map((t) => t.release).filter(Boolean))].sort((a, b) => compareRelease(b, a));
}

export type ReleaseState = 'released' | 'pending';

/**
 * 출시 여부 — latest 는 GitHub 최신 공개(정식) 릴리스. 모르면(조회 실패 · 아직) null.
 * 번호가 latest 이하면 출시됨 — 0.11.3-beta.1 도 정식 0.11.3 이 나왔으면 그 안에 실려 나갔다.
 */
export function releaseState(release: string, latest: string | null | undefined): ReleaseState | null {
  if (!release || !latest) return null;
  return compareCore(release, latest) <= 0 ? 'released' : 'pending';
}

/** 다음 버전 제안 — 최신 공개 릴리스의 다음 patch(0.11.2 → 0.11.3). 모르면 ''. */
export function nextRelease(latest: string | null | undefined): string {
  if (!latest || !TODO_RELEASE_RE.test(latest.replace(/^v/i, ''))) return '';
  const [a, b, c] = verParts(latest).nums;
  return `${a}.${b}.${c + 1}`;
}

export const draftOf = (t: Todo): TodoDraft => ({
  title: t.title,
  memo: t.memo,
  status: t.status,
  type: t.type,
  assignee: t.assignee,
  reports: [...t.reports],
  release: t.release,
});

export const emptyDraft = (reports: string[] = [], title = '', type: TodoType | null = null): TodoDraft => ({
  title,
  memo: '',
  status: 'todo',
  type,
  assignee: null,
  reports,
  release: '',
});

/** 입력 확인 — 문제없으면 null. */
export function checkDraft(d: TodoDraft): string | null {
  const title = d.title.trim();
  if (!title) return '제목 필요';
  if (title.length > TODO_TITLE_MAX) return `제목은 ${TODO_TITLE_MAX}자까지`;
  if (d.memo.trim().length > TODO_MEMO_MAX) return `메모는 ${TODO_MEMO_MAX}자까지`;
  if (!isStatus(d.status)) return '상태 필요';
  if (d.type !== null && !isType(d.type)) return '종류는 기능 · 버그 중에서';
  if (d.reports.some((r) => !REPORT_ID_RE.test(r))) return '제보 id 모양이 틀림';
  if (new Set(d.reports).size > TODO_REPORTS_MAX) return `제보는 ${TODO_REPORTS_MAX}개까지`;
  const release = d.release.trim();
  if (release.length > TODO_RELEASE_MAX) return `릴리스 버전은 ${TODO_RELEASE_MAX}자까지`;
  if (release && !TODO_RELEASE_RE.test(release)) return '릴리스 버전은 0.11.3 · 0.12.0-beta.1 모양으로';
  return null;
}

/**
 * 저장할 값 한 덩어리 — 새로 만들면 rev 0 · 만든 사람 · 만든 시각, 고치면 본 값(prev)의 것을 그대로 두고 rev + 1.
 * 빈 메모 · 작업자 없음 · 제보 없음 · 버전 없음은 칸을 두지 않는다(규칙이 빈 글자를 받지 않는다).
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
  const release = d.release.trim();
  return {
    title: d.title.trim().slice(0, TODO_TITLE_MAX),
    ...(memo ? { memo } : {}),
    status: d.status,
    ...(isType(d.type) ? { type: d.type } : {}),
    ...(d.assignee ? { assignee: d.assignee, ...(name ? { assigneeName: name } : {}) } : {}),
    ...(reports.length ? { reports: Object.fromEntries(reports.map((r) => [r, true])) } : {}),
    ...(release && TODO_RELEASE_RE.test(release) ? { release } : {}),
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
    if (d.type) parts.push(typeLabel(d.type));
    if (d.assignee) parts.push(`작업자 ${who(d.assignee)}`);
    if (d.reports.length) parts.push(`제보 ${d.reports.length}건`);
    if (d.release.trim()) parts.push(`릴리스 ${d.release.trim()}`);
    return parts.join(' · ');
  }
  const out: string[] = [];
  if (prev.status !== d.status) out.push(`${TODO_STATUS[prev.status]} → ${TODO_STATUS[d.status]}`);
  if (prev.type !== d.type) out.push(`종류 ${typeLabel(prev.type)} → ${typeLabel(d.type)}`);
  if (prev.assignee !== d.assignee) out.push(`작업자 ${who(prev.assignee)} → ${who(d.assignee)}`);
  if (prev.title !== d.title.trim()) out.push('제목');
  if (prev.memo !== d.memo.trim()) out.push('메모');
  if (prev.release !== d.release.trim())
    out.push(`릴리스 ${prev.release || '없음'} → ${d.release.trim() || '없음'}`);
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
