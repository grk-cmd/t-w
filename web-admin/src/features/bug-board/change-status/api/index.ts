import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseChangeStatusPort } from './firebase';
import type { ChangeStatusPort } from './port';
import { createServerChangeStatusPort } from './server';

/** 이 빌드의 판이 만든 «상태 바꾸기» 포트. */
export function useChangeStatusPort(): ChangeStatusPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<ChangeStatusPort>({
        firebase: () => createFirebaseChangeStatusPort(db),
        api: () => createServerChangeStatusPort(api),
      }),
    [db, api],
  );
}

export type { ChangeStatusPort } from './port';
