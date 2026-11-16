import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseEditTodoPort } from './firebase';
import type { EditTodoPort } from './port';
import { createServerEditTodoPort } from './server';

/** 이 빌드의 판이 만든 «할 일 쓰기» 포트. */
export function useEditTodoPort(): EditTodoPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<EditTodoPort>({
        firebase: () => createFirebaseEditTodoPort(db),
        api: () => createServerEditTodoPort(api),
      }),
    [db, api],
  );
}

export type { EditTodoPort } from './port';
