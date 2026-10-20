import { useQuery } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';

const USER_COUNT_PATH = 'stats/userCount';
const USER_COUNT_KEY = ['stats', 'userCount'];

// 앱이 새 사용자를 만들 때마다 1 씩 올리는 카운터 — users 노드를 세지 않으려고 둔 값이다.
export async function getUserCount(db: Db): Promise<number> {
  const value = await db.get<number>(USER_COUNT_PATH);
  return typeof value === 'number' ? value : 0;
}

export function useUserCount() {
  const db = useDb();
  return useQuery({ queryKey: USER_COUNT_KEY, queryFn: () => getUserCount(db) });
}
