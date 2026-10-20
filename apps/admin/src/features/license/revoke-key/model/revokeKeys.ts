import { removeLicensesWrite, revokeLicensesWrite, type LicenseStatus } from '@/entities/license';
import { countTarget, maskKey, withAudit, type AuditAction, type Db } from '@/shared/api';

export interface SelectedKey {
  key: string;
  status: LicenseStatus;
}

/** 회수할 키 — 이미 회수된 것은 뺀다(회수 시각을 덮지 않게). */
export const revokeTargets = (keys: readonly SelectedKey[]) =>
  keys.filter((k) => k.status !== 'revoked').map((k) => k.key);

/** 지울 수 있는 키 — 살아 있는 키는 회수부터 해야 해서 회수된 것만. */
export const removeTargets = (keys: readonly SelectedKey[]) =>
  keys.filter((k) => k.status === 'revoked').map((k) => k.key);

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
