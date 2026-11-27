import { useMutation } from '@tanstack/react-query';
import { useApplyEdits } from '@/entities/catalog';
import { useReorderEntriesPort, type ReorderInput } from '../api';

export function useReorderEntries() {
  const port = useReorderEntriesPort();
  const apply = useApplyEdits();
  return useMutation({
    mutationFn: (input: ReorderInput) => port.reorder(input),
    onSuccess: (r) => apply(r.edits),
  });
}
