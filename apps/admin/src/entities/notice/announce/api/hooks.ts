import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAnnouncePort } from './index';

const ANNOUNCE_KEY = ['announce'];
const OFFSET_KEY = ['serverTimeOffset'];

export function useAnnounce() {
  const port = useAnnouncePort();
  return useQuery({ queryKey: ANNOUNCE_KEY, queryFn: () => port.get() });
}

export function useRefreshAnnounce() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ANNOUNCE_KEY });
}

// ts 가 서버 시각이라 남은 시간도 서버 시계로 잰다.
export function useServerTimeOffset() {
  const port = useAnnouncePort();
  return useQuery({ queryKey: OFFSET_KEY, queryFn: () => port.serverTimeOffset() });
}
