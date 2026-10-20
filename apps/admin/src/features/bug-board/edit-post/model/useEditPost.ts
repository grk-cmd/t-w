import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, useRefreshPrvTitle, type EditInput } from '@/entities/bug-board';
import { useDb } from '@/shared/api';
import { editPost } from './editPost';

export function useEditPost(id: string, label: string) {
  const db = useDb();
  const refresh = useRefreshBugBoard();
  const refreshPrvTitle = useRefreshPrvTitle();
  return useMutation({
    mutationFn: (input: EditInput) => editPost(db, id, input, label),
    onSuccess: (r) => {
      if (!r.ok) return;
      refresh();
      refreshPrvTitle(id);
    },
  });
}
