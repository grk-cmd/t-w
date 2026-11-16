// Firebase 판 — 지금 코드 그대로: 할 일 · 작업 기록 · (고르면) 제보 상태를 한 db.commit 으로 쓰고, 본 rev 그대로일 때만 쓴다.
import { adminNameOf } from '@/entities/admin/name';
import {
  becomesDone,
  checkDraft,
  commitTodo,
  todoChanges,
  todoValue,
  type Todo,
} from '@/entities/admin/todo';
import { BUG_STATUS, getBugItem, isOpen, statusWrite } from '@/entities/bug-board';
import { auditEntry, type Db } from '@/shared/api';
import { assigneeNameOf, linkWith, type SaveTodoInput, type SaveTodoResult } from '../model/saveTodo';
import type { EditTodoPort } from './port';

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
  return linkWith((input) => saveTodo(db, input), todo, reportId, names);
}

export function createFirebaseEditTodoPort(db: Db): EditTodoPort {
  return {
    fixesReports: true,
    save: (input) => saveTodo(db, input),
    delete: (todo) => deleteTodo(db, todo),
    link: (todo, reportId, names) => linkReport(db, todo, reportId, names),
  };
}
