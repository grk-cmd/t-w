import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseUpdateNoticePort } from './firebase';
import type { UpdateNoticePort } from './port';
import { createServerUpdateNoticePort } from './server';

/** 이 빌드의 판이 만든 «업데이트 공지» 포트. */
export function useUpdateNoticePort(): UpdateNoticePort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<UpdateNoticePort>({
        firebase: () => createFirebaseUpdateNoticePort(db),
        api: () => createServerUpdateNoticePort(),
      }),
    [db],
  );
}

export type { UpdateNoticePort } from './port';
