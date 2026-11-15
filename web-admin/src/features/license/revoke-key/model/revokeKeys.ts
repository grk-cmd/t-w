import type { LicenseRow } from '@/entities/license';

/** 고른 키 — 목록이 읽은 줄 그대로(API 판은 `licenseId` · `version` 이 실려 있다). */
export type SelectedKey = Pick<LicenseRow, 'key' | 'status' | 'licenseId' | 'version'>;

/** 회수할 키 — 이미 회수된 것은 뺀다(회수 시각을 덮지 않게). */
export const revokeTargets = (keys: readonly SelectedKey[]) => keys.filter((k) => k.status !== 'revoked');

/** 지울 수 있는 키 — 살아 있는 키는 회수부터 해야 해서 회수된 것만. */
export const removeTargets = (keys: readonly SelectedKey[]) => keys.filter((k) => k.status === 'revoked');
