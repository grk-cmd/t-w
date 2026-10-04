import type { LicenseRequest } from '@/entities/license-request';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useApproveRequest, useRejectRequest } from '../model/useApproveRequest';

export function RequestActions({ request }: { request: LicenseRequest }) {
  const toast = useToast();
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const who = `${request.name || '이름 없음'} 님`;

  const onApprove = () =>
    approve.mutate(request, {
      onSuccess: ({ delivered }) =>
        toast(`${who}에게 발급했어요 · ${delivered ? '수령함으로 보냈어요' : '수령함 전송 실패'}`),
      onError: (e) => toast(errorMessage(e, '발급하지 못했어요')),
    });

  const onReject = () => {
    if (!confirm(`${who}의 요청을 거절할까요? 상대는 다시 요청할 수 있어요.`)) return;
    reject.mutate(request, {
      onSuccess: () => toast('거절했어요'),
      onError: (e) => toast(errorMessage(e, '거절하지 못했어요')),
    });
  };

  const busy = approve.isPending || reject.isPending;

  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={onApprove}>
        {approve.isPending ? '발급 중…' : '발급'}
      </button>
      <button type="button" className="btn danger" disabled={busy} onClick={onReject}>
        {reject.isPending ? '거절 중…' : '거절'}
      </button>
    </>
  );
}
