import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdBannerPort } from './index';

const AD_BANNER_KEY = ['adBanner'];

export function useAdBanner() {
  const port = useAdBannerPort();
  return useQuery({ queryKey: AD_BANNER_KEY, queryFn: () => port.get() });
}

export function useRefreshAdBanner() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: AD_BANNER_KEY });
}
