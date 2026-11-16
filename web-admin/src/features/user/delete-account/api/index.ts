import { useMemo } from 'react';
import { pickBackend, useApi, useFunctions } from '@/shared/api';
import { createFirebaseDeleteAccountPort } from './firebase';
import type { DeleteAccountPort } from './port';
import { createServerDeleteAccountPort } from './server';

/** 이 빌드의 판이 만든 «계정 삭제» 포트. */
export function useDeleteAccountPort(): DeleteAccountPort {
  const fns = useFunctions();
  const api = useApi();
  return useMemo(
    () =>
      pickBackend<DeleteAccountPort>({
        firebase: () => createFirebaseDeleteAccountPort(fns),
        api: () => createServerDeleteAccountPort(api),
      }),
    [fns, api],
  );
}

export type { DeleteAccountFunctionsPort, DeleteAccountPort, DeleteAccountServerPort } from './port';
