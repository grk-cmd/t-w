import { DAY_MS, kstDayStart } from '@/shared/lib';

// 사용량(비용) — 서버 함수(functions/usage-snapshot.js)가 매시간 어제 · 오늘(서울)을 다시 적는다.
//   metrics/usage/{YYYY-MM-DD}/db        = { sentBytes, storedBytes, peakConnections, at }
//   metrics/usage/{YYYY-MM-DD}/functions = { calls, byName: { 함수 이름: 호출 수 }, at }
//   metrics/usage/{YYYY-MM-DD}/storage   = { bucket, sentBytes, storedBytes, at }
//   metrics/usage/{YYYY-MM-DD}/hosting   = { sentBytes, at }
export const METRICS_USAGE = 'metrics/usage';
export const USAGE_DAYS = 30;

/** 구글 청구서의 GB 는 2³⁰ 바이트(GiB). */
export const BYTES_PER_GB = 2 ** 30;

/**
 * 추정 단가(USD) — 금액 계산은 전부 여기 값으로만. 바뀌면 이곳 한 곳만 고친다.
 * 근거: firebase.google.com/pricing · cloud.google.com/storage/pricing (2026-10 확인)
 *   RTDB: 다운로드 $1/GB(무료 월 10GB) · 저장 $5/GB·월(무료 1GB)
 *   Cloud Storage(버킷 us-east1 · Standard): 저장 $0.020/GB·월(무료 5GB·월) · 인터넷 다운로드 $0.12/GB(무료 월 100GB)
 *   Cloud Functions: 호출 100만 회당 $0.40(무료 월 200만 회) — CPU · 메모리 시간 요금은 빠져 있다
 *   Hosting: 다운로드 $0.15/GB(무료 월 10GB)
 */
export const PRICES = {
  dbDownloadPerGB: 1,
  dbStoragePerGBMonth: 5,
  storageDownloadPerGB: 0.12,
  storageStoragePerGBMonth: 0.02,
  hostingDownloadPerGB: 0.15,
  functionsPerMillion: 0.4,
} as const;

export const FREE = {
  dbDownloadGBMonth: 10,
  dbStorageGB: 1,
  storageDownloadGBMonth: 100,
  storageStorageGB: 5,
  hostingDownloadGBMonth: 10,
  functionsCallsMonth: 2_000_000,
} as const;

