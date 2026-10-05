import { useMutation } from '@tanstack/react-query';
import { useRefreshRooms } from '@/entities/room';
import { useDb } from '@/shared/api';
import { cleanGhostRooms } from './cleanGhostRooms';

export function useCleanGhostRooms() {
  const db = useDb();
  const refresh = useRefreshRooms();
  return useMutation({ mutationFn: (codes: string[]) => cleanGhostRooms(db, codes), onSettled: refresh });
}
