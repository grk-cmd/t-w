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

  return (
    <>
      <section className={styles.stats} aria-label="접속 지표">
        <div className="card">
          <span className="meta" title="오늘(서울) 앱을 켠 사람 수 — 여러 번 켜도 1명">
            🙋 오늘 DAU
          </span>
          <strong className={styles.num}>{n(summary?.today.users.length)}명</strong>
        </div>
        <div className="card">
          <span className="meta">🗓️ 어제 DAU</span>
          <strong className={styles.num}>
            {n(summary ? (summary.yesterday?.users.length ?? 0) : undefined)}명
          </strong>
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
      </section>

      <section className="card">
        <div className="card-head">
          <h2>최근 30일</h2>
          <span className="soft">{note}</span>
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
              <DailyBars
                title="DAU (고유 사용자)"
                unit="명"
                days={summary.days}
                value={(d) => d.users.length}
              />
              <DailyBars title="방문 수 (실행 횟수)" unit="회" days={summary.days} value={(d) => d.visits} />
            </div>
            <details className={styles.table}>
              <summary>날짜별 숫자</summary>
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>DAU</th>
                    <th>방문 수</th>
                  </tr>
                </thead>
                <tbody>
                  {newestFirst.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{d.users.length.toLocaleString()}</td>
                      <td>{d.visits.toLocaleString()}</td>
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
