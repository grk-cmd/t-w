import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseReorderEntriesPort } from './firebase';
import type { ReorderEntriesPort } from './port';
import { createServerReorderEntriesPort } from './server';

/** 이 빌드의 판이 만든 «순서 바꾸기» 포트. */
export function useReorderEntriesPort(): ReorderEntriesPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<ReorderEntriesPort>({
        firebase: () => createFirebaseReorderEntriesPort(db),
        api: () => createServerReorderEntriesPort(api),
      }),
    [db, api],
  );
}

export type { ReorderEntriesPort, ReorderInput } from './port';
