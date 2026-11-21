import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type AnswerInput, type BugItem } from '@/entities/bug-board';
import { useDb } from '@/shared/api';
import { answerPost } from './answerPost';

/** seen — 답변 칸이 지금 보고 있는 글. 겹친 답변으로 멈췄을 때도 새로 불러와 방금 달린 답변이 보이게 한다. */
export function useAnswerPost(id: string, label: string, seen: Pick<BugItem, 'lastReplyTs'>) {
  const db = useDb();
  const refresh = useRefreshBugBoard();
  return useMutation({
    mutationFn: (input: AnswerInput) => answerPost(db, id, input, label, seen),
    onSuccess: (r) => {
      if (r.ok || r.busy) refresh();
    },
  });
}
