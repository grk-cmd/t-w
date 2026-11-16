// Firebase 판 — 지금 코드 그대로: `adminTodos` · `adminTodoNote` 를 통째로 읽고, 본 rev 를 조건으로 쓴다(남이 먼저 고쳤으면 쓰지 않고 지금 값을 돌려준다).
import { isPermissionDenied, type Db } from '@/shared/api';
import { TODO_ROOT, toTodo, toTodos, type Todo } from '../model/adminTodo';
import { TODO_NOTE_PATH, toTodoNote, type TodoNote } from '../model/todoNote';
import type { TodoPort } from './port';

/** 관리자 몇 명이 쓰는 수십~수백 건이라 통째로 한 번 — 제보 목록도 이 한 번을 같이 쓴다. */
export async function listTodos(db: Db): Promise<Todo[]> {
  return toTodos(await db.get<unknown>(TODO_ROOT));
}

export async function getTodo(db: Db, id: string): Promise<Todo | null> {
  return toTodo(id, await db.get<unknown>(`${TODO_ROOT}/${id}`));
}

/** 쓰기 결과 — 남이 먼저 고쳤으면 쓰지 않고 지금 값(latest, 지워졌으면 null)을 돌려준다. */
export type TodoCommitResult = { ok: true } | { ok: false; latest: Todo | null };

const sameRev = (current: Todo | null, seenRev: number | null) =>
  seenRev === null ? current === null : current?.rev === seenRev;

/**
 * 화면에서 본 rev(새로 만들면 null) 그대로일 때만 쓴다 — 할 일 한 건(value, 지우면 null)과 함께 보낼 쓰기(extra:
 * 작업 기록 · 제보 상태)를 한 db.commit 으로. runTransaction 은 한 경로만 다뤄 extra 를 같은 묶음에 넣을 수 없어서,
 * «rev + 1 만 받는다» 는 규칙을 조건으로 쓴다.
 *   ① 쓰기 전에 지금 값을 읽어 rev 를 견준다 — 다르면 쓰지 않는다.
 *   ② 그 사이에 누가 끼면 규칙이 묶음째 거절한다 → 다시 읽어 rev 가 바뀌었으면 충돌로 돌려준다.
 * 지우기는 규칙 .validate 가 안 돌아 ① 만 본다.
 */
export async function commitTodo(
  db: Db,
  id: string,
  seenRev: number | null,
  value: Record<string, unknown> | null,
  extra: Record<string, unknown> = {},
): Promise<TodoCommitResult> {
  const current = await getTodo(db, id);
  if (!sameRev(current, seenRev)) return { ok: false, latest: current };
  try {
    await db.commit({ ...extra, [`${TODO_ROOT}/${id}`]: value });
    return { ok: true };
  } catch (error) {
    if (isPermissionDenied(error)) {
      const latest = await getTodo(db, id);
      if (!sameRev(latest, seenRev)) return { ok: false, latest };
    }
    throw error;
  }
}

export async function getTodoNote(db: Db): Promise<TodoNote | null> {
  return toTodoNote(await db.get<unknown>(TODO_NOTE_PATH));
}

/** 쓰기 결과 — 남이 먼저 고쳤으면 쓰지 않고 지금 값(latest)을 돌려준다. */
export type TodoNoteCommitResult = { ok: true } | { ok: false; latest: TodoNote | null };

const sameNoteRev = (current: TodoNote | null, seenRev: number | null) =>
  seenRev === null ? current === null : current?.rev === seenRev;

/**
 * 본 rev(처음이면 null) 그대로일 때만 쓴다 — commitTodo 와 같은 방식(작업 기록과 한 묶음 · 규칙의 rev + 1 을 조건으로).
 *   ① 쓰기 전에 지금 값을 읽어 rev 를 견준다 ② 그 사이에 누가 끼면 규칙이 거절 → 다시 읽어 충돌로 돌려준다.
 */
export async function commitTodoNote(
  db: Db,
  seenRev: number | null,
  value: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): Promise<TodoNoteCommitResult> {
  const current = await getTodoNote(db);
  if (!sameNoteRev(current, seenRev)) return { ok: false, latest: current };
  try {
    await db.commit({ ...extra, [TODO_NOTE_PATH]: value });
    return { ok: true };
  } catch (error) {
    if (isPermissionDenied(error)) {
      const latest = await getTodoNote(db);
      if (!sameNoteRev(latest, seenRev)) return { ok: false, latest };
    }
    throw error;
  }
}

export function createFirebaseTodoPort(db: Db): TodoPort {
  return { list: () => listTodos(db), note: () => getTodoNote(db) };
}
