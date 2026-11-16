import { useMemo } from 'react';
import { useApi, useDb } from '@/shared/api';
import { createFirebaseBugBoardPort } from './firebase';
import type { BugBoardPort } from './port';

/** 이 빌드의 판이 만든 «제보 읽기» 포트. */
export function useBugBoardPort(): BugBoardPort {
  const db = useDb();
  const api = useApi();
  return useMemo(() => createFirebaseBugBoardPort(api, db), [db, api]);
}

export type { BugBoardPort, BugListQuery, BugPost } from './port';
