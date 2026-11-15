import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseAnnouncePort } from './firebase';
import type { AnnouncePort } from './port';
import { createServerAnnouncePort } from './server';

/** 이 빌드의 판이 만든 «상단 공지» 포트. */
export function useAnnouncePort(): AnnouncePort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<AnnouncePort>({
        firebase: () => createFirebaseAnnouncePort(db),
        api: () => createServerAnnouncePort(api),
      }),
    [db, api],
  );
}

export type { AnnouncePort } from './port';
