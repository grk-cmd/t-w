// 기능 코드가 Firebase SDK 를 직접 부르지 않도록 둔 얇은 통로. 테스트에서는 가짜 Db 를 넣는다.
export interface Db {
  get<T>(path: string): Promise<T | null>;
  set(path: string, value: unknown): Promise<void>;
  update(path: string, value: Record<string, unknown>): Promise<void>;
  remove(path: string): Promise<void>;
  /** 여러 경로를 한 번에 쓴다 — 전부 되거나 전부 안 된다(규칙 검사도 한 묶음으로). 값이 null 이면 그 경로를 지운다. */
  commit(updates: Record<string, unknown>): Promise<void>;
  /** 구독 해제 함수를 돌려준다. */
  watch<T>(path: string, onChange: (value: T | null) => void, onError: (error: Error) => void): () => void;
  /** 첫 한 건만 읽어 본다 — 권한이 있는지 확인하는 용도. */
  probe(path: string): Promise<void>;
  /** 서버 시각 자리표시자. */
  now(): object;
  /** 이 기기 시계와 서버 시계의 차(ms). 서버 기준 «지금» = Date.now() + 이 값. */
  serverTimeOffset(): Promise<number>;
}

export function isPermissionDenied(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return /permission.denied/i.test(String(e?.code ?? e?.message ?? ''));
}
