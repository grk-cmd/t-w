import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseAdminNamePort } from './firebase';
import type { AdminNamePort } from './port';
import { createServerAdminNamePort } from './server';

/** 이 빌드의 판이 만든 «관리자 이름표» 포트. */
export function useAdminNamePort(): AdminNamePort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<AdminNamePort>({
        firebase: () => createFirebaseAdminNamePort(db),
        api: () => createServerAdminNamePort(api),
      }),
    [db, api],
  );
}

export type { AdminNamePort } from './port';
