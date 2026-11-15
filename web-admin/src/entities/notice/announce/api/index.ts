import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseAnnouncePort } from './firebase';
import type { AnnouncePort } from './port';
import { createServerAnnouncePort } from './server';

/** 이 빌드의 판이 만든 «상단 공지» 포트. */
export function useAnnouncePort(): AnnouncePort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<AnnouncePort>({
        firebase: () => createFirebaseAnnouncePort(db),
        api: () => createServerAnnouncePort(),
      }),
    [db],
  );
}

export type { AnnouncePort } from './port';
