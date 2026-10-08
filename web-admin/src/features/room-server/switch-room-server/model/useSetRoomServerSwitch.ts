import { useMutation } from '@tanstack/react-query';
import { setRoomServerSwitch, useRefreshRoomServer } from '@/entities/room-server';
import { useDb } from '@/shared/api';

export function useSetRoomServerSwitch() {
  const db = useDb();
  const refresh = useRefreshRoomServer();
  return useMutation({
    mutationFn: ({ key, value }: { key: 'on' | 'follow'; value: boolean }) =>
      setRoomServerSwitch(db, key, value),
    onSuccess: refresh,
  });
}
