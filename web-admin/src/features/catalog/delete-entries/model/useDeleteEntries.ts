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

/** 지우기가 지우는지 단종하는지 — 단추 · 확인 문구가 쓴다. */
export const useArchives = (): boolean => useDeleteEntriesPort().archives;
