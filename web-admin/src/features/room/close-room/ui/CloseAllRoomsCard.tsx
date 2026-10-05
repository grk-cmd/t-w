import { useState } from 'react';
import { allRoomCodes, isSecretRoom, useRoomCodes, useRoomIndex } from '@/entities/room';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { CLOSE_ALL_WORD, isCloseAllConfirmed } from '../model/closeRoom';
import { useCloseAllRooms } from '../model/useCloseRoom';

export function CloseAllRoomsCard() {
  const toast = useToast();
  const env = useEnv();
  const { data: index } = useRoomIndex();
  const { data: codes } = useRoomCodes();
  const closeAll = useCloseAllRooms();
  const [typed, setTyped] = useState('');
  const all = index && codes ? allRoomCodes(index, codes) : null;
  const secret = all?.filter(isSecretRoom).length ?? 0;
  const target = all ? `${all.length}개` + (secret ? ` (시크릿룸 ${secret}개 포함)` : '') : '…';

  const onClose = () => {
    if (!all || !isCloseAllConfirmed(typed)) return;
    const ask = `방 ${all.length}개를 모두 종료할까요? (시크릿룸 ${secret}개 포함)\n안에 있던 사람은 방에서 튕겨 나가요.`;
    if (!confirm(withProdMark(env, ask))) return;
    closeAll.mutate(undefined, {
      onSuccess: (closed) => {
        toast(closed.length ? `방 ${closed.length}개를 종료했어요` : '종료할 방이 없어요');
        setTyped('');
      },
      onError: (e) => toast(errorMessage(e, '종료하지 못했어요. 지운 방은 없어요')),
    });
  };

  return (
    <section className="card">
      <h2>🛑 전체 방 종료</h2>
      <p className="soft">대상 {target}</p>
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
          disabled={!all || !isCloseAllConfirmed(typed) || closeAll.isPending}
          title="시크릿룸까지 모든 방을 즉시 닫아요. 안에 있던 사람은 튕겨 나가요"
          onClick={onClose}
        >
          {closeAll.isPending ? '종료 중…' : '전체 종료'}
        </button>
      </div>
    </section>
  );
}
