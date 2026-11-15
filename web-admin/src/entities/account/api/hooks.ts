import { useQuery } from '@tanstack/react-query';
import { useAccountPort } from './index';

export function useAccountSnaps() {
  const port = useAccountPort();
  return useQuery({ queryKey: ['accountSnap'], queryFn: () => port.list() });
}
