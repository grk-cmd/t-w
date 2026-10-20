// 앱 animal.js 의 UNLOCK_LEVEL 기본값 — 서버 값이 없으면 앱은 이 레벨에서 동물을 연다.
export const DEFAULT_ANIMAL_UNLOCK_LEVEL = 50;
export const UNLOCK_LEVEL_MIN = 1; // 규칙 catalog/gameConfig/animalUnlockLevel .validate
export const UNLOCK_LEVEL_MAX = 999;

/** 입력 → 레벨. 정수가 아니거나 범위를 벗어나면 null. */
export function parseUnlockLevel(input: string): number | null {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= UNLOCK_LEVEL_MIN && n <= UNLOCK_LEVEL_MAX ? n : null;
}
