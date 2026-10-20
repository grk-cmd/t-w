import type { ApiFallback } from '@/shared/api';
import { queryUsers, type UserQuery } from './userQuery';
import type { UserLicense, UserRow } from './userRow';
import { APP_VER_UNKNOWN, cleanVer, toVersionCounts, versionCounts, type VersionCount } from './version';

// 화면이 쓰는 모양 — API(읽기 사본)로 받든 예전 방식(RTDB 통째)으로 받든 같은 모양으로 맞춘다.

/** 어디서 읽었나. rtdb 면 왜 넘어왔는지(fallback): 이 환경에 API 가 없음 · API 에 닿지 못함. */
export type UserSource = { via: 'api' } | { via: 'rtdb'; fallback: UserFallback };
/** 예전 방식으로 읽은 까닭 — shared/api 의 ApiFallback 과 같은 값(viaApiOr 한 벌). */
export type UserFallback = ApiFallback;

export interface UserPageView {
  items: UserRow[];
  /** 맞춘 쪽(예전 방식은 끝 쪽을 넘으면 끝 쪽으로, API 는 요청한 쪽 그대로 — 빈 쪽). */
  page: number;
  pageCount: number;
  /** 조건에 맞는 사람 수. */
  total: number;
  source: UserSource;
}

export interface UserStatsView {
  /** 목록 전체 사람 수(계정 없는 사람 포함). */
  total: number;
  /** 계정의 버전별 수(기간 없음) — 큰 버전부터, 기록 없음은 맨 뒤. */
  versions: VersionCount[];
  /** 최근 7일 안에 앱을 켠 사람의 버전별 수(presence 마지막 접속 기준). 서버가 안 주면(예전 방식 · 옛 서버) null. */
  recent: VersionCount[] | null;
  /** 이 시각까지의 RTDB 변경은 반영됨(API 읽기 사본). 예전 방식이면 방금 받은 원본이라 null. */
  syncedAt: number | null;
  source: UserSource;
}

// ── API 응답 모양(t-w-server api/README.md «관리자 API» · /v1/admin/users) ──
export interface ApiUserRow {
  userCode: string;
  name: string | null;
  friendCode: string | null;
  license: string | null;
  licenseState: string;
  hasAccount: boolean;
  lastSeen: string | null;
  focusTotalSec: number;
  ver: string | null;
  licenseUsers: number;
}

export interface ApiUserPage {
  items: ApiUserRow[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface ApiUserStats {
  total: number;
  accounts: number;
  versions: { ver: string | null; count: number }[];
  recentVersions?: { ver: string | null; count: number }[];
  syncedAt: string | null;
  snapshotAt: string | null;
}

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

const STATES: readonly UserLicense[] = ['none', 'unused', 'used', 'revoked', 'unknown'];

export function rowFromApi(item: ApiUserRow): UserRow {
  return {
    userCode: item.userCode,
    name: item.name,
    friendCode: item.friendCode,
    license: item.license,
    // 모르는 상태(서버가 앞서 나간 판)면 키가 있으면 «없는 키» 처럼 경고로 보인다
    licenseState: STATES.includes(item.licenseState as UserLicense)
      ? (item.licenseState as UserLicense)
      : item.license
        ? 'unknown'
        : 'none',
    hasAccount: item.hasAccount,
    lastSeen: ms(item.lastSeen) ?? 0,
    focusTotalSec: item.focusTotalSec ?? 0,
    ver: cleanVer(item.ver),
    licenseUsers: item.licenseUsers ?? 0,
  };
}

export function pageFromApi(p: ApiUserPage): UserPageView {
  return {
    items: p.items.map(rowFromApi),
    page: p.page,
    pageCount: Math.max(1, p.totalPages),
    total: p.total,
    source: { via: 'api' },
  };
}

// 서버는 presence 의 ver 를 그대로 센다 — «모름» 은 버전도 옛 앱(null)도 아니라 칩에서 뺀다.
// cleanVer 로 null 이 되게 두면 «0.10.2 이하» 칩에 섞이고 같은 null 칩이 둘 생긴다.
const apiVerCounts = (list: readonly { ver: string | null; count: number }[]) =>
  toVersionCounts(
    list.filter((v) => v.ver !== APP_VER_UNKNOWN).map((v) => ({ ver: cleanVer(v.ver), count: v.count })),
  );

export function statsFromApi(s: ApiUserStats): UserStatsView {
  return {
    total: s.total,
    versions: apiVerCounts(s.versions),
    recent: s.recentVersions ? apiVerCounts(s.recentVersions) : null,
    syncedAt: ms(s.syncedAt),
    source: { via: 'api' },
  };
}

/** 예전 방식 — 통째로 받은 줄을 화면에서 거르고 쪽으로 자른다. */
export function pageFromRows(
  all: UserRow[],
  query: UserQuery,
  page: number,
  size: number,
  fallback: UserFallback,
): UserPageView {
  const rows = queryUsers(all, query);
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const at = Math.min(Math.max(page, 1), pageCount);
  return {
    items: rows.slice((at - 1) * size, at * size),
    page: at,
    pageCount,
    total: rows.length,
    source: { via: 'rtdb', fallback },
  };
}

export function statsFromRows(all: UserRow[], fallback: UserFallback): UserStatsView {
  return {
    total: all.length,
    versions: versionCounts(all),
    recent: null,
    syncedAt: null,
    source: { via: 'rtdb', fallback },
  };
}

const clock = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** 어디서 읽었는지 작게 붙일 말. API 면 기준 시각(사본이 몇 초 늦을 수 있어서), 예전 방식이면 왜 넘어왔는지. */
export function userSourceNote(source: UserSource, syncedAt: number | null): string {
  if (source.via === 'api')
    return syncedAt ? `기준 ${clock(syncedAt)}` : '기준 시각 없음 — 서버 사본을 아직 맞추지 못함';
  return source.fallback === 'no-api'
    ? 'API 없음(dev) — 예전 방식으로 읽는 중'
    : 'API 연결 안 됨 — 예전 방식으로 읽는 중';
}
