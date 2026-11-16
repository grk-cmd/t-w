import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseDeleteAnswerPort } from './firebase';
import type { DeleteAnswerPort } from './port';
import { createServerDeleteAnswerPort } from './server';

/** 이 빌드의 판이 만든 «답변 지우기» 포트. */
export function useDeleteAnswerPort(): DeleteAnswerPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<DeleteAnswerPort>({
        firebase: () => createFirebaseDeleteAnswerPort(db),
        api: () => createServerDeleteAnswerPort(api),
      }),
    [db, api],
  );
}

export type { DeleteAnswerPort } from './port';
