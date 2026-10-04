import { useMutation } from '@tanstack/react-query';
import { setUserCount, useRefreshUserCount } from '@/entities/user-count';
import { useDb } from '@/shared/api';

export function useAdjustUserCount() {
  const db = useDb();
  const refresh = useRefreshUserCount();
  return useMutation({ mutationFn: (count: number) => setUserCount(db, count), onSettled: refresh });
}
