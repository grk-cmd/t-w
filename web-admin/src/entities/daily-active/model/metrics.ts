// 일일 접속 지표 — 서버 함수가 날짜별로 적는다.
//   metrics/daily/{YYYY-MM-DD}/u/{사용자 코드} = true · visits = 방문 수   (functions/daily-active.js · 로그인 연결된 사용자)
//   metrics/daily/{YYYY-MM-DD}/ip/{IP 해시} = true    · pings = 앱 실행 수 (functions/visit-ping.js · 로그인 안 한 사람 포함)
//   metrics/summary/{YYYY-MM-DD} = { dau, ipVisitors, visits, pings, wau, mau, at } (functions/daily-summary.js · 지난날 숫자만)
// 날짜는 서울 기준이라 함수의 kstDateKey 와 같은 계산을 쓴다.
export const METRICS_DAILY = 'metrics/daily';
export const METRICS_SUMMARY = 'metrics/summary';
export const METRICS_DAYS = 30;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayMetrics {
  date: string;
  /**
   * 그날 접속한 사용자 코드(중복 없음). WAU · MAU 는 여러 날의 합집합이라 수가 아니라 키를 들고 있다.
   * 요약이 있는 지난날도 받는다 — 오늘 기준 WAU · MAU 는 요약 숫자로 낼 수 없다.
   */
  users: string[];
  /** 그날 고유 사용자 수 — 요약이 있으면 요약 값, 없으면 users 길이 */
  dau: number;
  visits: number;
  /** IP 기준 방문자(같은 IP 는 하루 1번) */
  ipVisitors: number;
  /** 앱 실행 수(로그인 안 한 사람 포함) */
  pings: number;
}

/** 서버가 남긴 지난날 요약 — 숫자만. */
export interface DaySummary {
  dau: number;
  ipVisitors: number;
  visits: number;
  pings: number;
}

export interface MetricsSummary {
  today: DayMetrics;
  yesterday: DayMetrics | null;
  /** 최근 7일(오늘 포함) 고유 사용자 */
  wau: number;
  /** 최근 30일(오늘 포함) 고유 사용자 */
  mau: number;
  /** 범위 안에서 로그인 기준 기록이 처음 있는 날 — 없으면 null */
  firstDate: string | null;
  /** 범위 안에서 IP 기준 기록이 처음 있는 날 — 없으면 null */
  ipFirstDate: string | null;
  /** 오래된 날 → 오늘 */
  days: DayMetrics[];
}

export function kstDateKey(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 오늘(서울)까지 n 일의 날짜 키 — 오래된 날부터. */
export function lastDateKeys(nowMs: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => kstDateKey(nowMs - (n - 1 - i) * DAY_MS));
}

export function uniqueUsers(days: readonly DayMetrics[]): number {
  const all = new Set<string>();
  for (const d of days) for (const u of d.users) all.add(u);
  return all.size;
}

export const hasRecord = (d: DayMetrics) => d.dau > 0 || d.users.length > 0 || d.visits > 0;
export const hasIpRecord = (d: DayMetrics) => d.ipVisitors > 0 || d.pings > 0;

/** days 는 오래된 날 → 오늘 순(lastDateKeys 순서). 비어 있으면 null. */
export function metricsSummary(days: readonly DayMetrics[]): MetricsSummary | null {
  if (!days.length) return null;
  const n = days.length;
  return {
    today: days[n - 1],
    yesterday: n > 1 ? days[n - 2] : null,
    wau: uniqueUsers(days.slice(-7)),
    mau: uniqueUsers(days.slice(-30)),
    firstDate: days.find(hasRecord)?.date ?? null,
    ipFirstDate: days.find(hasIpRecord)?.date ?? null,
    days: [...days],
  };
}

/** 서버 값을 숫자로 — 없거나 이상하면 0. */
export const toVisits = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;

/** 요약 노드 → 숫자 넷. at 이 없으면(모양이 다름) 요약이 없는 것으로 본다 — 서버도 at 으로 있는지 가린다. */
export function toDaySummary(v: unknown): DaySummary | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'number') return null;
  return {
    dau: toVisits(o.dau),
    ipVisitors: toVisits(o.ipVisitors),
    visits: toVisits(o.visits),
    pings: toVisits(o.pings),
  };
}
