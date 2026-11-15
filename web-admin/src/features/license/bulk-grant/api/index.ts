import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { loadAllFrom } from '@/entities/license';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseBulkGrantPort } from './firebase';
import type { BulkGrantPort } from './port';
import { createServerBulkGrantPort } from './server';

/** 이 빌드의 판이 만든 «엑셀 일괄 발급» 포트. */
export function useBulkGrantPort(): BulkGrantPort {
  const db = useDb();
  const api = useApi();
  const client = useQueryClient();
  return useMemo(
    () =>
      pickBackend<BulkGrantPort>({
        firebase: () => createFirebaseBulkGrantPort(db, loadAllFrom(client, db)),
        api: () => createServerBulkGrantPort(api),
      }),
    [db, api, client],
  );
}

export type { BulkGrantPort } from './port';
