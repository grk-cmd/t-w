import { useMutation } from '@tanstack/react-query';
import { useRefreshTodoNote, type TodoNote } from '@/entities/admin/todo';
import { useEditNotePort } from '../api';

/** 성공이든 충돌이든 메모를 다시 받는다 — 충돌이면 최신 값을 봐야 하니까. */
export function useSaveTodoNote() {
  const port = useEditNotePort();
  const refresh = useRefreshTodoNote();
  return useMutation({
    mutationFn: ({ seen, text }: { seen: TodoNote | null; text: string }) => port.save(seen, text),
    onSuccess: (r) => {
      if (r.ok || 'conflict' in r) void refresh();
    },
  });
}
