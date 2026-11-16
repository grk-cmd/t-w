import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseAnswerPostPort } from './firebase';
import type { AnswerPostPort } from './port';

/** 이 빌드의 판이 만든 «답변 등록» 포트. */
export function useAnswerPostPort(): AnswerPostPort {
  const db = useDb();
  return useMemo(() => createFirebaseAnswerPostPort(db), [db]);
}

export type { AnswerPostPort } from './port';
