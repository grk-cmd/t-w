import { useMutation } from '@tanstack/react-query';
import { useRefreshLicenses } from '@/entities/license';
import { useDb } from '@/shared/api';
import { removeKeys, revokeKeys } from './revokeKeys';

// 한 개도 여러 개와 같은 길(한 묶음 + 기록 한 줄)로 보낸다.
export function useRevokeKey() {
  const db = useDb();
  const refresh = useRefreshLicenses();
  return useMutation({ mutationFn: (key: string) => revokeKeys(db, [key]), onSuccess: refresh });
}

export function useRemoveKey() {
  const db = useDb();
  const refresh = useRefreshLicenses();
  return useMutation({ mutationFn: (key: string) => removeKeys(db, [key]), onSuccess: refresh });
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
