import { useMutation } from '@tanstack/react-query';
import { useApplyCatalogWrite, type CatalogEntry } from '@/entities/catalog';
import { useDb } from '@/shared/api';
import { reorderEntries } from './reorderEntries';

export interface ReorderInput {
  group: CatalogEntry[];
  dragged: string;
  target: string;
}

export function useReorderEntries() {
  const db = useDb();
  const apply = useApplyCatalogWrite();
  return useMutation({
    mutationFn: ({ group, dragged, target }: ReorderInput) => reorderEntries(db, group, dragged, target),
    onSuccess: apply,
  });
}
