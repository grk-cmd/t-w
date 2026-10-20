import { useQuery } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import type { AccountSnap } from '../model/account';

// 한 명에 100바이트 남짓이라 통째로 받는다. users 노드는 마이홈 · 캐릭터까지 딸려 와 이렇게 받으면 안 된다.
export async function listAccountSnaps(db: Db): Promise<Record<string, AccountSnap>> {
  return (await db.get<Record<string, AccountSnap>>('accountSnap')) ?? {};
}

export function useAccountSnaps() {
  const db = useDb();
  return useQuery({ queryKey: ['accountSnap'], queryFn: () => listAccountSnaps(db) });
}
