import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseAdminLogPort } from './firebase';
import type { AdminLogPort } from './port';
import { createServerAdminLogPort } from './server';

/** 이 빌드의 판이 만든 «작업 기록» 포트. */
export function useAdminLogPort(): AdminLogPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<AdminLogPort>({
        firebase: () => createFirebaseAdminLogPort(db),
        api: () => createServerAdminLogPort(api),
      }),
    [db, api],
  );
}

export type { AdminLogPage, AdminLogPort } from './port';
