import { useMemo } from 'react';
import { pickBackend, useApi, useDb, useFiles } from '@/shared/api';
import { createFirebaseModerateReportPort } from './firebase';
import type { ModerateReportPort } from './port';
import { createServerModerateReportPort } from './server';

/** 이 빌드의 판이 만든 «신고 처리» 포트. */
export function useModerateReportPort(): ModerateReportPort {
  const db = useDb();
  const files = useFiles();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<ModerateReportPort>({
        firebase: () => createFirebaseModerateReportPort(db, files),
        api: () => createServerModerateReportPort(api),
      }),
    [db, files, api],
  );
}

export type { ModerateReportPort } from './port';
