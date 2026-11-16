// API 판 — `GET /v2/admin/reports?cursor&limit`(신고 많은 순 키셋 · `minReporters` 는 안 보낸다 — 서버 기본값이 기준이다).
// 대상마다 지금 이름 · 친구코드 · 자리비움 그림과 신고자 줄이 함께 온다. 한 사람이 받은 신고 수는 사용자 상세 `GET /v2/admin/users/{userCode}` 의 `openReports`.
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
  wireTime,
  type Api,
} from '@/shared/api';
import type { Report, ReportTarget } from '../model/report';
import type { ReportPort } from './port';

const BASE = adminPath('/reports');
/** 서버 한 번에 받는 상한(`limit` 1~100). */
const PAGE_MAX = 100;

/** 서버 신고 종류 → 화면이 쓰는 이름. */
const KINDS: Record<string, string> = {
  CHARACTER: 'char',
  AWAY_IMAGE: 'away',
  NICKNAME: 'nick',
  ETC: 'etc',
};

/** 신고자 한 줄 — 칸이 약속과 다르면 줄을 버리거나 짐작으로 채우지 않고 던진다. 이름 · 친구코드 · 사유의 null 만 문서가 약속한 «없음». */
function toReport(w: unknown): Report {
  const o = wireObject(w, '신고자 줄');
  const who = wireString(o.userCode, '신고자 줄의 userCode');
  const what = (field: string) => `신고자 ${who} 의 ${field}`;
  const kind = wireString(o.kind, what('kind'));
  if (!Object.hasOwn(KINDS, kind)) throw wireError(what('kind'), Object.keys(KINDS).join(' · '));
  // 신고할 때 이름이 있으면 그것, 없으면(옛 줄) 지금 이름.
  const nick =
    wireNullableString(o.nameSnapshot, what('nameSnapshot')) ??
    wireNullableString(o.displayName, what('displayName'));
  const friendCode = wireNullableString(o.friendCode, what('friendCode'));
  const note = wireNullableString(o.note, what('note'));
  return {
    kind: KINDS[kind],
    ...(nick !== null ? { nick } : {}),
    ...(friendCode !== null ? { friendCode } : {}),
    ...(note !== null ? { note } : {}),
    ts: wireTime(o.at, what('at')),
  };
}

/** 신고 대상 한 줄. */
export function toReportTarget(w: unknown): ReportTarget {
  const o = wireObject(w, '신고 대상 줄');
  const target = wireString(o.target, '신고 대상 줄의 target');
  const what = (field: string) => `신고 대상 ${target} 의 ${field}`;
  const image = o.awayImage === null ? null : wireObject(o.awayImage, what('awayImage'));
  return {
    target,
    reports: wireArray(o.reporters, what('reporters')).map(toReport),
    card: {
      name: wireNullableString(o.displayName, what('displayName')),
      friendCode: wireNullableString(o.friendCode, what('friendCode')),
      awayImg: image === null ? null : wireString(image.url, what('awayImage.url')),
    },
  };
}

function build(api: Api | null): ReportPort {
  return {
    // 서버 목록은 쪽으로 오지만 이 화면은 목록을 통째로 보인다 — 끝까지 이어 받는다.
    targets: () =>
      portCall(
        api,
        async (a) => {
          const rows: ReportTarget[] = [];
          let cursor: string | undefined;
          do {
            const page = wireObject(await a.get<unknown>(BASE, { cursor, limit: PAGE_MAX }), '신고 쪽');
            rows.push(...wireArray(page.items, '신고 쪽의 items').map(toReportTarget));
            cursor = wireNullableString(page.nextCursor, '신고 쪽의 nextCursor') ?? undefined;
          } while (cursor !== undefined);
          return rows;
        },
        '신고 목록을 불러오지 못했어요',
      ),

    countFor: (uid) =>
      portCall(
        api,
        async (a) =>
          wireNumber(
            wireObject(await a.get<unknown>(adminPath(`/users/${encodeURIComponent(uid)}`)), '사용자 상세')
              .openReports,
            '사용자 상세의 openReports',
          ),
        '신고 수를 읽지 못했어요',
      ),
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerReportPort = perApi(build);
