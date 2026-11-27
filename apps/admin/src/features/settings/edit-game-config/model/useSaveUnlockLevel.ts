import { useMutation } from '@tanstack/react-query';
import { useGameConfigPort, useRefreshAnimalUnlockLevel } from '@/entities/game-config';
import { refreshOnConflict, type Versioned } from '@/shared/api';

export function useSaveUnlockLevel() {
  const port = useGameConfigPort();
  const refresh = useRefreshAnimalUnlockLevel();
  return useMutation({
    mutationFn: ({ from, level }: { from: Versioned<number | null>; level: number }) =>
      port.saveAnimalUnlockLevel(from, level),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
