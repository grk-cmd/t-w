import { adminNameOf } from '@/entities/admin/name';
import {
  becomesDone,
  checkDraft,
  commitTodo,
  draftOf,
  todoChanges,
  todoValue,
  type Todo,
  type TodoDraft,
} from '@/entities/admin/todo';
import { BUG_STATUS, getBugItem, isOpen, statusWrite } from '@/entities/bug-board';
import { auditEntry, type Db } from '@/shared/api';

export type SaveTodoResult =
  | { ok: true; id: string; fixed: number }
  | { ok: false; reason: string }
  | { ok: false; conflict: true; latest: Todo | null };

export interface SaveTodoInput {
  id: string;
  /** 화면에서 본 값 — 새로 만들면 null. 이 값의 rev 그대로일 때만 쓴다. */
  seen: Todo | null;
  draft: TodoDraft;
  names: ReadonlyMap<string, string>;
  /** 완료로 바꾸면서 연결된 제보를 «수정 완료» 로 — 확인 창에서 «예» 일 때만. */
  markFixed?: boolean;
}

/** 작업자 이름 — 이름표에서, 없으면 같은 작업자일 때 저장돼 있던 이름. 모르면 비움(규칙이 빈 글자를 안 받아 칸을 뺀다). */
function assigneeNameOf(d: TodoDraft, seen: Todo | null, names: ReadonlyMap<string, string>): string {
  if (!d.assignee) return '';
  return names.get(d.assignee) ?? (seen?.assignee === d.assignee ? seen.assigneeName : '');
}

/**
 * 연결된 제보 중 아직 미해결인 것만 «수정 완료» 로 — 제보마다 줄을 다시 읽어(지워졌으면 건너뜀) openTs 도 같이 맞춘다.
 * 제보 상태 기록(bug.status)도 제보마다 한 줄씩 같은 묶음에.
 */
async function fixReports(db: Db, reports: readonly string[]): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const items = await Promise.all(reports.map((rid) => getBugItem(db, rid)));
  for (const item of items) {
    if (!item || !isOpen(item.status)) continue;
    Object.assign(
      out,
      statusWrite(item, 'fixed'),
      auditEntry(
        db,
        'bug.status',
        item.no ?? item.id,
        `${BUG_STATUS[item.status]} → ${BUG_STATUS.fixed} · 할 일 완료`,
      ),
    );
  }
  return out;
}

/** 만들기 · 고치기 — 할 일 · 작업 기록 · (고르면) 제보 상태를 한 묶음으로. 남이 먼저 고쳤으면 쓰지 않는다. */
export async function saveTodo(db: Db, input: SaveTodoInput): Promise<SaveTodoResult> {
  const { id, seen, draft, names } = input;
  const bad = checkDraft(draft);
  if (bad) return { ok: false, reason: bad };
  const me = db.uid();
  if (!me) return { ok: false, reason: '로그인 필요' };
  const value = todoValue(draft, seen, me, assigneeNameOf(draft, seen, names), db.now());
  const fixes = input.markFixed && becomesDone(seen, draft) ? await fixReports(db, draft.reports) : {};
  const fixed = Object.keys(fixes).filter((p) => p.endsWith('/status')).length;
  const detail =
    todoChanges(seen, draft, (uid) => adminNameOf(uid, names)) +
    (fixed ? ` · 제보 ${fixed}건 수정 완료` : '');
  const audit = auditEntry(db, seen ? 'todo.update' : 'todo.create', draft.title.trim(), detail);
  const r = await commitTodo(db, id, seen?.rev ?? null, value, { ...fixes, ...audit });
  return r.ok ? { ok: true, id, fixed } : { ok: false, conflict: true, latest: r.latest };
}

/** 지우기 — 본 rev 그대로일 때만. 연결된 제보는 그대로 둔다(할 일 쪽 칸이라 제보엔 흔적이 없다). */
export async function deleteTodo(db: Db, todo: Todo): Promise<SaveTodoResult> {
  const r = await commitTodo(db, todo.id, todo.rev, null, auditEntry(db, 'todo.delete', todo.title));
  return r.ok ? { ok: true, id: todo.id, fixed: 0 } : { ok: false, conflict: true, latest: r.latest };
}

/** 제보 하나를 할 일에 붙이기 — 이미 붙어 있으면 쓰지 않는다. */
export function linkReport(
  db: Db,
  todo: Todo,
  reportId: string,
  names: ReadonlyMap<string, string>,
): Promise<SaveTodoResult> {
  if (todo.reports.includes(reportId)) return Promise.resolve({ ok: true, id: todo.id, fixed: 0 });
  const draft: TodoDraft = { ...draftOf(todo), reports: [...todo.reports, reportId] };
  return saveTodo(db, { id: todo.id, seen: todo, draft, names });
}

/** 충돌 안내 — «방금 ○○님이 바꿨어요». 지워졌으면 그렇게. */
export function conflictMessage(
  latest: Todo | null,
  names: ReadonlyMap<string, string>,
  me: string | null,
): string {
  if (!latest) return '방금 다른 관리자가 이 할 일을 지웠어요';
  const who = latest.updatedBy === me ? '다른 창에서 내가' : `${adminNameOf(latest.updatedBy, names)}님이`;
  return `방금 ${who} 바꿨어요 — 최신 내용으로 다시 불러왔어요`;
}

/** 실패 결과 → 안내 문구. */
export function resultMessage(
  r: Exclude<SaveTodoResult, { ok: true }>,
  names: ReadonlyMap<string, string>,
  me: string | null,
): string {
  return 'reason' in r ? r.reason : conflictMessage(r.latest, names, me);
}
