import { useMutation } from '@tanstack/react-query';
import { saveBannedWords, useRefreshBannedWords } from '@/entities/room';
import { useDb } from '@/shared/api';

export function useSaveBannedWords() {
  const db = useDb();
  const refresh = useRefreshBannedWords();
  return useMutation({
    mutationFn: ({ before, words }: { before: string[]; words: string[] }) =>
      saveBannedWords(db, before, words),
    onSuccess: refresh,
  });
}
