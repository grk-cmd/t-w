// 호출형 함수 통로 — 기능 코드가 Functions SDK 를 직접 부르지 않게 한다. 테스트에서는 가짜를 넣는다.
export interface Functions {
  /** 이름으로 부르고 함수가 돌려준 값만 받는다. 실패하면 code 가 «functions/…» 인 오류를 던진다. */
  call<T>(name: string, data: unknown): Promise<T>;
}

// functions/index.js 의 setGlobalOptions 지역과 같아야 한다.
export const FUNCTIONS_REGION = 'asia-southeast1';

/**
 * 함수가 HttpsError 로 보낸 한국어 문구는 그대로 보여 준다. 배포 전 · 연결 실패처럼 SDK 가 만든 영어 문구(internal 등)는
 * 대신 fallback 을 쓴다.
 */
export function callErrorMessage(error: unknown, fallback: string): string {
  const e = error as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  const message = typeof e?.message === 'string' ? e.message : '';
  return code.startsWith('functions/') && /[가-힣]/.test(message) ? message : fallback;
}
