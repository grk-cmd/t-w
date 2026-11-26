// Storage 주인 문서(Firestore storageOwners/{코드}) 확인 · 채우기 — Storage 규칙이 사람 폴더의 주인을 이 문서로 본다.
// 서버가 가입 · 탈퇴 때 쓰고, 그 전부터 있던 계정은 채우기로 한 번 만든다. 글은 scripts/storage-owners.js report() 와 같다.
import { ADMIN_MEMO_MAX } from '@/shared/lib';

/** 서버 답 한 벌 — 확인 · 채우기가 같은 모양을 준다. */
export interface StorageOwnersResult {
  /** DB 계정 수 */
  users: number;
  /** Firestore 문서 수 */
  documents: number;
  /** 이번에 쓴 문서 수(확인은 0) */
  written: number;
  /** 문서가 없는 계정 수 */
  missing: number;
  /** DB 에 계정이 없는 문서 수 — 규칙에는 영향이 없다 */
  orphans: number;
  /** missing 0 이고 계정 수 = 문서 수 — 이때만 규칙을 올린다 */
  ready: boolean;
}

/** 채우기 메모 처음 값 — 규칙을 올리기 전에 한 번 돌린다. */
export const DEFAULT_BACKFILL_MEMO = '규칙 올리기 전';

export const BACKFILL_MEMO_MAX = ADMIN_MEMO_MAX;

/** 채우기는 계정 수만큼 Firestore 에 써서 수십 초 걸린다 — 기본 대기(8초)로는 끊긴다. */
export const STORAGE_OWNERS_TIMEOUT_MS = 120_000;

/** 결과 → 사람이 읽는 줄. ready 가 아니면 왜 아닌지 같이. */
export function storageOwnersReport(r: StorageOwnersResult): string[] {
  const lines = [
    `계정 ${r.users} · 문서 ${r.documents} · 이번에 쓴 것 ${r.written} · 빠진 계정 ${r.missing} · DB 에 없는 문서 ${r.orphans}`,
  ];
  if (r.ready) lines.push('✓ ready — 규칙을 올려도 돼요(firebase deploy --only firestore:rules,storage)');
  else
    lines.push(
      '✗ 아직 안 돼요 — ' +
        (r.missing
          ? `빠진 계정 ${r.missing} 명(채우기를 다시)`
          : `계정 수와 문서 수가 달라요(${r.users} ≠ ${r.documents})`),
    );
  if (r.orphans)
    lines.push(
      `(DB 에 없는 문서 ${r.orphans} 개 — 가입 도중 끊긴 코드 · 막 지운 계정. 규칙에는 영향이 없어요)`,
    );
  return lines;
}
