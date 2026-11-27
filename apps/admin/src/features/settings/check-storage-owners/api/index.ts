import { useMemo } from 'react';
import { pickBackend, useApi } from '@/shared/api';
import type { StorageOwnersPort } from './port';
import { createServerStorageOwnersPort } from './server';

/** API 판에만 있다 — Firebase 판은 null(카드를 그리지 않는다). */
export function useStorageOwnersPort(): StorageOwnersPort | null {
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<StorageOwnersPort | null>({
        firebase: () => null,
        api: () => createServerStorageOwnersPort(api),
      }),
    [api],
  );
}

export type { StorageOwnersPort } from './port';
