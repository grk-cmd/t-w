import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseEditPostPort } from './firebase';
import type { EditPostPort } from './port';

/** 이 빌드의 판이 만든 «제보 고치기» 포트. */
export function useEditPostPort(): EditPostPort {
  const db = useDb();
  return useMemo(() => createFirebaseEditPostPort(db), [db]);
}

export type { EditPostPort } from './port';
