import { useMutation } from '@tanstack/react-query';
import { useApplyCatalogWrite, type CatView } from '@/entities/catalog';
import { useDb } from '@/shared/api';
import { saveCategoryName } from './manageCategories';

export function useSaveCategoryName() {
  const db = useDb();
  const apply = useApplyCatalogWrite();
  return useMutation({
    mutationFn: ({ cat, label, icon }: { cat: CatView; label: string; icon: string }) =>
      saveCategoryName(db, cat, label, icon),
    onSuccess: apply,
  });
}
