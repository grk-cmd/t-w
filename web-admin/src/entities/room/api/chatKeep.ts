import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoomPort } from './index';

const KEY = ['chatKeepDays'];

export function useChatKeep() {
  const port = useRoomPort();
  return useQuery({ queryKey: KEY, queryFn: () => port.getChatKeep() });
}

export function useRefreshChatKeep() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: KEY });
}
