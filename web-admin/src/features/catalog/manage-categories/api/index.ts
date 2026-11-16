import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseManageCategoriesPort } from './firebase';
import type { ManageCategoriesPort } from './port';
import { createServerManageCategoriesPort } from './server';

/** 이 빌드의 판이 만든 «카테고리 고치기» 포트. */
export function useManageCategoriesPort(): ManageCategoriesPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<ManageCategoriesPort>({
        firebase: () => createFirebaseManageCategoriesPort(db),
        api: () => createServerManageCategoriesPort(api),
      }),
    [db, api],
  );
}

export type { ManageCategoriesPort } from './port';
