import { useMutation } from '@tanstack/react-query';
import { useApplyCatalogWrite, type CustomCatInput } from '@/entities/catalog';
import { useDb } from '@/shared/api';
import { addCustomCat, deleteCustomCats, revertCatOverrides, saveCatOverride } from './manageCategories';

export function useAddCustomCat() {
  const db = useDb();
  const apply = useApplyCatalogWrite();
  return useMutation({ mutationFn: (input: CustomCatInput) => addCustomCat(db, input), onSuccess: apply });
}

export function useDeleteCustomCats() {
  const db = useDb();
  const apply = useApplyCatalogWrite();
  return useMutation({ mutationFn: (ids: string[]) => deleteCustomCats(db, ids), onSuccess: apply });
}

export function useSaveCatOverride() {
  const db = useDb();
  const apply = useApplyCatalogWrite();
  return useMutation({
    mutationFn: ({ cat, label, icon }: { cat: string; label: string; icon: string }) =>
      saveCatOverride(db, cat, label, icon),
    onSuccess: apply,
  });
}

export function useRevertCatOverrides() {
  const db = useDb();
  const apply = useApplyCatalogWrite();
  return useMutation({ mutationFn: (cats: string[]) => revertCatOverrides(db, cats), onSuccess: apply });
}
