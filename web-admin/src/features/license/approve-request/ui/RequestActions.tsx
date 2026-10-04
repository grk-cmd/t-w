import type { LicenseRequest } from '@/entities/license-request';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useApproveRequest, useRejectRequest } from '../model/useApproveRequest';

export function RequestActions({ request }: { request: LicenseRequest }) {
  const toast = useToast();
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const who = `${request.name || '이름 없음'} 님`;

  // 요청 목록은 실시간 구독이라 쓰는 순간 이 줄이 사라진다 — mutate 의 콜백은 언마운트되면 불리지 않아
  // 알림이 사라지므로 mutateAsync 의 결과를 기다려 알린다.
  const onApprove = async () => {
    try {
      const { delivered } = await approve.mutateAsync(request);
      toast(`${who}에게 발급했어요 · ${delivered ? '수령함으로 보냈어요' : '수령함 전송 실패'}`);
    } catch (e) {
      toast(errorMessage(e, '발급하지 못했어요'));
    }
  };

  const onReject = async () => {
    if (!confirm(`${who}의 요청을 거절할까요? 상대는 다시 요청할 수 있어요.`)) return;
    try {
      await reject.mutateAsync(request);
      toast('거절했어요');
    } catch (e) {
      toast(errorMessage(e, '거절하지 못했어요'));
    }
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
