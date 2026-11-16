import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type BugItem } from '@/entities/bug-board';
import { useDeletePostPort } from '../api';

export function useDeletePost(item: BugItem, label: string) {
  const port = useDeletePostPort();
  const refresh = useRefreshBugBoard();
  return useMutation({
    mutationFn: () => port.remove(item, label),
    onSuccess: refresh,
  });
}
