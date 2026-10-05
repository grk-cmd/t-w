import { useMutation } from '@tanstack/react-query';
import { useApplyCatalogWrite, type CatalogEntry } from '@/entities/catalog';
import { useDb } from '@/shared/api';
import { saveEntryInfo } from './editEntryInfo';

export function useEditEntryInfo() {
  const db = useDb();
  const apply = useApplyCatalogWrite();
  return useMutation({
    mutationFn: ({ entry, name, icon }: { entry: CatalogEntry; name: string; icon: string }) =>
      saveEntryInfo(db, entry, name, icon),
    onSuccess: apply,
  });
}
