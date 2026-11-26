import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUpdateNoticePort } from './index';

const NOTICE_KEY = ['updateNotice'];

export function useUpdateNotice() {
  const port = useUpdateNoticePort();
  return useQuery({ queryKey: NOTICE_KEY, queryFn: () => port.get() });
}

export function useRefreshUpdateNotice() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: NOTICE_KEY });
}
