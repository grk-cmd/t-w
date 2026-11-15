import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseSecretRoomPort } from './firebase';
import type { SecretRoomPort } from './port';
import { createServerSecretRoomPort } from './server';

/** 이 빌드의 판이 만든 «시크릿룸 읽기» 포트. */
export function useSecretRoomPort(): SecretRoomPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<SecretRoomPort>({
        firebase: () => createFirebaseSecretRoomPort(db),
        api: () => createServerSecretRoomPort(),
      }),
    [db],
  );
}

export type { SecretRoomPort } from './port';
