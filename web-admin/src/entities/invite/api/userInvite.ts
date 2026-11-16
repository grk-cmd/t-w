// 사용자 화면(표 · 상세)이 줄마다 읽는 초대 칸 — Firebase 판 전용. D12-8a(사용자)에서 줄이 싣고 오는 값으로 바뀌며 걷는다.
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { toIssuedInvites, type IssuedInvite } from '../model/invite';
import { userInviteKey } from './keys';

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
