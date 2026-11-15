import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseGrantInvitesPort } from './firebase';
import type { GrantInvitesPort } from './port';

/** 이 빌드의 판이 만든 «초대장 쓰기» 포트. */
export function useGrantInvitesPort(): GrantInvitesPort {
  const db = useDb();
  const client = useQueryClient();
  return useMemo(() => createFirebaseGrantInvitesPort(db, client), [db, client]);
}

export type { GrantInvitesPort, RunOpts } from './port';
