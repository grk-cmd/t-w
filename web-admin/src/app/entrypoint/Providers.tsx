import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  DbProvider,
  EnvContext,
  queryClient,
  type Api,
  type Db,
  type Env,
  type Files,
  type Functions,
} from '@/shared/api';
import { ToastProvider } from '@/shared/ui';

interface Props {
  db: Db;
  files: Files;
  fns: Functions;
  api: Api | null;
  env: Env;
  children: ReactNode;
}

export function Providers({ db, files, fns, api, env, children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <EnvContext.Provider value={env}>
        <DbProvider db={db} files={files} fns={fns} api={api}>
          <ToastProvider>{children}</ToastProvider>
        </DbProvider>
      </EnvContext.Provider>
    </QueryClientProvider>
  );
}
