import type { BugItem } from '@/entities/bug-board';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { deleteAsk } from '../model/deletePost';
import { useDeletePost } from '../model/useDeletePost';

/** 지우고 나면 onDone(패널 닫기). */
export function DeletePostButton({
  item,
  label,
  onDone,
}: {
  item: BugItem;
  label: string;
  onDone: () => void;
}) {
  const env = useEnv();
  const toast = useToast();
  const remove = useDeletePost(item, label);

  const onClick = () => {
    if (!confirm(withProdMark(env, deleteAsk(label)))) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        toast(`${label} 삭제됨`);
        onDone();
      },
      onError: (e) => toast(errorMessage(e, '삭제 실패')),
    });
  };

  return (
    <button type="button" className="btn danger" disabled={remove.isPending} onClick={onClick}>
      {remove.isPending ? '지우는 중…' : '제보 삭제'}
    </button>
  );
}
