import { useMutation } from '@tanstack/react-query';
import { useApplyEdits, type CatView } from '@/entities/catalog';
import { useManageCategoriesPort } from '../api';

export function useSaveCategoryName() {
  const port = useManageCategoriesPort();
  const apply = useApplyEdits();
  return useMutation({
    mutationFn: ({ cat, label, icon }: { cat: CatView; label: string; icon: string }) =>
      port.save(cat, label, icon),
    onSuccess: (r) => apply(r.edits),
  });
}

export function useCategoryNameCheck() {
  return useManageCategoriesPort().check;
}
