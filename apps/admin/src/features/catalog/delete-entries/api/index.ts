import { useMemo } from 'react';
import { pickBackend, useApi, useDb, useFiles } from '@/shared/api';
import { createFirebaseDeleteEntriesPort } from './firebase';
import type { DeleteEntriesPort } from './port';
import { createServerDeleteEntriesPort } from './server';

/** 이 빌드의 판이 만든 «항목 지우기» 포트. */
export function useDeleteEntriesPort(): DeleteEntriesPort {
  const db = useDb();
  const files = useFiles();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<DeleteEntriesPort>({
        firebase: () => createFirebaseDeleteEntriesPort(db, files),
        api: () => createServerDeleteEntriesPort(api),
      }),
    [db, files, api],
  );
}

export type { DeleteEntriesPort, RemoveEntriesResult } from './port';
