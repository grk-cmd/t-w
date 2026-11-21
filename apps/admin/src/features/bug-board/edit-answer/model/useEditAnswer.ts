import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type AnswerEditInput, type BugAnswer } from '@/entities/bug-board';
import { useDb } from '@/shared/api';
import { editAnswer } from './editAnswer';

export function useEditAnswer(postId: string, answer: BugAnswer, label: string) {
  const db = useDb();
  const refresh = useRefreshBugBoard();
  return useMutation({
    mutationFn: (input: AnswerEditInput) => editAnswer(db, postId, answer, input, label),
    onSuccess: (r) => {
      if (r.ok) refresh();
    },
  });
}
