import type { LicenseRequest } from '@/entities/license-request';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useApproveRequests } from '../model/useApproveRequest';

interface Props {
  requests: LicenseRequest[];
  onDone: () => void;
}

export function BulkApproveButton({ requests, onDone }: Props) {
  const toast = useToast();
  const env = useEnv();
  const approve = useApproveRequests();

  // 발급된 요청은 실시간 목록에서 먼저 사라져 이 버튼이 내려갈 수 있다 — 호출별 콜백 대신 결과를 기다려 알린다.
  const onClick = async () => {
    const ask = `선택한 요청 ${requests.length}건에 키를 발급해 각자의 수령함으로 보낼까요?`;
    if (!confirm(withProdMark(env, ask))) return;
    try {
      const r = await approve.mutateAsync(requests);
      const parts = [`${r.issued}건 발급`];
      if (r.notDelivered) parts.push(`그중 ${r.notDelivered}건은 수령함으로 못 보냄`);
      if (r.failed) parts.push(`${r.failed}건 실패`);
      toast(parts.join(' · '));
      onDone();
    } catch (e) {
      toast(errorMessage(e, '발급하지 못했어요'));
    }
  };

  return (
    <button
      type="button"
      className="btn primary"
      disabled={!requests.length || approve.isPending}
      onClick={onClick}
    >
      {approve.isPending ? '발급 중…' : `선택 발급 (${requests.length})`}
    </button>
  );
}
