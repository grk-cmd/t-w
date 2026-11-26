import { useMutation } from '@tanstack/react-query';
import { useRefreshTodos, useSetTodos, type Todo } from '@/entities/admin/todo';
import { useRefreshBugBoard } from '@/entities/bug-board';
import { useEditTodoPort } from '../api';
import { afterTodoSave } from './afterSave';
import type { SaveTodoInput, SaveTodoResult } from './saveTodo';

function useAfter() {
  const refreshTodos = useRefreshTodos();
  const setTodos = useSetTodos();
  const refreshBugs = useRefreshBugBoard();
  return (r: SaveTodoResult) => afterTodoSave(r, { refreshTodos, setTodos, refreshBugs });
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
