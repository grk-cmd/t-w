// Firebase 판 — 지금 코드 그대로: catalog/gameConfig 를 읽고 쓴다.
import { unversioned, withAudit, type Db } from '@/shared/api';
import type { GameConfigPort } from './port';

const PATH = 'catalog/gameConfig';

/** 서버에 정해 둔 값. 없으면 null(앱은 기본값을 쓴다). */
export async function getAnimalUnlockLevel(db: Db): Promise<number | null> {
  const v = await db.get<unknown>(`${PATH}/animalUnlockLevel`);
  return typeof v === 'number' ? v : null;
}

// 앱은 gameConfig 를 통째로 set 하지만, 여기서는 이 필드만 고쳐 앞으로 늘어날 다른 설정을 지우지 않는다.
export function saveAnimalUnlockLevel(db: Db, level: number): Promise<void> {
  const updates = { [`${PATH}/animalUnlockLevel`]: level };
  return db.commit(withAudit(db, updates, 'settings.unlockLevel', `동물 해금 레벨 ${level}`));
}

export function createFirebaseGameConfigPort(db: Db): GameConfigPort {
  return {
    getAnimalUnlockLevel: async () => unversioned(await getAnimalUnlockLevel(db)),
    saveAnimalUnlockLevel: (_from, level) => saveAnimalUnlockLevel(db, level),
  };
}
