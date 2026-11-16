import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseDeleteAnswerPort } from './firebase';
import type { DeleteAnswerPort } from './port';

/** 이 빌드의 판이 만든 «답변 지우기» 포트. */
export function useDeleteAnswerPort(): DeleteAnswerPort {
  const db = useDb();
  return useMemo(() => createFirebaseDeleteAnswerPort(db), [db]);
}

export type { DeleteAnswerPort } from './port';
