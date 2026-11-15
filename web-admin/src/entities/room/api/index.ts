import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseRoomPort } from './firebase';
import type { RoomPort } from './port';
import { createServerRoomPort } from './server';

/** 이 빌드의 판이 만든 «방 설정» 포트. */
export function useRoomPort(): RoomPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<RoomPort>({
        firebase: () => createFirebaseRoomPort(db),
        api: () => createServerRoomPort(api),
      }),
    [db, api],
  );
}

export type { RoomPort } from './port';
