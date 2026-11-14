import { useMutation } from '@tanstack/react-query';
import { useAdBannerPort, useRefreshAdBanner, type AdSlide } from '@/entities/ad-banner';

export function useSaveAdBanner() {
  const port = useAdBannerPort();
  const refresh = useRefreshAdBanner();
  return useMutation({ mutationFn: (slides: AdSlide[]) => port.save(slides), onSuccess: refresh });
}
