import { useMutation } from '@tanstack/react-query';
import { useBroadcastPort, useRefreshBroadcasts } from '@/entities/inbox';
import { refreshOnConflict } from '@/shared/api';

// 하나도 여럿과 같은 길(한 묶음 + 기록 한 줄)로 보낸다.
export function useTogglePin() {
  const port = useBroadcastPort();
  const refresh = useRefreshBroadcasts();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => port.setPinned([id], pinned),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}

export function useDeleteBroadcast() {
  const port = useBroadcastPort();
  const refresh = useRefreshBroadcasts();
  return useMutation({
    mutationFn: (id: string) => port.remove([id]),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}

export function usePinBroadcasts() {
  const port = useBroadcastPort();
  const refresh = useRefreshBroadcasts();
  return useMutation({
    mutationFn: ({ ids, pinned }: { ids: string[]; pinned: boolean }) => port.setPinned(ids, pinned),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}

export function useDeleteBroadcasts() {
  const port = useBroadcastPort();
  const refresh = useRefreshBroadcasts();
  return useMutation({
    mutationFn: (ids: string[]) => port.remove(ids),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
