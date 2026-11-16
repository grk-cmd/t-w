import { useMemo } from 'react';
import { useDb, useFiles } from '@/shared/api';
import { createFirebaseDeleteEntriesPort } from './firebase';
import type { DeleteEntriesPort } from './port';

/** 이 빌드의 판이 만든 «항목 지우기» 포트. */
export function useDeleteEntriesPort(): DeleteEntriesPort {
  const db = useDb();
  const files = useFiles();
  return useMemo(() => createFirebaseDeleteEntriesPort(db, files), [db, files]);
}

export type { DeleteEntriesPort, RemoveEntriesResult } from './port';
