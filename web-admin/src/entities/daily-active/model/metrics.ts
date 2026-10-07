// 일일 접속 지표 — functions/daily-active.js 가 accountSnap 쓰기(앱 부팅)마다 적는다.
//   metrics/daily/{YYYY-MM-DD}/u/{사용자 코드} = true   · metrics/daily/{YYYY-MM-DD}/visits = 방문 수
// 날짜는 서울 기준이라 함수의 kstDateKey 와 같은 계산을 쓴다.
export const METRICS_DAILY = 'metrics/daily';
export const METRICS_DAYS = 30;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayMetrics {
  date: string;
  /** 그날 접속한 사용자 코드(중복 없음). WAU · MAU 는 여러 날의 합집합이라 수가 아니라 키를 들고 있다. */
  users: string[];
  visits: number;
}

export interface MetricsSummary {
  today: DayMetrics;
  yesterday: DayMetrics | null;
  /** 최근 7일(오늘 포함) 고유 사용자 */
  wau: number;
  /** 최근 30일(오늘 포함) 고유 사용자 */
  mau: number;
  /** 범위 안에서 기록이 처음 있는 날 — 없으면 null */
  firstDate: string | null;
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

export const hasRecord = (d: DayMetrics) => d.users.length > 0 || d.visits > 0;

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
    days: [...days],
  };
}

/** 서버 값을 숫자로 — 없거나 이상하면 0. */
export const toVisits = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
