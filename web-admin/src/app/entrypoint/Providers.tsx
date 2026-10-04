import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DbProvider, queryClient, type Db } from '@/shared/api';
import { ToastProvider } from '@/shared/ui';

export function Providers({ db, children }: { db: Db; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DbProvider db={db}>
        <ToastProvider>{children}</ToastProvider>
      </DbProvider>
    </QueryClientProvider>
  );
}
