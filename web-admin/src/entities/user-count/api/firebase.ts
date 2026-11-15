// Firebase 판 — 지금 코드 그대로: stats/userCount 한 칸을 읽는다.
import type { Db } from '@/shared/api';
import type { UserCountPort } from './port';

const USER_COUNT_PATH = 'stats/userCount';

// 앱이 새 사용자를 만들 때마다 1 씩 올리는 카운터 — users 노드를 세지 않으려고 둔 값이다.
export async function getUserCount(db: Db): Promise<number> {
  const value = await db.get<number>(USER_COUNT_PATH);
  return typeof value === 'number' ? value : 0;
}

export function createFirebaseUserCountPort(db: Db): UserCountPort {
  return { get: () => getUserCount(db) };
}
