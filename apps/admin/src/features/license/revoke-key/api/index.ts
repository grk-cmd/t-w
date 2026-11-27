import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseRevokeKeyPort } from './firebase';
import type { RevokeKeyPort } from './port';
import { createServerRevokeKeyPort } from './server';

/** 이 빌드의 판이 만든 «키 회수 · 삭제» 포트. */
export function useRevokeKeyPort(): RevokeKeyPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<RevokeKeyPort>({
        firebase: () => createFirebaseRevokeKeyPort(db),
        api: () => createServerRevokeKeyPort(api),
      }),
    [db, api],
  );
}

export type { RevokeKeyPort } from './port';
