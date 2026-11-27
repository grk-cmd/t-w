import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MinVersionKind } from '../model/minVersion';
import { useMinVersionPort } from './index';

const queryKey = (kind: MinVersionKind) => ['minVersion', kind];

export function useMinVersion(kind: MinVersionKind) {
  const port = useMinVersionPort();
  return useQuery({ queryKey: queryKey(kind), queryFn: () => port.get(kind) });
}

export function useRefreshMinVersion(kind: MinVersionKind) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKey(kind) });
}
