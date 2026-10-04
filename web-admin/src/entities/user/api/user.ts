import { useQuery } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';

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

export function useFriendCodes() {
  const db = useDb();
  return useQuery({ queryKey: ['friendCodes'], queryFn: () => listFriendCodes(db) });
}

/** 이름 한 칸 — 한 번 받은 이름은 캐시에 남아 페이지를 오가도 다시 받지 않는다. */
export function useUserName(uid: string, enabled: boolean) {
  const db = useDb();
  return useQuery({ queryKey: ['userName', uid], queryFn: () => getUserName(db, uid), enabled });
}
