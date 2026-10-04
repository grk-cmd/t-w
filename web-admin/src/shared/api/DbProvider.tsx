import type { ReactNode } from 'react';
import { DbContext } from './useDb';
import type { Db } from './db';

export function DbProvider({ db, children }: { db: Db; children: ReactNode }) {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}
