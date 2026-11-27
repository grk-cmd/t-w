import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseAuthPort } from './firebase';
import type { AuthPort } from './port';
import { createServerAuthPort } from './server';

/** 이 빌드의 판이 만든 «관리자 확인» 포트. */
export function useAuthPort(): AuthPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<AuthPort>({
        firebase: () => createFirebaseAuthPort(db),
        api: () => createServerAuthPort(api),
      }),
    [db, api],
  );
}

export type { AdminCheck, AuthPort, AuthUser } from './port';
