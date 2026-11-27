import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseApplyReleasePort } from './firebase';
import type { ApplyReleasePort } from './port';
import { createServerApplyReleasePort } from './server';

/** 이 빌드의 판이 만든 «릴리스 반영» 포트. */
export function useApplyReleasePort(): ApplyReleasePort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<ApplyReleasePort>({
        firebase: () => createFirebaseApplyReleasePort(db),
        api: () => createServerApplyReleasePort(api),
      }),
    [db, api],
  );
}

export type { ApplyReleasePort } from './port';
