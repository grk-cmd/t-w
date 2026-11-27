import { useRoomPort } from '@/entities/room';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { closeResultText } from '../model/closeRoom';
import { useCloseSelectedRooms } from '../model/useCloseRoom';

interface Props {
  codes: string[];
  onDone: () => void;
}

export function CloseSelectedRoomsButton({ codes, onDone }: Props) {
  const toast = useToast();
  const close = useCloseSelectedRooms();
  const { closeMax } = useRoomPort();
  // 한 번에 닫을 수 있는 수를 넘으면 나눠 보내지 않고 줄이라고 알린다.
  const over = closeMax !== null && codes.length > closeMax;

  // 닫힌 방은 목록에서 빠져 이 버튼이 내려갈 수 있다 — 호출별 콜백 대신 결과를 기다려 알린다.
  const onClick = async () => {
    if (!confirm(`선택한 ${codes.length}개 방을 종료할까요? 안에 있던 사람은 방에서 튕겨 나가요.`)) return;
    try {
      toast(closeResultText(await close.mutateAsync(codes)));
      onDone();
    } catch (e) {
      toast(errorMessage(e, '종료하지 못했어요. 지운 방은 없어요'));
    }
  };

  return (
    <button
      type="button"
      className="btn danger"
      disabled={!codes.length || close.isPending || over}
      title={over ? `한 번에 ${closeMax}개까지 — 선택을 줄여 주세요 (지금 ${codes.length}개)` : undefined}
      onClick={onClick}
    >
      {close.isPending ? '종료 중…' : `선택 종료 (${codes.length})`}
    </button>
  );
}
