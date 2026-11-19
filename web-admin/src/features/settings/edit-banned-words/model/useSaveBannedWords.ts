import { useMutation } from '@tanstack/react-query';
import { useRefreshBannedWords, useRoomPort } from '@/entities/room';
import { refreshOnConflict, type Versioned } from '@/shared/api';

export function useSaveBannedWords() {
  const { bannedWords } = useRoomPort();
  const refresh = useRefreshBannedWords();
  return useMutation({
    mutationFn: ({ from, words }: { from: Versioned<string[]>; words: string[] }) => {
      if (!bannedWords) throw new Error('이 판에는 금칙어 설정이 없어요');
      return bannedWords.save(from, words);
    },
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
