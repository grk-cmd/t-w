// Firebase 판 — 지금 코드 그대로: users/{uid}/… 의 작은 칸을 하나씩 읽는다.
import type { Db } from '@/shared/api';
import { realName } from '@/shared/lib';
import { toIssuedInvites, type IssuedInvite } from '@/entities/invite/@x/user';
import type { Presence, UserInvite } from '../model/live';
import { APP_VER_UNKNOWN, cleanVer } from '../model/version';
import type { UserBrief, UserPort } from './port';

const FRIEND_CODE_PREFIXES = ['MATE', 'COZY'];

// 뒤 4자리만 넣어도 되게 접두어를 붙여 본다 — 앱의 친구 추가와 같은 규칙.
export function friendCodeCandidates(input: string): string[] {
  const code = input.trim().toUpperCase();
  if (!code) return [];
  if (/^[A-Z0-9]{4}$/.test(code)) return FRIEND_CODE_PREFIXES.map((p) => `${p}-${code}`);
  return [code];
}

export async function findUserByFriendCode(
  db: Db,
  input: string,
): Promise<{ uid: string; code: string } | null> {
  for (const code of friendCodeCandidates(input)) {
    const entry = await db.get<{ userId?: string }>(`friendCodes/${code}`);
    if (entry?.userId) return { uid: entry.userId, code };
  }
  return null;
}

// friendCodes 는 관리자만 통째로 읽는다 — 계정이 없는 사용자까지 포함한 전체 명단은 여기뿐이다.
export async function listFriendCodes(db: Db): Promise<Record<string, { userId?: string }>> {
  return (await db.get<Record<string, { userId?: string }>>('friendCodes')) ?? {};
}

// 프로필 전체가 아니라 name 필드만 읽는다. 빈 값 · 옛 placeholder 는 null 로 돌려 저장하는 메모에 실리지 않게 한다.
export async function getUserName(db: Db, uid: string): Promise<string | null> {
  return realName(await db.get<string>(`users/${uid}/profile/name`).catch(() => null));
}

/** 마지막 접속 시각(ms). 기록이 없거나 읽지 못하면 null. */
export async function getUserLastSeen(db: Db, uid: string): Promise<number | null> {
  try {
    const seen = await db.get<number>(`users/${uid}/presence/lastSeen`);
    return typeof seen === 'number' ? seen : null;
  } catch {
    return null;
  }
}

// presence 는 online · lastSeen · room · inRoom · ver 다섯 칸뿐이라 통째로 읽는다(접속 중인 사람은 lastSeen 이 접속한 시각이라 online 도 봐야 한다).
export async function getUserPresence(db: Db, uid: string): Promise<Presence | null> {
  const p = await db.get<{ online?: unknown; lastSeen?: unknown; room?: unknown; ver?: unknown }>(
    `users/${uid}/presence`,
  );
  if (!p) return null;
  const online = p.online === true;
  return {
    online,
    lastSeen: typeof p.lastSeen === 'number' ? p.lastSeen : null,
    // 끈 앱은 room 을 지우지 못하고 남길 수 있다 — 접속 중일 때만 믿는다.
    room: online && typeof p.room === 'string' && p.room ? p.room : null,
    ver: cleanVer(p.ver),
    verUnknown: p.ver === APP_VER_UNKNOWN,
  };
}

/**
 * 계정에 적힌 친구코드(거울). friendCodes 는 코드 → uid 뿐이라 반대 방향은 여기서만 알 수 있다.
 * undefined = 읽지 못함 · null = 적힌 값 없음.
 */
export async function getUserFriendCode(db: Db, uid: string): Promise<string | null | undefined> {
  try {
    const code = await db.get<string>(`users/${uid}/friendCode`);
    return typeof code === 'string' && code ? code : null;
  } catch {
    return undefined;
  }
}

/**
 * 집중 누적 시간(초) — 계정 요약에도 있지만 계정이 없는 사람은 여기에만 있다. 앱이 기기끼리 합치는 정본.
 * 칸이 없으면 0.
 */
export async function getUserFocusSec(db: Db, uid: string): Promise<number> {
  const v = await db.get<unknown>(`users/${uid}/focus/totalSec`);
  return typeof v === 'number' && v > 0 ? v : 0;
}

// 규칙 users/$id/awayImg 가 받는 모양과 같다 — 그 밖의 값은 그림으로 보지 않는다.
export function isAwayImgUrl(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 500 && v.startsWith('https://firebasestorage.googleapis.com/');
}

/** 앱 getUserBrief 와 같이 세 칸만 따로 읽는다 — users/{uid} 를 통째로 받으면 마이홈 · 캐릭터까지 딸려 온다. */
export async function getUserBrief(db: Db, uid: string): Promise<UserBrief> {
  const read = (path: string) => db.get<unknown>(`users/${uid}/${path}`).catch(() => null);
  const [name, friendCode, awayImg] = await Promise.all([
    read('profile/name'),
    read('friendCode'),
    read('awayImg'),
  ]);
  return {
    name: typeof name === 'string' ? name : null,
    friendCode: typeof friendCode === 'string' ? friendCode : null,
    awayImg: isAwayImgUrl(awayImg) ? awayImg : null,
  };
}

export function awayImgRemoveWrite(uid: string): Record<string, null> {
  return { [`users/${uid}/awayImg`]: null };
}

/** users/{uid}/invite 세 칸. 칸이 없으면 null — 아직 게이트를 안 지난(옛 앱) 사용자. */
export async function getUserInvite(db: Db, uid: string): Promise<UserInvite | null> {
  const v = await db.get<{ joinedAt?: unknown; invitedBy?: unknown; invitesLeft?: unknown }>(
    `users/${uid}/invite`,
  );
  if (!v || typeof v !== 'object') return null;
  return {
    joinedAt: typeof v.joinedAt === 'number' ? v.joinedAt : null,
    invitedBy: typeof v.invitedBy === 'string' && v.invitedBy ? v.invitedBy : null,
    invitesLeft: typeof v.invitesLeft === 'number' ? v.invitesLeft : null,
    // Firebase 판은 가입에 쓴 코드를 남기지 않았다
    inviteCode: null,
    inviteMemo: null,
  };
}

/**
 * 이 사람이 만든 초대 코드 — 규칙의 invites ".indexOn": ["issuedBy"] 로 그 사람 몫만 받는다(통째 받기 금지).
 * 관리자가 만든 코드는 issuedBy 가 'admin' 이라 여기 나오지 않는다.
 */
export async function listIssuedInvites(db: Db, uid: string): Promise<IssuedInvite[]> {
  return toIssuedInvites(
    await db.getEqual<{ createdAt?: unknown; usedBy?: unknown }>('invites', 'issuedBy', uid),
  );
}

export function createFirebaseUserPort(db: Db): UserPort {
  return {
    kind: 'cells',
    name: (uid) => getUserName(db, uid),
    brief: (uid) => getUserBrief(db, uid),
    presence: (uid) => getUserPresence(db, uid),
    focusSec: (uid) => getUserFocusSec(db, uid),
    invite: (uid) => getUserInvite(db, uid),
    issuedInvites: (uid) => listIssuedInvites(db, uid),
  };
}
