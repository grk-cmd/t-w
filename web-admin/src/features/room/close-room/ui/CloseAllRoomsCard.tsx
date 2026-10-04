import { useState } from 'react';
import { useRoomIndex } from '@/entities/room';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { CLOSE_ALL_WORD, isCloseAllConfirmed } from '../model/closeRoom';
import { useCloseAllRooms } from '../model/useCloseRoom';

export function CloseAllRoomsCard() {
  const toast = useToast();
  const { data: index } = useRoomIndex();
  const closeAll = useCloseAllRooms();
  const [typed, setTyped] = useState('');
  const count = index ? Object.keys(index).length : null;

  const onClose = () => {
    if (!isCloseAllConfirmed(typed)) return;
    closeAll.mutate(undefined, {
      onSuccess: (codes) => {
        toast(codes.length ? `방 ${codes.length}개를 종료했어요` : '종료할 방이 없어요');
        setTyped('');
      },
      onError: (e) => toast(errorMessage(e, '종료하지 못했어요. 지운 방은 없어요')),
    });
  };

  return (
    <section className="card">
      <h2>🛑 전체 방 종료</h2>
      <p className="soft">대상 {count ?? '…'}개</p>
      <div className="field">
        <input
          type="text"
          placeholder={CLOSE_ALL_WORD}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button
          type="button"
          className="btn danger"
          disabled={!isCloseAllConfirmed(typed) || closeAll.isPending}
          title="목록의 방을 즉시 닫아요. 안에 있던 사람은 튕겨 나가요. 시크릿룸은 제외"
          onClick={onClose}
        >
          {closeAll.isPending ? '종료 중…' : '전체 종료'}
        </button>
      </div>
    </section>
  );
}
