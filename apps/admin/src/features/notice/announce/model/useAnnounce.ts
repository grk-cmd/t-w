import { useMutation } from '@tanstack/react-query';
import { useAnnouncePort, useRefreshAnnounce } from '@/entities/notice/announce';

export function usePublishAnnounce() {
  const port = useAnnouncePort();
  const refresh = useRefreshAnnounce();
  return useMutation({ mutationFn: (text: string) => port.publish(text), onSuccess: refresh });
}

export function useClearAnnounce() {
  const port = useAnnouncePort();
  const refresh = useRefreshAnnounce();
  return useMutation({ mutationFn: () => port.clear(), onSuccess: refresh });
}
