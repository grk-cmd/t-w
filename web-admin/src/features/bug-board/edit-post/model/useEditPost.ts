import { useMutation } from '@tanstack/react-query';
import {
  useRefreshBugBoard,
  useRefreshPrvTitle,
  type BugContent,
  type BugItem,
  type EditInput,
} from '@/entities/bug-board';
import { useEditPostPort } from '../api';

export function useEditPost(item: BugItem, content: BugContent | null, label: string) {
  const port = useEditPostPort();
  const refresh = useRefreshBugBoard();
  const refreshPrvTitle = useRefreshPrvTitle();
  const mutation = useMutation({
    mutationFn: (input: EditInput) => port.edit(item, content, input, label),
    onSuccess: (r) => {
      if (!r.ok) return;
      refresh();
      refreshPrvTitle(item.id);
    },
  });
  return { ...mutation, check: port.check };
}
