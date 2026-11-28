/** 첫 화면 소식 창 아래 사람 그림 — 왼쪽부터 차례대로. 파일은 화면 크기의 두 배(선명한 화면용) · 크기는 실제 파일과 같다(시험이 본다).
    이름은 고유 이름이라 언어마다 같다(역할 · 대사는 문구 crew).
    headX = 그림 폭에서 머리 가운데 자리(0~1) — 말풍선 꼬리가 머리를 가리키게(그림이 머리 한쪽에 소품을 둬서 가운데가 아니다) */
export const CREW = [
  { key: 'admin', name: '고로케', src: '/crew/admin.webp', w: 275, h: 351, headX: 0.59 },
  { key: 'dev', name: 'Noodle', src: '/crew/dev.webp', w: 400, h: 351, headX: 0.64 },
] as const;

/** 이 시간 안에 FLY_TAPS 번 누르면 날아간다(연타) — 그보다 느리면 한 번씩 말풍선 */
export const TAP_WINDOW_MS = 1200;
export const FLY_TAPS = 5;

/** 누른 시각들(최근 것만) + 지금 → 다음 시각들 · 날아갈지. 날면 세던 것을 비운다 */
export function nextTap(taps: readonly number[], now: number): { taps: number[]; fly: boolean } {
  const recent = [...taps.filter((t) => now - t < TAP_WINDOW_MS), now];
  return recent.length >= FLY_TAPS ? { taps: [], fly: true } : { taps: recent, fly: false };
}
