import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGameConfigPort } from './index';

const UNLOCK_LEVEL_KEY = ['gameConfig', 'animalUnlockLevel'];

export function useAnimalUnlockLevel() {
  const port = useGameConfigPort();
  return useQuery({ queryKey: UNLOCK_LEVEL_KEY, queryFn: () => port.getAnimalUnlockLevel() });
}

export function useRefreshAnimalUnlockLevel() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: UNLOCK_LEVEL_KEY });
}
