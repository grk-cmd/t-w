import type { BugAnswer } from '@/entities/bug-board';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { deleteAnswerAsk } from '../model/deleteAnswer';
import { useDeleteAnswer } from '../model/useDeleteAnswer';

/** 운영자 답변 한 개 지우기 버튼 — 글쓴이 답글에는 달지 않는다. */
export function DeleteAnswerButton({
  postId,
  answer,
  label,
}: {
  postId: string;
  answer: BugAnswer;
  label: string;
}) {
  const env = useEnv();
  const toast = useToast();
  const remove = useDeleteAnswer(postId, answer, label);

  const onClick = () => {
    if (!confirm(withProdMark(env, deleteAnswerAsk(label)))) return;
    remove.mutate(undefined, {
      onSuccess: (r) => toast(r.ok ? `${label} 답변 삭제됨` : r.reason),
      onError: (e) => toast(errorMessage(e, '답변 삭제 실패')),
    });
  };

  return (
    <button type="button" className="btn danger" disabled={remove.isPending} onClick={onClick}>
      {remove.isPending ? '지우는 중…' : '삭제'}
    </button>
  );
}
