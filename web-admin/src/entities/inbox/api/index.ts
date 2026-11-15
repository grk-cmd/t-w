import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseBroadcastPort } from './firebase';
import type { BroadcastPort } from './port';
import { createServerBroadcastPort } from './server';

/** 이 빌드의 판이 만든 «소식(공용 공지)» 포트. */
export function useBroadcastPort(): BroadcastPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<BroadcastPort>({
        firebase: () => createFirebaseBroadcastPort(db),
        api: () => createServerBroadcastPort(),
      }),
    [db],
  );
}

export type { BroadcastPage, BroadcastPort } from './port';
export { BROADCAST_PAGE } from './port';
