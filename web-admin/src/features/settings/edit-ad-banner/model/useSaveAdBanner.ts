import { useMutation } from '@tanstack/react-query';
import { useAdBannerPort, useRefreshAdBanner, type AdSlide } from '@/entities/ad-banner';
import { refreshOnConflict, type Versioned } from '@/shared/api';

export function useSaveAdBanner() {
  const port = useAdBannerPort();
  const refresh = useRefreshAdBanner();
  return useMutation({
    mutationFn: ({ from, slides }: { from: Versioned<AdSlide[]>; slides: AdSlide[] }) =>
      port.save(from, slides),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
