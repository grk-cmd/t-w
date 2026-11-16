import { useMutation } from '@tanstack/react-query';
import { useRefreshTodoNote, useSetTodoNote, type TodoNote } from '@/entities/admin/todo';
import { useEditNotePort } from '../api';
import { afterNoteSave } from './afterSave';

/** 성공이든 충돌이든 메모를 다시 받는다 — 충돌이면 최신 값을 봐야 하니까. */
export function useSaveTodoNote() {
  const port = useEditNotePort();
  const refresh = useRefreshTodoNote();
  const setNote = useSetTodoNote();
  return useMutation({
    mutationFn: ({ seen, text }: { seen: TodoNote | null; text: string }) => port.save(seen, text),
    onSuccess: (r) => {
      afterNoteSave(r, { refresh, setNote });
    },
  });
}
