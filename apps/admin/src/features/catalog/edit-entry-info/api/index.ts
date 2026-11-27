import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseEditEntryInfoPort } from './firebase';
import type { EditEntryInfoPort } from './port';
import { createServerEditEntryInfoPort } from './server';

/** 이 빌드의 판이 만든 «이름 · 아이콘 고치기» 포트. */
export function useEditEntryInfoPort(): EditEntryInfoPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<EditEntryInfoPort>({
        firebase: () => createFirebaseEditEntryInfoPort(db),
        api: () => createServerEditEntryInfoPort(api),
      }),
    [db, api],
  );
}

export type { EditEntryInfoPort } from './port';
