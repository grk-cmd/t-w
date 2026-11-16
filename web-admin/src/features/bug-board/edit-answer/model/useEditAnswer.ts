import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type AnswerEditInput, type BugAnswer } from '@/entities/bug-board';
import { useEditAnswerPort } from '../api';

export function useEditAnswer(postId: string, answer: BugAnswer, label: string) {
  const port = useEditAnswerPort();
  const refresh = useRefreshBugBoard();
  const mutation = useMutation({
    mutationFn: (input: AnswerEditInput) => port.edit(postId, answer, input, label),
    onSuccess: (r) => {
      if (r.ok) refresh();
    },
  });
  return { ...mutation, check: port.check };
}
