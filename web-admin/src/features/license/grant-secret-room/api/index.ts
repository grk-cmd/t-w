import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseGrantSecretRoomPort } from './firebase';
import type { GrantSecretRoomPort } from './port';
import { createServerGrantSecretRoomPort } from './server';

/** 이 빌드의 판이 만든 «시크릿룸 발급» 포트. */
export function useGrantSecretRoomPort(): GrantSecretRoomPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<GrantSecretRoomPort>({
        firebase: () => createFirebaseGrantSecretRoomPort(db),
        api: () => createServerGrantSecretRoomPort(),
      }),
    [db],
  );
}

export type { GrantSecretRoomPort } from './port';
