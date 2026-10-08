import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type AnswerInput } from '@/entities/bug-board';
import { useDb } from '@/shared/api';
import { answerPost } from './answerPost';

export function useAnswerPost(id: string, label: string) {
  const db = useDb();
  const refresh = useRefreshBugBoard();
  return useMutation({
    mutationFn: (input: AnswerInput) => answerPost(db, id, input, label),
    onSuccess: (r) => {
      if (r.ok) refresh();
    },
  });
}
