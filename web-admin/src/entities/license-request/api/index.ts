import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseLicenseRequestPort } from './firebase';
import type { LicenseRequestPort } from './port';
import { createServerLicenseRequestPort } from './server';

/** 이 빌드의 판이 만든 «라이선스 요청» 포트. */
export function useLicenseRequestPort(): LicenseRequestPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<LicenseRequestPort>({
        firebase: () => createFirebaseLicenseRequestPort(db),
        api: () => createServerLicenseRequestPort(),
      }),
    [db],
  );
}

export type { LicenseRequestPort } from './port';
