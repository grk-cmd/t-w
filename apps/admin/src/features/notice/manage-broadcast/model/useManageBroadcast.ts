import { useMutation } from '@tanstack/react-query';
import { useRefreshBroadcasts } from '@/entities/inbox';
import { useDb } from '@/shared/api';
import { deleteBroadcasts, setBroadcastsPinned } from './manageBroadcasts';

// 하나도 여럿과 같은 길(한 묶음 + 기록 한 줄)로 보낸다.
export function useTogglePin() {
  const db = useDb();
  const refresh = useRefreshBroadcasts();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => setBroadcastsPinned(db, [id], pinned),
    onSuccess: refresh,
  });
}

export function useDeleteBroadcast() {
  const db = useDb();
  const refresh = useRefreshBroadcasts();
  return useMutation({ mutationFn: (id: string) => deleteBroadcasts(db, [id]), onSuccess: refresh });
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
