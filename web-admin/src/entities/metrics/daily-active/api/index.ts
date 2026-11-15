import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseMetricsPort } from './firebase';
import type { MetricsPort } from './port';
import { createServerMetricsPort } from './server';

/** 이 빌드의 판이 만든 «접속 지표» 포트. */
export function useMetricsPort(): MetricsPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<MetricsPort>({
        firebase: () => createFirebaseMetricsPort(db),
        api: () => createServerMetricsPort(),
      }),
    [db],
  );
}

export type { MetricsPort } from './port';
