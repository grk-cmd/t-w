// Firebase 판 — 지금 코드 그대로: 키 회수 · 삭제를 한 묶음(기록 포함)으로 쓴다.
import { removeLicensesWrite, revokeLicensesWrite } from '@/entities/license';
import { countTarget, maskKey, withAudit, type AuditAction, type Db } from '@/shared/api';
import type { RevokeKeyPort } from './port';

// 한 개든 여러 개든 기록은 한 줄 — 키 원문 대신 첫 덩어리만.
function withKeysAudit(
  db: Db,
  updates: Record<string, unknown>,
  action: AuditAction,
  keys: readonly string[],
) {
  const masked = keys.map(maskKey);
  return keys.length === 1
    ? withAudit(db, updates, action, masked[0])
    : withAudit(db, updates, action, `${keys.length}개`, countTarget(masked));
}

// 관리자만 쓰는 경로라 한 묶음으로 보낸다 — 규칙에 하나라도 막히면 아무것도 바뀌지 않는다(기록도).
export async function revokeKeys(db: Db, keys: readonly string[]): Promise<number> {
  if (keys.length) await db.commit(withKeysAudit(db, revokeLicensesWrite(db, keys), 'license.revoke', keys));
  return keys.length;
}

export async function removeKeys(db: Db, keys: readonly string[]): Promise<number> {
  if (keys.length) await db.commit(withKeysAudit(db, removeLicensesWrite(keys), 'license.remove', keys));
  return keys.length;
}

export function createFirebaseRevokeKeyPort(db: Db): RevokeKeyPort {
  return {
    revoke: (rows) =>
      revokeKeys(
        db,
        rows.map((r) => r.key),
      ),
    remove: (rows) =>
      removeKeys(
        db,
        rows.map((r) => r.key),
      ),
  };
}
