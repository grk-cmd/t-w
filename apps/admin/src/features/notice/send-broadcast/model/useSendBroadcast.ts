import { useMutation } from '@tanstack/react-query';
import { useBroadcastPort, useRefreshBroadcasts, type InboxMessage } from '@/entities/inbox';

export function useSendBroadcast() {
  const port = useBroadcastPort();
  const refresh = useRefreshBroadcasts();
  return useMutation({
    mutationFn: ({ message, pinned }: { message: InboxMessage; pinned: boolean }) =>
      port.send(message, pinned),
    onSuccess: refresh,
  });
}
