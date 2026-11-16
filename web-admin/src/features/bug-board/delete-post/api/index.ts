import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseDeletePostPort } from './firebase';
import type { DeletePostPort } from './port';
import { createServerDeletePostPort } from './server';

/** 이 빌드의 판이 만든 «제보 지우기» 포트. */
export function useDeletePostPort(): DeletePostPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<DeletePostPort>({
        firebase: () => createFirebaseDeletePostPort(db),
        api: () => createServerDeletePostPort(api),
      }),
    [db, api],
  );
}

export type { DeletePostPort } from './port';
