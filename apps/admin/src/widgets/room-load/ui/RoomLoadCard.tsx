import { CHANNEL_LABEL, PROD_REALTIME_URL, uptimeLabel, useServerHealth } from '@/entities/room-server';
import styles from './RoomLoadCard.module.css';

// 화면이 열려 있는 동안 30초마다 다시 읽는다 — /health 는 공개 · 개수뿐이라 가볍다.
const REFETCH_MS = 30_000;

const n = (v: number) => v.toLocaleString('ko-KR');

/**
 * 지금 realtime 서버에 붙은 사람 — 앱을 켠 사람(presence.online)과 방 안에 들어간 사람(members).
 * 서버 메모리는 연결 · 방 수에 따라 늘어서, 방 탭에서 바로 본다. API 판(운영 realtime)만.
 */
export function RoomLoadCard() {
  const h = useServerHealth(PROD_REALTIME_URL, REFETCH_MS);
  const d = h.data;
  return (
    <section className="card">
      <div className="card-head">
        <h2>지금 접속</h2>
        <span className="soft">
          {d && d.uptimeS !== null && uptimeLabel(d.uptimeS)}
          {h.dataUpdatedAt > 0 && ` · ${new Date(h.dataUpdatedAt).toLocaleTimeString('ko-KR')} 읽음`}
        </span>
        <button type="button" className="btn" disabled={h.isFetching} onClick={() => void h.refetch()}>
          새로고침
        </button>
      </div>
      {h.isPending ? (
        <p className="soft">불러오는 중…</p>
      ) : h.error || !d ? (
        <p className="msg err">realtime 서버 상태를 읽지 못했어요</p>
      ) : (
        <>
          <div className={styles.nums}>
            <span>
              접속 <b className={styles.big}>{d.online !== null ? n(d.online) : '—'}</b>명
            </span>
            <span>
              방 안 <b className={styles.big}>{d.members !== null ? n(d.members) : '—'}</b>명
            </span>
            <span>
              열린 방 <b>{n(d.rooms)}</b>개
              <small className="soft">
                {' '}
                ({CHANNEL_LABEL.workingroom} {n(d.workingroom)} · {CHANNEL_LABEL.togetherroom}{' '}
                {n(d.togetherroom)}
                {d.secret !== null && ` · 시크릿룸 ${n(d.secret)}`})
              </small>
            </span>
            <span className="soft">연결 {n(d.conns)}</span>
          </div>
          <p className="soft">접속 · 방 수가 늘면 realtime 서버 메모리도 같이 는다.</p>
        </>
      )}
    </section>
  );
}
