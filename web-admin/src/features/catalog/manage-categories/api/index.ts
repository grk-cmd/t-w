import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseManageCategoriesPort } from './firebase';
import type { ManageCategoriesPort } from './port';

/** 이 빌드의 판이 만든 «카테고리 고치기» 포트. */
export function useManageCategoriesPort(): ManageCategoriesPort {
  const db = useDb();
  return useMemo(() => createFirebaseManageCategoriesPort(db), [db]);
}

export type { ManageCategoriesPort } from './port';
