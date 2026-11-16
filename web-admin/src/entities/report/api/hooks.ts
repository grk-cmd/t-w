import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReportTarget } from '../model/report';
import { REPORTS_KEY, userReportCountKey } from './keys';
import { useReportPort } from './index';

export function useReports() {
  const port = useReportPort();
  return useQuery({ queryKey: REPORTS_KEY, queryFn: () => port.targets() });
}

export function useRefreshReports() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: REPORTS_KEY });
}

export function useUserReportCount(uid: string) {
  const port = useReportPort();
  return useQuery({ queryKey: userReportCountKey(uid), queryFn: () => port.countFor(uid) });
}

/** 비운 사람을 캐시에서만 뺀다 — 목록을 다시 받지 않아도 된다. */
export function useForgetReports() {
  const client = useQueryClient();
  return (target: string) =>
    client.setQueryData<ReportTarget[]>(REPORTS_KEY, (all) => all?.filter((t) => t.target !== target));
}
