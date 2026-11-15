import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseRevokeKeyPort } from './firebase';
import type { RevokeKeyPort } from './port';
import { createServerRevokeKeyPort } from './server';

/** 이 빌드의 판이 만든 «키 회수 · 삭제» 포트. */
export function useRevokeKeyPort(): RevokeKeyPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<RevokeKeyPort>({
        firebase: () => createFirebaseRevokeKeyPort(db),
        api: () => createServerRevokeKeyPort(),
      }),
    [db],
  );
}

export type { RevokeKeyPort } from './port';
