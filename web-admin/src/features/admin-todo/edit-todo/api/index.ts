import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseEditTodoPort } from './firebase';
import type { EditTodoPort } from './port';

/** 이 빌드의 판이 만든 «할 일 쓰기» 포트. */
export function useEditTodoPort(): EditTodoPort {
  const db = useDb();
  return useMemo(() => createFirebaseEditTodoPort(db), [db]);
}

export type { EditTodoPort } from './port';
