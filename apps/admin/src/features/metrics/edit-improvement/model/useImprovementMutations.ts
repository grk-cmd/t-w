import { useMutation } from '@tanstack/react-query';
import {
  deleteImprovement,
  saveImprovement,
  useRefreshImprovements,
  type Improvement,
  type ImprovementDraft,
} from '@/entities/metrics/usage';
import { useDb } from '@/shared/api';

export function useSaveImprovement() {
  const db = useDb();
  const refresh = useRefreshImprovements();
  return useMutation({
    mutationFn: ({ draft, id }: { draft: ImprovementDraft; id?: string }) => saveImprovement(db, draft, id),
    onSuccess: refresh,
  });
}

export function useDeleteImprovement() {
  const db = useDb();
  const refresh = useRefreshImprovements();
  return useMutation({
    mutationFn: (entry: Improvement) => deleteImprovement(db, entry),
    onSuccess: refresh,
  });
}
