import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseOpsConfigPort } from './firebase';
import type { OpsConfigPort } from './port';
import { createServerOpsConfigPort } from './server';

/** 이 빌드의 판이 만든 «서버 운영 설정» 포트. */
export function useOpsConfigPort(): OpsConfigPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<OpsConfigPort>({
        firebase: () => createFirebaseOpsConfigPort(db),
        api: () => createServerOpsConfigPort(),
      }),
    [db],
  );
}

export type { OpsConfigPort } from './port';
