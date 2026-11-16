import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type BugItem, type BugStatus } from '@/entities/bug-board';
import { useChangeStatusPort } from '../api';

export function useChangeStatus(item: BugItem, label: string) {
  const port = useChangeStatusPort();
  const refresh = useRefreshBugBoard();
  return useMutation({
    mutationFn: (status: BugStatus) => port.change(item, status, label),
    onSuccess: refresh,
  });
}
