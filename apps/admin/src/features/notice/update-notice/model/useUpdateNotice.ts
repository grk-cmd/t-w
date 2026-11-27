import { useMutation } from '@tanstack/react-query';
import {
  useRefreshUpdateNotice,
  useUpdateNoticePort,
  type UpdateNotice,
} from '@/entities/notice/update-notice';

export function usePublishUpdateNotice() {
  const port = useUpdateNoticePort();
  const refresh = useRefreshUpdateNotice();
  return useMutation({
    mutationFn: ({ title, body }: { title: string; body: string }) => port.publish(title, body),
    onSuccess: refresh,
  });
}

export function useClearUpdateNotice() {
  const port = useUpdateNoticePort();
  const refresh = useRefreshUpdateNotice();
  return useMutation({ mutationFn: (notice: UpdateNotice) => port.clear(notice), onSuccess: refresh });
}
