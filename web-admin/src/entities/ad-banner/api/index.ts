import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseAdBannerPort } from './firebase';
import type { AdBannerPort } from './port';
import { createServerAdBannerPort } from './server';

/** 이 빌드의 판이 만든 «런처 배너» 포트. */
export function useAdBannerPort(): AdBannerPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<AdBannerPort>({
        firebase: () => createFirebaseAdBannerPort(db),
        api: () => createServerAdBannerPort(api),
      }),
    [db, api],
  );
}

export type { AdBannerPort } from './port';
