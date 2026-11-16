import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseDeletePostPort } from './firebase';
import type { DeletePostPort } from './port';

/** 이 빌드의 판이 만든 «제보 지우기» 포트. */
export function useDeletePostPort(): DeletePostPort {
  const db = useDb();
  return useMemo(() => createFirebaseDeletePostPort(db), [db]);
}

export type { DeletePostPort } from './port';
