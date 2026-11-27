import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseEditPostPort } from './firebase';
import type { EditPostPort } from './port';
import { createServerEditPostPort } from './server';

/** 이 빌드의 판이 만든 «제보 고치기» 포트. */
export function useEditPostPort(): EditPostPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<EditPostPort>({
        firebase: () => createFirebaseEditPostPort(db),
        api: () => createServerEditPostPort(api),
      }),
    [db, api],
  );
}

export type { EditPostPort } from './port';
