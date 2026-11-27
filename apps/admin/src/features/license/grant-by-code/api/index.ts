import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseGrantByCodePort } from './firebase';
import type { GrantByCodePort } from './port';
import { createServerGrantByCodePort } from './server';

/** 이 빌드의 판이 만든 «친구코드로 발급» 포트. */
export function useGrantByCodePort(): GrantByCodePort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<GrantByCodePort>({
        firebase: () => createFirebaseGrantByCodePort(db),
        api: () => createServerGrantByCodePort(api),
      }),
    [db, api],
  );
}

export type { GrantByCodePort } from './port';
