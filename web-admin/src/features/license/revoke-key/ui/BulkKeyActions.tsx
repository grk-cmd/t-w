import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { removeTargets, revokeTargets, type SelectedKey } from '../model/revokeKeys';
import { useRemoveKeys, useRevokeKeys } from '../model/useRevokeKey';

interface Props {
  keys: SelectedKey[];
  onDone: () => void;
}

export function BulkKeyActions({ keys, onDone }: Props) {
  const toast = useToast();
  const revoke = useRevokeKeys();
  const remove = useRemoveKeys();
  const toRevoke = revokeTargets(keys);
  const toRemove = removeTargets(keys);
  const busy = revoke.isPending || remove.isPending;

  // 동작 뒤 줄 · 이 막대가 사라질 수 있어 mutate 의 호출별 콜백 대신 결과를 기다려 알린다.
  const onRevoke = async () => {
    const skip = keys.length - toRevoke.length;
    const head = skip
      ? `선택한 ${keys.length}개 중 이미 회수된 ${skip}개를 빼고 ${toRevoke.length}개를 회수할까요?`
      : `선택한 ${toRevoke.length}개를 회수할까요?`;
    if (!confirm(`${head} 이 키를 쓰던 사람은 다음 접속 때 라이선스가 풀려요.`)) return;
    try {
      toast(`${await revoke.mutateAsync(toRevoke)}개 회수했어요`);
      onDone();
    } catch (e) {
      toast(errorMessage(e, '회수하지 못했어요. 바뀐 키는 없어요'));
    }
  };

  const onRemove = async () => {
    const skip = keys.length - toRemove.length;
    const head = skip
      ? `선택한 ${keys.length}개 중 회수된 ${toRemove.length}개만 삭제할까요? 살아 있는 ${skip}개는 남아요.`
      : `선택한 ${toRemove.length}개를 삭제할까요?`;
    if (!confirm(`${head} 되돌릴 수 없어요.`)) return;
    try {
      toast(`${await remove.mutateAsync(toRemove)}개 삭제했어요`);
      onDone();
    } catch (e) {
      toast(errorMessage(e, '삭제하지 못했어요. 지운 키는 없어요'));
    }
  };

  return (
    <>
      <button type="button" className="btn danger" disabled={busy || !toRevoke.length} onClick={onRevoke}>
        {revoke.isPending ? '회수 중…' : `선택 회수 (${toRevoke.length})`}
      </button>
      <button type="button" className="btn danger" disabled={busy || !toRemove.length} onClick={onRemove}>
        {remove.isPending ? '삭제 중…' : `선택 삭제 (${toRemove.length})`}
      </button>
    </>
  );
}
