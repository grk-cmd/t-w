import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseEditEntryInfoPort } from './firebase';
import type { EditEntryInfoPort } from './port';

/** 이 빌드의 판이 만든 «이름 · 아이콘 고치기» 포트. */
export function useEditEntryInfoPort(): EditEntryInfoPort {
  const db = useDb();
  return useMemo(() => createFirebaseEditEntryInfoPort(db), [db]);
}

export type { EditEntryInfoPort } from './port';
