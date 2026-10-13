import { useState } from 'react';
import { useRoomServerConfig } from '@/entities/room-server';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  registerIndexConfirmText,
  useSetRegisterIndex,
  useSetRoomServerSwitch,
} from '../model/useSetRoomServerSwitch';
import styles from './RoomServerSwitchCard.module.css';

type Message = { text: string; error: boolean } | null;

const LABEL = '방 서버 사용';
const INDEX_LABEL = '방 서버 장부 등록';

// 켜져 있으면 누구든 서버에 있는 방 코드로 들어갈 때 그 서버로 따라간다(따로 끄는 칸 없음 —
// 안 따라가면 Firebase 의 «같은 코드 다른 방» 으로 갈라진다). 문제가 생기면 이 스위치 하나로 멈춘다.
export function RoomServerSwitchCard() {
  const env = useEnv();
  const { data: cfg, error, isPending } = useRoomServerConfig();
  const save = useSetRoomServerSwitch();
  const saveIndex = useSetRegisterIndex();
  const [message, setMessage] = useState<Message>(null);
  const busy = isPending || save.isPending || saveIndex.isPending;

  const toggle = (value: boolean) => {
    if (!confirm(withProdMark(env, `${LABEL} ${value ? '켜기' : '끄기'} — 다음 입장부터 반영`))) return;
    save.mutate(value, {
      onSuccess: () => setMessage({ text: `${LABEL} ${value ? '켜짐' : '꺼짐'}`, error: false }),
      onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
    });
  };

  const toggleIndex = (value: boolean) => {
    if (!confirm(withProdMark(env, registerIndexConfirmText(value)))) return;
    saveIndex.mutate(value, {
      onSuccess: () =>
        setMessage({
          text: `${INDEX_LABEL} ${value ? '켜짐' : '꺼짐'} · 방 서버는 1분 안에 반영`,
          error: false,
        }),
      onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
    });
  };

  return (
    <section className="card">
      <h2>스위치</h2>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <>
          <div className={styles.item}>
            <label className={styles.label}>
              <input
                type="checkbox"
                checked={cfg?.on ?? false}
                disabled={busy}
                onChange={(e) => toggle(e.target.checked)}
              />
              {LABEL}
            </label>
            <small className="soft">
              켜면 시범 이용자는 서버에 방을 열고, 누구든 서버에 있는 방으로 따라감(로그인 연결 계정만 —
              아니면 Firebase).
            </small>
            <small className="soft">
              비상 정지 — 끄면 다음 입장부터 전원 Firebase. 이미 서버 방에 있는 사람은 나갈 때까지 그대로.
            </small>
          </div>
          <div className={styles.item}>
            <label className={styles.label}>
              <input
                type="checkbox"
                checked={cfg?.registerIndex ?? false}
                disabled={busy}
                onChange={(e) => toggleIndex(e.target.checked)}
              />
              {INDEX_LABEL}
            </label>
            <small className="soft">
              켜면 방 서버가 자기 방을 roomIndex 장부에 올려 전체 방 상한(⚙️ 설정)을 Firebase + 방 서버 합계로
              셈.
            </small>
            <small className="soft">
              끄면 Firebase 방만 전체 상한과 견주고, 방 서버 방은 아래 «서버 한 대 상한» 으로 따로 막음.
            </small>
          </div>
        </>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
