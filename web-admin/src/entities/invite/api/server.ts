// API 판 — 여러 명 코드는 `GET /v2/admin/invites?group=true&cursor&limit`(여러 명 코드만 · 최근 만든 것부터 키셋), 한 사람의 남은 초대권은 사용자 상세 `GET /v2/admin/users/{userCode}` 의 `invite.invitesLeft`.
// 화면은 쪽으로 이어 받고(`useKeysetPaging`), 전체 수는 첫 쪽 `total` 을 쓴다.
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
import type { KeysetPage } from '@/shared/lib';
import type { GroupInvite } from '../model/groupInvite';
import type { InvitePort } from './port';

const BASE = adminPath('/invites');

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
    groups: (cursor, limit) =>
      portCall(
        api,
        async (a): Promise<KeysetPage<GroupInvite>> => {
          const page = wireObject(
            await a.get<unknown>(BASE, { group: 'true', cursor, limit }),
            '초대 코드 쪽',
          );
          return {
            items: wireArray(page.items, '초대 코드 쪽의 items').map(toGroupInviteRow),
            nextCursor: wireNullableString(page.nextCursor, '초대 코드 쪽의 nextCursor'),
            // `total` 은 첫 쪽에만 오고 다음 쪽은 null.
            total:
              cursor === undefined
                ? wireNumber(page.total, '초대 코드 첫 쪽의 total')
                : wireNullableNumber(page.total, '초대 코드 쪽의 total'),
          };
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
