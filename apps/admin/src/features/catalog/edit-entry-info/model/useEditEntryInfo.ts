import { useMutation } from '@tanstack/react-query';
import { useApplyEdits, type CatalogEntry } from '@/entities/catalog';
import { useEditEntryInfoPort } from '../api';

export function useEditEntryInfo() {
  const port = useEditEntryInfoPort();
  const apply = useApplyEdits();
  return useMutation({
    mutationFn: ({ entry, name, icon }: { entry: CatalogEntry; name: string; icon: string }) =>
      port.save(entry, name, icon),
    onSuccess: (r) => apply(r.edits),
  });
}

export function useEditEntryInfoCheck() {
  return useEditEntryInfoPort().check;
}
