import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseChangeStatusPort } from './firebase';
import type { ChangeStatusPort } from './port';

/** 이 빌드의 판이 만든 «상태 바꾸기» 포트. */
export function useChangeStatusPort(): ChangeStatusPort {
  const db = useDb();
  return useMemo(() => createFirebaseChangeStatusPort(db), [db]);
}

export type { ChangeStatusPort } from './port';
