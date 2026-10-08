import { useState, type FormEvent } from 'react';
import {
  CHANNEL_LABEL,
  CHANNELS,
  effectiveLimit,
  useRoomServerConfig,
  useServerHealth,
  type RoomServerConfig,
} from '@/entities/room-server';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { checkLimits, limitsConfirmText, useSetRoomLimits, type LimitInputs } from '../model/editLimits';
import styles from './LimitsCard.module.css';

type Message = { text: string; error: boolean } | null;

const toInputs = (cfg: RoomServerConfig | undefined): LimitInputs => ({
  workingroom: String(effectiveLimit(cfg, 'workingroom')),
  togetherroom: String(effectiveLimit(cfg, 'togetherroom')),
});

// 서버 한 대의 지금 방 개수 — 방 서버 /health(공개 · 개수뿐). Firebase 는 읽지 않는다.
function ServerCount({ name, url }: { name: string; url: string }) {
  const h = useServerHealth(url);
  return (
    <div className="row">
      <code className="key">{name}</code>
      {h.isPending ? (
        <span className="soft grow">…</span>
      ) : h.error || !h.data ? (
        <span className="soft grow">읽지 못함</span>
      ) : (
        <span className="grow">
          {CHANNELS.map((ch) => {
            const d = h.data;
            const lim = d.limits?.[ch];
            return (
              <span key={ch} className={styles.count}>
                {CHANNEL_LABEL[ch]} {d[ch]}
                {lim !== undefined && <small className="soft">/{lim}</small>}
              </span>
            );
          })}
          <small className="soft">연결 {h.data.conns}</small>
        </span>
      )}
      <button type="button" className="btn" disabled={h.isFetching} onClick={() => void h.refetch()}>
        다시
      </button>
    </div>
  );
}

// 채널별 방 개수 상한 — config/roomServer/limits. 방 서버가 1분마다 읽어 새 방부터 적용(열린 방은 그대로).
export function LimitsCard() {
  const env = useEnv();
  const { data: cfg, error, isPending } = useRoomServerConfig();
  const save = useSetRoomLimits();
  const [draft, setDraft] = useState<LimitInputs | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const inputs = draft ?? toInputs(cfg);
  const servers = Object.entries(cfg?.servers ?? {}).sort(([a], [b]) => a.localeCompare(b));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = checkLimits(cfg, inputs);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (!confirm(withProdMark(env, limitsConfirmText(cfg, r.next)))) return;
    save.mutate(
      { cfg, next: r.next },
      {
        onSuccess: () => {
          setDraft(null);
          setMessage({ text: '저장 · 1분 안에 서버에 반영', error: false });
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  return (
    <section className="card">
      <h2>방 개수 상한</h2>
      <p className="soft">
        서버 한 대 · 채널마다 열 수 있는 방 수(시크릿룸 제외). 낮춰도 열린 방은 그대로 — 새 방만 막음.
      </p>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <>
          <form className={styles.form} onSubmit={submit}>
            {CHANNELS.map((ch) => (
              <label key={ch} className={styles.field}>
                {CHANNEL_LABEL[ch]}
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`${CHANNEL_LABEL[ch]} 상한`}
                  value={inputs[ch]}
                  disabled={isPending}
                  onChange={(e) => setDraft({ ...inputs, [ch]: e.target.value })}
                />
                {!isPending && cfg?.limits[ch] == null && <small className="soft">기본값</small>}
              </label>
            ))}
            <button type="submit" className="btn primary" disabled={isPending || save.isPending}>
              저장
            </button>
          </form>
          {servers.length > 0 && (
            <div className="list">
              {servers.map(([n, u]) => (
                <ServerCount key={n} name={n} url={u} />
              ))}
            </div>
          )}
        </>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
