import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseIssueKeyPort } from './firebase';
import type { IssueKeyPort } from './port';
import { createServerIssueKeyPort } from './server';

/** 이 빌드의 판이 만든 «키 한 장 발급» 포트. */
export function useIssueKeyPort(): IssueKeyPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<IssueKeyPort>({
        firebase: () => createFirebaseIssueKeyPort(db),
        api: () => createServerIssueKeyPort(api),
      }),
    [db, api],
  );
}

export type { IssueKeyPort } from './port';
