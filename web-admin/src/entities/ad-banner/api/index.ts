import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseAdBannerPort } from './firebase';
import type { AdBannerPort } from './port';
import { createServerAdBannerPort } from './server';

/** 이 빌드의 판이 만든 «런처 배너» 포트. */
export function useAdBannerPort(): AdBannerPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<AdBannerPort>({
        firebase: () => createFirebaseAdBannerPort(db),
        api: () => createServerAdBannerPort(),
      }),
    [db],
  );
}

export type { AdBannerPort } from './port';
