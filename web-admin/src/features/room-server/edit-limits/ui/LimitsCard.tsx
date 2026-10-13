import { useState, type FormEvent } from 'react';
import {
  formatAgo,
  roomStatsSummary,
  totalLimitOf,
  useRoomLimits,
  useRoomStats,
  useSnapshotNow,
} from '@/entities/room';
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

/**
 * 전체 방 개수 — roomStats(함수가 roomIndex 를 센 값). 방 서버가 자기 방을 roomIndex 에 올리면(registerIndex) 합계가 곧
 * 앱 · 방 서버가 전체 상한(config/roomLimits)과 비교하는 값이다. server 몫은 함수가 srv 줄을 따로 센 것(배포 전이면 없음).
 */
function TotalCount({ healthUrl }: { healthUrl: string | null }) {
  const stats = useRoomStats();
  // 전체 상한 — config/roomLimits(없거나 못 읽으면 기본값). 앱 · 방 서버가 견주는 값과 같다.
  const limits = useRoomLimits();
  const now = useSnapshotNow(stats.dataUpdatedAt);
  const s = now !== null ? roomStatsSummary(stats.data ?? null, now) : null;
  // 방 서버가 장부(roomIndex)에 자기 방을 안 올리는 판(v0.1.2)이면 장부의 방 서버 몫은 0 이다 —
  // 그때는 방 서버 /health 의 실제 방 수를 더해 «Firebase(장부) + 방 서버(실제)» 로 보인다.
  const h = useServerHealth(healthUrl ?? '');
  const ledgerSrv = (ch: (typeof CHANNELS)[number]) => s?.server?.[ch] ?? 0;
  const ledgerHasServer = !!s?.server && CHANNELS.some((ch) => ledgerSrv(ch) > 0);
  return (
    <div className="row">
      <b>전체</b>
      {stats.isPending ? (
        <span className="soft grow">…</span>
      ) : !s ? (
        <span className="soft grow">집계 없음</span>
      ) : (
        <span className="grow">
          {CHANNELS.map((ch) => {
            const lim = totalLimitOf(limits.data, ch);
            const live = !ledgerHasServer && healthUrl && h.data ? h.data[ch] : undefined;
            const srv = live ?? s.server?.[ch];
            const fb = s[ch] - ledgerSrv(ch);
            const total = fb + (srv ?? 0);
            return (
              <span key={ch} className={styles.count}>
                {CHANNEL_LABEL[ch]}{' '}
                {srv !== undefined && (
                  <small className="soft">
                    Firebase {fb} + 방 서버 {srv}
                    {live !== undefined ? '(실제)' : ''} ={' '}
                  </small>
                )}
                <b className={total >= lim ? 'warn' : undefined}>{total}</b>
                <small className="soft">/{lim}</small>
              </span>
            );
          })}
          {!s.server && <small className="soft">방 서버 몫 따로 모름(함수 배포 전) · </small>}
          <small className={s.fresh ? 'soft' : 'warn'}>
            {s.at !== null && now !== null ? `${formatAgo(now - s.at)} 집계` : '집계 시각 없음'}
            {!s.fresh && ' · 갱신 멈춤'}
          </small>
        </span>
      )}
      <button type="button" className="btn" disabled={stats.isFetching} onClick={() => void stats.refetch()}>
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
      <h2>방 개수 상한 (서버 한 대)</h2>
      <p className="soft">
        아래 입력 칸은 «서버 한 대 상한» — 방 서버 한 대가 채널마다 열 수 있는 방 수(시크릿룸 제외 · 서버
        보호용). «전체» 줄의 /숫자는 «전체 방 상한»(Firebase 방 + 방 서버 방 · ⚙️ 설정에서 바꿈)이라 이것과
        다르다. 낮춰도 열린 방은 그대로 — 새 방만 막음.
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
                  aria-label={`${CHANNEL_LABEL[ch]} 서버 한 대 상한`}
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
          <div className="list">
            <TotalCount healthUrl={servers[0]?.[1] ?? null} />
            {servers.map(([n, u]) => (
              <ServerCount key={n} name={n} url={u} />
            ))}
          </div>
        </>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
