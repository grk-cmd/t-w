import { queryOptions, useQuery } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { cleanVer } from '../model/version';

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

// 프로필 전체가 아니라 이름 한 칸만 읽는다.
export function getUserName(db: Db, uid: string): Promise<string | null> {
  return db.get<string>(`users/${uid}/profile/name`).catch(() => null);
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

export interface Presence {
  online: boolean;
  /** 마지막으로 접속 · 종료한 시각(ms). 0.9.7 같은 옛 앱도 쓴다 — 계정이 없는 사용자의 활동은 여기서만 보인다. */
  lastSeen: number | null;
  /** 접속 중일 때 들어가 있는 방 코드. 시크릿룸은 앱이 코드를 올리지 않아 늘 null 이다. */
  room: string | null;
  /** 앱 버전 — 0.10.3 부터. 꺼진 뒤에도 남는다. 옛 앱은 null. */
  ver: string | null;
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
  };
}

/** 목록 칸과 기간 검색이 같은 캐시를 쓰도록 한 곳에서 만든다. */
export const userPresenceQuery = (db: Db, uid: string) =>
  queryOptions({ queryKey: ['presence', uid], queryFn: () => getUserPresence(db, uid) });

/** 화면에 보이는 줄만 읽는다 — 한 번 읽은 값은 캐시에 남아 페이지를 오가도 다시 받지 않는다. */
export function useUserPresence(uid: string) {
  return useQuery(userPresenceQuery(useDb(), uid));
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

export function useFriendCodes() {
  const db = useDb();
  return useQuery({ queryKey: ['friendCodes'], queryFn: () => listFriendCodes(db) });
}

/**
 * 집중 누적 시간(초) — 계정 요약에도 있지만 계정이 없는 사람은 여기에만 있다. 앱이 기기끼리 합치는 정본.
 * 칸이 없으면 0.
 */
export async function getUserFocusSec(db: Db, uid: string): Promise<number> {
  const v = await db.get<unknown>(`users/${uid}/focus/totalSec`);
  return typeof v === 'number' && v > 0 ? v : 0;
}

/** 상세 창을 열 때만 읽는다. */
export function useUserFocusSec(uid: string) {
  const db = useDb();
  return useQuery({ queryKey: ['userFocus', uid], queryFn: () => getUserFocusSec(db, uid) });
}

/** 이름 한 칸 — 한 번 받은 이름은 캐시에 남아 페이지를 오가도 다시 받지 않는다. */
export function useUserName(uid: string, enabled: boolean) {
  const db = useDb();
  return useQuery({ queryKey: ['userName', uid], queryFn: () => getUserName(db, uid), enabled });
}
