import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseEditAnswerPort } from './firebase';
import type { EditAnswerPort } from './port';

/** 이 빌드의 판이 만든 «답변 고치기» 포트. */
export function useEditAnswerPort(): EditAnswerPort {
  const db = useDb();
  return useMemo(() => createFirebaseEditAnswerPort(db), [db]);
}

export type { EditAnswerPort } from './port';
