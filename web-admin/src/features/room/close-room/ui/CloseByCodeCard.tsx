import { useState } from 'react';
import { normalizeRoomCode } from '@/entities/room';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useCloseRoom } from '../model/useCloseRoom';

// 시크릿룸(SCRT-)은 roomIndex 에 적히지 않아 목록에 없다. 코드를 알면 여기서 닫는다.
export function CloseByCodeCard() {
  const toast = useToast();
  const close = useCloseRoom();
  const [input, setInput] = useState('');
  const code = normalizeRoomCode(input);

  const onClose = () => {
    if (!code) return;
    if (!confirm(`${code} 방을 종료할까요? 안에 있던 사람은 방에서 튕겨 나가요.`)) return;
    close.mutate(code, {
      onSuccess: () => {
        toast(`${code} 방을 종료했어요`);
        setInput('');
      },
      onError: (e) => toast(errorMessage(e, '종료하지 못했어요')),
    });
  };

  return (
    <section className="card">
      <h2>코드로 방 종료</h2>
      <p className="soft">목록에 없는 방(시크릿룸 SCRT- 등)을 코드로 닫아요.</p>
      <div className="field">
        <input
          type="text"
          placeholder="예: SCRT-AB12"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="button" className="btn danger" disabled={!code || close.isPending} onClick={onClose}>
          {close.isPending ? '종료 중…' : '종료'}
        </button>
      </div>
    </section>
  );
}
