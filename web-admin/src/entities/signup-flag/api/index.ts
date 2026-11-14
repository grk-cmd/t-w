import { useMemo } from 'react';
import { pickBackend, useDb } from '@/shared/api';
import { createFirebaseSignupFlagPort } from './firebase';
import type { SignupFlagPort } from './port';
import { createServerSignupFlagPort } from './server';

/** 이 빌드의 판이 만든 «가입 스위치» 포트. */
export function useSignupFlagPort(): SignupFlagPort {
  const db = useDb();
  return useMemo(
    () =>
      pickBackend<SignupFlagPort>({
        firebase: () => createFirebaseSignupFlagPort(db),
        api: () => createServerSignupFlagPort(),
      }),
    [db],
  );
}

export type { SignupFlagPort } from './port';
