import { useMutation } from '@tanstack/react-query';
import {
  useRefreshImprovements,
  useUsagePort,
  type Improvement,
  type ImprovementDraft,
} from '@/entities/metrics/usage';

export function useSaveImprovement() {
  const port = useUsagePort();
  const refresh = useRefreshImprovements();
  return useMutation({
    mutationFn: ({ draft, entry }: { draft: ImprovementDraft; entry?: Improvement }) =>
      port.saveImprovement(draft, entry),
    onSuccess: refresh,
  });
}

export function useDeleteImprovement() {
  const port = useUsagePort();
  const refresh = useRefreshImprovements();
  return useMutation({
    mutationFn: (entry: Improvement) => port.deleteImprovement(entry),
    onSuccess: refresh,
  });
}
