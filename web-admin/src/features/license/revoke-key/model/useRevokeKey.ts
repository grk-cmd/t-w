import { useMutation } from '@tanstack/react-query';
import { removeLicense, revokeLicense, useRefreshLicenses } from '@/entities/license';
import { useDb } from '@/shared/api';

export function useRevokeKey() {
  const db = useDb();
  const refresh = useRefreshLicenses();
  return useMutation({ mutationFn: (key: string) => revokeLicense(db, key), onSuccess: refresh });
}

export function useRemoveKey() {
  const db = useDb();
  const refresh = useRefreshLicenses();
  return useMutation({ mutationFn: (key: string) => removeLicense(db, key), onSuccess: refresh });
}
