import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseInvitePort } from './firebase';
import type { InvitePort } from './port';

/** 이 빌드의 판이 만든 «초대장 읽기» 포트. */
export function useInvitePort(): InvitePort {
  const db = useDb();
  return useMemo(() => createFirebaseInvitePort(db), [db]);
}

export type { InvitePort } from './port';
