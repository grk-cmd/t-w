import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseReportPort } from './firebase';
import type { ReportPort } from './port';

/** 이 빌드의 판이 만든 «신고 읽기» 포트. */
export function useReportPort(): ReportPort {
  const db = useDb();
  return useMemo(() => createFirebaseReportPort(db), [db]);
}

export type { ReportPort } from './port';
