import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseRoomPort } from './firebase';
import type { RoomPort } from './port';
import { createServerRoomPort } from './server';

/** 이 빌드의 판이 만든 «방 설정» 포트. */
export function useRoomPort(): RoomPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<RoomPort>({
        firebase: () => createFirebaseRoomPort(db),
        api: () => createServerRoomPort(),
      }),
    [db],
  );
}

export type { RoomPort } from './port';
