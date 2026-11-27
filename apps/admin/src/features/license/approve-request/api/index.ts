import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseApproveRequestPort } from './firebase';
import type { ApproveRequestPort } from './port';
import { createServerApproveRequestPort } from './server';

/** 이 빌드의 판이 만든 «요청 승인 · 거절» 포트. */
export function useApproveRequestPort(): ApproveRequestPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<ApproveRequestPort>({
        firebase: () => createFirebaseApproveRequestPort(db),
        api: () => createServerApproveRequestPort(api),
      }),
    [db, api],
  );
}

export type { ApproveRequestPort } from './port';
