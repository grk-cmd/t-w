import { useMutation } from '@tanstack/react-query';
import { deleteBroadcast, setBroadcastPinned, useRefreshBroadcasts } from '@/entities/inbox';
import { useDb } from '@/shared/api';

export function useTogglePin() {
  const db = useDb();
  const refresh = useRefreshBroadcasts();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => setBroadcastPinned(db, id, pinned),
    onSuccess: refresh,
  });
}

export function useDeleteBroadcast() {
  const db = useDb();
  const refresh = useRefreshBroadcasts();
  return useMutation({ mutationFn: (id: string) => deleteBroadcast(db, id), onSuccess: refresh });
}
