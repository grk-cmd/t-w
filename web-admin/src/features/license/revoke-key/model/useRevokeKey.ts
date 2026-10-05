import { useMutation } from '@tanstack/react-query';
import { removeLicense, revokeLicense, useRefreshLicenses } from '@/entities/license';
import { useDb } from '@/shared/api';
import { removeKeys, revokeKeys } from './revokeKeys';

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

export function useRevokeKeys() {
  const db = useDb();
  const refresh = useRefreshLicenses();
  return useMutation({ mutationFn: (keys: string[]) => revokeKeys(db, keys), onSuccess: refresh });
}

export function useRemoveKeys() {
  const db = useDb();
  const refresh = useRefreshLicenses();
  return useMutation({ mutationFn: (keys: string[]) => removeKeys(db, keys), onSuccess: refresh });
}
