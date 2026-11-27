import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseTodoPort } from './firebase';
import type { TodoPort } from './port';
import { createServerTodoPort } from './server';

/** 이 빌드의 판이 만든 «관리자 할 일 읽기» 포트. */
export function useTodoPort(): TodoPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<TodoPort>({
        firebase: () => createFirebaseTodoPort(db),
        api: () => createServerTodoPort(api),
      }),
    [db, api],
  );
}

export type { TodoPort } from './port';
