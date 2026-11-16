import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseBugBoardPort } from './firebase';
import type { BugBoardPort } from './port';
import { createServerBugBoardPort } from './server';

/** 이 빌드의 판이 만든 «제보 읽기» 포트. */
export function useBugBoardPort(): BugBoardPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<BugBoardPort>({
        firebase: () => createFirebaseBugBoardPort(api, db),
        api: () => createServerBugBoardPort(api),
      }),
    [db, api],
  );
}

export type { BugBoardPort, BugListQuery, BugPost } from './port';
