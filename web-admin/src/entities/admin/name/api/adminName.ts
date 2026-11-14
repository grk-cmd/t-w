import { useQuery } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { ADMIN_NAMES_ROOT, toAdminNames } from '../model/adminName';

const NAMES_KEY = ['adminNames'];

/** 관리자 몇 명분이라 통째로 한 번. */
export async function getAdminNames(db: Db): Promise<Map<string, string>> {
  return toAdminNames(await db.get<unknown>(ADMIN_NAMES_ROOT));
}

export function useAdminNames() {
  const db = useDb();
  return useQuery({ queryKey: NAMES_KEY, queryFn: () => getAdminNames(db), staleTime: 5 * 60_000 });
}
