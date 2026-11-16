export type PeriodField = 'joined' | 'seen';

/** 날짜 칸 값(YYYY-MM-DD, 비면 열림). 끝 날짜는 그날 끝까지 — 이 컴퓨터 시간대로. */
export interface Period {
  field: PeriodField;
  from: string;
  to: string;
}

export const NO_PERIOD: Period = { field: 'joined', from: '', to: '' };

export const hasPeriod = (p: Period) => Boolean(p.from || p.to);

const DAY_MS = 24 * 60 * 60 * 1000;

const dayStart = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

export function periodRange(p: Period): { start: number; end: number } {
  return {
    start: p.from ? dayStart(p.from) : -Infinity,
    end: p.to ? dayStart(p.to) + DAY_MS - 1 : Infinity,
  };
}

/** 기록이 없는(null) 사람은 기간을 걸면 빠진다. */
export function inPeriod(ts: number | null | undefined, p: Period): boolean {
  if (!hasPeriod(p)) return true;
  if (typeof ts !== 'number') return false;
  const { start, end } = periodRange(p);
  return ts >= start && ts <= end;
}
