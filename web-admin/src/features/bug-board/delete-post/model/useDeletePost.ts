import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type BugItem } from '@/entities/bug-board';
import { useDb } from '@/shared/api';
import { deletePost } from './deletePost';

export function useDeletePost(item: BugItem, label: string) {
  const db = useDb();
  const refresh = useRefreshBugBoard();
  return useMutation({
    mutationFn: () => deletePost(db, item, label),
    onSuccess: refresh,
  });
}
