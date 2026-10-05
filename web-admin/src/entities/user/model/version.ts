import type { UserRow } from './userRow';

// 앱은 0.10.3 부터 계정 요약에 버전을 올린다 — 계정은 있는데 버전이 없으면 그보다 옛 앱이다.
export const OLD_VER_LABEL = '0.10.2 이하';

const VER_MAX = 20;

/** 앱이 올린 버전 문자열만 믿는다(규칙과 같은 20자). 아니면 null. */
export function cleanVer(v: unknown): string | null {
  return typeof v === 'string' && v && v.length <= VER_MAX ? v : null;
}

/** 목록 · 상세에 보일 글자. 계정이 없는 사람은 계정 요약을 안 올려 버전을 알 수 없다. */
export function verLabel(row: Pick<UserRow, 'ver' | 'hasAccount'>): string {
  if (row.ver) return row.ver;
  return row.hasAccount ? OLD_VER_LABEL : '—';
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

export const ACTIVE_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/**
 * 최근 days 일 안에 앱을 켠(계정 요약을 올린) 사람을 버전별로 센다 — 큰 버전부터, 기록 없음은 맨 뒤.
 * 계정이 없는 사람은 lastSeen 이 0 이라 저절로 빠진다.
 */
export function versionCounts(rows: UserRow[], now: number, days = ACTIVE_DAYS): VersionCount[] {
  const since = now - days * DAY;
  const counts = new Map<string | null, number>();
  let total = 0;
  for (const row of rows) {
    if (!row.hasAccount || row.lastSeen < since) continue;
    counts.set(row.ver, (counts.get(row.ver) ?? 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .map(([ver, count]) => ({ ver, count, share: count / total }))
    .sort((a, b) => (a.ver === null ? 1 : b.ver === null ? -1 : compareVerDesc(a.ver, b.ver)));
}

/** 버전 칩으로 좁힌다. null = 버전 기록 없는 계정(계정 없는 사람은 버전을 알 수 없어 빠진다). */
export function matchesVer(row: UserRow, ver: string | null): boolean {
  return ver === null ? row.hasAccount && !row.ver : row.ver === ver;
}
