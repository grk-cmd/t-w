import { useMemo } from 'react';
import { useLicensePort } from '@/entities/license';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseBulkGrantPort } from './firebase';
import type { BulkGrantPort } from './port';
import { createServerBulkGrantPort } from './server';

/** 이 빌드의 판이 만든 «엑셀 일괄 발급» 포트. */
export function useBulkGrantPort(): BulkGrantPort {
  const db = useDb();
  const licenses = useLicensePort();
  return useMemo(
    () =>
      pickBackend<BulkGrantPort>({
        firebase: () => createFirebaseBulkGrantPort(db, licenses.all),
        api: () => createServerBulkGrantPort(),
      }),
    [db, licenses],
  );
}

export type { BulkGrantPort } from './port';
