import type { Db } from './db';

// 관리자가 «바꾼» 동작의 기록. 모양은 규칙 adminLog/$logId 를 따른다(at = 서버 시각 · by = 로그인 uid · 그 밖 칸 거절).
export const AUDIT_ROOT = 'adminLog';
export const AUDIT_TARGET_MAX = 60; // 규칙 target
export const AUDIT_DETAIL_MAX = 120; // 규칙 detail

/** «종류.동작» — 규칙이 영문자만 받는다(숫자 · 기호 안 됨). 화면 이름은 entities/admin-log 에. */
export const AUDIT_ACTIONS = [
  'license.issue',
  'license.grantCode',
  'license.revoke',
  'license.remove',
  'license.approve',
  'license.reject',
  'license.bulk',
  'license.secretRoom',
  'invite.grant',
  'invite.grantSelected',
  'invite.grantAll',
  'invite.codes',
  'report.takeDown',
  'report.dismiss',
  'notice.announce',
  'notice.announceClear',
  'notice.update',
  'notice.updateClear',
  'notice.bugReport',
  'notice.broadcast',
  'notice.pin',
  'notice.unpin',
  'notice.broadcastDelete',
  'settings.adBanner',
  'settings.unlockLevel',
  'settings.minRoomVer',
  'room.close',
  'room.closeAll',
  'room.cleanGhost',
  'catalog.categoryName',
  'catalog.delete',
  'catalog.reorder',
  'catalog.editInfo',
  'catalog.cleanGlb',
  'bug.answer',
  'bug.status',
  // 서버 함수(adminDeleteAccount)가 쓴다 — 웹은 이름만 보여 준다.
  'account.delete',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditRecord {
  at: number;
  by: string;
  action: string;
  target: string;
  detail?: string;
}

function auditId(): string {
  return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 키 원문은 기록에 남기지 않는다 — 첫 덩어리만(«ABCD-…»). 기록을 읽는 사람이 그 키를 쓸 수 없게. */
export function maskKey(key: string): string {
  return key.length > 4 ? `${key.slice(0, 4)}-…` : key;
}

/** 여러 대상을 한 줄로 — 앞 몇 개와 개수. */
export function countTarget(items: readonly string[], unit = '개', show = 3): string {
  const head = items.slice(0, show).join(', ');
  return items.length > show ? `${head} 외 ${items.length - show}${unit}` : head;
}

/** 기록 한 줄을 쓸 내용(경로 → 값). 로그인 uid 를 모르면 빈 묶음 — 규칙이 어차피 받지 않는다. */
export function auditEntry(
  db: Db,
  action: AuditAction,
  target: string,
  detail?: string,
  id = auditId(),
): Record<string, unknown> {
  const by = db.uid();
  if (!by) return {};
  const text = detail?.trim().slice(0, AUDIT_DETAIL_MAX);
  return {
    [`${AUDIT_ROOT}/${id}`]: {
      at: db.now(),
      by,
      action,
      target: target.slice(0, AUDIT_TARGET_MAX),
      ...(text ? { detail: text } : {}),
    },
  };
}

/**
 * 바꾸는 쓰기 묶음에 기록 한 줄을 얹는다 — 같은 db.commit 으로 보내면 «동작은 됐는데 기록이 없음» 이 생기지 않는다.
 * 바꿀 것이 없는 묶음(빈 객체)이면 기록도 붙이지 않는다.
 */
export function withAudit(
  db: Db,
  updates: Record<string, unknown>,
  action: AuditAction,
  target: string,
  detail?: string,
): Record<string, unknown> {
  if (!Object.keys(updates).length) return updates;
  return { ...updates, ...auditEntry(db, action, target, detail) };
}

/**
 * 묶을 수 없는 동작(트랜잭션 · Storage 삭제 · 여러 번 나눠 쓰기) 뒤에 따로 쓴다.
 * 기록이 실패해도 동작은 이미 끝났으니 실패로 만들지 않고 콘솔에만 남긴다.
 */
export async function auditAfter(
  db: Db,
  action: AuditAction,
  target: string,
  detail?: string,
): Promise<void> {
  try {
    const entry = auditEntry(db, action, target, detail);
    if (Object.keys(entry).length) await db.commit(entry);
  } catch (error) {
    console.warn('[adminLog] 작업 기록을 남기지 못했어요', action, error);
  }
}
