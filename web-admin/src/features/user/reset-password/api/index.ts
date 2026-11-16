import { useMemo } from 'react';
import { pickBackend, useApi, useFunctions } from '@/shared/api';
import { createFirebaseResetPasswordPort } from './firebase';
import type { ResetPasswordPort } from './port';

/** 이 빌드의 판이 만든 «임시 비밀번호» 포트. */
export function useResetPasswordPort(): ResetPasswordPort {
  const fns = useFunctions();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<ResetPasswordPort>({
        firebase: () => createFirebaseResetPasswordPort(fns),
        api: () => {
          throw new Error('API 판은 다음 커밋에서 채워요');
        },
      }),
    [fns, api],
  );
}

export type { ResetPasswordPort } from './port';
