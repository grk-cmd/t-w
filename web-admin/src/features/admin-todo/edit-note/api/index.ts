import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseEditNotePort } from './firebase';
import type { EditNotePort } from './port';
import { createServerEditNotePort } from './server';

/** 이 빌드의 판이 만든 «공용 메모 쓰기» 포트. */
export function useEditNotePort(): EditNotePort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<EditNotePort>({
        firebase: () => createFirebaseEditNotePort(db),
        api: () => createServerEditNotePort(api),
      }),
    [db, api],
  );
}

export type { EditNotePort } from './port';
