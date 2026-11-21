import { DAY_MS, kstDateKey, kstDayStart } from '@/shared/lib';
import { BYTES_PER_GB, type DayUsage } from './usage';

// 개선 기록 — 릴리스마다 «무엇을 바꿨나» 를 관리자가 적고, 효과는 metrics/usage 의 날짜 칸으로 계산한다.
//   metrics/improvements/{id} = { version, releasedAt(ms), title, items: string[], adoptDays? }
// 모양 · 길이는 규칙 metrics/improvements/$id 와 같다.
export const METRICS_IMPROVEMENTS = 'metrics/improvements';
export const VERSION_MAX = 20;
export const TITLE_MAX = 80;
export const ITEM_MAX = 120;
export const ITEMS_MAX = 20;
export const ADOPT_DAYS_DEFAULT = 3;
export const ADOPT_DAYS_MAX = 30;
/** 전 · 후를 견주는 날 수 */
export const WINDOW_DAYS = 7;
/** 한 달 절감 추정에 쓰는 날 수 */
export const MONTH_DAYS = 30;
const BYTES_PER_MB = 2 ** 20;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface ImprovementDraft {
  version: string;
  releasedAt: number;
  title: string;
  items: string[];
  adoptDays: number;
}

export interface Improvement extends ImprovementDraft {
  id: string;
}

const isText = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length >= 1 && v.length <= max;
const isAdoptDays = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= ADOPT_DAYS_MAX;

/** 한 칸 → 기록. 모양이 틀리면 null. items 는 RTDB 에서 배열 또는 {0:…} 로 온다. */
export function toImprovement(id: string, raw: unknown): Improvement | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isText(r.version, VERSION_MAX) || !isText(r.title, TITLE_MAX)) return null;
  if (typeof r.releasedAt !== 'number' || !Number.isFinite(r.releasedAt)) return null;
  const items = Object.values((r.items && typeof r.items === 'object' ? r.items : {}) as object).filter(
    (v): v is string => typeof v === 'string',
  );
  return {
    id,
    version: r.version,
    releasedAt: r.releasedAt,
    title: r.title,
    items,
    adoptDays: isAdoptDays(r.adoptDays) ? r.adoptDays : ADOPT_DAYS_DEFAULT,
  };
}

/** 최근 릴리스부터. */
export function toImprovements(all: Record<string, unknown> | null): Improvement[] {
  return Object.entries(all ?? {})
    .map(([id, v]) => toImprovement(id, v))
    .filter((v): v is Improvement => v !== null)
    .sort((a, b) => b.releasedAt - a.releasedAt);
}

/** 앞뒤 공백 · 빈 항목을 걷는다. */
export function cleanDraft(d: ImprovementDraft): ImprovementDraft {
  return {
    version: d.version.trim(),
    releasedAt: d.releasedAt,
    title: d.title.trim(),
    items: d.items.map((s) => s.trim()).filter(Boolean),
    adoptDays: d.adoptDays,
  };
}

/** 규칙이 받지 않을 값이면 그 까닭, 괜찮으면 null. cleanDraft 를 거친 값으로 부른다. */
export function draftProblem(d: ImprovementDraft): string | null {
  if (!isText(d.version, VERSION_MAX)) return `버전 1~${VERSION_MAX}자`;
  if (!Number.isInteger(d.releasedAt) || d.releasedAt <= 0) return '릴리스 시각 없음';
  if (!isText(d.title, TITLE_MAX)) return `제목 1~${TITLE_MAX}자`;
  if (!d.items.length) return '바뀐 것 1개 이상';
  if (d.items.length > ITEMS_MAX) return `바뀐 것 ${ITEMS_MAX}개까지`;
  if (d.items.some((s) => !isText(s, ITEM_MAX))) return `바뀐 것 한 줄 ${ITEM_MAX}자까지`;
  if (!isAdoptDays(d.adoptDays)) return `적용 기간 0~${ADOPT_DAYS_MAX}일`;
  return null;
}

/** 서울 시각 «YYYY-MM-DDTHH:mm» (datetime-local 입력칸 모양). */
export function toKstInput(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 16);
}

