/**
 * 읽은 값 + 서버가 그 값에 붙인 번호. 화면이 캐시에 이 모양 그대로 들고 있다가 저장할 때 읽은 번호를 돌려준다 —
 * 포트는 «마지막에 본 번호» 를 따로 기억하지 않는다. 그 사이 다른 곳이 고쳤으면 서버가 409 → `conflict` → 화면이 다시 받는다.
 */
export interface Versioned<T> {
  value: T;
  /** 서버가 준 번호 — 저장에 그대로 싣는다. Firebase 판은 번호가 없어 0 이고 쓰지 않는다(마지막 쓰기가 이긴다). */
  version: number;
  /** API 판 설정 키의 통째 값 · 기본값 — 칸이 여럿인 키는 고친 칸만 이 위에 얹어 통째로 쓴다. Firebase 판은 없다. */
  raw?: { effective: unknown; defaults: unknown };
}

/** Firebase 판 값에 붙이는 «번호 없음». */
export const unversioned = <T>(value: T): Versioned<T> => ({ value, version: 0 });
