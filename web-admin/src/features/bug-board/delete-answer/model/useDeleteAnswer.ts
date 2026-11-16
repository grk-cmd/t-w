import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type BugAnswer } from '@/entities/bug-board';
import { useDeleteAnswerPort } from '../api';

export function useDeleteAnswer(postId: string, answer: BugAnswer, label: string) {
  const port = useDeleteAnswerPort();
  const refresh = useRefreshBugBoard();
  return useMutation({
    mutationFn: () => port.remove(postId, answer, label),
    onSuccess: (r) => {
      if (r.ok) refresh();
    },
  });
}
