import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { pickBackend, useApi, useDb } from '@/shared/api';
import { createFirebaseLicensePort } from './firebase';
import type { LicensePort } from './port';
import { createServerLicensePort } from './server';

/** 이 빌드의 판이 만든 «라이선스 키 읽기» 포트. */
export function useLicensePort(): LicensePort {
  const db = useDb();
  const api = useApi();
  const client = useQueryClient();
  return useMemo(
    () =>
      pickBackend<LicensePort>({
        firebase: () => createFirebaseLicensePort(db, api, client),
        api: () => createServerLicensePort(api),
      }),
    [db, api, client],
  );
}

export type { LicensePort } from './port';
