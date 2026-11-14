import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseMinVersionPort } from './firebase';
import type { MinVersionPort } from './port';
import { createServerMinVersionPort } from './server';

/** 이 빌드의 판이 만든 «최소 버전» 포트. */
export function useMinVersionPort(): MinVersionPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<MinVersionPort>({
        firebase: () => createFirebaseMinVersionPort(db),
        api: () => createServerMinVersionPort(),
      }),
    [db],
  );
}

export type { MinVersionPort } from './port';
