import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseBugReportPort } from './firebase';
import type { BugReportPort } from './port';
import { createServerBugReportPort } from './server';

/** 이 빌드의 판이 만든 «제보 안내» 포트. */
export function useBugReportPort(): BugReportPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<BugReportPort>({
        firebase: () => createFirebaseBugReportPort(db),
        api: () => createServerBugReportPort(),
      }),
    [db],
  );
}

export type { BugReportPort } from './port';
