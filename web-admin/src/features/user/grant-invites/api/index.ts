import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseGrantInvitesPort } from './firebase';
import type { GrantInvitesPort } from './port';
import { createServerGrantInvitesPort } from './server';

/** 이 빌드의 판이 만든 «초대장 쓰기» 포트. */
export function useGrantInvitesPort(): GrantInvitesPort {
  const db = useDb();
  const api = useApi();
  const client = useQueryClient();
  return useMemo(
    () =>
      pickBackend<GrantInvitesPort>({
        firebase: () => createFirebaseGrantInvitesPort(db, client),
        api: () => createServerGrantInvitesPort(api),
      }),
    [db, api, client],
  );
}

export type { GrantInvitesPort, RunOpts } from './port';
