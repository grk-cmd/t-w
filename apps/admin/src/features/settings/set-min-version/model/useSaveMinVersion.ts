import { useMutation } from '@tanstack/react-query';
import { saveMinVersion, useRefreshMinVersion, type MinVersionKind } from '@/entities/min-version';
import { useDb } from '@/shared/api';

export function useSaveMinVersion(kind: MinVersionKind) {
  const db = useDb();
  const refresh = useRefreshMinVersion(kind);
  return useMutation({
    mutationFn: ({ version, before }: { version: string; before: string | null }) =>
      saveMinVersion(db, kind, version, before),
    onSuccess: refresh,
  });
}
