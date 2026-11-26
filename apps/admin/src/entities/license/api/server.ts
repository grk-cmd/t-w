// API 판 — `GET /v2/admin/licenses/stats` · `GET /v2/admin/licenses?q&cursor&limit`(최신 발급부터 키셋).
// 화면은 쪽 번호로 묻는다 — 서버 키셋을 첫 쪽부터 이어 받아 그 쪽을 자른다(받아 둔 커서를 포트가 기억하지 않는다).
// 서버가 원본이라 «기준 시각» 도 사본 지연도 없다.
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireError,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import type { LicenseStatus } from '../model/license';
import {
  LICENSE_QUERY_MAX,
  type LicensePageQuery,
  type LicensePageView,
  type LicenseRow,
  type LicenseStatsView,
} from '../model/licenseView';
import type { LicensePort } from './port';

const BASE = adminPath('/licenses');
/** 서버 한 번에 받는 상한(`limit` 1~100). */
const PAGE_MAX = 100;

function time(value: unknown, what: string): number {
  const at = Date.parse(wireString(value, what));
  if (Number.isNaN(at)) throw wireError(what, 'ISO 시각');
  return at;
}

function nullableTime(value: unknown, what: string): number | undefined {
  return value === null ? undefined : time(value, what);
}

/** 키 한 장 — 칸이 약속과 다르면 줄을 버리거나 짐작으로 채우지 않고 던진다. `note` · 시각 · 주인의 null 만 문서가 약속한 «없음». */
export function toLicenseRow(w: unknown): LicenseRow {
  const o = wireObject(w, '라이선스 줄');
  const licenseId = wireString(o.licenseId, '라이선스의 licenseId');
  const what = (field: string) => `라이선스 ${licenseId} 의 ${field}`;
  const state = wireString(o.status, what('status'));
  const owner = wireNullableString(o.ownerUserCode, what('ownerUserCode'));
  let status: LicenseStatus;
  if (state === 'REVOKED') status = 'revoked';
  else if (state === 'VALID') status = owner === null ? 'unused' : 'used';
  else throw wireError(what('status'), 'VALID · REVOKED');
  return {
    key: wireString(o.key, what('key')),
    licenseId,
    version: wireNumber(o.version, what('version')),
    status,
    note: wireNullableString(o.note, what('note')) ?? '',
    createdAt: time(o.createdAt, what('createdAt')),
    redeemedAt: nullableTime(o.firstRedeemedAt, what('firstRedeemedAt')),
    revokedAt: nullableTime(o.revokedAt, what('revokedAt')),
  };
}

function build(api: Api | null): LicensePort {
  return {
    stats: () =>
      portCall(
        api,
        async (a) => {
          const s = wireObject(await a.get<unknown>(`${BASE}/stats`), '라이선스 통계');
          const n = (field: string) => wireNumber(s[field], `라이선스 통계의 ${field}`);
          // 서버의 «주인 있는 유효 키» = 사용 중, «주인 없는 유효 키» = 미사용.
          return {
            counts: {
              total: n('total'),
              valid: n('valid'),
              used: n('owned'),
              unused: n('unowned'),
              revoked: n('revoked'),
            },
            syncedAt: null,
            source: { via: 'server' },
          } satisfies LicenseStatsView;
        },
        '통계를 불러오지 못했어요',
      ),

    page: (query: LicensePageQuery) =>
      portCall(
        api,
        async (a): Promise<LicensePageView> => {
          const q = query.q.trim().slice(0, LICENSE_QUERY_MAX);
          const want = query.page * query.size;
          const read = async (cursor: string | undefined, have: number) => {
            const page = wireObject(
              await a.get<unknown>(BASE, {
                q: q || undefined,
                cursor,
                limit: Math.min(PAGE_MAX, want - have),
              }),
              '라이선스 쪽',
            );
            return {
              page,
              rows: wireArray(page.items, '라이선스 쪽의 items').map(toLicenseRow),
              next: wireNullableString(page.nextCursor, '라이선스 쪽의 nextCursor') ?? undefined,
            };
          };
          // `total` 은 첫 쪽에만 온다.
          const first = await read(undefined, 0);
          const total = wireNumber(first.page.total, '라이선스 첫 쪽의 total');
          const rows = first.rows;
          let cursor = first.next;
          while (cursor !== undefined && rows.length < want) {
            const next = await read(cursor, rows.length);
            rows.push(...next.rows);
            cursor = next.next;
          }
          return {
            items: rows.slice((query.page - 1) * query.size, want),
            page: query.page,
            pageCount: Math.max(1, Math.ceil(total / query.size)),
            total,
            source: { via: 'server' },
          };
        },
        '목록을 불러오지 못했어요',
      ),
  };
}

/** `api` 마다 하나 — 쪽을 이어 받는 커서도 매번 첫 쪽부터라 포트는 상태가 없다. */
export const createServerLicensePort = perApi(build);
