import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseUpdateNoticePort } from './firebase';
import type { UpdateNoticePort } from './port';
import { createServerUpdateNoticePort } from './server';

/** 이 빌드의 판이 만든 «업데이트 공지» 포트. */
export function useUpdateNoticePort(): UpdateNoticePort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<UpdateNoticePort>({
        firebase: () => createFirebaseUpdateNoticePort(db),
        api: () => createServerUpdateNoticePort(api),
      }),
    [db, api],
  );
}

export type { UpdateNoticePort } from './port';
