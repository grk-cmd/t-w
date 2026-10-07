import { useMemo, type ReactNode } from 'react';
import {
  hasIpRecord,
  hasRecord,
  metricsSummary,
  seriesStats,
  useRecentMetrics,
  useRefreshTodayMetrics,
  type DayMetrics,
  type MetricsSummary,
} from '@/entities/metrics/daily-active';
import { errorMessage } from '@/shared/lib';
import { DailyBars, StatSection } from '@/shared/ui';
import styles from './MetricsDashboard.module.css';

const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
// 한 계열을 막대 그래프 점으로
const points = (days: readonly DayMetrics[], value: (d: DayMetrics) => number) =>
  days.map((d) => ({ date: d.date, value: value(d) }));

function stats(
  summary: MetricsSummary | null,
  value: (d: DayMetrics) => number,
  recorded: (d: DayMetrics) => boolean,
) {
  if (!summary) return { avg: undefined, max: undefined, sub: undefined };
  const s = seriesStats(summary.days, value, recorded);
  return { avg: s.avg, max: s.max, sub: s.maxDate ? `${shortDate(s.maxDate)}` : undefined };
}

export function MetricsDashboard() {
  const metrics = useRecentMetrics();
  const refresh = useRefreshTodayMetrics();
  const summary = useMemo(() => (metrics.data ? metricsSummary(metrics.data) : null), [metrics.data]);
  const newestFirst = useMemo(() => (summary ? [...summary.days].reverse() : []), [summary]);
  const ip = stats(summary, (d) => d.ipVisitors, hasIpRecord);
  const visits = stats(summary, (d) => d.visits, hasRecord);
  const yesterday = (v: (d: DayMetrics) => number) =>
    summary ? (summary.yesterday ? v(summary.yesterday) : 0) : undefined;

  const since = (first: string | null | undefined) =>
    first === undefined ? '' : first ? ` · ${first}부터 기록` : ' · 기록이 아직 없음';

  const body = (render: (days: DayMetrics[]) => ReactNode) =>
    metrics.error ? (
      <p className="warn">{errorMessage(metrics.error, '지표를 불러오지 못했어요')}</p>
    ) : !summary ? (
      <p className="soft">불러오는 중…</p>
    ) : (
      render(summary.days)
    );

  return (
    <>
      <div className={styles.toolbar}>
        <p className="soft">서울 날짜 기준 · 오늘 숫자는 하루가 끝날 때까지 늘어납니다</p>
        <button type="button" className="btn" onClick={() => void refresh()} disabled={metrics.fetching}>
          새로고침
        </button>
      </div>

      <StatSection
        title="활성 사용자 (DAU)"
        desc={<>하루에 한 번이라도 앱을 켠 로그인 연결 사용자 수{since(summary?.firstDate)}</>}
        stats={[
          {
            label: '오늘',
            value: summary?.today.dau,
            unit: '명',
            main: true,
            hint: '오늘 앱을 켠 사람 수 — 여러 번 켜도 1명',
          },
          { label: '어제', value: yesterday((d) => d.dau), unit: '명' },
          {
            label: 'WAU (7일)',
            value: summary?.wau,
            unit: '명',
            hint: '오늘 포함 최근 7일 동안 한 번이라도 켠 사람 수',
          },
          {
            label: 'MAU (30일)',
            value: summary?.mau,
            unit: '명',
            hint: '오늘 포함 최근 30일 동안 한 번이라도 켠 사람 수',
          },
        ]}
        chart={body((days) => (
          <DailyBars label="활성 사용자" unit="명" days={points(days, (d) => d.dau)} />
        ))}
      />

      {/* IP 해시는 날마다 바뀌게 만들어 여러 날을 이을 수 없다 — 그래서 IP 기준은 WAU · MAU 대신 일평균 · 최대. */}
      <StatSection
        title="방문자 (IP 기준)"
        desc={
          <>
            로그인하지 않은 사람을 포함한 방문자 수 · 같은 IP 는 하루 1번 · IP 원문은 저장하지 않음
            {since(summary?.ipFirstDate)}
          </>
        }
        stats={[
          { label: '오늘', value: summary?.today.ipVisitors, unit: '명', main: true },
          { label: '어제', value: yesterday((d) => d.ipVisitors), unit: '명' },
          { label: '일평균', value: ip.avg, unit: '명', hint: '오늘을 뺀 지난날 평균(기록이 있는 날만)' },
          { label: '최대', value: ip.max, unit: '명', sub: ip.sub },
        ]}
        chart={body((days) => (
          <DailyBars label="방문자" unit="명" days={points(days, (d) => d.ipVisitors)} />
        ))}
      />

      <StatSection
        title="방문 수"
        desc="로그인 연결 사용자가 앱을 켠 횟수 — 같은 사람이 여러 번 켜면 모두 셈"
        stats={[
          { label: '오늘', value: summary?.today.visits, unit: '회', main: true },
          {
            label: '오늘 실행 수',
            value: summary?.today.pings,
            unit: '회',
            hint: '로그인하지 않은 사람을 포함한 앱 실행 수',
          },
          { label: '일평균', value: visits.avg, unit: '회', hint: '오늘을 뺀 지난날 평균(기록이 있는 날만)' },
          { label: '최대', value: visits.max, unit: '회', sub: visits.sub },
        ]}
        chart={body((days) => (
          <DailyBars label="방문 수" unit="회" days={points(days, (d) => d.visits)} />
        ))}
      />

      <section className="card" aria-label="날짜별 숫자">
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
      </section>
    </>
  );
}
