import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseUserCountPort } from './firebase';
import type { UserCountPort } from './port';
import { createServerUserCountPort } from './server';

/** 이 빌드의 판이 만든 «가입자 수» 포트. */
export function useUserCountPort(): UserCountPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<UserCountPort>({
        firebase: () => createFirebaseUserCountPort(db),
        api: () => createServerUserCountPort(api),
      }),
    [db, api],
  );
}

export type { UserCountPort } from './port';
