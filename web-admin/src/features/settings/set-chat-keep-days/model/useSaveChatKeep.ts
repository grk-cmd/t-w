import { useMutation } from '@tanstack/react-query';
import { useRefreshChatKeep, useRoomPort, type ChatKeep } from '@/entities/room';
import { refreshOnConflict } from '@/shared/api';

export function useSaveChatKeep() {
  const port = useRoomPort();
  const refresh = useRefreshChatKeep();
  return useMutation({
    mutationFn: ({ before, updates }: { before: ChatKeep; updates: Record<string, number | null> }) =>
      port.saveChatKeep(before, updates),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
