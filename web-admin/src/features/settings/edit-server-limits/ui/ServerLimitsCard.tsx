import { useState, type FormEvent } from 'react';
import { SERVER_LIMIT_CHANNELS, SERVER_LIMIT_DEFAULT, useServerLimits } from '@/entities/server/ops-config';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  checkServerLimits,
  SERVER_LIMIT_LABEL,
  serverLimitsConfirmText,
  useSaveServerLimits,
  type ServerLimitInputs,
} from '../model/editServerLimits';
import styles from './ServerLimitsCard.module.css';

type Message = { text: string; error: boolean } | null;

// 방 서버 한 대가 맡을 수 있는 채널별 방 수 — 서버 설정 키 room.serverLimits. API 판에만 있다(Firebase 판은 방 서버 화면에서 고친다).
export function ServerLimitsCard() {
  const env = useEnv();
  const { data: saved, error, isPending } = useServerLimits();
  const save = useSaveServerLimits();
  const [draft, setDraft] = useState<ServerLimitInputs | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const inputs: ServerLimitInputs = draft ?? {
    workingroom: String(saved?.workingroom ?? ''),
    togetherroom: String(saved?.togetherroom ?? ''),
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!saved) return;
    const r = checkServerLimits(saved, inputs);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (!confirm(withProdMark(env, serverLimitsConfirmText(saved, r.next)))) return;
    save.mutate(r.next, {
      onSuccess: () => {
        setDraft(null);
        setMessage({ text: '저장 · 방 서버가 다음에 설정을 읽은 뒤부터', error: false });
      },
      onError: (err) => {
        setDraft(null);
        setMessage({ text: errorMessage(err, '저장 실패'), error: true });
      },
    });
  };

  return (
    <section className="card">
      <h2>방 서버 한 대의 방 상한</h2>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <form className={styles.row} onSubmit={submit}>
          {SERVER_LIMIT_CHANNELS.map((ch) => (
            <label key={ch} className={styles.field}>
              {SERVER_LIMIT_LABEL[ch]}
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                aria-label={`${SERVER_LIMIT_LABEL[ch]} 방 서버 한 대의 방 상한`}
                disabled={isPending}
                value={isPending ? '' : inputs[ch]}
                onChange={(e) => setDraft({ ...inputs, [ch]: e.target.value })}
              />
            </label>
          ))}
          <button type="submit" className="btn primary" disabled={isPending || save.isPending || !draft}>
            {save.isPending ? '저장 중…' : '저장'}
          </button>
          <small className={`soft ${styles.hint}`}>
            방 서버 한 대를 지키는 상한 · 기본 {SERVER_LIMIT_DEFAULT} · 낮춰도 열린 방은 그대로 — 새 방만
            막음. 채널별 «전체 방 상한» 과 다르다.
          </small>
        </form>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
