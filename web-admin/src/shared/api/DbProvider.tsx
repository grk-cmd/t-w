import type { ReactNode } from 'react';
import type { Db } from './db';
import type { Files } from './files';
import { FilesContext } from './useFiles';
import { DbContext } from './useDb';

export function DbProvider({ db, files, children }: { db: Db; files: Files; children: ReactNode }) {
  return (
    <DbContext.Provider value={db}>
      <FilesContext.Provider value={files}>{children}</FilesContext.Provider>
    </DbContext.Provider>
  );
}
