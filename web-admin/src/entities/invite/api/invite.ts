import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import {
  addInvites,
  genInviteCode,
  INVITE_ISSUER_ADMIN,
  INVITES_LEFT_MAX,
  type InviteRecord,
  toIssuedInvites,
  type IssuedInvite,
} from '../model/invite';

const invitesLeftKey = (uid: string) => ['invitesLeft', uid];
const USER_INVITE = 'userInvite';
const userInviteKey = (uid: string) => [USER_INVITE, uid];

/** 초대권 칸이 없으면 null — 규칙이 «없던 칸은 0 으로만 만들 수 있다» 고 해서 지급 대상이 아니다. */
export async function getInvitesLeft(db: Db, uid: string): Promise<number | null> {
  const v = await db.get<unknown>(`users/${uid}/invite/invitesLeft`);
  return typeof v === 'number' ? v : null;
}

export type AddInvitesResult =
  { ok: true; before: number; after: number } | { ok: false; reason: 'no-invite' | 'full' };

/**
 * 초대권에 count 장을 더한다(999 에서 자름). 트랜잭션이라 그 사이 본인이 쓰거나 다른 관리자가 지급해도 덮지 않는다.
 * 칸이 없으면 쓰지 않는다 — 규칙이 새 칸을 0 으로만 받아 어차피 거부된다.
 */
export async function addInvitesLeft(db: Db, uid: string, count: number): Promise<AddInvitesResult> {
  // 서버가 거절하면 update 가 다시 불리므로 마지막 호출의 판단만 남긴다.
  const seen: { before: number | null } = { before: null };
  const r = await db.transaction<unknown>(`users/${uid}/invite/invitesLeft`, (current) => {
    seen.before = typeof current === 'number' ? current : null;
    if (seen.before === null || seen.before >= INVITES_LEFT_MAX) return undefined;
    return addInvites(seen.before, count);
  });
  if (seen.before === null) return { ok: false, reason: 'no-invite' };
  if (!r.committed || typeof r.value !== 'number') return { ok: false, reason: 'full' };
  return { ok: true, before: seen.before, after: r.value };
}

/** 한 사람 몫 한 칸 — 지급 창을 열 때만 읽는다. */
export function useInvitesLeft(uid: string, enabled: boolean) {
  const db = useDb();
  return useQuery({ queryKey: invitesLeftKey(uid), queryFn: () => getInvitesLeft(db, uid), enabled });
}

/** 한 명에게 지급한 뒤 — 지급 창의 장수와 목록의 가입 칸을 함께 맞춘다. */
export function useSetInvitesLeftCache() {
  const client = useQueryClient();
  return (uid: string, value: number) => {
    client.setQueryData(invitesLeftKey(uid), value);
    client.setQueryData<UserInvite | null>(userInviteKey(uid), (cur) =>
      cur ? { ...cur, invitesLeft: value } : cur,
    );
  };
}

/** 여러 명에게 지급한 뒤 — 받아 둔 가입 칸을 버려 보이는 줄만 다시 읽게 한다. */
export function useForgetUserInvites() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: [USER_INVITE] });
}

export interface UserInvite {
  /** 가입(처음 통과)한 시각(ms). */
  joinedAt: number | null;
  /** 초대 코드를 준 사람. null 이면 초대장 제도 전부터 쓰던 기존 사용자(처음 한 번 5장). */
  invitedBy: string | null;
  invitesLeft: number | null;
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
  };
}

/** 목록 칸과 기간 검색이 같은 캐시를 쓰도록 한 곳에서 만든다. */
export const userInviteQuery = (db: Db, uid: string) =>
  queryOptions({ queryKey: userInviteKey(uid), queryFn: () => getUserInvite(db, uid) });

/** 화면에 보이는 줄만 읽고 캐시에 남긴다. */
export function useUserInvite(uid: string) {
  return useQuery(userInviteQuery(useDb(), uid));
}

/**
 * 새 초대 코드 하나. invites 는 규칙상 누구나 덮어쓸 수 있어, 이미 있는 코드면 쓰지 않도록 트랜잭션으로 «없을 때만» 만든다.
 * 겹치면 새 코드로 몇 번 더 해 본다.
 */
export async function createInviteCode(
  db: Db,
  now = Date.now(),
  gen: () => string = genInviteCode,
): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = gen();
    const record: InviteRecord = { issuedBy: INVITE_ISSUER_ADMIN, createdAt: now };
    const r = await db.transaction<InviteRecord>(`invites/${code}`, (current) =>
      current === null ? record : undefined,
    );
    if (r.committed) return code;
  }
  throw new Error('초대 코드가 계속 겹쳐요');
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

/** 상세 창을 열 때만. */
export function useIssuedInvites(uid: string) {
  const db = useDb();
  return useQuery({ queryKey: ['issuedInvites', uid], queryFn: () => listIssuedInvites(db, uid) });
}
