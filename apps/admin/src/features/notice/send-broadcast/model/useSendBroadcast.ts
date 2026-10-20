import { useMutation } from '@tanstack/react-query';
import { sendBroadcast, useRefreshBroadcasts, type InboxMessage } from '@/entities/inbox';
import { useDb } from '@/shared/api';

export function useSendBroadcast() {
  const db = useDb();
  const refresh = useRefreshBroadcasts();
  return useMutation({
    mutationFn: ({ message, pinned }: { message: InboxMessage; pinned: boolean }) =>
      sendBroadcast(db, message, pinned),
    onSuccess: refresh,
  });
}
