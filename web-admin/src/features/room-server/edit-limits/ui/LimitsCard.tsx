import { useState, type FormEvent } from 'react';
import {
  CHANNEL_LABEL,
  CHANNELS,
  effectiveLimit,
  useRoomServerConfig,
  useServerHealth,
  type RoomServerConfig,
} from '@/entities/room-server';
import { useRoomStats } from '@/entities/room';
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
// 시크릿룸은 채널 상한 밖이라 «/상한» 없이 따로 센다.
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
          {h.data.secret !== null && <span className={styles.count}>시크릿룸 {h.data.secret}</span>}
          <small className="soft">
            {h.data.members !== null && `방 안 ${h.data.members}명 · `}연결 {h.data.conns}
          </small>
        </span>
      )}
      <button type="button" className="btn" disabled={h.isFetching} onClick={() => void h.refetch()}>
        다시
      </button>
    </div>
  );
}

// 채널마다 Firebase 방 + 방 서버 방 = 합계 / 250(앱 ROOM_LIMITS · 함수 TOTAL_ROOM_LIMIT). 시크릿룸은 셈에서 뺀다.
const TOTAL_LIMIT = 250;
function TotalCount() {
  const st = useRoomStats();
  const d = st.data;
  if (st.isPending) return <p className="soft">…</p>;
  if (st.error || !d) return <p className="soft">합계를 읽지 못함</p>;
  return (
    <div className={styles.total}>
      {CHANNELS.map((ch) => {
        const fb = d[ch] ?? 0;
        const srv = d.server?.[ch];
        const sum = fb + (srv ?? 0);
        return (
          <div key={ch} className="row">
            <strong>{CHANNEL_LABEL[ch]}</strong>
            <span className="grow">
              Firebase {fb} + 방 서버 {srv ?? '—'} ={' '}
              <b className={sum >= TOTAL_LIMIT ? styles.over : undefined}>
                {sum}/{TOTAL_LIMIT}
              </b>
            </span>
          </div>
        );
      })}
      <small className="soft">
        {d.at ? `${new Date(d.at).toLocaleTimeString()} 집계(1분마다)` : ''}
        {d.server ? '' : ' · 방 서버 몫은 새 함수 배포 뒤부터'}
      </small>
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
        채널마다 <b>Firebase 방 + 방 서버 방 합계 {TOTAL_LIMIT}</b>(시크릿룸 제외). 방 서버 상한은 roomStats
        함수가 매분 «{TOTAL_LIMIT} − Firebase 방» 으로 자동으로 맞춘다 — 아래에서 손으로 바꿔도 다음 분에
        덮인다.
      </p>
      <TotalCount />
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
