import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type AnswerInput, type BugItem } from '@/entities/bug-board';
import { useAnswerPostPort } from '../api';

/** item — 답변 칸이 지금 보고 있는 글. 겹친 답변으로 멈췄을 때도 새로 불러와 방금 달린 답변이 보이게 한다. */
export function useAnswerPost(item: BugItem, label: string) {
  const port = useAnswerPostPort();
  const refresh = useRefreshBugBoard();
  const mutation = useMutation({
    mutationFn: (input: AnswerInput) => port.answer(item, input, label),
    onSuccess: (r) => {
      if (r.ok || r.busy) refresh();
    },
  });
  return { ...mutation, check: port.check };
}
