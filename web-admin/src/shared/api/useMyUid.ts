import { useDb } from './useDb';

/** 지금 로그인한 사람의 auth uid — 작업 기록 · 할 일에서 «내 것» 을 가린다. 로그인 전이면 null. */
export function useMyUid(): string | null {
  return useDb().uid();
}
