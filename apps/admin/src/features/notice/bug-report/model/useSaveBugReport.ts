import { useMutation } from '@tanstack/react-query';
import { saveBugReport, useRefreshBugReport } from '@/entities/bug-report';
import { useDb } from '@/shared/api';

export function useSaveBugReport() {
  const db = useDb();
  const refresh = useRefreshBugReport();
  return useMutation({
    mutationFn: ({ notice, link }: { notice: string; link: string }) => saveBugReport(db, notice, link),
    onSuccess: refresh,
  });
}
