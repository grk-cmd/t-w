import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useCloseRoom } from '../model/useCloseRoom';

export function CloseRoomButton({ code }: { code: string }) {
  const toast = useToast();
  const close = useCloseRoom();

  // 닫힌 방은 목록에서 빠져 이 버튼이 내려간다 — 호출별 콜백 대신 결과를 기다려 알린다.
  const onClick = async () => {
    if (!confirm(`${code} 방을 종료할까요? 안에 있던 사람은 방에서 튕겨 나가요.`)) return;
    try {
      await close.mutateAsync(code);
      toast(`${code} 방을 종료했어요`);
    } catch (e) {
      toast(errorMessage(e, '종료하지 못했어요'));
    }
  };

  return (
    <button type="button" className="btn danger" disabled={close.isPending} onClick={onClick}>
      {close.isPending ? '종료 중…' : '종료'}
    </button>
  );
}
