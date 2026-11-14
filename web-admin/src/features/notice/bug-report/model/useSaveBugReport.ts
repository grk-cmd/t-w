import { useMutation } from '@tanstack/react-query';
import { useBugReportPort, useRefreshBugReport } from '@/entities/bug-report';

export function useSaveBugReport() {
  const port = useBugReportPort();
  const refresh = useRefreshBugReport();
  return useMutation({
    mutationFn: ({ notice, link }: { notice: string; link: string }) => port.save(notice, link),
    onSuccess: refresh,
  });
}
