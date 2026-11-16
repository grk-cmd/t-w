import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseReorderEntriesPort } from './firebase';
import type { ReorderEntriesPort } from './port';

/** 이 빌드의 판이 만든 «순서 바꾸기» 포트. */
export function useReorderEntriesPort(): ReorderEntriesPort {
  const db = useDb();
  return useMemo(() => createFirebaseReorderEntriesPort(db), [db]);
}

export type { ReorderEntriesPort, ReorderInput } from './port';
