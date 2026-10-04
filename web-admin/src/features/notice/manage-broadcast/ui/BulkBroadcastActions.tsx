import type { InboxBroadcast } from '@/entities/inbox';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { pinTargets } from '../model/manageBroadcasts';
import { useDeleteBroadcasts, usePinBroadcasts } from '../model/useManageBroadcast';

interface Props {
  broadcasts: InboxBroadcast[];
  onDone: () => void;
}

export function BulkBroadcastActions({ broadcasts, onDone }: Props) {
  const toast = useToast();
  const env = useEnv();
  const pin = usePinBroadcasts();
  const remove = useDeleteBroadcasts();
  const toPin = pinTargets(broadcasts, true);
  const toUnpin = pinTargets(broadcasts, false);
  const busy = pin.isPending || remove.isPending;

  // 지운 줄과 함께 이 막대가 내려갈 수 있어 호출별 콜백 대신 결과를 기다려 알린다.
  const onPin = async (pinned: boolean) => {
    const ids = pinned ? toPin : toUnpin;
    if (!confirm(`선택한 ${ids.length}개를 ${pinned ? '맨 위에 고정' : '고정 해제'}할까요?`)) return;
    try {
      const n = await pin.mutateAsync({ ids, pinned });
      toast(pinned ? `${n}개 고정했어요` : `${n}개 고정을 풀었어요`);
      onDone();
    } catch (e) {
      toast(errorMessage(e, '바꾸지 못했어요'));
    }
  };

  const onDelete = async () => {
    const ids = broadcasts.map((b) => b.id);
    if (
      !confirm(
        withProdMark(env, `선택한 ${ids.length}개를 모든 사람의 수령함에서 지울까요? 되돌릴 수 없어요.`),
      )
    )
      return;
    try {
      toast(`${await remove.mutateAsync(ids)}개 삭제했어요`);
      onDone();
    } catch (e) {
      toast(errorMessage(e, '삭제하지 못했어요. 지운 공지는 없어요'));
    }
  };

  return (
    <>
      <button type="button" className="btn" disabled={busy || !toPin.length} onClick={() => onPin(true)}>
        선택 고정 ({toPin.length})
      </button>
      <button type="button" className="btn" disabled={busy || !toUnpin.length} onClick={() => onPin(false)}>
        선택 고정 해제 ({toUnpin.length})
      </button>
      <button type="button" className="btn danger" disabled={busy || !broadcasts.length} onClick={onDelete}>
        {remove.isPending ? '삭제 중…' : `선택 삭제 (${broadcasts.length})`}
      </button>
    </>
  );
}
