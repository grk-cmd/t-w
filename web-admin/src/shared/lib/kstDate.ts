// 지표 날짜는 서울(UTC+9 · 서머타임 없음) 기준 — 함수(functions/daily-active.js kstDateKey)와 같은 계산.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function kstDateKey(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 서울 자정 — 그 날짜가 시작하는 UTC ms. */
export function kstDayStart(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) - KST_OFFSET_MS;
}

/** 오늘(서울)까지 n 일의 날짜 키 — 오래된 날부터. */
export function lastDateKeys(nowMs: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => kstDateKey(nowMs - (n - 1 - i) * DAY_MS));
}
