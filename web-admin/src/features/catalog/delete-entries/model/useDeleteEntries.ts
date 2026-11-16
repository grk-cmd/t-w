import { useMutation } from '@tanstack/react-query';
import { useApplyEdits, type CatalogEntry } from '@/entities/catalog';
import { useDeleteEntriesPort } from '../api';

export function useDeleteEntries() {
  const port = useDeleteEntriesPort();
  const apply = useApplyEdits();
  return useMutation({
    mutationFn: ({ entries, rest }: { entries: CatalogEntry[]; rest: CatalogEntry[] }) =>
      port.remove(entries, rest),
    onSuccess: (r) => apply(r.edits),
  });
}