export interface DayUsage {
  date: string;
  db: { sentBytes: number; storedBytes: number | null; peakConnections: number; at: number } | null;
  functions: { calls: number; byName: Record<string, number>; at: number } | null;
  storage: { sentBytes: number; storedBytes: number | null; at: number } | null;
  hosting: { sentBytes: number; at: number } | null;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && typeof (v as Record<string, unknown>).at === 'number'
    ? (v as Record<string, unknown>)
    : null;

/** 날짜 노드 → 무리 넷. 무리에 at 이 없으면(모양이 다름 · 아직 안 적힘) null. */
export function toDayUsage(date: string, raw: unknown): DayUsage {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const db = obj(r.db);
  const fn = obj(r.functions);
  const st = obj(r.storage);
  const host = obj(r.hosting);
  const byName: Record<string, number> = {};
  if (fn && fn.byName && typeof fn.byName === 'object')
    for (const [k, v] of Object.entries(fn.byName as Record<string, unknown>)) if (num(v)) byName[k] = num(v);
  return {
    date,
    db: db
      ? {
          sentBytes: num(db.sentBytes),
          storedBytes: numOrNull(db.storedBytes),
          peakConnections: num(db.peakConnections),
          at: db.at as number,
        }
      : null,
    functions: fn ? { calls: num(fn.calls), byName, at: fn.at as number } : null,
    storage: st
      ? { sentBytes: num(st.sentBytes), storedBytes: numOrNull(st.storedBytes), at: st.at as number }
      : null,
    hosting: host ? { sentBytes: num(host.sentBytes), at: host.at as number } : null,
  };
}

export interface ByteUnit {
  unit: 'GB' | 'MB' | 'KB';
  div: number;
  digits: number;
}

/** 계열 최댓값에 맞춘 단위 — 1GB 이상이면 GB, 1MB 이상이면 MB, 아니면 KB. */
export function byteUnit(maxBytes: number): ByteUnit {
  if (maxBytes >= BYTES_PER_GB) return { unit: 'GB', div: BYTES_PER_GB, digits: 2 };
  if (maxBytes >= 2 ** 20) return { unit: 'MB', div: 2 ** 20, digits: 1 };
  return { unit: 'KB', div: 2 ** 10, digits: 0 };
}

/** 원화 환산 — 대략 값(1달러 = USD_KRW 원). 환율이 크게 바뀌면 이 한 곳만 고친다. */
export const USD_KRW = 1400;

/** 1234 → «약 1,200원», 442470 → «약 44만 원» — 추정치라 앞 두 자리만. */
export function formatKrw(usd: number): string {
  const won = usd * USD_KRW;
  if (won < 100) return '약 100원 미만';
  if (won < 10_000) return `약 ${(Math.round(won / 100) * 100).toLocaleString()}원`;
  const man = won / 10_000;
  return `약 ${man < 100 ? man.toFixed(1).replace(/\.0$/, '') : Math.round(man).toLocaleString()}만 원`;
}

/** $0.0123 → «$0.01», 아주 작으면 «$0.01 미만». 원화를 괄호로 덧붙인다. */
export function formatUsd(v: number): string {
  if (v <= 0) return '$0';
  if (v < 0.01) return '$0.01 미만';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${formatKrw(v)})`;
}

export interface UsageStats {
  /** 오늘 · 어제를 뺀 지난날 중 기록이 있는 날의 평균 — 오늘은 덜 찼고 어제는 경고 비교 대상이라 뺀다. 없으면 null */
  avg: number | null;
  /** 평균에 쓴 날 수 */
  avgDays: number;
  max: number;
  maxDate: string | null;
  /** 오늘 값을 하루치로 늘린 값(지금까지 지난 시간 비례) — 2시간이 안 지났으면 null(너무 들쭉날쭉) */
  todayProjected: number | null;
}

// 평균이 이만큼 이상 쌓여야 경고를 낸다 — 기록 첫날 · 둘째 날은 비교할 것이 없다.
export const ALERT_MIN_DAYS = 3;
export const ALERT_RATIO = 2;
const PROJECT_MIN_MS = 2 * 60 * 60 * 1000;

/**
 * 한 계열의 일평균 · 최대 · 오늘 환산. days 는 오래된 날 → 오늘. value 가 null 이면 기록이 없는 날.
 * todayAt 은 오늘 값을 잰 시각(서버가 적은 at) — 시간 비례 환산의 기준.
 */
export function usageStats(
  days: readonly DayUsage[],
  value: (d: DayUsage) => number | null,
  todayAt: number | null,
): UsageStats {
  const past = days
    .slice(0, -2)
    .map(value)
    .filter((v): v is number => v !== null);
  const avg = past.length ? past.reduce((s, v) => s + v, 0) / past.length : null;
  let max = 0;
  let maxDate: string | null = null;
  for (const d of days) {
    const v = value(d) ?? 0;
    if (v > max) {
      max = v;
      maxDate = d.date;
    }
  }
  const today = days.at(-1);
  const tv = today ? value(today) : null;
  let todayProjected: number | null = null;
  if (today && tv !== null && todayAt !== null) {
    const elapsed = Math.min(DAY_MS, todayAt - kstDayStart(today.date));
    if (elapsed >= PROJECT_MIN_MS) todayProjected = (tv * DAY_MS) / elapsed;
  }
  return { avg, avgDays: past.length, max, maxDate, todayProjected };
}

/** 지난날 평균의 2배를 넘었나 — 평균이 ALERT_MIN_DAYS 일 이상 쌓였을 때만. */
export function overAverage(v: number | null, s: UsageStats): boolean {
  return v !== null && s.avg !== null && s.avgDays >= ALERT_MIN_DAYS && s.avg > 0 && v > s.avg * ALERT_RATIO;
}

export interface MonthLine {
  label: string;
  /** 이번 달 예상 사용량 설명(예: «약 345GB») */
  amount: string;
  usd: number;
}

export interface MonthEstimate {
  /** YYYY-MM */
  month: string;
  total: number;
  lines: MonthLine[];
  /** 이번 달 중 기록이 없어 최근 평균으로 채운 지난날 수 */
  filledDays: number;
}

const RATE_DAYS = 7;
const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const gbOf = (bytes: number) => bytes / BYTES_PER_GB;
const gbText = (g: number) => `약 ${g < 10 ? g.toFixed(1) : Math.round(g).toLocaleString()}GB`;

/**
 * 이번 달(서울) 예상 청구액 — 쌓이는 값(다운로드 · 호출)은 «이번 달 지난날 실제 + 오늘부터 말일까지 × 최근 7일 평균»,
 * 지난날 중 기록이 없는 날(기록 시작 전)도 최근 평균으로 채운다. 저장 용량은 가장 최근 값으로 한 달치.
 * 무료 한도는 달 단위로 한 번 뺀다. days 는 오래된 날 → 오늘.
 */
export function monthEstimate(days: readonly DayUsage[]): MonthEstimate | null {
  const today = days.at(-1);
  if (!today) return null;
  const month = today.date.slice(0, 7);
  const past = days.slice(0, -1);
  const thisMonthPast = past.filter((d) => d.date.startsWith(month));
  const dayOfMonth = Number(today.date.slice(8, 10));
  const anyRecord = (d: DayUsage) => !!(d.db || d.functions || d.storage || d.hosting);
  const filledDays = dayOfMonth - 1 - thisMonthPast.filter(anyRecord).length;

  const project = (value: (d: DayUsage) => number | null) => {
    const recent = past
      .map(value)
      .filter((v): v is number => v !== null)
      .slice(-RATE_DAYS);
    const rate = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : (value(today) ?? 0);
    const known = thisMonthPast.map(value).filter((v): v is number => v !== null);
    const missing = dayOfMonth - 1 - known.length;
    const remaining = daysInMonth(month) - dayOfMonth + 1;
    return known.reduce((s, v) => s + v, 0) + Math.max(0, missing) * rate + remaining * rate;
  };
  const latest = (pick: (d: DayUsage) => number | null | undefined) => {
    for (let i = days.length - 1; i >= 0; i--) {
      const v = pick(days[i]);
      if (typeof v === 'number') return v;
    }
    return 0;
  };

  const dbDown = gbOf(project((d) => d.db?.sentBytes ?? null));
  const stDown = gbOf(project((d) => d.storage?.sentBytes ?? null));
  const hostDown = gbOf(project((d) => d.hosting?.sentBytes ?? null));
  const calls = project((d) => d.functions?.calls ?? null);
  const dbStored = gbOf(latest((d) => d.db?.storedBytes));
  const stStored = gbOf(latest((d) => d.storage?.storedBytes));

  const over = (v: number, free: number) => Math.max(0, v - free);
  const lines: MonthLine[] = [
    {
      label: 'DB 다운로드',
      amount: gbText(dbDown),
      usd: over(dbDown, FREE.dbDownloadGBMonth) * PRICES.dbDownloadPerGB,
    },
    {
      label: 'DB 저장',
      amount: gbText(dbStored),
      usd: over(dbStored, FREE.dbStorageGB) * PRICES.dbStoragePerGBMonth,
    },
    {
      label: 'Storage 다운로드',
      amount: gbText(stDown),
      usd: over(stDown, FREE.storageDownloadGBMonth) * PRICES.storageDownloadPerGB,
    },
    {
      label: 'Storage 저장',
      amount: gbText(stStored),
      usd: over(stStored, FREE.storageStorageGB) * PRICES.storageStoragePerGBMonth,
    },
    {
      label: 'Hosting 다운로드',
      amount: gbText(hostDown),
      usd: over(hostDown, FREE.hostingDownloadGBMonth) * PRICES.hostingDownloadPerGB,
    },
    {
      label: '함수 호출',
      amount: `약 ${Math.round(calls).toLocaleString()}회`,
      usd: (over(calls, FREE.functionsCallsMonth) / 1_000_000) * PRICES.functionsPerMillion,
    },
  ];
  return { month, total: lines.reduce((s, l) => s + l.usd, 0), lines, filledDays };
}
