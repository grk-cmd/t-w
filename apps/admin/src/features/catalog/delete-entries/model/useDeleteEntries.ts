import { useMutation } from '@tanstack/react-query';
import { useApplyCatalogWrite, type CatalogEntry } from '@/entities/catalog';
import { useDb, useFiles } from '@/shared/api';
import { deleteEntries } from './deleteEntries';

export function useDeleteEntries() {
  const db = useDb();
  const files = useFiles();
  const apply = useApplyCatalogWrite();
  return useMutation({
    mutationFn: ({ entries, rest }: { entries: CatalogEntry[]; rest: CatalogEntry[] }) =>
      deleteEntries(db, files, entries, rest),
    onSuccess: (r) => apply(r.written),
  });
}
