/* 화면 밝기 — 앱 생성기 미리보기와 같은 예산(apps/desktop app.js 조명 상수 · shared/light-tone.js · creator-preview.js 빛 색).
   ⚠️ 앱 값이 바뀌면 같이 — 시험(tests/app-parity.test.ts)이 앱 원본을 읽어 견준다. 한 벌로 묶는 일은 코어로 올릴 때(따로). */
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
