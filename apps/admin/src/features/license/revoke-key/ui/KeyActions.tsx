import type { LicenseStatus } from '@/entities/license';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useRemoveKey, useRevokeKey } from '../model/useRevokeKey';

// 살아 있는 키는 회수만, 회수된 키만 목록에서 지울 수 있다.
export function KeyActions({ licenseKey, status }: { licenseKey: string; status: LicenseStatus }) {
  const toast = useToast();
  const revoke = useRevokeKey();
  const remove = useRemoveKey();

  // 회수 · 삭제 뒤 목록을 다시 받으며 이 줄이 바뀌거나 사라진다 — 호출별 콜백 대신 결과를 기다려 알린다.
  const onRevoke = async () => {
    if (!confirm(`${licenseKey} 키를 회수할까요? 이 키를 쓰던 사람은 다음 접속 때 라이선스가 풀려요.`))
      return;
    try {
      await revoke.mutateAsync(licenseKey);
      toast('회수했어요');
    } catch (e) {
      toast(errorMessage(e, '회수하지 못했어요'));
    }
  };

  const onRemove = async () => {
    if (!confirm(`${licenseKey} 키를 목록에서 완전히 지울까요? 되돌릴 수 없어요.`)) return;
    try {
      await remove.mutateAsync(licenseKey);
      toast('삭제했어요');
    } catch (e) {
      toast(errorMessage(e, '삭제하지 못했어요'));
    }
  };

  return status === 'revoked' ? (
    <button type="button" className="btn danger" disabled={remove.isPending} onClick={onRemove}>
      {remove.isPending ? '삭제 중…' : '삭제'}
    </button>
  ) : (
    <button type="button" className="btn danger" disabled={revoke.isPending} onClick={onRevoke}>
      {revoke.isPending ? '회수 중…' : '회수'}
    </button>
  );
}
