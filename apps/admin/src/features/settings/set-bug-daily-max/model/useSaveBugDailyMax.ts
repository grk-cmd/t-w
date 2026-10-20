import { useMutation } from '@tanstack/react-query';
import { saveBugDailyMax, useRefreshBugDailyMax } from '@/entities/bug-board';
import { useDb } from '@/shared/api';

export function useSaveBugDailyMax() {
  const db = useDb();
  const refresh = useRefreshBugDailyMax();
  return useMutation({
    mutationFn: ({ max, before }: { max: number; before: number | null }) => saveBugDailyMax(db, max, before),
    onSuccess: refresh,
  });
}
