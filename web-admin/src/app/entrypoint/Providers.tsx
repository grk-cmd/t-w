import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DbProvider, EnvContext, queryClient, type Db, type Env, type Files } from '@/shared/api';
import { ToastProvider } from '@/shared/ui';

interface Props {
  db: Db;
  files: Files;
  env: Env;
  children: ReactNode;
}

export function Providers({ db, files, env, children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <EnvContext.Provider value={env}>
        <DbProvider db={db} files={files}>
          <ToastProvider>{children}</ToastProvider>
        </DbProvider>
      </EnvContext.Provider>
    </QueryClientProvider>
  );
}
