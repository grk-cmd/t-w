import { useMutation } from '@tanstack/react-query';
import { useGameConfigPort, useRefreshAnimalUnlockLevel } from '@/entities/game-config';
import { refreshOnConflict } from '@/shared/api';

export function useSaveUnlockLevel() {
  const port = useGameConfigPort();
  const refresh = useRefreshAnimalUnlockLevel();
  return useMutation({
    mutationFn: (level: number) => port.saveAnimalUnlockLevel(level),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
