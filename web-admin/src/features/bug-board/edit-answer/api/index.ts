import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseEditAnswerPort } from './firebase';
import type { EditAnswerPort } from './port';
import { createServerEditAnswerPort } from './server';

/** 이 빌드의 판이 만든 «답변 고치기» 포트. */
export function useEditAnswerPort(): EditAnswerPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<EditAnswerPort>({
        firebase: () => createFirebaseEditAnswerPort(db),
        api: () => createServerEditAnswerPort(api),
      }),
    [db, api],
  );
}

export type { EditAnswerPort } from './port';
