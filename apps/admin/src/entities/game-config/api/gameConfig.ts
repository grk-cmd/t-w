import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';

const PATH = 'catalog/gameConfig';
const UNLOCK_LEVEL_KEY = ['gameConfig', 'animalUnlockLevel'];

/** 서버에 정해 둔 값. 없으면 null(앱은 기본값을 쓴다). */
export async function getAnimalUnlockLevel(db: Db): Promise<number | null> {
  const v = await db.get<unknown>(`${PATH}/animalUnlockLevel`);
  return typeof v === 'number' ? v : null;
}

export function useAnimalUnlockLevel() {
  const db = useDb();
  return useQuery({ queryKey: UNLOCK_LEVEL_KEY, queryFn: () => getAnimalUnlockLevel(db) });
}

export function useRefreshAnimalUnlockLevel() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: UNLOCK_LEVEL_KEY });
}

// 앱은 gameConfig 를 통째로 set 하지만, 여기서는 이 필드만 고쳐 앞으로 늘어날 다른 설정을 지우지 않는다.
export function saveAnimalUnlockLevel(db: Db, level: number): Promise<void> {
  const updates = { [`${PATH}/animalUnlockLevel`]: level };
  return db.commit(withAudit(db, updates, 'settings.unlockLevel', `동물 해금 레벨 ${level}`));
}
