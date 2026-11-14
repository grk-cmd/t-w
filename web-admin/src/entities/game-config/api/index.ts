import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseGameConfigPort } from './firebase';
import type { GameConfigPort } from './port';
import { createServerGameConfigPort } from './server';

/** 이 빌드의 판이 만든 «게임 설정» 포트. */
export function useGameConfigPort(): GameConfigPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<GameConfigPort>({
        firebase: () => createFirebaseGameConfigPort(db),
        api: () => createServerGameConfigPort(),
      }),
    [db],
  );
}

export type { GameConfigPort } from './port';
