import { useMutation } from '@tanstack/react-query';
import { useRefreshTodoNote, type TodoNote } from '@/entities/admin/todo';
import { useDb } from '@/shared/api';
import { saveTodoNote } from './saveNote';

/** 성공이든 충돌이든 메모를 다시 받는다 — 충돌이면 최신 값을 봐야 하니까. */
export function useSaveTodoNote() {
  const db = useDb();
  const refresh = useRefreshTodoNote();
  return useMutation({
    mutationFn: ({ seen, text }: { seen: TodoNote | null; text: string }) => saveTodoNote(db, seen, text),
    onSuccess: (r) => {
      if (r.ok || 'conflict' in r) void refresh();
    },
  });
}
