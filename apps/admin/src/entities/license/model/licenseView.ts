import type { ApiFallback } from '@/shared/api';
import {
  countLicenses,
  filterLicenses,
  licenseStatus,
  type License,
  type LicenseCounts,
  type LicenseStatus,
} from './license';

// 화면이 쓰는 모양 — API(읽기 사본)로 받든 예전 방식(RTDB 통째)으로 받든 같은 모양으로 맞춘다.

/** 어디서 읽었나. rtdb 면 왜 넘어왔는지(fallback): 이 환경에 API 가 없음 · API 에 닿지 못함. */
export type LicenseSource = { via: 'api' } | { via: 'rtdb'; fallback: LicenseFallback };
export type LicenseFallback = ApiFallback;

export interface LicenseRow {
  key: string;
  status: LicenseStatus;
  note: string;
  createdAt?: number;
  redeemedAt?: number;
  revokedAt?: number;
}

export interface LicenseStatsView {
  counts: LicenseCounts;
  /** 이 시각까지의 RTDB 변경은 반영됨(API 읽기 사본). 예전 방식이면 방금 받은 원본이라 null. */
  syncedAt: number | null;
  source: LicenseSource;
}

export interface LicensePageQuery {
  /** 1부터. */
  page: number;
  size: number;
  /** 검색어(앞뒤 공백은 무시). */
  q: string;
}

export interface LicensePageView {
  items: LicenseRow[];
  /** 서버가 맞춘 쪽(범위를 넘으면 예전 방식은 끝 쪽으로, API 는 요청한 쪽 그대로 — 빈 쪽). */
  page: number;
  pageCount: number;
  /** 검색 뒤 개수. */
  total: number;
  source: LicenseSource;
}

/** 서버 검색어 상한(LicenseRequest.MAX_QUERY) — 넘기면 400 이라 미리 자른다. */
export const LICENSE_QUERY_MAX = 100;

// ── API 응답 모양(t-w-server api/README.md «관리자 API») ──
export interface ApiLicenseStats {
  total: number;
  valid: number;
  used: number;
  unused: number;
  revoked: number;
  holders: number;
  syncedAt: string | null;
  snapshotAt: string | null;
}

export interface ApiLicenseItem {
  key: string;
  status: string;
  note: string | null;
  createdAt: string | null;
  redeemedAt: string | null;
  revokedAt: string | null;
  users: string[];
}

export interface ApiLicensePage {
  items: ApiLicenseItem[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

const ms = (iso: string | null | undefined): number | undefined => {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : t;
};

const STATUSES: readonly LicenseStatus[] = ['unused', 'used', 'revoked'];

export function statsFromApi(s: ApiLicenseStats): LicenseStatsView {
  return {
    counts: { total: s.total, valid: s.valid, used: s.used, unused: s.unused, revoked: s.revoked },
    syncedAt: ms(s.syncedAt) ?? null,
    source: { via: 'api' },
  };
}

export function rowFromApi(item: ApiLicenseItem): LicenseRow {
  // 모르는 상태(서버가 앞서 나간 판)면 시각 칸으로 짐작한다
  const status = STATUSES.includes(item.status as LicenseStatus)
    ? (item.status as LicenseStatus)
    : item.revokedAt
      ? 'revoked'
      : item.redeemedAt
        ? 'used'
        : 'unused';
  return {
    key: item.key,
    status,
    note: item.note ?? '',
    createdAt: ms(item.createdAt),
    redeemedAt: ms(item.redeemedAt),
    revokedAt: ms(item.revokedAt),
  };
}

export function pageFromApi(p: ApiLicensePage): LicensePageView {
  return {
    items: p.items.map(rowFromApi),
    page: p.page,
    pageCount: Math.max(1, p.totalPages),
    total: p.total,
    source: { via: 'api' },
  };
}

export function rowFromLicense(key: string, license: License): LicenseRow {
  return {
    key,
    status: licenseStatus(license),
    note: license.note ?? '',
    createdAt: license.createdAt,
    redeemedAt: license.redeemedAt ?? undefined,
    revokedAt: license.revokedAt,
  };
}

export function statsFromAll(all: Record<string, License>, fallback: LicenseFallback): LicenseStatsView {
  return { counts: countLicenses(all), syncedAt: null, source: { via: 'rtdb', fallback } };
}

/** 예전 방식 — 통째로 받은 것을 화면에서 거르고(filterLicenses: 키 · 메모, 최근 발급부터) 쪽으로 자른다. */
export function pageFromAll(
  all: Record<string, License>,
  query: LicensePageQuery,
  fallback: LicenseFallback,
): LicensePageView {
  const rows = filterLicenses(all, query.q.slice(0, LICENSE_QUERY_MAX));
  const pageCount = Math.max(1, Math.ceil(rows.length / query.size));
  const page = Math.min(Math.max(query.page, 1), pageCount);
  return {
    items: rows.slice((page - 1) * query.size, page * query.size).map(([key, d]) => rowFromLicense(key, d)),
    page,
    pageCount,
    total: rows.length,
    source: { via: 'rtdb', fallback },
  };
}

const clock = (ts: number) => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** 어디서 읽었는지 작게 붙일 말. API 면 기준 시각(사본이 몇 초 늦을 수 있어서), 예전 방식이면 왜 넘어왔는지. */
export function sourceNote(source: LicenseSource, syncedAt: number | null): string {
  if (source.via === 'api')
    return syncedAt ? `기준 ${clock(syncedAt)}` : '기준 시각 없음 — 서버 사본을 아직 맞추지 못함';
  return source.fallback === 'no-api'
    ? 'API 없음(dev) — 예전 방식으로 읽는 중'
    : 'API 연결 안 됨 — 예전 방식으로 읽는 중';
}
