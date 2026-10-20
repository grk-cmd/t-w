import { useMutation } from '@tanstack/react-query';
import { useRefreshBugBoard, type BugItem, type BugStatus } from '@/entities/bug-board';
import { useDb } from '@/shared/api';
import { changeStatus } from './changeStatus';

export function useChangeStatus(item: BugItem, label: string) {
  const db = useDb();
  const refresh = useRefreshBugBoard();
  return useMutation({
    mutationFn: (status: BugStatus) => changeStatus(db, item, status, label),
    onSuccess: refresh,
  });
}
