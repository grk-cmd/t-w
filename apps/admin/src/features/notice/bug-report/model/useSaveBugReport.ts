import { useMutation } from '@tanstack/react-query';
import { useBugReportPort, useRefreshBugReport, type BugReport } from '@/entities/bug-report';
import { refreshOnConflict, type Versioned } from '@/shared/api';

export function useSaveBugReport() {
  const port = useBugReportPort();
  const refresh = useRefreshBugReport();
  return useMutation({
    mutationFn: ({
      from,
      notice,
      link,
    }: {
      from: Versioned<BugReport | null>;
      notice: string;
      link: string;
    }) => port.save(from, notice, link),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
