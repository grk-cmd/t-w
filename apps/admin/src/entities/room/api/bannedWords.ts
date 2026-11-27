import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoomPort } from './index';

const KEY = ['bannedWords'];

export function useBannedWords() {
  const port = useRoomPort();
  return useQuery({ queryKey: KEY, queryFn: () => port.getBannedWords() });
}

export function useRefreshBannedWords() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: KEY });
}
