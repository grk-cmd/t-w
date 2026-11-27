import { useMutation } from '@tanstack/react-query';
import { useRefreshBannedWords, useRoomPort } from '@/entities/room';
import { refreshOnConflict, type Versioned } from '@/shared/api';

export function useSaveBannedWords() {
  const port = useRoomPort();
  const refresh = useRefreshBannedWords();
  return useMutation({
    mutationFn: ({ from, words }: { from: Versioned<string[]>; words: string[] }) =>
      port.saveBannedWords(from, words),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
