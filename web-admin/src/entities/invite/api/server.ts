// API 판 — 여러 명 코드는 `GET /v2/admin/invites?group=true&cursor&limit`(여러 명 코드만 · 최근 만든 것부터 키셋), 한 사람의 남은 초대권은 사용자 상세 `GET /v2/admin/users/{userCode}` 의 `invite.invitesLeft`.
// 서버 목록은 쪽으로 오지만 이 화면은 코드를 통째로 보인다 — 끝까지 이어 받는다.
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireNullableNumber,
  wireNullableString,
  wireNullableTime,
  wireNumber,
  wireObject,
  wireString,
  wireTime,
  type Api,
} from '@/shared/api';
import type { GroupInvite } from '../model/groupInvite';
import type { InvitePort } from './port';

const BASE = adminPath('/invites');
/** 서버 한 번에 받는 상한(`limit` 1~100). */
const PAGE_MAX = 100;

/** 여러 명 코드 한 줄 — 칸이 약속과 다르면 줄을 버리거나 짐작으로 채우지 않고 던진다. `expiresAt` · `pausedAt` · `memo` 의 null 만 문서가 약속한 «없음». */
export function toGroupInviteRow(w: unknown): GroupInvite {
  const o = wireObject(w, '초대 코드 줄');
  const code = wireString(o.code, '초대 코드 줄의 code');
  const what = (field: string) => `초대 코드 ${code} 의 ${field}`;
  return {
    code,
    createdAt: wireTime(o.createdAt, what('createdAt')),
    maxUses: wireNumber(o.maxUses, what('maxUses')),
    usedCount: wireNumber(o.usedCount, what('usedCount')),
    expiresAt: wireNullableTime(o.expiresAt, what('expiresAt')),
    stoppedAt: wireNullableTime(o.pausedAt, what('pausedAt')),
    note: wireNullableString(o.memo, what('memo')) ?? '',
    version: wireNumber(o.version, what('version')),
  };
}

function build(api: Api | null): InvitePort {
  return {
    groups: () =>
      portCall(
        api,
        async (a) => {
          const rows: GroupInvite[] = [];
          let cursor: string | undefined;
          do {
            const page = wireObject(
              await a.get<unknown>(BASE, { group: 'true', cursor, limit: PAGE_MAX }),
              '초대 코드 쪽',
            );
            rows.push(...wireArray(page.items, '초대 코드 쪽의 items').map(toGroupInviteRow));
            cursor = wireNullableString(page.nextCursor, '초대 코드 쪽의 nextCursor') ?? undefined;
          } while (cursor !== undefined);
          return rows;
        },
        '목록을 불러오지 못했어요',
      ),

    invitesLeft: (uid) =>
      portCall(
        api,
        async (a) => {
          const user = wireObject(
            await a.get<unknown>(adminPath(`/users/${encodeURIComponent(uid)}`)),
            '사용자 상세',
          );
          const invite = wireObject(user.invite, '사용자 상세의 invite');
          return wireNullableNumber(invite.invitesLeft, '사용자 상세의 invite.invitesLeft');
        },
        '초대권을 읽지 못했어요',
      ),
  };
}

/** `api` 마다 하나 — 상태가 없다. */
export const createServerInvitePort = perApi(build);
