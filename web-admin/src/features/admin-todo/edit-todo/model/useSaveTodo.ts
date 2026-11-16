import { useMutation } from '@tanstack/react-query';
import { useRefreshTodos, type Todo } from '@/entities/admin/todo';
import { useRefreshBugBoard } from '@/entities/bug-board';
import { useEditTodoPort } from '../api';
import type { SaveTodoInput, SaveTodoResult } from './saveTodo';

/** 성공이든 충돌이든 목록을 다시 받는다 — 충돌이면 최신 값을 봐야 하니까. 제보를 바꿨으면 제보 목록도. */
function useAfter() {
  const refreshTodos = useRefreshTodos();
  const refreshBugs = useRefreshBugBoard();
  return (r: SaveTodoResult) => {
    if (r.ok || 'conflict' in r) void refreshTodos();
    if (r.ok && r.fixed) void refreshBugs();
  };
}

export function useSaveTodo() {
  const port = useEditTodoPort();
  const after = useAfter();
  return useMutation({ mutationFn: (input: SaveTodoInput) => port.save(input), onSuccess: after });
}

export function useDeleteTodo() {
  const port = useEditTodoPort();
  const after = useAfter();
  return useMutation({ mutationFn: (todo: Todo) => port.delete(todo), onSuccess: after });
}

export function useLinkReport(reportId: string, names: ReadonlyMap<string, string>) {
  const port = useEditTodoPort();
  const after = useAfter();
  return useMutation({ mutationFn: (todo: Todo) => port.link(todo, reportId, names), onSuccess: after });
}
