import type { UserRow } from './userRow';

// 앱은 0.11.0 부터 계정 요약에 버전을 올린다 — 계정은 있는데 버전이 없으면 그보다 옛 앱이다.
export const OLD_VER_LABEL = '0.10.2 이하';

const VER_MAX = 20;

/** 앱이 올린 버전 문자열만 믿는다(규칙과 같은 20자). 아니면 null. */
export function cleanVer(v: unknown): string | null {
  return typeof v === 'string' && v && v.length <= VER_MAX ? v : null;
}

/** 지금 쓰는 앱 버전. ver 가 없고 old 면 버전을 안 남기는 옛 앱(0.10.2 이하), 둘 다 아니면 모름. */
export interface CurrentVer {
  ver: string | null;
  old: boolean;
}

// presence 는 모든 앱이 켤 때마다 쓰지만(0.11.0 부터 ver 포함) 계정 요약은 로그인된 기기가 켤 때만 다시 써서
// 옛 버전이 남는다 — presence 가 있으면 그것만 믿고, presence 를 못 받았을 때만 계정 요약을 본다.
export function currentVer(
  presence: { ver: string | null } | null,
  row: Pick<UserRow, 'ver' | 'hasAccount'>,
): CurrentVer {
  if (presence) return { ver: presence.ver, old: !presence.ver };
  return { ver: row.ver, old: !row.ver && row.hasAccount };
}

export function verLabel({ ver, old }: CurrentVer): string {
  return ver ?? (old ? OLD_VER_LABEL : '—');
}

function parts(v: string): { core: number[]; pre: string } {
  const [core, ...pre] = v.split('-');
  return { core: core.split('.').map((n) => Number.parseInt(n, 10) || 0), pre: pre.join('-') };
}

/** 큰 버전이 앞으로 가게 비교한다(0.10.3 > 0.10.3-beta.1 > 0.9.9). */
export function compareVerDesc(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.core.length, pb.core.length); i++) {
    const d = (pb.core[i] ?? 0) - (pa.core[i] ?? 0);
    if (d) return d;
  }
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return -1;
  if (!pb.pre) return 1;
  return pb.pre.localeCompare(pa.pre, undefined, { numeric: true });
}

export interface VersionCount {
  /** null = 버전 기록 없음(0.10.2 이하). */
  ver: string | null;
  count: number;
  /** 0~1 — 센 사람 전체 중 몫. */
  share: number;
}

/**
 * 계정마다 가장 최근 값으로 버전별로 센다(기간 없음 — 눌러서 나오는 목록과 같은 사람들) — 큰 버전부터, 기록 없음은 맨 뒤.
 * 계정이 없는 사람은 버전을 알 수 없어 빠진다.
 */
export function versionCounts(rows: UserRow[]): VersionCount[] {
  const counts = new Map<string | null, number>();
  for (const row of rows) {
    if (!row.hasAccount) continue;
    counts.set(row.ver, (counts.get(row.ver) ?? 0) + 1);
  }
  return toVersionCounts([...counts.entries()].map(([ver, count]) => ({ ver, count })));
}

/** 버전별 수 → 몫을 붙이고 큰 버전부터, 기록 없음은 맨 뒤. API 가 센 수도 같은 모양으로 맞춘다. */
export function toVersionCounts(list: readonly { ver: string | null; count: number }[]): VersionCount[] {
  const total = list.reduce((sum, v) => sum + v.count, 0);
  return list
    .filter((v) => v.count > 0)
    .map(({ ver, count }) => ({ ver, count, share: count / total }))
    .sort((a, b) => (a.ver === null ? 1 : b.ver === null ? -1 : compareVerDesc(a.ver, b.ver)));
}

/** 버전 칩으로 좁힌다. null = 버전 기록 없는 계정(계정 없는 사람은 버전을 알 수 없어 빠진다). */
export function matchesVer(row: UserRow, ver: string | null): boolean {
  return ver === null ? row.hasAccount && !row.ver : row.ver === ver;
}
