import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useCloseRoom } from '../model/useCloseRoom';

export function CloseRoomButton({ code }: { code: string }) {
  const toast = useToast();
  const close = useCloseRoom();

  const onClick = () => {
    if (!confirm(`${code} 방을 종료할까요? 안에 있던 사람은 방에서 튕겨 나가요.`)) return;
    close.mutate(code, {
      onSuccess: () => toast(`${code} 방을 종료했어요`),
      onError: (e) => toast(errorMessage(e, '종료하지 못했어요')),
    });
  };

  return (
    <button type="button" className="btn danger" disabled={close.isPending} onClick={onClick}>
      {close.isPending ? '종료 중…' : '종료'}
    </button>
  );
}
