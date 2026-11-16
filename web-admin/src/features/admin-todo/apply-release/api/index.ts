import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseApplyReleasePort } from './firebase';
import type { ApplyReleasePort } from './port';

/** 이 빌드의 판이 만든 «릴리스 반영» 포트. */
export function useApplyReleasePort(): ApplyReleasePort {
  const db = useDb();
  return useMemo(() => createFirebaseApplyReleasePort(db), [db]);
}

export type { ApplyReleasePort } from './port';
