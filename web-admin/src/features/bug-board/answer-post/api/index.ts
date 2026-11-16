import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseAnswerPostPort } from './firebase';
import type { AnswerPostPort } from './port';
import { createServerAnswerPostPort } from './server';

/** 이 빌드의 판이 만든 «답변 등록» 포트. */
export function useAnswerPostPort(): AnswerPostPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<AnswerPostPort>({
        firebase: () => createFirebaseAnswerPostPort(db),
        api: () => createServerAnswerPostPort(api),
      }),
    [db, api],
  );
}

export type { AnswerPostPort } from './port';
