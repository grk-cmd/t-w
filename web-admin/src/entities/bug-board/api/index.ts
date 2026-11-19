import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseBugBoardPort, createFirebaseBugDailyMaxPort } from './firebase';
import type { BugBoardPort, BugDailyMaxPort } from './port';
import { createServerBugBoardPort, createServerBugDailyMaxPort } from './server';

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

/** 이 빌드의 판이 만든 «하루 제보 상한» 포트. */
export function useBugDailyMaxPort(): BugDailyMaxPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<BugDailyMaxPort>({
        firebase: () => createFirebaseBugDailyMaxPort(db),
        api: () => createServerBugDailyMaxPort(api),
      }),
    [db, api],
  );
}

export type { BugBoardPort, BugDailyMaxPort, BugListQuery, BugPost } from './port';
