import type { InboxBroadcast } from '@/entities/inbox';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useDeleteBroadcast, useTogglePin } from '../model/useManageBroadcast';

export function BroadcastActions({ broadcast }: { broadcast: InboxBroadcast }) {
  const toast = useToast();
  const pin = useTogglePin();
  const remove = useDeleteBroadcast();
  const next = !broadcast.pinned;

  // 고정하면 줄이 맨 위로 옮겨 가고 지우면 사라진다 — 호출별 콜백 대신 결과를 기다려 알린다.
  const onPin = async () => {
    try {
      await pin.mutateAsync({ id: broadcast.id, pinned: next });
      toast(next ? '맨 위에 고정했어요' : '고정을 풀었어요');
    } catch (e) {
      toast(errorMessage(e, '바꾸지 못했어요'));
    }
  };

  const onDelete = async () => {
    if (!confirm(`"${broadcast.title}" 공지를 모든 사람의 수령함에서 지울까요? 되돌릴 수 없어요.`)) return;
    try {
      await remove.mutateAsync(broadcast.id);
      toast('삭제했어요');
    } catch (e) {
      toast(errorMessage(e, '삭제하지 못했어요'));
    }
  };

  const busy = pin.isPending || remove.isPending;

  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={onPin}>
        {broadcast.pinned ? '고정 풀기' : '📌 고정'}
      </button>
      <button type="button" className="btn danger" disabled={busy} onClick={onDelete}>
        {remove.isPending ? '삭제 중…' : '삭제'}
      </button>
    </>
  );
}
