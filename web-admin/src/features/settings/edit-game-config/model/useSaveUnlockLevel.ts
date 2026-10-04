import { useMutation } from '@tanstack/react-query';
import { saveAnimalUnlockLevel, useRefreshAnimalUnlockLevel } from '@/entities/game-config';
import { useDb } from '@/shared/api';

export function useSaveUnlockLevel() {
  const db = useDb();
  const refresh = useRefreshAnimalUnlockLevel();
  return useMutation({ mutationFn: (level: number) => saveAnimalUnlockLevel(db, level), onSuccess: refresh });
}
