import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoomPort } from './index';

const BANNED_WORDS_KEY = ['bannedWords'];

/** API 판에만 있는 «방 제목 금칙어» — Firebase 판은 포트에 없어 묻지 않는다. */
export function useBannedWords() {
  const { bannedWords } = useRoomPort();
  return useQuery({
    queryKey: BANNED_WORDS_KEY,
    queryFn: () => (bannedWords as NonNullable<typeof bannedWords>).get(),
    enabled: bannedWords !== null,
  });
}

export function useRefreshBannedWords() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: BANNED_WORDS_KEY });
}
