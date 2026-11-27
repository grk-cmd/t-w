import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseUserRowsPort, loadAllRowsFrom } from './firebase';
import type { UserRowsPort } from './port';
import { createServerUserRowsPort } from './server';

/** 이 빌드의 판이 만든 «사용자 목록 읽기» 포트. */
export function useUserRowsPort(): UserRowsPort {
  const db = useDb();
  const api = useApi();
  const client = useQueryClient();
  return useMemo(
    () =>
      pickBackend<UserRowsPort>({
        firebase: () => createFirebaseUserRowsPort(api, loadAllRowsFrom(client, db)),
        api: () => createServerUserRowsPort(api),
      }),
    [db, api, client],
  );
}

export type { UserRowsPagedPort, UserRowsPort, UserRowsServerPort, UserServerPage } from './port';
