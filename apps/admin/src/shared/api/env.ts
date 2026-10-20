import { createContext, useContext } from 'react';

/** 지금 붙은 Firebase 프로젝트 — 운영이면 위험 동작의 확인창에 표시를 붙인다. */
export interface Env {
  isProd: boolean;
  projectId: string;
}

export const EnvContext = createContext<Env | null>(null);

export function useEnv(): Env {
  const env = useContext(EnvContext);
  if (!env) throw new Error('Providers 바깥에서 useEnv 를 불렀어요');
  return env;
}

export const PROD_MARK = '[운영] ';

/** 운영이면 확인 문구 앞에 «[운영] » — dev 와 같은 창이라 누르기 전에 한 번 더 보게. */
export function withProdMark(env: Env, text: string): string {
  return env.isProd ? PROD_MARK + text : text;
}
