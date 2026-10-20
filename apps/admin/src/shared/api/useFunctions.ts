import { createContext, useContext } from 'react';
import type { Functions } from './functions';

export const FunctionsContext = createContext<Functions | null>(null);

export function useFunctions(): Functions {
  const fns = useContext(FunctionsContext);
  if (!fns) throw new Error('FunctionsContext 바깥에서 useFunctions 를 불렀어요');
  return fns;
}
