import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseCatalogPort } from './firebase';
import type { CatalogPort } from './port';
import { createServerCatalogPort } from './server';

/** 이 빌드의 판이 만든 «카탈로그 읽기» 포트. */
export function useCatalogPort(): CatalogPort {
  const db = useDb();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<CatalogPort>({
        firebase: () => createFirebaseCatalogPort(db),
        api: () => createServerCatalogPort(api),
      }),
    [db, api],
  );
}

export type { CatalogPort } from './port';
