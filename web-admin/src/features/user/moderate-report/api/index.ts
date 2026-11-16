import { useMemo } from 'react';
import { useDb, useFiles } from '@/shared/api';
import { createFirebaseModerateReportPort } from './firebase';
import type { ModerateReportPort } from './port';

/** 이 빌드의 판이 만든 «신고 처리» 포트. */
export function useModerateReportPort(): ModerateReportPort {
  const db = useDb();
  const files = useFiles();
  return useMemo(() => createFirebaseModerateReportPort(db, files), [db, files]);
}

export type { ModerateReportPort } from './port';
