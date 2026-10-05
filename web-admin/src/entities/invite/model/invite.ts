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

/** 앱 _genInviteCode 와 같은 모양 — 헷갈리는 0/O · 1/I 를 뺀 글자로 INVT-XXXX-XXXX. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_RE = /^INVT-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
/** 관리자가 한 번에 만드는 초대 코드 수. */
export const INVITE_CODE_MAX = 10;
/**
 * 웹에서 만든 코드의 issuedBy — 앱은 관리자 userCode 를 넣지만 웹 관리자는 Auth 계정이라 userCode 가 없다.
 * invites 는 누구나 읽으므로 이메일 같은 개인 정보는 넣지 않는다. 받는 쪽 앱은 이 값을 invitedBy 로 적기만 한다.
 */
export const INVITE_ISSUER_ADMIN = 'admin';

export function genInviteCode(random: () => number = Math.random): string {
  const seg = () =>
    Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join('');
  return `INVT-${seg()}-${seg()}`;
}

export interface InviteRecord {
  issuedBy: string;
  createdAt: number;
}
