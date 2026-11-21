import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchLicenseRows, refreshLicenses } from '@/entities/license';
import { useDb } from '@/shared/api';
import { removeKeys, revokeKeys } from './revokeKeys';

// 쓴 뒤 받아 둔 목록에 먼저 반영하고(API 사본은 몇 초 늦다), 사본이 따라오면 다시 읽는다.
function useKeysMutation(write: typeof revokeKeys, change: 'revoked' | 'removed') {
  const db = useDb();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (keys: string[]) => write(db, keys),
    onSuccess: (_n, keys) => {
      patchLicenseRows(client, keys, change);
      refreshLicenses(client);
    },
  });
}

export function useRevokeKeys() {
  return useKeysMutation(revokeKeys, 'revoked');
}

export function useRemoveKeys() {
  return useKeysMutation(removeKeys, 'removed');
}

// 한 개도 여러 개와 같은 길(한 묶음 + 기록 한 줄)로 보낸다.
export function useRevokeKey() {
  const m = useRevokeKeys();
  return { ...m, mutateAsync: (key: string) => m.mutateAsync([key]) };
}

export function useRemoveKey() {
  const m = useRemoveKeys();
  return { ...m, mutateAsync: (key: string) => m.mutateAsync([key]) };
}
