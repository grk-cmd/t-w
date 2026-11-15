import { useMutation } from '@tanstack/react-query';
import { useRefreshLicenses } from '@/entities/license';
import { useIssueKeyPort } from '../api';

export function useIssueKey() {
  const port = useIssueKeyPort();
  const refresh = useRefreshLicenses();
  return useMutation({ mutationFn: (note: string) => port.issue(note), onSuccess: refresh });
}
