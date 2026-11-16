import { useQuery } from '@tanstack/react-query';
import { useAdminNamePort } from './index';

const NAMES_KEY = ['adminNames'];

export function useAdminNames() {
  const port = useAdminNamePort();
  return useQuery({ queryKey: NAMES_KEY, queryFn: () => port.names(), staleTime: 5 * 60_000 });
}
