// 지표 날짜는 서울(UTC+9 · 서머타임 없음) 기준 — 함수(functions/daily-active.js kstDateKey)와 같은 계산.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function kstDateKey(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 서울 자정 — 그 날짜가 시작하는 UTC ms. */
/**
 * 서버가 «오늘(서울 날짜)» 만 알려 줄 때의 서버 시각 차(ms) — 이 PC 의 서울 날짜가 같으면 0, 다르면 그날 한낮으로 맞춘다.
 * 하루 안의 오차는 모르므로 날짜 칸을 고르는 데만 쓴다.
 */
export function offsetFromServerToday(today: string, now: number = Date.now()): number {
  return kstDateKey(now) === today ? 0 : kstDayStart(today) + 12 * 60 * 60 * 1000 - now;
}

export function kstDayStart(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) - KST_OFFSET_MS;
}

/** 오늘(서울)까지 n 일의 날짜 키 — 오래된 날부터. */
export function lastDateKeys(nowMs: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => kstDateKey(nowMs - (n - 1 - i) * DAY_MS));
}
