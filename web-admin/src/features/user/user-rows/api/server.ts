// API 판 — `GET /v2/admin/users`(키셋 · 서버가 거르고 찾고 세고 정렬) · `/users/stats`.
// 웹은 받은 쪽을 거르거나 세지 않는다 — 조건은 모두 쿼리로 보내고 수는 첫 쪽 `total` 을 쓴다.
import {
  toServerUserRow,
  toVersionCounts,
  type Period,
  type UserQuery,
  type UserRow,
  type UserStatsView,
} from '@/entities/user';
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireNullableNumber,
  wireNullableString,
  wireNumber,
  wireObject,
  type Api,
  type ApiParams,
} from '@/shared/api';
import { BULK_SEND_MAX, chunks, KEYSET_PAGE_MAX } from '@/shared/lib';
import type { UserRowsKeysetPort } from './port';

const BASE = adminPath('/users');

/** 날짜 칸(YYYY-MM-DD) → 이 컴퓨터 시간대 그날 0시의 ISO 시각. `plusDays` 1 이면 다음 날 0시(끝 날짜는 «그날 끝까지» 라 서버의 «To 빼고» 에 맞춘다). */
function dayIso(day: string, plusDays = 0): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + plusDays).toISOString();
}

function periodParams(period: Period | undefined): ApiParams {
  if (!period || (!period.from && !period.to)) return {};
  const from = period.from ? dayIso(period.from) : undefined;
  const to = period.to ? dayIso(period.to, 1) : undefined;
  return period.field === 'joined' ? { joinedFrom: from, joinedTo: to } : { seenFrom: from, seenTo: to };
}

/** 화면 조건 → 쿼리. 기본값(전체 · 빈 검색어 · 최근 접속 순)은 보내지 않는다. 길이 · 값 판정은 서버가 한다. */
export function serverUserParams(query: UserQuery): ApiParams {
  return {
    q: query.q.trim() || undefined,
    filter: query.filter === 'all' ? undefined : query.filter,
    // null = 버전 기록 없는 사람 — 서버는 «none» 으로 받는다
    ver: query.ver === undefined ? undefined : (query.ver ?? 'none'),
    sort: query.order === 'asc' ? 'lastSeen,asc' : undefined,
    ...periodParams(query.period),
  };
}

function toPage(w: unknown) {
  const page = wireObject(w, '사용자 쪽');
  return {
    items: wireArray(page.items, '사용자 쪽의 items').map(toServerUserRow),
    nextCursor: wireNullableString(page.nextCursor, '사용자 쪽의 nextCursor'),
    total: wireNullableNumber(page.total, '사용자 쪽의 total'),
  };
}

function toVersions(w: unknown, what: string) {
  return toVersionCounts(
    wireArray(w, what).map((v, i) => {
      const o = wireObject(v, `${what} ${i + 1}번째`);
      return {
        ver: wireNullableString(o.version, `${what} ${i + 1}번째의 version`),
        count: wireNumber(o.count, `${what} ${i + 1}번째의 count`),
      };
    }),
  );
}

function build(api: Api | null): UserRowsKeysetPort {
  return {
    kind: 'keyset',

    page: (query, cursor, limit) =>
      portCall(
        api,
        async (a) => toPage(await a.get<unknown>(BASE, { ...serverUserParams(query), cursor, limit })),
        '사용자 목록을 불러오지 못했어요',
      ),

    stats: () =>
      portCall(
        api,
        async (a): Promise<UserStatsView> => {
          const s = wireObject(await a.get<unknown>(`${BASE}/stats`), '사용자 통계');
          return {
            total: wireNumber(s.total, '사용자 통계의 total'),
            versions: toVersions(s.versions, '사용자 통계의 versions'),
            recent: toVersions(s.recentVersions, '사용자 통계의 recentVersions'),
            syncedAt: null,
            source: { via: 'api' },
          };
        },
        '사용자 통계를 불러오지 못했어요',
      ),

    byCodes: (codes) => {
      const unique = [...new Set(codes)].filter(Boolean);
      return portCall(
        api,
        async (a) => {
          const pages = await Promise.all(
            chunks(unique, BULK_SEND_MAX).map(async (part) =>
              toPage(await a.get<unknown>(BASE, { codes: part.join(','), limit: KEYSET_PAGE_MAX })),
            ),
          );
          return new Map<string, UserRow>(pages.flatMap((p) => p.items.map((r) => [r.userCode, r] as const)));
        },
        '사용자를 불러오지 못했어요',
      );
    },
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerUserRowsPort = perApi(build);
