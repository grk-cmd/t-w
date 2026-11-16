import { useMemo } from 'react';
import { useDb } from '@/shared/api';
import { createFirebaseEditNotePort } from './firebase';
import type { EditNotePort } from './port';

/** 이 빌드의 판이 만든 «공용 메모 쓰기» 포트. */
export function useEditNotePort(): EditNotePort {
  const db = useDb();
  return useMemo(() => createFirebaseEditNotePort(db), [db]);
}

export type { EditNotePort } from './port';
