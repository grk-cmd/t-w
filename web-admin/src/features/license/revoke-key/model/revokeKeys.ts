import type { LicenseStatus } from '@/entities/license';

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
