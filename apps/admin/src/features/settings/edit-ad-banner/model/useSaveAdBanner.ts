import { useMutation } from '@tanstack/react-query';
import { saveAdBanner, useRefreshAdBanner, type AdSlide } from '@/entities/ad-banner';
import { useDb } from '@/shared/api';

export function useSaveAdBanner() {
  const db = useDb();
  const refresh = useRefreshAdBanner();
  return useMutation({ mutationFn: (slides: AdSlide[]) => saveAdBanner(db, slides), onSuccess: refresh });
}
