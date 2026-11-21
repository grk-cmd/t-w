// 기능 코드가 Firebase SDK 를 직접 부르지 않도록 둔 얇은 통로. 테스트에서는 가짜 Db 를 넣는다.

/**
 * getLast 의 범위 — startAt 이상 · endBefore 미만만. endBefore 에 key 를 주면 값이 같을 때 키 이름으로 가른다
 * (같은 값이 쪽 경계에 걸려도 빠지거나 겹치지 않게).
 */
export interface LastRange {
  startAt?: number;
  endBefore?: { value: number; key?: string };
}

export interface Db {
  get<T>(path: string): Promise<T | null>;
  /**
   * 아래 항목을 child 값 순으로 세워 마지막 n 개만 받는다(orderByChild + limitToLast).
   * 규칙에 그 child 의 .indexOn 이 없으면 SDK 가 노드를 통째로 받아 걸러 내 내려받는 양이 줄지 않는다.
   */
  getLast<T>(path: string, child: string, n: number, range?: LastRange): Promise<Record<string, T>>;
  /** child 값이 value 인 항목만 받는다(orderByChild + equalTo). .indexOn 은 getLast 와 같다. */
  getEqual<T>(path: string, child: string, value: string | number | boolean): Promise<Record<string, T>>;
  set(path: string, value: unknown): Promise<void>;
  update(path: string, value: Record<string, unknown>): Promise<void>;
  remove(path: string): Promise<void>;
  /**
   * 한 경로를 읽고-고쳐-쓰기를 서버에서 한 번에 — 그 사이 다른 쓰기가 끼면 새 값으로 update 를 다시 부른다.
   * update 가 undefined 를 돌려주면 쓰지 않고 그만둔다(committed: false). value 는 끝났을 때의 값.
   */
  transaction<T>(
    path: string,
    update: (current: T | null) => T | undefined,
  ): Promise<{ committed: boolean; value: T | null }>;
  /** 여러 경로를 한 번에 쓴다 — 전부 되거나 전부 안 된다(규칙 검사도 한 묶음으로). 값이 null 이면 그 경로를 지운다. */
  commit(updates: Record<string, unknown>): Promise<void>;
  /** 바로 아래 키 이름만 받는다(REST ?shallow=true) — 값은 내려받지 않는다. 없으면 []. */
  shallowKeys(path: string): Promise<string[]>;
  /** 구독 해제 함수를 돌려준다. */
  watch<T>(path: string, onChange: (value: T | null) => void, onError: (error: Error) => void): () => void;
  /** 첫 한 건만 읽어 본다 — 권한이 있는지 확인하는 용도. */
  probe(path: string): Promise<void>;
  /** 서버 시각 자리표시자. */
  now(): object;
  /** 지금 로그인한 사람의 auth uid — 작업 기록의 by. 로그인 전이면 null. */
  uid(): string | null;
  /** 이 기기 시계와 서버 시계의 차(ms). 서버 기준 «지금» = Date.now() + 이 값. */
  serverTimeOffset(): Promise<number>;
}

/** 규칙에 .indexOn 이 없어 서버가 범위 조회(getLast · getEqual)를 거절했다. */
export function isIndexMissing(error: unknown): boolean {
  return /index not defined/i.test(String((error as { message?: string } | null)?.message ?? ''));
}

export function isPermissionDenied(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return /permission.denied/i.test(String(e?.code ?? e?.message ?? ''));
}
