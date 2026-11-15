import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseInvitePort } from './firebase';
import type { InvitePort } from './port';
import { createServerInvitePort } from './server';

/** 이 빌드의 판이 만든 «초대장 읽기» 포트. */
export function useInvitePort(): InvitePort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<InvitePort>({
        firebase: () => createFirebaseInvitePort(db),
        api: () => createServerInvitePort(api),
      }),
    [db, api],
  );
}

export type { InvitePort } from './port';
