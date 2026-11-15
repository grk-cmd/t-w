import { useMutation } from '@tanstack/react-query';
import { useMinVersionPort, useRefreshMinVersion, type MinVersionKind } from '@/entities/min-version';

export function useSaveMinVersion(kind: MinVersionKind) {
  const port = useMinVersionPort();
  const refresh = useRefreshMinVersion(kind);
  return useMutation({
    mutationFn: ({ version, before }: { version: string; before: string | null }) =>
      port.save(kind, version, before),
    onSuccess: refresh,
  });
}
