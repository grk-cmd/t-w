import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseGrantSecretRoomPort } from './firebase';
import type { GrantSecretRoomPort } from './port';
import { createServerGrantSecretRoomPort } from './server';

/** 이 빌드의 판이 만든 «시크릿룸 발급» 포트. */
export function useGrantSecretRoomPort(): GrantSecretRoomPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<GrantSecretRoomPort>({
        firebase: () => createFirebaseGrantSecretRoomPort(db),
        api: () => createServerGrantSecretRoomPort(api),
      }),
    [db, api],
  );
}

export type { GrantSecretRoomPort } from './port';
