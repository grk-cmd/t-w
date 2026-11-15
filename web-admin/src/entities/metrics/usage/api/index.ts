import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseUsagePort } from './firebase';
import type { UsagePort } from './port';
import { createServerUsagePort } from './server';

/** 이 빌드의 판이 만든 «사용량 · 개선 기록» 포트. */
export function useUsagePort(): UsagePort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<UsagePort>({
        firebase: () => createFirebaseUsagePort(db),
        api: () => createServerUsagePort(),
      }),
    [db],
  );
}

export type { UsagePort } from './port';
