export type TakeDownResult = { ok: true; fileDeleted: boolean } | { ok: false; reason: 'changed' };

/** 여러 명 «문제없음» 의 결과 — 비운 사람과 못 비운 사람(Firebase 판은 한 묶음이라 못 비운 사람이 없다). */
export interface DismissManyResult {
  dismissed: string[];
  failed: string[];
}
