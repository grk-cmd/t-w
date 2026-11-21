// DB 모양은 앱(app/parts/firebase-init.js)과 같아야 한다 — 앱이 이 모양으로 키를 검증한다.
export interface License {
  valid: boolean;
  note?: string;
  createdAt?: number;
  redeemedAt?: number | null;
  revokedAt?: number;
}

export type LicenseStatus = 'unused' | 'used' | 'revoked';

export const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O, 1/I 제외 — 앱 _genLicenseKey 와 같다
export const NOTE_MAX = 100; // 규칙 licenses/$key .validate

// 32 는 2^32 를 나누므로 나머지 연산에 치우침이 없다.
function randomIndex(n: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

export function genLicenseKey(pick: (n: number) => number = randomIndex): string {
  const segment = () => Array.from({ length: 4 }, () => KEY_CHARS[pick(KEY_CHARS.length)]).join('');
  return [segment(), segment(), segment(), segment()].join('-');
}

export function licenseStatus(license: License | null): LicenseStatus {
  if (!license || license.valid === false) return 'revoked';
  return license.redeemedAt ? 'used' : 'unused';
}

export interface LicenseCounts {
  total: number;
  valid: number;
  used: number;
  unused: number;
  revoked: number;
}

// 앱 통계는 usedBy 로 세는데 그 필드를 쓰는 곳이 없어 늘 0 이다. 사용 여부는 redeemedAt 에만 남는다.
export function countLicenses(all: Record<string, License>): LicenseCounts {
  const counts: LicenseCounts = { total: 0, valid: 0, used: 0, unused: 0, revoked: 0 };
  for (const license of Object.values(all)) {
    const status = licenseStatus(license);
    counts.total++;
    counts[status]++;
    if (status !== 'revoked') counts.valid++;
  }
  return counts;
}

// 키는 무작위라 키 순서가 발급 순서가 아니다 — 최근 발급한 것부터.
export function filterLicenses(all: Record<string, License>, search: string): [string, License][] {
  const needle = search.trim().toLowerCase();
  return Object.entries(all)
    .filter(
      ([key, d]) =>
        !needle || key.toLowerCase().includes(needle) || (d.note ?? '').toLowerCase().includes(needle),
    )
    .sort(([, a], [, b]) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}
