import { useMutation } from '@tanstack/react-query';
import {
  useRefreshBugBoard,
  useRefreshPrvTitle,
  type BugContent,
  type BugItem,
  type EditInput,
} from '@/entities/bug-board';
import { refreshOnConflict } from '@/shared/api';
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
    // 그 사이 다른 곳이 고쳤다 — 덮지 않고 글을 다시 받는다.
    onError: refreshOnConflict(refresh),
  });
  return { ...mutation, check: port.check };
}
