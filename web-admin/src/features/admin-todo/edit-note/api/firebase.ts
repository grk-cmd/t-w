// Firebase 판 — 지금 코드 그대로: 메모 · 작업 기록(todo.note)을 한 묶음으로 쓰고, 본 뒤 남이 먼저 고쳤으면 쓰지 않는다.
import { checkTodoNote, commitTodoNote, todoNoteValue, type TodoNote } from '@/entities/admin/todo';
import { auditEntry, type Db } from '@/shared/api';
import { noteChange, type SaveNoteResult } from '../model/saveNote';
import type { EditNotePort } from './port';

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

export function createFirebaseEditNotePort(db: Db): EditNotePort {
  return { check: checkTodoNote, save: (seen, text) => saveTodoNote(db, seen, text) };
}
