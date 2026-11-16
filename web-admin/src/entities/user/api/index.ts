import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseUserPort } from './firebase';
import type { UserPort } from './port';
import { createServerUserPort } from './server';

/** 이 빌드의 판이 만든 «사용자 한 사람 읽기» 포트. */
export function useUserPort(): UserPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<UserPort>({
        firebase: () => createFirebaseUserPort(db),
        api: () => createServerUserPort(api),
      }),
    [db, api],
  );
}

export type { UserBrief, UserCellsPort, UserDetailPort, UserPort } from './port';
