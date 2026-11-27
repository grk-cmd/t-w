import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseGameConfigPort } from './firebase';
import type { GameConfigPort } from './port';
import { createServerGameConfigPort } from './server';

/** 이 빌드의 판이 만든 «게임 설정» 포트. */
export function useGameConfigPort(): GameConfigPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<GameConfigPort>({
        firebase: () => createFirebaseGameConfigPort(db),
        api: () => createServerGameConfigPort(api),
      }),
    [db, api],
  );
}

export type { GameConfigPort } from './port';
