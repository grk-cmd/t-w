import { useQuery } from '@tanstack/react-query';
import { useUserCountPort } from './index';

const USER_COUNT_KEY = ['stats', 'userCount'];

export function useUserCount() {
  const port = useUserCountPort();
  return useQuery({ queryKey: USER_COUNT_KEY, queryFn: () => port.get() });
}
