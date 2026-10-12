import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type BugAnswer } from '@/entities/bug-board';
import { useDb } from '@/shared/api';
import { deleteAnswer } from './deleteAnswer';

export function useDeleteAnswer(postId: string, answer: BugAnswer, label: string) {
  const db = useDb();
  const refresh = useRefreshBugBoard();
  return useMutation({
    mutationFn: () => deleteAnswer(db, postId, answer, label),
    onSuccess: (r) => {
      if (r.ok) refresh();
    },
  });
}
