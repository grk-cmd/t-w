import { useMutation } from '@tanstack/react-query';
import {
  clearUpdateNotice,
  publishUpdateNotice,
  useRefreshUpdateNotice,
} from '@/entities/notice/update-notice';
import { useDb } from '@/shared/api';

export function usePublishUpdateNotice() {
  const db = useDb();
  const refresh = useRefreshUpdateNotice();
  return useMutation({
    mutationFn: ({ title, body }: { title: string; body: string }) => publishUpdateNotice(db, title, body),
    onSuccess: refresh,
  });
}

export function useClearUpdateNotice() {
  const db = useDb();
  const refresh = useRefreshUpdateNotice();
  return useMutation({ mutationFn: () => clearUpdateNotice(db), onSuccess: refresh });
}
