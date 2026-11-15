import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseAccountPort } from './firebase';
import type { AccountPort } from './port';
import { createServerAccountPort } from './server';

/** 이 빌드의 판이 만든 «계정 요약» 포트. */
export function useAccountPort(): AccountPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<AccountPort>({
        firebase: () => createFirebaseAccountPort(db),
        api: () => createServerAccountPort(),
      }),
    [db],
  );
}

export type { AccountPort } from './port';
