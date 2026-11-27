import { useMutation } from '@tanstack/react-query';
import { useMinVersionPort, useRefreshMinVersion, type MinVersionKind } from '@/entities/min-version';
import { refreshOnConflict, type Versioned } from '@/shared/api';

export function useSaveMinVersion(kind: MinVersionKind) {
  const port = useMinVersionPort();
  const refresh = useRefreshMinVersion(kind);
  return useMutation({
    mutationFn: ({ from, version }: { from: Versioned<string | null>; version: string }) =>
      port.save(kind, from, version),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
