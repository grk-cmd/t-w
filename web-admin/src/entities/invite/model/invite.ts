/** 관리자가 한 번에 지급할 수 있는 최대 장수 — 앱 INVITE_GRANT_MAX 와 같다. */
export const INVITE_GRANT_MAX = 3;
/** 규칙 users/$id/invite 의 .validate 상한 — 넘기면 쓰기가 통째로 거부되므로 미리 자른다. */
export const INVITES_LEFT_MAX = 999;

export function isGrantCount(count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= INVITE_GRANT_MAX;
}

export function addInvites(current: number, count: number): number {
  return Math.min(INVITES_LEFT_MAX, current + count);
}
