import { useMutation } from '@tanstack/react-query';
import { createLicense, useRefreshLicenses } from '@/entities/license';
import { useDb } from '@/shared/api';

export function useIssueKey() {
  const db = useDb();
  const refresh = useRefreshLicenses();
  return useMutation({ mutationFn: (note: string) => createLicense(db, note), onSuccess: refresh });
}
