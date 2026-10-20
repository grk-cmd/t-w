import { useMutation } from '@tanstack/react-query';
import { removeServer, saveServer, useRefreshRoomServer } from '@/entities/room-server';
import { useDb } from '@/shared/api';

export function useSaveServer() {
  const db = useDb();
  const refresh = useRefreshRoomServer();
  return useMutation({
    mutationFn: ({ name, url, before }: { name: string; url: string; before: string | null }) =>
      saveServer(db, name, url, before),
    onSuccess: refresh,
  });
}

export function useRemoveServer() {
  const db = useDb();
  const refresh = useRefreshRoomServer();
  return useMutation({ mutationFn: (name: string) => removeServer(db, name), onSuccess: refresh });
}
