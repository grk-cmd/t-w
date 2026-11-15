import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseOpsConfigPort } from './firebase';
import type { OpsConfigPort } from './port';
import { createServerOpsConfigPort } from './server';

/** 이 빌드의 판이 만든 «서버 운영 설정» 포트. */
export function useOpsConfigPort(): OpsConfigPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<OpsConfigPort>({
        firebase: () => createFirebaseOpsConfigPort(db),
        api: () => createServerOpsConfigPort(api),
      }),
    [db, api],
  );
}

export type { MaintenanceControl, OpsConfigPort, OpsGroups, ServerLimitsControl } from './port';
