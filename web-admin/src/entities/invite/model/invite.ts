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

/** 가입 경로 — 초대한 사람이 없으면 제도 전부터 쓰던 기존 사용자, 'admin' 이면 웹 관리자가 만든 코드, 그 밖은 사용자코드. */
export type InviterKind = 'existing' | 'admin' | 'user';

export function inviterKind(invitedBy: string | null): InviterKind {
  if (!invitedBy) return 'existing';
  return invitedBy === INVITE_ISSUER_ADMIN ? 'admin' : 'user';
}

export function genInviteCode(random: () => number = Math.random): string {
  const seg = () =>
    Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]).join('');
  return `INVT-${seg()}-${seg()}`;
}

export interface InviteRecord {
  issuedBy: string;
  createdAt: number;
}

export interface IssuedInvite {
  code: string;
  createdAt: number | null;
  /** 쓴 사람의 사용자코드. 가입 도중이면 앱이 잠깐 기기 토큰을 넣어 둔다 — 그때는 pending. */
  usedBy: string | null;
  pending: boolean;
}

// 앱 redeemInvite 는 가입 도중 기기 토큰을, finishInviteSignup 이 끝나면 사용자코드를 usedBy 에 둔다.
const USER_CODE_RE = /^u[0-9a-z]{6,}$/;

/** invites 에서 issuedBy 로 받은 묶음 → 최근 만든 것부터. */
export function toIssuedInvites(
  raw: Record<string, { createdAt?: unknown; usedBy?: unknown }>,
): IssuedInvite[] {
  return Object.entries(raw)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([code, v]) => {
      const used = typeof v.usedBy === 'string' && v.usedBy ? v.usedBy : null;
      return {
        code,
        createdAt: typeof v.createdAt === 'number' ? v.createdAt : null,
        usedBy: used && USER_CODE_RE.test(used) ? used : null,
        pending: !!used && !USER_CODE_RE.test(used),
      };
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}
