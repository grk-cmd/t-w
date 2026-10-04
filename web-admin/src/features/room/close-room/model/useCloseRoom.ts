import { useMutation } from '@tanstack/react-query';
import { useRefreshRooms } from '@/entities/room';
import { useDb } from '@/shared/api';
import { closeAllRooms, closeRoom, closeSelectedRooms } from './closeRoom';

export function useCloseRoom() {
  const db = useDb();
  const refresh = useRefreshRooms();
  return useMutation({ mutationFn: (code: string) => closeRoom(db, code), onSettled: refresh });
}

export function useCloseAllRooms() {
  const db = useDb();
  const refresh = useRefreshRooms();
  return useMutation({ mutationFn: () => closeAllRooms(db), onSettled: refresh });
}

export function useCloseSelectedRooms() {
  const db = useDb();
  const refresh = useRefreshRooms();
  return useMutation({ mutationFn: (codes: string[]) => closeSelectedRooms(db, codes), onSettled: refresh });
}
