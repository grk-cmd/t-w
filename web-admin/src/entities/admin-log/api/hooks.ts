import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminLogPort } from './index';

const ADMIN_LOG_KEY = ['adminLog'];

// 메뉴를 열 때마다 최근 것을 한 번 받는다(다른 메뉴에서 한 동작이 바로 보이게). 그 밖엔 새로고침 · 뒤쪽으로 갈 때만.
export function useAdminLog(n: number) {
  const port = useAdminLogPort();
  return useQuery({
    queryKey: [...ADMIN_LOG_KEY, n],
    queryFn: () => port.list(n),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useRefreshAdminLog() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ADMIN_LOG_KEY });
}
