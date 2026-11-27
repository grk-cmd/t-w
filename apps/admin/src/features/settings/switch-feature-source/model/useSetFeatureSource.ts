import { useMutation } from '@tanstack/react-query';
import {
  setFeatureSource,
  useRefreshFeatureSources,
  type Feature,
  type Source,
} from '@/entities/server/feature-source';
import { useRefreshRoomServer } from '@/entities/room-server';
import { useDb } from '@/shared/api';

export function useSetFeatureSource() {
  const db = useDb();
  const refresh = useRefreshFeatureSources();
  const refreshRoomServer = useRefreshRoomServer(); // 방은 🛰 방 서버 화면의 «방 서버 사용» 과 같은 칸
  return useMutation({
    mutationFn: ({ feature, source }: { feature: Feature; source: Source }) =>
      setFeatureSource(db, feature, source),
    onSuccess: () => Promise.all([refresh(), refreshRoomServer()]),
  });
}
