import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseCatalogPort } from './firebase';
import type { CatalogPort } from './port';

/** 이 빌드의 판이 만든 «카탈로그 읽기» 포트. */
export function useCatalogPort(): CatalogPort {
  const db = useDb();
  return useMemo(() => createFirebaseCatalogPort(db), [db]);
}

export type { CatalogPort } from './port';
