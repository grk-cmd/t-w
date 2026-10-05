import { useMutation } from '@tanstack/react-query';
import { saveMinRoomVer, useRefreshMinRoomVer } from '@/entities/min-room-ver';
import { useDb } from '@/shared/api';

export function useSaveMinRoomVer() {
  const db = useDb();
  const refresh = useRefreshMinRoomVer();
  return useMutation({
    mutationFn: ({ version, before }: { version: string; before: string | null }) =>
      saveMinRoomVer(db, version, before),
    onSuccess: refresh,
  });
}
