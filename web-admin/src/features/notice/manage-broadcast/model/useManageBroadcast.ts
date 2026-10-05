import { useMutation } from '@tanstack/react-query';
import { deleteBroadcast, setBroadcastPinned, useRefreshBroadcasts } from '@/entities/inbox';
import { useDb } from '@/shared/api';
import { deleteBroadcasts, setBroadcastsPinned } from './manageBroadcasts';

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

export function usePinBroadcasts() {
  const db = useDb();
  const refresh = useRefreshBroadcasts();
  return useMutation({
    mutationFn: ({ ids, pinned }: { ids: string[]; pinned: boolean }) => setBroadcastsPinned(db, ids, pinned),
    onSuccess: refresh,
  });
}

export function useDeleteBroadcasts() {
  const db = useDb();
  const refresh = useRefreshBroadcasts();
  return useMutation({ mutationFn: (ids: string[]) => deleteBroadcasts(db, ids), onSuccess: refresh });
}
