import { useMutation } from '@tanstack/react-query';
import { useBugDailyMaxPort, useRefreshBugDailyMax } from '@/entities/bug-board';
import { refreshOnConflict, type Versioned } from '@/shared/api';

export function useSaveBugDailyMax() {
  const port = useBugDailyMaxPort();
  const refresh = useRefreshBugDailyMax();
  return useMutation({
    mutationFn: ({ from, max }: { from: Versioned<number | null>; max: number }) => port.save(from, max),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
