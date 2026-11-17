import type { AddInvitesResult } from '@/entities/invite';

/** 한 사람 지급의 결과 — 지급한 뒤 남은 장수, 또는 못 준 까닭. */
export type GrantInvitesResult = { ok: true; after: number } | Extract<AddInvitesResult, { ok: false }>;

/** friendCodes 는 코드 → 사용자라 코드를 바꾼 사람이 여럿 나온다 — 한 번씩만. */
export function uniqueUserIds(friendCodes: Record<string, { userId?: string }>): string[] {
  const uids = new Set<string>();
  for (const entry of Object.values(friendCodes)) if (entry?.userId) uids.add(entry.userId);
  return [...uids];
}

/**
 * 여러 명 지급의 결과. `null` 인 칸은 모르는 값이다(API 판에서 그 칸이 생기기 전에 적힌 요청 기록을
 * 같은 요청 번호로 다시 받으면 서버가 대상 수 · 건너뛴 수를 싣지 않는다) — 0 으로 보이지 않게 화면이 «모름» 으로 다룬다.
 */
export interface GrantAllResult {
  total: number | null;
  granted: number;
  /** 초대권 칸이 없거나 이미 상한인 사람. */
  skipped: number | null;
  failed: number;
  stopped: boolean;
}

/** 여러 명 지급의 범위 — 기록에서 «선택» 과 «전체» 를 가른다. */
export type GrantScope = 'selected' | 'all';

/** 지급 · 회수의 대상 — 전체이거나 고른 사람들(사용자코드). */
export type InviteTarget = { kind: 'all' } | { kind: 'picked'; uids: string[] };

export interface BatchOpts {
  onProgress?: (done: number, total: number) => void;
  shouldStop?: () => boolean;
  scope?: GrantScope;
}

export interface RevokeAllResult {
  total: number;
  /** 0 장으로 바꾼 사람. */
  revoked: number;
  /** 거둔 장수의 합. */
  taken: number;
  /** 초대권 칸이 없거나 이미 0 장 이하인 사람. */
  skipped: number;
  failed: number;
  stopped: boolean;
}

/** «전체 지급» 확인 단추 글자 — 대상 수를 못 읽었으면(null) 수를 지어내지 않고 그렇게 말한다. */
export function grantAllLabel(total: number | null, count: number, running: boolean): string {
  if (running) return '지급 중…';
  return total === null ? '대상 수 못 읽음' : `${total}명에게 ${count}장씩 지급`;
}

/** «전체 회수» 확인 단추 글자 — 대상 수를 못 읽었으면(null) 0명으로 보이지 않게 한다. */
export function revokeAllLabel(total: number | null, running: boolean): string {
  if (running) return '회수 중…';
  return total === null ? '대상 수 못 읽음' : `${total}명 초대권 0장으로`;
}
