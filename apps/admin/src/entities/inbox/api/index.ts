import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseBroadcastPort } from './firebase';
import type { BroadcastPort } from './port';
import { createServerBroadcastPort } from './server';

/** 이 빌드의 판이 만든 «소식(공용 공지)» 포트. */
export function useBroadcastPort(): BroadcastPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<BroadcastPort>({
        firebase: () => createFirebaseBroadcastPort(db),
        api: () => createServerBroadcastPort(api),
      }),
    [db, api],
  );
}

export type { BroadcastPage, BroadcastPort } from './port';
export { BROADCAST_PAGE } from './port';
