import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { equipPath, toEquipCounts, type EquipKind } from '../model/popularity';

const countsKey = (kind: EquipKind) => ['metrics', 'partsEquipped', kind];
// 숫자 수백 개짜리 작은 노드라 종류마다 한 번에 받는다. 계속 바뀌지만 자주 볼 숫자는 아니라 5분은 그대로 둔다.
const STALE_MS = 5 * 60 * 1000;

export async function getEquipCounts(db: Db, kind: EquipKind): Promise<Record<string, number>> {
  return toEquipCounts(await db.get<unknown>(equipPath(kind)));
}

export function useEquipCounts(kind: EquipKind) {
  const db = useDb();
  return useQuery({
    queryKey: countsKey(kind),
    queryFn: () => getEquipCounts(db, kind),
    staleTime: STALE_MS,
  });
}

export function useRefreshEquipCounts() {
  const client = useQueryClient();
  return (kind: EquipKind) => client.invalidateQueries({ queryKey: countsKey(kind) });
}
