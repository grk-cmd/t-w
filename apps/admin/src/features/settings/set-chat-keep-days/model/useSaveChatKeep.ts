import { useMutation } from '@tanstack/react-query';
import { useRefreshChatKeep, useRoomPort, type ChatKeep } from '@/entities/room';
import { refreshOnConflict, type Versioned } from '@/shared/api';

export function useSaveChatKeep() {
  const port = useRoomPort();
  const refresh = useRefreshChatKeep();
  return useMutation({
    mutationFn: ({ from, updates }: { from: Versioned<ChatKeep>; updates: Record<string, number | null> }) =>
      port.saveChatKeep(from, updates),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
