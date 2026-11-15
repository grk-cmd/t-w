import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchLicenseRows, refreshLicenses } from '@/entities/license';
import { useRevokeKeyPort } from '../api';
import type { SelectedKey } from './revokeKeys';

// 쓴 뒤 받아 둔 목록에 먼저 반영하고(API 사본은 몇 초 늦다), 사본이 따라오면 다시 읽는다.
function useKeysMutation(act: 'revoke' | 'remove', change: 'revoked' | 'removed') {
  const port = useRevokeKeyPort();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (keys: readonly SelectedKey[]) => port[act](keys),
    onSuccess: (_n, keys) => {
      patchLicenseRows(
        client,
        keys.map((k) => k.key),
        change,
      );
      refreshLicenses(client);
    },
    // 묶음이 일부만 됐거나(API 판) 다른 곳이 먼저 고쳤으면(409) 화면이 옛 줄 · 옛 번호를 들고 있다 — 서버 값을 다시 받는다.
    onError: () => refreshLicenses(client),
  });
}

export function useRevokeKeys() {
  return useKeysMutation('revoke', 'revoked');
}

export function useRemoveKeys() {
  return useKeysMutation('remove', 'removed');
}

// 한 개도 여러 개와 같은 길(한 묶음 + 기록 한 줄)로 보낸다.
export function useRevokeKey() {
  const m = useRevokeKeys();
  return { ...m, mutateAsync: (key: SelectedKey) => m.mutateAsync([key]) };
}

export function useRemoveKey() {
  const m = useRemoveKeys();
  return { ...m, mutateAsync: (key: SelectedKey) => m.mutateAsync([key]) };
}
