// 앱이 announce/current 를 구독해 ts 부터 duration 동안 캐릭터 머리 위에 띄운다 — 모양을 바꾸지 않는다.
export interface Announce {
  text: string;
  ts: number;
  duration: number;
}

export const ANNOUNCE_TEXT_MAX = 140; // 규칙 announce/current .validate
export const ANNOUNCE_DURATION = 60_000; // 앱 확성기와 같은 1분

/** 서버 기준 «지금» 에서 공지가 더 떠 있을 시간(ms). 0 이면 지금은 아무에게도 안 보인다. */
export function announceRemaining(announce: Announce | null, serverNow: number): number {
  if (!announce?.text) return 0;
  const duration = announce.duration || ANNOUNCE_DURATION;
  return Math.max(0, (announce.ts ?? 0) + duration - serverNow);
}
