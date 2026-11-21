import { useQuery } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { ADMIN_NAMES_ROOT, adminNameWrite, toAdminNames } from '../model/adminName';

const NAMES_KEY = ['adminNames'];

/** 관리자 몇 명분이라 통째로 한 번. */
export async function getAdminNames(db: Db): Promise<Map<string, string>> {
  return toAdminNames(await db.get<unknown>(ADMIN_NAMES_ROOT));
}

export function useAdminNames() {
  const db = useDb();
  return useQuery({ queryKey: NAMES_KEY, queryFn: () => getAdminNames(db), staleTime: 5 * 60_000 });
}

/**
 * 로그인할 때 본인 이름 칸을 구글 이름으로 — 같으면 쓰지 않는다.
 * 실패해도 로그인은 그대로(규칙 배포 전 · 네트워크) — 이름 대신 uid 앞자리가 보일 뿐이다.
 */
export async function syncMyAdminName(db: Db, uid: string, displayName: string | null): Promise<void> {
  try {
    const current = await db.get<{ name?: unknown }>(`${ADMIN_NAMES_ROOT}/${uid}`);
    const updates = adminNameWrite(
      uid,
      displayName,
      typeof current?.name === 'string' ? current.name : null,
      db.now(),
    );
    if (updates) await db.commit(updates);
  } catch (error) {
    console.warn('[adminNames] 이름을 저장하지 못했어요', error);
  }
}