/** datetime-local 값을 서울 시각으로 읽는다 — 브라우저 시간대와 상관없이. 이상하면 null. */
export function fromKstInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}:00+09:00`);
  return Number.isFinite(ms) ? ms : null;
}

const shift = (date: string, days: number) => kstDateKey(kstDayStart(date) + days * DAY_MS);

/**
 * 견줄 날짜(서울).
 * 전 = 릴리스 날 앞 7일(릴리스 날은 뺀다 — 반나절만 새 버전).
 * 후 = 릴리스 시각 + 적용 기간(사용자 대부분이 업데이트할 때까지)이 든 날부터 7일.
 */
export function improvementWindows(e: Pick<ImprovementDraft, 'releasedAt' | 'adoptDays'>): {
  before: string[];
  after: string[];
} {
  const release = kstDateKey(e.releasedAt);
  const start = kstDateKey(e.releasedAt + e.adoptDays * DAY_MS);
  return {
    before: Array.from({ length: WINDOW_DAYS }, (_, i) => shift(release, i - WINDOW_DAYS)),
    after: Array.from({ length: WINDOW_DAYS }, (_, i) => shift(start, i)),
  };
}

export interface WindowStat {
  /** 기록이 있어 평균에 쓴 날 수 */
  days: number;
  /** 하루 DB 다운로드 평균(GB) */
  gbPerDay: number | null;
  /** 접속당 다운로드(MB) — 날마다 다운로드 ÷ 최대 동시 접속, 그 평균. 동시 접속이 0 인 날은 뺀다 */
  mbPerConn: number | null;
  /** 최대 동시 접속 평균 */
  peakAvg: number | null;
}

const avg = (vs: number[]) => (vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null);

/**
 * 한 구간의 평균. 오늘(덜 찬 날) · 아직 안 온 날 · 기록 없는 날은 뺀다.
 * byDate 는 날짜 → 그날 사용량(받지 못했거나 없으면 undefined).
 */
export function windowStat(
  dates: readonly string[],
  byDate: ReadonlyMap<string, DayUsage>,
  today: string,
): WindowStat {
  const rows = dates
    .filter((d) => d < today)
    .map((d) => byDate.get(d)?.db)
    .filter((db): db is NonNullable<DayUsage['db']> => !!db);
  const withPeak = rows.filter((r) => r.peakConnections > 0);
  return {
    days: rows.length,
    gbPerDay: avg(rows.map((r) => r.sentBytes / BYTES_PER_GB)),
    mbPerConn: avg(withPeak.map((r) => r.sentBytes / r.peakConnections / BYTES_PER_MB)),
    peakAvg: avg(withPeak.map((r) => r.peakConnections)),
  };
}

/** 전 → 후 변화율(%). 계산할 수 없으면 null. */
export function changePct(before: number | null, after: number | null): number | null {
  return before === null || after === null || before <= 0 ? null : ((after - before) / before) * 100;
}

export interface ImprovementResult {
  before: WindowStat;
  after: WindowStat;
  /** 후 구간이 아직 7일 안 찼다 */
  measuring: boolean;
  gbChangePct: number | null;
  perConnChangePct: number | null;
  /** 한 달 절감 추정(USD) — monthlySaving 참고. 음수면 늘어난 것. 계산할 수 없으면 null */
  monthlySavingUsd: number | null;
}

/**
 * 사용자 수 변화를 뺀 한 달 절감 추정(USD)
 * = (전 − 후 접속당 MB) × 후 구간 최대 동시 접속(평균) → GB/일 × 30 × 단가.
 * 하루 GB 를 그대로 빼면 그사이 사용자가 늘어난 만큼 «증가» 로 보이기 때문에 접속당으로 견준다.
 */
export function monthlySaving(before: WindowStat, after: WindowStat, perGB: number): number | null {
  if (before.mbPerConn === null || after.mbPerConn === null || after.peakAvg === null) return null;
  const gbPerDay = ((before.mbPerConn - after.mbPerConn) * after.peakAvg * BYTES_PER_MB) / BYTES_PER_GB;
  return gbPerDay * MONTH_DAYS * perGB;
}

export function improvementResult(
  e: Pick<ImprovementDraft, 'releasedAt' | 'adoptDays'>,
  byDate: ReadonlyMap<string, DayUsage>,
  today: string,
  perGB: number,
): ImprovementResult {
  const w = improvementWindows(e);
  const before = windowStat(w.before, byDate, today);
  const after = windowStat(w.after, byDate, today);
  return {
    before,
    after,
    measuring: after.days < WINDOW_DAYS,
    gbChangePct: changePct(before.gbPerDay, after.gbPerDay),
    perConnChangePct: changePct(before.mbPerConn, after.mbPerConn),
    monthlySavingUsd: monthlySaving(before, after, perGB),
  };
}

/** 그날 접속당 다운로드(MB) — 기록이 없거나 동시 접속이 0 이면 null. */
export function mbPerConnOf(d: DayUsage | undefined): number | null {
  const db = d?.db;
  return db && db.peakConnections > 0 ? db.sentBytes / db.peakConnections / BYTES_PER_MB : null;
}
