import { getAuth } from 'firebase/auth';

/**
 * 지금 로그인한 사람의 auth uid — 작업 기록 · 할 일에서 «내 것» 을 가린다. 로그인 전이면 null.
 * Firebase Auth 에서 바로 읽는다(두 판 모두 로그인은 Firebase Auth) — API 판도 RTDB 손잡이(`useDb`) 없이 쓴다.
 */
export function useMyUid(): string | null {
  return getAuth().currentUser?.uid ?? null;
}
