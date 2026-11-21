import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isPermissionDenied, useDb, type Db } from '@/shared/api';
import { TODO_ROOT, toTodo, toTodos, type Todo } from '../model/adminTodo';

const TODOS_KEY = ['adminTodos'];

/** 관리자 몇 명이 쓰는 수십~수백 건이라 통째로 한 번 — 제보 목록도 이 한 번을 같이 쓴다. */
export async function listTodos(db: Db): Promise<Todo[]> {
  return toTodos(await db.get<unknown>(TODO_ROOT));
}

export async function getTodo(db: Db, id: string): Promise<Todo | null> {
  return toTodo(id, await db.get<unknown>(`${TODO_ROOT}/${id}`));
}

export function useTodos() {
  const db = useDb();
  return useQuery({ queryKey: TODOS_KEY, queryFn: () => listTodos(db), staleTime: 30_000 });
}

export function useRefreshTodos() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: TODOS_KEY });
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
