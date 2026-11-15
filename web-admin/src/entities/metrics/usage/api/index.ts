import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseUsagePort } from './firebase';
import type { UsagePort } from './port';
import { createServerUsagePort } from './server';

/** 이 빌드의 판이 만든 «사용량 · 개선 기록» 포트. */
export function useUsagePort(): UsagePort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<UsagePort>({
        firebase: () => createFirebaseUsagePort(db),
        api: () => createServerUsagePort(api),
      }),
    [db, api],
  );
}

export type { UsagePort } from './port';
