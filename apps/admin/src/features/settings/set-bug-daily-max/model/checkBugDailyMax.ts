/** 상한 범위 — Firebase 판은 규칙 .validate(`BUG_DAILY_MAX_*`), API 판은 서버 키 `bug.dailyMax` 의 칸. */
export interface BugDailyMaxRange {
  min: number;
  max: number;
  def: number;
}

export type BugDailyMaxCheck = { ok: true; max: number } | { ok: false; error: string };

/** 입력 검사 — 범위 안 정수여야 하고, 지금 값과 같으면 저장하지 않는다. */
export function checkBugDailyMax(
  range: BugDailyMaxRange,
  input: string,
  saved: number | null,
): BugDailyMaxCheck {
  const text = input.trim();
  const n = /^\d+$/.test(text) ? Number(text) : NaN;
  if (!(n >= range.min && n <= range.max)) return { ok: false, error: `${range.min}~${range.max} 사이 숫자` };
  if (n === saved) return { ok: false, error: '지금 값과 같음' };
  return { ok: true, max: n };
}

export const bugDailyMaxConfirmText = (current: number, max: number, apply: string) =>
  `버그 제보 하루 상한 ${current}건 → ${max}건 — ${apply}`;
