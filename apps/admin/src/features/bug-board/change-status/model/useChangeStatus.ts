import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type BugItem, type BugStatus } from '@/entities/bug-board';
import { refreshOnConflict } from '@/shared/api';
import { useChangeStatusPort } from '../api';

export function useChangeStatus(item: BugItem, label: string) {
  const port = useChangeStatusPort();
  const refresh = useRefreshBugBoard();
  return useMutation({
    mutationFn: (status: BugStatus) => port.change(item, status, label),
    onSuccess: refresh,
    // 그 사이 다른 곳이 고쳤다 — 덮지 않고 글을 다시 받는다.
    onError: refreshOnConflict(refresh),
  });
}
