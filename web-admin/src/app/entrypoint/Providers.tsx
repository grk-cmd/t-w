import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DbProvider, queryClient, type Db, type Files } from '@/shared/api';
import { ToastProvider } from '@/shared/ui';

export function Providers({ db, files, children }: { db: Db; files: Files; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DbProvider db={db} files={files}>
        <ToastProvider>{children}</ToastProvider>
      </DbProvider>
    </QueryClientProvider>
  );
}
