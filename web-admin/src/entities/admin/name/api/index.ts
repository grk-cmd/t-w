import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseAdminNamePort } from './firebase';
import type { AdminNamePort } from './port';

/** 이 빌드의 판이 만든 «관리자 이름표» 포트. */
export function useAdminNamePort(): AdminNamePort {
  const db = useDb();
  return useMemo(() => createFirebaseAdminNamePort(db), [db]);
}

export type { AdminNamePort } from './port';
