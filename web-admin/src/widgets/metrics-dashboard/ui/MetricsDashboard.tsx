import { useMemo } from 'react';
import { metricsSummary, useRecentMetrics, useRefreshTodayMetrics } from '@/entities/daily-active';
import { errorMessage } from '@/shared/lib';
import { DailyBars } from './DailyBars';
import styles from './MetricsDashboard.module.css';

const n = (v: number | undefined) => (v === undefined ? '…' : v.toLocaleString());

export function MetricsDashboard() {
  const metrics = useRecentMetrics();
  const refresh = useRefreshTodayMetrics();
  const summary = useMemo(() => (metrics.data ? metricsSummary(metrics.data) : null), [metrics.data]);
  const newestFirst = useMemo(() => (summary ? [...summary.days].reverse() : []), [summary]);

  const note = summary
    ? summary.firstDate
      ? `로그인 연결된 사용자 기준 · ${summary.firstDate}부터 기록`
      : '로그인 연결된 사용자 기준 · 기록이 아직 없음'
    : '로그인 연결된 사용자 기준';
  // IP 해시는 날마다 바뀌게 만들어 여러 날을 이을 수 없다 — 그래서 IP 기준은 하루 숫자만 있고 WAU · MAU 가 없다.
  const ipNote = `IP 기준 방문자: 같은 IP 는 하루 1번 · IP 원문은 저장하지 않음 · ${
    summary?.ipFirstDate ? `${summary.ipFirstDate}부터` : '기록이 아직 없음'
  }`;

  return (
    <>
      <section className={styles.stats} aria-label="접속 지표">
        <div className="card">
          <span className="meta" title="오늘(서울) 앱을 켠 사람 수 — 여러 번 켜도 1명">
            🙋 오늘 DAU
          </span>
          <strong className={styles.num}>{n(summary?.today.dau)}명</strong>
        </div>
        <div className="card">
          <span className="meta">🗓️ 어제 DAU</span>
          <strong className={styles.num}>{n(summary ? (summary.yesterday?.dau ?? 0) : undefined)}명</strong>
        </div>
        <div className="card">
          <span className="meta" title="오늘 앱을 켠 횟수 — 같은 사람이 여러 번 켜면 모두 셈">
            🚪 오늘 방문 수
          </span>
          <strong className={styles.num}>{n(summary?.today.visits)}회</strong>
        </div>
        <div className="card">
          <span className="meta" title="오늘 포함 최근 7일 동안 한 번이라도 켠 사람 수">
            📅 WAU (7일)
          </span>
          <strong className={styles.num}>{n(summary?.wau)}명</strong>
        </div>
        <div className="card">
          <span className="meta" title="오늘 포함 최근 30일 동안 한 번이라도 켠 사람 수">
            🗓️ MAU (30일)
          </span>
          <strong className={styles.num}>{n(summary?.mau)}명</strong>
        </div>
        <div className="card">
          <span className="meta" title="오늘 앱을 켠 IP 수 — 로그인 안 한 사람 포함 · 같은 IP 는 하루 1번">
            🌐 오늘 방문자(IP 기준)
          </span>
          <strong className={styles.num}>{n(summary?.today.ipVisitors)}명</strong>
        </div>
        <div className="card">
          <span className="meta">🌐 어제 방문자(IP 기준)</span>
          <strong className={styles.num}>
            {n(summary ? (summary.yesterday?.ipVisitors ?? 0) : undefined)}명
          </strong>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>최근 30일</h2>
          <p className={`${styles.notes} soft`}>
            <span>{note}</span>
            <span>{ipNote}</span>
          </p>
          <button type="button" className="btn" onClick={() => void refresh()} disabled={metrics.fetching}>
            새로고침
          </button>
        </div>
        {metrics.error ? (
          <p className="warn">{errorMessage(metrics.error, '지표를 불러오지 못했어요')}</p>
        ) : !summary ? (
          <p className="soft">불러오는 중…</p>
        ) : (
          <>
            <div className={styles.charts}>
              <DailyBars title="DAU (고유 사용자)" unit="명" days={summary.days} value={(d) => d.dau} />
              <DailyBars title="방문 수 (실행 횟수)" unit="회" days={summary.days} value={(d) => d.visits} />
              <DailyBars title="방문자 (IP 기준)" unit="명" days={summary.days} value={(d) => d.ipVisitors} />
            </div>
            <details className={styles.table}>
              <summary>날짜별 숫자</summary>
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>DAU</th>
                    <th>방문 수</th>
                    <th>IP 방문자</th>
                    <th title="로그인 안 한 사람 포함 앱 실행 수">실행 수</th>
                  </tr>
                </thead>
                <tbody>
                  {newestFirst.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.dau.toLocaleString()}</td>
                      <td>{d.visits.toLocaleString()}</td>
                      <td>{d.ipVisitors.toLocaleString()}</td>
                      <td>{d.pings.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </section>
    </>
  );
}
