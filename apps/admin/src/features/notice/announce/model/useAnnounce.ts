import { useMutation } from '@tanstack/react-query';
import { clearAnnounce, publishAnnounce, useRefreshAnnounce } from '@/entities/notice/announce';
import { useDb } from '@/shared/api';

export function usePublishAnnounce() {
  const db = useDb();
  const refresh = useRefreshAnnounce();
  return useMutation({ mutationFn: (text: string) => publishAnnounce(db, text), onSuccess: refresh });
}

export function useClearAnnounce() {
  const db = useDb();
  const refresh = useRefreshAnnounce();
  return useMutation({ mutationFn: () => clearAnnounce(db), onSuccess: refresh });
}
