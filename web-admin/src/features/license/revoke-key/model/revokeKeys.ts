import { removeLicensesWrite, revokeLicensesWrite, type LicenseStatus } from '@/entities/license';
import type { Db } from '@/shared/api';

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

// 관리자만 쓰는 경로라 한 묶음으로 보낸다 — 규칙에 하나라도 막히면 아무것도 바뀌지 않는다.
export async function revokeKeys(db: Db, keys: readonly string[]): Promise<number> {
  if (keys.length) await db.commit(revokeLicensesWrite(db, keys));
  return keys.length;
}

export async function removeKeys(db: Db, keys: readonly string[]): Promise<number> {
  if (keys.length) await db.commit(removeLicensesWrite(keys));
  return keys.length;
}
