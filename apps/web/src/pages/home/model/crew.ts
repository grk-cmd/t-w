/** 첫 화면 소식 창 아래 사람 그림 — 왼쪽부터 차례대로. 파일은 화면 크기의 두 배(선명한 화면용) · 크기는 실제 파일과 같다(시험이 본다).
    이름은 고유 이름이라 언어마다 같다(역할 · 대사는 문구 crew).
    headX = 그림 폭에서 머리 가운데 자리(0~1) — 말풍선 꼬리가 머리를 가리키게(그림이 머리 한쪽에 소품을 둬서 가운데가 아니다) */
export const CREW = [
  { key: 'dev', name: 'Noodle', src: '/crew/dev.webp', w: 400, h: 351, headX: 0.64 },
  { key: 'admin', name: '고로케', src: '/crew/admin.webp', w: 275, h: 351, headX: 0.59 },
] as const;

/** 이 시간 안에 FLY_TAPS 번 누르면 날아간다(연타) — 그보다 느리면 한 번씩 말풍선 */
export const TAP_WINDOW_MS = 1200;
export const FLY_TAPS = 5;

/** 누른 시각들(최근 것만) + 지금 → 다음 시각들 · 날아갈지. 날면 세던 것을 비운다 */
export function nextTap(taps: readonly number[], now: number): { taps: number[]; fly: boolean } {
  const recent = [...taps.filter((t) => now - t < TAP_WINDOW_MS), now];
  return recent.length >= FLY_TAPS ? { taps: [], fly: true } : { taps: recent, fly: false };
}

/** 말풍선이 화면 끝에서 띄울 거리 · 꼬리가 몸통 끝에서 떨어질 거리(테두리 9px + 꼬리 반 폭) */
export const BUBBLE_EDGE = 8;
export const TAIL_IN = 17;

/** 머리 위에 놓은 말풍선(왼쪽 · 오른쪽 · 폭, 정수 px)이 화면(폭 vw) 끝을 넘으면 몸통을 밀 거리(push) ·
    꼬리를 몸통 가운데에서 옮길 거리(tail — 머리를 계속 가리키게, 몸통 안쪽까지만). 양쪽 다 넘으면 왼쪽을 맞춘다(글 첫머리가 보이게) */
export function bubbleShift(
  left: number,
  right: number,
  w: number,
  vw: number,
): { push: number; tail: number } {
  let push = 0;
  if (left < BUBBLE_EDGE) push = BUBBLE_EDGE - left;
  else if (right > vw - BUBBLE_EDGE) push = vw - BUBBLE_EDGE - right;
  const lim = Math.max(0, Math.floor(w / 2) - TAIL_IN);
  // + 0: -push · -lim 이 -0 이 되는 것을 0 으로(스타일 글에 «-0px» 가 안 남게)
  return { push, tail: Math.max(-lim, Math.min(lim, -push)) + 0 };
}

/** 눌렀을 때 통통 튀기 — 앱 쓰다듬기(frame-loop · sin(t·0.016)·e^(−t·0.0026))와 같은 박자 · 줄어듦.
    그림은 바닥(책상)을 뚫으면 안 돼서 위로만 튄다(|sin|) · 땅에 닿을 때 살짝 납작 */
export const BOP_MS = 1100;
export const BOP_PX = 12;
const BOP_FREQ = 0.016;
const BOP_DECAY = 0.0026;
const BOP_SQUASH = 0.06;

/** 튀기 한 번의 키프레임(Web Animations) — 처음 · 끝은 제자리 */
export function bopFrames(samples = 24): Keyframe[] {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = (i / samples) * BOP_MS;
    const d = Math.exp(-t * BOP_DECAY);
    const hop = Math.abs(Math.sin(t * BOP_FREQ));
    const last = i === samples;
    const y = last ? 0 : Math.round(-BOP_PX * hop * d * 10) / 10;
    const s = last ? 0 : Math.round(BOP_SQUASH * d * (1 - hop) * 1000) / 1000;
    return {
      offset: i / samples,
      transform: `translateY(${y}px) scale(${1 + s}, ${1 - s})`,
    };
  });
}
