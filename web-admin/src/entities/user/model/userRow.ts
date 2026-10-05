// 사용자 한 줄은 계정 요약 · 친구코드 명단 · 발급된 키를 맞춰 본 결과라 두 entity 를 @x 통로로 함께 쓴다.
import type { AccountSnap } from '@/entities/account/@x/user';
import { licenseStatus, type License, type LicenseStatus } from '@/entities/license/@x/user';
import { cleanVer } from './version';

export type UserLicense = LicenseStatus | 'none' | 'unknown';

// 사용자 쪽에서 보면 아직 안 쓴(unused) 키도 쥐고 있는 것이라 «사용 중» 으로 묶는다.
export const LICENSE_LABEL: Record<UserLicense, string> = {
  used: '사용 중',
  unused: '사용 중',
  revoked: '회수됨',
  unknown: '없는 키',
  none: '—',
};

/** 회수됐거나 발급 목록에 없는 키 — 경고 색으로 보인다. */
export const isBadLicense = (state: UserLicense) => state === 'revoked' || state === 'unknown';

export interface UserRow {
  userCode: string;
  name: string | null;
  friendCode: string | null;
  license: string | null;
  licenseState: UserLicense;
  hasAccount: boolean;
  lastSeen: number;
  focusTotalSec: number;
  /** 계정 요약의 앱 버전. 없으면 null — 옛 앱이거나 계정이 없다. */
  ver: string | null;
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
      ver: cleanVer(snap.ver),
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
      ver: null,
    });
  }

  return [...rows.values()].sort((a, b) => b.lastSeen - a.lastSeen);
}

/** 키 → 그 키를 쓰는 사람 수. 계정 요약에 적힌 키만 센다 — 계정 없는 사람은 키를 모른다. */
export function licenseUseCounts(rows: UserRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { license } of rows) {
    if (license) counts.set(license, (counts.get(license) ?? 0) + 1);
  }
  return counts;
}

/** 같은 키를 쓰는 다른 사람들(본인 빼고). 목록 줄과 같은 정규화된 키로 맞춘다. */
export function sameLicenseUsers(rows: UserRow[], row: UserRow): UserRow[] {
  if (!row.license) return [];
  return rows.filter((r) => r.license === row.license && r.userCode !== row.userCode);
}
