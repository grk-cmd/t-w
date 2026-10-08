import { useState } from 'react';
import { useRoomServerConfig } from '@/entities/room-server';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useSetRoomServerSwitch } from '../model/useSetRoomServerSwitch';
import styles from './RoomServerSwitchCard.module.css';

type Message = { text: string; error: boolean } | null;

const SWITCHES = [
  {
    key: 'on',
    label: '방 서버 사용',
    help: '끄면 다음 입장부터 전원 Firebase. 이미 서버 방에 있는 사람은 나갈 때까지 그대로.',
  },
  {
    key: 'follow',
    label: '방 따라가기',
    help: '켜면 시범 이용자가 아닌 사람도 서버에 있는 방 코드로 들어갈 때 그 서버로. 로그인 연결 계정만 — 아니면 Firebase(같은 코드 다른 방).',
  },
] as const;

export function RoomServerSwitchCard() {
  const env = useEnv();
  const { data: cfg, error, isPending } = useRoomServerConfig();
  const save = useSetRoomServerSwitch();
  const [message, setMessage] = useState<Message>(null);

  const toggle = (key: 'on' | 'follow', label: string, value: boolean) => {
    if (!confirm(withProdMark(env, `${label} ${value ? '켜기' : '끄기'} — 다음 입장부터 반영`))) return;
    save.mutate(
      { key, value },
      {
        onSuccess: () => setMessage({ text: `${label} ${value ? '켜짐' : '꺼짐'}`, error: false }),
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  return (
    <section className="card">
      <h2>스위치</h2>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        SWITCHES.map((s) => (
          <div key={s.key} className={styles.item}>
            <label className={styles.label}>
              <input
                type="checkbox"
                checked={cfg?.[s.key] ?? false}
                disabled={isPending || save.isPending}
                onChange={(e) => toggle(s.key, s.label, e.target.checked)}
              />
              {s.label}
            </label>
            <small className="soft">{s.help}</small>
          </div>
        ))
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
