import type { LicenseRequest } from '@/entities/license-request';
import { useToast } from '@/shared/ui';
import { useApproveRequests } from '../model/useApproveRequest';

interface Props {
  requests: LicenseRequest[];
  onDone: () => void;
}

export function BulkApproveButton({ requests, onDone }: Props) {
  const toast = useToast();
  const approve = useApproveRequests();

  const onClick = () => {
    if (!confirm(`선택한 요청 ${requests.length}건에 키를 발급해 각자의 수령함으로 보낼까요?`)) return;
    approve.mutate(requests, {
      onSuccess: (r) => {
        const parts = [`${r.issued}건 발급`];
        if (r.notDelivered) parts.push(`그중 ${r.notDelivered}건은 수령함으로 못 보냄`);
        if (r.failed) parts.push(`${r.failed}건 실패`);
        toast(parts.join(' · '));
        onDone();
      },
    });
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
