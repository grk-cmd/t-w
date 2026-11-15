import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseMinVersionPort } from './firebase';
import type { MinVersionPort } from './port';
import { createServerMinVersionPort } from './server';

/** 이 빌드의 판이 만든 «최소 버전» 포트. */
export function useMinVersionPort(): MinVersionPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<MinVersionPort>({
        firebase: () => createFirebaseMinVersionPort(db),
        api: () => createServerMinVersionPort(api),
      }),
    [db, api],
  );
}

export type { MinVersionPort } from './port';
