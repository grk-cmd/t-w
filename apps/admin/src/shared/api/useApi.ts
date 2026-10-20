import { createContext, useContext } from 'react';
import type { Api } from './api';

/** null 이면 이 환경에는 API 가 없다(dev · e2e) — 기능은 예전 방식(RTDB)으로 읽는다. */
export const ApiContext = createContext<Api | null>(null);

export function useApi(): Api | null {
  return useContext(ApiContext);
}
