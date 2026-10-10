import { adminNameOf } from '@/entities/admin/name';
import { checkTodoNote, commitTodoNote, todoNoteValue, type TodoNote } from '@/entities/admin/todo';
import { auditEntry, type Db } from '@/shared/api';

export type SaveNoteResult =
  { ok: true } | { ok: false; reason: string } | { ok: false; conflict: true; latest: TodoNote | null };

/** 작업 기록 detail — 메모 본문은 기록에 남기지 않고 길이만(기록은 120자라 어차피 잘린다). */
export function noteChange(prev: TodoNote | null, text: string): string {
  const after = text.trimEnd().length;
  return prev ? `${prev.text.length}자 → ${after}자` : `처음 작성 · ${after}자`;
}

/** 저장 — 메모 · 작업 기록(todo.note)을 한 묶음으로. 본 뒤 남이 먼저 고쳤으면 쓰지 않는다. */
export async function saveTodoNote(db: Db, seen: TodoNote | null, text: string): Promise<SaveNoteResult> {
  const bad = checkTodoNote(text);
  if (bad) return { ok: false, reason: bad };
  const me = db.uid();
  if (!me) return { ok: false, reason: '로그인 필요' };
  const value = todoNoteValue(text, seen, me, db.now());
  const audit = auditEntry(db, 'todo.note', '할 일 공용 메모', noteChange(seen, text));
  const r = await commitTodoNote(db, seen?.rev ?? null, value, audit);
  return r.ok ? { ok: true } : { ok: false, conflict: true, latest: r.latest };
}

/** 충돌 안내 — «방금 ○○님이 고쳤어요». */
export function noteConflictMessage(
  latest: TodoNote | null,
  names: ReadonlyMap<string, string>,
  me: string | null,
): string {
  if (!latest) return '방금 메모가 지워졌어요 — 다시 불러왔어요';
  const who = latest.updatedBy === me ? '다른 창에서 내가' : `${adminNameOf(latest.updatedBy, names)}님이`;
  return `방금 ${who} 메모를 고쳤어요 — 최신 내용으로 다시 불러왔어요`;
}
