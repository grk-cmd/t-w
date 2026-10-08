import { useState } from 'react';
import { useRoomServerConfig } from '@/entities/room-server';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useSetRoomServerSwitch } from '../model/useSetRoomServerSwitch';
import styles from './RoomServerSwitchCard.module.css';

type Message = { text: string; error: boolean } | null;

const LABEL = '방 서버 사용';

// 켜져 있으면 누구든 서버에 있는 방 코드로 들어갈 때 그 서버로 따라간다(따로 끄는 칸 없음 —
// 안 따라가면 Firebase 의 «같은 코드 다른 방» 으로 갈라진다). 문제가 생기면 이 스위치 하나로 멈춘다.
export function RoomServerSwitchCard() {
  const env = useEnv();
  const { data: cfg, error, isPending } = useRoomServerConfig();
  const save = useSetRoomServerSwitch();
  const [message, setMessage] = useState<Message>(null);

  const toggle = (value: boolean) => {
    if (!confirm(withProdMark(env, `${LABEL} ${value ? '켜기' : '끄기'} — 다음 입장부터 반영`))) return;
    save.mutate(value, {
      onSuccess: () => setMessage({ text: `${LABEL} ${value ? '켜짐' : '꺼짐'}`, error: false }),
      onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
    });
  };

  return (
    <section className="card">
      <h2>스위치</h2>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <div className={styles.item}>
          <label className={styles.label}>
            <input
              type="checkbox"
              checked={cfg?.on ?? false}
              disabled={isPending || save.isPending}
              onChange={(e) => toggle(e.target.checked)}
            />
            {LABEL}
          </label>
          <small className="soft">
            켜면 시범 이용자는 서버에 방을 열고, 누구든 서버에 있는 방으로 따라감(로그인 연결 계정만 — 아니면
            Firebase).
          </small>
          <small className="soft">
            비상 정지 — 끄면 다음 입장부터 전원 Firebase. 이미 서버 방에 있는 사람은 나갈 때까지 그대로.
          </small>
        </div>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
