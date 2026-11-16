/** `fileDeleted` — Firebase 판은 파일 삭제 결과를 안다. API 판은 서버가 그림 칸과 파일을 지워 `null`(웹이 모른다). */
export type TakeDownResult = { ok: true; fileDeleted: boolean | null } | { ok: false; reason: 'changed' };

/** 여러 명 «문제없음» 의 결과 — 비운 사람과 못 비운 사람(Firebase 판은 한 묶음이라 못 비운 사람이 없다). */
export interface DismissManyResult {
  dismissed: string[];
  failed: string[];
}
