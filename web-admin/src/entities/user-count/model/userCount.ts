export type UserCountCheck =
  { ok: true; value: number } | { ok: false; reason: 'not-number' | 'below-current' };

/**
 * 보정값 검사. 규칙(stats/userCount .validate)이 관리자에게도 «지금 값 이상» 만 허락한다 —
 * 줄이는 값은 보내 봐야 거부되므로 미리 막는다.
 */
export function checkUserCount(input: string, current: number): UserCountCheck {
  const text = input.trim();
  if (!/^\d{1,9}$/.test(text)) return { ok: false, reason: 'not-number' };
  const value = Number(text);
  if (value < current) return { ok: false, reason: 'below-current' };
  return { ok: true, value };
}
