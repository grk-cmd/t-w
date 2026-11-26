import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_CORS_PATH, LOG_LEVEL_PATH, type IntGroup } from '../model/opsConfig';
import { useOpsConfigPort } from './index';

const OPS_KEY = ['opsConfig'];

export function useIntGroup(group: IntGroup) {
  const port = useOpsConfigPort();
  return useQuery({ queryKey: [...OPS_KEY, group.path], queryFn: () => port.getIntGroup(group) });
}

export function useLogLevels() {
  const port = useOpsConfigPort();
  return useQuery({ queryKey: [...OPS_KEY, LOG_LEVEL_PATH], queryFn: () => port.getLogLevels() });
}

export function useCorsOrigins() {
  const port = useOpsConfigPort();
  return useQuery({ queryKey: [...OPS_KEY, API_CORS_PATH], queryFn: () => port.getCorsOrigins() });
}

export function useRefreshOpsConfig() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: OPS_KEY });
}

/** API 판에만 있는 «점검 안내» — Firebase 판은 포트에 없어 묻지 않는다. */
export function useMaintenance() {
  const { maintenance } = useOpsConfigPort();
  return useQuery({
    queryKey: [...OPS_KEY, 'maintenance'],
    queryFn: () => (maintenance as NonNullable<typeof maintenance>).get(),
    enabled: maintenance !== null,
  });
}
