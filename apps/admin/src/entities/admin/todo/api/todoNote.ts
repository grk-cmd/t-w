import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isPermissionDenied, useDb, type Db } from '@/shared/api';
import { TODO_NOTE_PATH, toTodoNote, type TodoNote } from '../model/todoNote';

const TODO_NOTE_KEY = ['adminTodoNote'];

export async function getTodoNote(db: Db): Promise<TodoNote | null> {
  return toTodoNote(await db.get<unknown>(TODO_NOTE_PATH));
}

/** 할 일 화면을 열 때 한 번 — 2000자 이하 한 칸이라 통째로. 다시 받기는 할 일 «새로고침» 과 같이. */
export function useTodoNote() {
  const db = useDb();
  return useQuery({ queryKey: TODO_NOTE_KEY, queryFn: () => getTodoNote(db), staleTime: 30_000 });
}

export function useRefreshTodoNote() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: TODO_NOTE_KEY });
}

/** 쓰기 결과 — 남이 먼저 고쳤으면 쓰지 않고 지금 값(latest)을 돌려준다. */
export type TodoNoteCommitResult = { ok: true } | { ok: false; latest: TodoNote | null };

const sameRev = (current: TodoNote | null, seenRev: number | null) =>
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
  if (!sameRev(current, seenRev)) return { ok: false, latest: current };
  try {
    await db.commit({ ...extra, [TODO_NOTE_PATH]: value });
    return { ok: true };
  } catch (error) {
    if (isPermissionDenied(error)) {
      const latest = await getTodoNote(db);
      if (!sameRev(latest, seenRev)) return { ok: false, latest };
    }
    throw error;
  }
}
