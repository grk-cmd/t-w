import type { ReactNode } from 'react';
import type { Api } from './api';
import type { Db } from './db';
import type { Files } from './files';
import type { Functions } from './functions';
import { ApiContext } from './useApi';
import { FilesContext } from './useFiles';
import { FunctionsContext } from './useFunctions';
import { DbContext } from './useDb';

interface Props {
  db: Db;
  files: Files;
  fns: Functions;
  api?: Api | null;
  children: ReactNode;
}

export function DbProvider({ db, files, fns, api = null, children }: Props) {
  return (
    <DbContext.Provider value={db}>
      <FilesContext.Provider value={files}>
        <FunctionsContext.Provider value={fns}>
          <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
        </FunctionsContext.Provider>
      </FilesContext.Provider>
    </DbContext.Provider>
  );
}
