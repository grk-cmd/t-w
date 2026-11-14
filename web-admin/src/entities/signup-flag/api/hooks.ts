import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSignupFlagPort } from './index';

const KEY = ['signupFlags'];

export function useSignupFlags() {
  const port = useSignupFlagPort();
  return useQuery({ queryKey: KEY, queryFn: () => port.get() });
}

export function useRefreshSignupFlags() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: KEY });
}
