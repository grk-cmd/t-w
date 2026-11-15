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
 * 여러 명 지급의 결과. `null` 인 칸은 이 판이 세지 않는 값이다(API 판에서 «전체» 는 서버가 한 번에 처리해
 * 바뀐 사람 수만 알려 준다) — 0 으로 보이지 않게 화면이 «모름» 으로 다룬다.
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
  total: number | null;
  /** 0 장으로 바꾼 사람. */
  revoked: number;
  /** 거둔 장수의 합. 서버가 합을 알려 주지 않는 API 판은 null. */
  taken: number | null;
  /** 초대권 칸이 없거나 이미 0 장 이하인 사람. */
  skipped: number | null;
  failed: number;
  stopped: boolean;
}
