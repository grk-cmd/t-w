import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';

export interface UserBrief {
  name: string | null;
  friendCode: string | null;
  awayImg: string | null;
}

const briefKey = (uid: string) => ['userBrief', uid];

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

export function useUserBrief(uid: string) {
  const db = useDb();
  return useQuery({ queryKey: briefKey(uid), queryFn: () => getUserBrief(db, uid) });
}

export function useRefreshUserBrief() {
  const client = useQueryClient();
  return (uid: string) => client.invalidateQueries({ queryKey: briefKey(uid) });
}

export function useForgetAwayImg() {
  const client = useQueryClient();
  return (uid: string) =>
    client.setQueryData<UserBrief>(briefKey(uid), (b) => (b ? { ...b, awayImg: null } : b));
}
