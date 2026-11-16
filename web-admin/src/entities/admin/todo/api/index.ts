import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseTodoPort } from './firebase';
import type { TodoPort } from './port';

/** 이 빌드의 판이 만든 «관리자 할 일 읽기» 포트. */
export function useTodoPort(): TodoPort {
  const db = useDb();
  return useMemo(() => createFirebaseTodoPort(db), [db]);
}

export type { TodoPort } from './port';
