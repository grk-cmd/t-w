import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBroadcastPort } from './index';
import { BROADCAST_PAGE } from './port';

const BROADCAST_KEY = ['inboxBroadcast'];

export function useBroadcasts(n = BROADCAST_PAGE) {
  const port = useBroadcastPort();
  return useQuery({
    queryKey: [...BROADCAST_KEY, n],
    queryFn: () => port.list(n),
    // 더 받는 동안 지금 목록을 둔 채 받는다.
    placeholderData: keepPreviousData,
  });
}

export function useRefreshBroadcasts() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: BROADCAST_KEY });
}
