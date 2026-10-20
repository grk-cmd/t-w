import { useMutation } from '@tanstack/react-query';
import { saveChatKeep, useRefreshChatKeep, type ChatKeep } from '@/entities/room';
import { useDb } from '@/shared/api';

export function useSaveChatKeep() {
  const db = useDb();
  const refresh = useRefreshChatKeep();
  return useMutation({
    mutationFn: ({ before, updates }: { before: ChatKeep; updates: Record<string, number | null> }) =>
      saveChatKeep(db, before, updates),
    onSuccess: refresh,
  });
}
