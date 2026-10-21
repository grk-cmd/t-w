/* 화면 밝기 — 앱 생성기 미리보기와 같은 예산(apps/desktop app.js 조명 상수 · shared/light-tone.js). 앱 값이 바뀌면 같이 바꾼다. */
export const MAIN_LIGHT_INT = 1.2 * 0.46;
export const FILL_LIGHT_MUL = 0.29;
export const KEY_LIGHT_MUL = 0.29;
const TONE_FRONT_TOTAL = 1.05;
export const FLAT_EMISSIVE = Math.max(
  0,
  TONE_FRONT_TOTAL - 0.95 * MAIN_LIGHT_INT - MAIN_LIGHT_INT * FILL_LIGHT_MUL,
);
/** 빛 색 — 앱 생성기 `updateCreatorLights` 의 HSL */
export const LIGHT_HSL = [0.09, 0.45, 0.85] as const;
