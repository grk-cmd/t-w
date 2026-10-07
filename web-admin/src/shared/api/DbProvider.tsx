import type { ReactNode } from 'react';
import type { Db } from './db';
import type { Files } from './files';
import type { Functions } from './functions';
import { FilesContext } from './useFiles';
import { FunctionsContext } from './useFunctions';
import { DbContext } from './useDb';

interface Props {
  db: Db;
  files: Files;
  fns: Functions;
  children: ReactNode;
}

export function DbProvider({ db, files, fns, children }: Props) {
  return (
    <DbContext.Provider value={db}>
      <FilesContext.Provider value={files}>
        <FunctionsContext.Provider value={fns}>{children}</FunctionsContext.Provider>
      </FilesContext.Provider>
    </DbContext.Provider>
  );
}
