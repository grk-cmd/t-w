import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  DbProvider,
  EnvContext,
  queryClient,
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
  env: Env;
  children: ReactNode;
}

export function Providers({ db, files, fns, env, children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <EnvContext.Provider value={env}>
        <DbProvider db={db} files={files} fns={fns}>
          <ToastProvider>{children}</ToastProvider>
        </DbProvider>
      </EnvContext.Provider>
    </QueryClientProvider>
  );
}
