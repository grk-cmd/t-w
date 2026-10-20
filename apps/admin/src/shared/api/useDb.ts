import { createContext, useContext } from 'react';
import type { Db } from './db';

export const DbContext = createContext<Db | null>(null);

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('DbProvider 바깥에서 useDb 를 불렀어요');
  return db;
}
