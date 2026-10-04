// 사용자 한 줄은 계정 요약 · 친구코드 명단 · 발급된 키를 맞춰 본 결과라 두 entity 를 @x 통로로 함께 쓴다.
import type { AccountSnap } from '@/entities/account/@x/user';
import { licenseStatus, type License, type LicenseStatus } from '@/entities/license/@x/user';

export type UserLicense = LicenseStatus | 'none' | 'unknown';

export interface UserRow {
  userCode: string;
  name: string | null;
  friendCode: string | null;
  license: string | null;
  licenseState: UserLicense;
  hasAccount: boolean;
  lastSeen: number;
  focusTotalSec: number;
}

// 앱은 이름을 안 정한 사람에게 이 글자를 실제 이름처럼 저장한다 — 이름이 없는 것으로 본다.
const NO_NAME = '(이름 없음)';

export function realName(name: string | null | undefined): string | null {
  const n = name?.trim();
  return n && n !== NO_NAME ? n : null;
}

// 계정 요약(accountSnap)이 있으면 그걸 쓰고, 없는 사용자는 친구코드 명단에서만 잡힌다(이름 · 키를 모름).
// 친구코드가 바뀐 사용자는 코드가 여럿일 수 있다 — 사용자코드로 한 줄로 합친다.
export function buildUserRows(
  accounts: Record<string, AccountSnap>,
  friendCodes: Record<string, { userId?: string }>,
  licenses: Record<string, License>,
): UserRow[] {
  const rows = new Map<string, UserRow>();

  for (const [userCode, snap] of Object.entries(accounts)) {
    const license = snap.license?.trim().toUpperCase() || null;
    rows.set(userCode, {
      userCode,
      name: realName(snap.name),
      friendCode: snap.friendCode ?? null,
      license,
      licenseState: !license ? 'none' : licenses[license] ? licenseStatus(licenses[license]) : 'unknown',
      hasAccount: true,
      lastSeen: snap.ts ?? 0,
      focusTotalSec: snap.focusTotalSec ?? 0,
    });
  }

  for (const [code, entry] of Object.entries(friendCodes)) {
    const userCode = entry?.userId;
    if (!userCode || rows.has(userCode)) continue;
    rows.set(userCode, {
      userCode,
      name: null,
      friendCode: code,
      license: null,
      licenseState: 'none',
      hasAccount: false,
      lastSeen: 0,
      focusTotalSec: 0,
    });
  }

  return [...rows.values()].sort((a, b) => b.lastSeen - a.lastSeen);
}
