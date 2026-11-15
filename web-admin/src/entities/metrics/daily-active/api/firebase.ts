// Firebase 판 — 지금 코드 그대로: metrics/daily · summary 를 읽는다.
import type { Db } from '@/shared/api';
import { METRICS_DAILY, METRICS_SUMMARY, toDaySummary, toVisits, type DayMetrics } from '../model/metrics';
import type { MetricsPort } from './port';

/**
 * 하루치 — 사용자 코드 · IP 해시는 키만(shallow), 숫자는 한 칸씩. 기록이 없는 날은 빈 값.
 * 지난날은 서버 요약(metrics/summary)이 있으면 숫자를 거기서 받고 IP 목록 · 숫자 칸은 받지 않는다.
 * 사용자 목록은 요약이 있어도 받는다 — 오늘 기준 WAU · MAU 가 여러 날의 합집합이라서.
 */
export async function getDayMetrics(db: Db, date: string, isToday = false): Promise<DayMetrics> {
  const base = `${METRICS_DAILY}/${date}`;
  const [users, summary] = await Promise.all([
    db.shallowKeys(`${base}/u`),
    isToday ? null : db.get<unknown>(`${METRICS_SUMMARY}/${date}`).then(toDaySummary),
  ]);
  if (summary) return { date, users, ...summary };
  const [ips, visits, pings] = await Promise.all([
    db.shallowKeys(`${base}/ip`),
    db.get<unknown>(`${base}/visits`),
    db.get<unknown>(`${base}/pings`),
  ]);
  return {
    date,
    users,
    dau: users.length,
    visits: toVisits(visits),
    ipVisitors: ips.length,
    pings: toVisits(pings),
  };
}

/** dates 의 마지막 날을 오늘로 본다(오늘은 요약이 아직 없다). */
export function getRecentMetrics(db: Db, dates: readonly string[]): Promise<DayMetrics[]> {
  const today = dates.at(-1);
  return Promise.all(dates.map((date) => getDayMetrics(db, date, date === today)));
}

export function createFirebaseMetricsPort(db: Db): MetricsPort {
  return {
    getDay: (date, isToday) => getDayMetrics(db, date, isToday),
    getRecent: (dates) => getRecentMetrics(db, dates),
    serverTimeOffset: () => db.serverTimeOffset(),
  };
}
