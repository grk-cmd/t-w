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
