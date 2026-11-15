import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBugReportPort } from './index';

const BUG_REPORT_KEY = ['bugReport'];

export function useBugReport() {
  const port = useBugReportPort();
  return useQuery({ queryKey: BUG_REPORT_KEY, queryFn: () => port.get() });
}

export function useRefreshBugReport() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: BUG_REPORT_KEY });
}
