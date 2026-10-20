import { createContext, useContext } from 'react';
import type { Files } from './files';

export const FilesContext = createContext<Files | null>(null);

export function useFiles(): Files {
  const files = useContext(FilesContext);
  if (!files) throw new Error('FilesContext 바깥에서 useFiles 를 불렀어요');
  return files;
}
