// API 판 — `GET /v2/admin/users/{userCode}`(한 사람 몫을 한 번에). 작은 읽기(이름 · 소개 · 접속 · 집중 · 라이선스)는 모두 그 답의 한 칸이다.
// 그 사람의 초대 코드로 들어온 사람은 `GET /v2/admin/users/{userCode}/invitees?cursor&limit`(가입 최근순 키셋 · 첫 쪽 `total` · 이름 · 친구코드 함께).
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireBool,
  wireNullableNumber,
  wireNullableString,
  wireNullableTime,
  wireNumber,
  wireObject,
  wireString,
  wireTime,
  wireError,
  type Api,
} from '@/shared/api';
import { INVITE_ISSUER_ADMIN } from '@/entities/invite/@x/user';
import type { KeysetPage } from '@/shared/lib';
import type { DetailSecretRoom, Invitee, UserDetail } from '../model/detail';
import type { UserInvite } from '../model/live';
import { realName, type LiveUserRow, type UserLicense } from '../model/userRow';
import type { UserDetailPort } from './port';

/** 서버 `license.state` → 줄의 라이선스 상태. 모르는 값은 짐작하지 않고 던진다. */
function licenseOf(w: unknown, userCode: string): { key: string | null; state: UserLicense } {
  if (w === null) return { key: null, state: 'none' };
  const what = (field: string) => `사용자 ${userCode} 의 license.${field}`;
  const o = wireObject(w, `사용자 ${userCode} 의 license`);
  const key = wireString(o.key, what('key'));
  const state = wireString(o.state, what('state'));
  if (state === 'valid') return { key, state: 'used' };
  if (state === 'revoked') return { key, state: 'revoked' };
  throw wireError(what('state'), 'valid · revoked');
}

function inviteOf(w: unknown, userCode: string): UserInvite {
  const what = (field: string) => `사용자 ${userCode} 의 invite.${field}`;
  const o = wireObject(w, `사용자 ${userCode} 의 invite`);
  const invitedByAdmin = wireBool(o.invitedByAdmin, what('invitedByAdmin'));
  const invitedBy = wireNullableString(o.invitedBy, what('invitedBy'));
  wireBool(o.invited, what('invited'));
  return {
    joinedAt: wireTime(o.joinedAt, what('joinedAt')),
    // 웹 관리자가 만든 코드로 들어온 사람은 «관리자», 그 밖의 초대는 만든 사람의 사용자코드, 제도 전부터 쓰던 사람은 null.
    invitedBy: invitedByAdmin ? INVITE_ISSUER_ADMIN : invitedBy,
    invitesLeft: wireNullableNumber(o.invitesLeft, what('invitesLeft')),
  };
}

/** 목록 한 줄 · 상세의 줄 칸. 칸이 약속과 다르면 줄을 버리거나 짐작으로 채우지 않고 던진다. `online` 의 null 만 «모름». */
export function toServerUserRow(w: unknown): LiveUserRow {
  const o = wireObject(w, '사용자 줄');
  const userCode = wireString(o.userCode, '사용자 줄의 userCode');
  const what = (field: string) => `사용자 ${userCode} 의 ${field}`;
  const license = licenseOf(o.license, userCode);
  const lastSeenAt = wireNullableTime(o.lastSeenAt, what('lastSeenAt'));
  const appVersion = wireNullableString(o.appVersion, what('appVersion'));
  const onlineRaw = o.online;
  const online = onlineRaw === null ? null : wireBool(onlineRaw, what('online'));
  const invite = inviteOf(o.invite, userCode);
  return {
    userCode,
    name: realName(wireString(o.name, what('name'))),
    friendCode: wireString(o.friendCode, what('friendCode')),
    license: license.key,
    licenseState: license.state,
    hasAccount: true,
    lastSeen: lastSeenAt ?? 0,
    focusTotalSec: wireNumber(o.focusTotalSec, what('focusTotalSec')),
    ver: appVersion,
    licenseUsers: license.key ? 1 : 0,
    live: {
      presence: { online, lastSeen: lastSeenAt, room: null, ver: appVersion, verUnknown: false },
      invite,
    },
  };
}

function secretRoomOf(w: unknown, userCode: string): DetailSecretRoom | null {
  if (w === null) return null;
  const o = wireObject(w, `사용자 ${userCode} 의 secretRoom`);
  return {
    code: wireString(o.code, `사용자 ${userCode} 의 secretRoom.code`),
    name: wireNullableString(o.name, `사용자 ${userCode} 의 secretRoom.name`),
    expiresAt: wireNullableTime(o.expiresAt, `사용자 ${userCode} 의 secretRoom.expiresAt`),
  };
}

/** 들어온 사람 한 줄 — `name` · `friendCode` 의 null 만 문서가 약속한 «없음». */
function toInvitee(w: unknown): Invitee {
  const o = wireObject(w, '들어온 사람 줄');
  const userCode = wireString(o.userCode, '들어온 사람 줄의 userCode');
  const what = (field: string) => `들어온 사람 ${userCode} 의 ${field}`;
  return {
    userCode,
    name: wireNullableString(o.name, what('name')),
    friendCode: wireNullableString(o.friendCode, what('friendCode')),
    code: wireString(o.code, what('code')),
    joinedAt: wireTime(o.joinedAt, what('joinedAt')),
  };
}

export function toServerUserDetail(w: unknown): UserDetail {
  const o = wireObject(w, '사용자 상세');
  const listed = toServerUserRow(o);
  const userCode = listed.userCode;
  const what = (field: string) => `사용자 ${userCode} 의 ${field}`;
  const roomRaw = o.room;
  const room =
    roomRaw === null ? null : wireString(wireObject(roomRaw, what('room')).code, what('room.code'));
  const awayRaw = o.awayImage;
  const away = awayRaw === null ? null : wireObject(awayRaw, what('awayImage'));
  return {
    // 상세만 방 코드를 안다 — 줄의 접속 칸에 합쳐 한 곳에서 읽게 한다.
    row: { ...listed, live: { ...listed.live, presence: { ...listed.live.presence, room } } },
    room,
    hasPasswordLogin: wireBool(o.hasPasswordLogin, what('hasPasswordLogin')),
    awayImage: away
      ? {
          url: wireString(away.url, what('awayImage.url')),
          size: wireNumber(away.size, what('awayImage.size')),
        }
      : null,
    openReports: wireNumber(o.openReports, what('openReports')),
    secretRoom: secretRoomOf(o.secretRoom, userCode),
    issuedInviteCount: wireNumber(o.issuedInviteCount, what('issuedInviteCount')),
    usedInviteCount: wireNumber(o.usedInviteCount, what('usedInviteCount')),
  };
}

function build(api: Api | null): UserDetailPort {
  // 한 화면에서 이름 · 라이선스 · 접속을 같은 사람 몫으로 함께 부른다 — 받는 중인 요청은 한 번만 보낸다(끝나면 비운다).
  const pending = new Map<string, Promise<UserDetail>>();
  const detail = (uid: string) => {
    let call = pending.get(uid);
    if (!call) {
      call = portCall(
        api,
        async (a) => toServerUserDetail(await a.get<unknown>(adminPath(`/users/${encodeURIComponent(uid)}`))),
        '사용자를 읽지 못했어요',
      ).finally(() => pending.delete(uid));
      pending.set(uid, call);
    }
    return call;
  };
  return {
    kind: 'detail',
    detail,
    invitees: (uid, cursor, limit) =>
      portCall(
        api,
        async (a): Promise<KeysetPage<Invitee>> => {
          const page = wireObject(
            await a.get<unknown>(adminPath(`/users/${encodeURIComponent(uid)}/invitees`), { cursor, limit }),
            '들어온 사람 쪽',
          );
          return {
            items: wireArray(page.items, '들어온 사람 쪽의 items').map(toInvitee),
            nextCursor: wireNullableString(page.nextCursor, '들어온 사람 쪽의 nextCursor'),
            // `total` 은 첫 쪽에만 오고 다음 쪽은 null.
            total:
              cursor === undefined
                ? wireNumber(page.total, '들어온 사람 첫 쪽의 total')
                : wireNullableNumber(page.total, '들어온 사람 쪽의 total'),
          };
        },
        '초대로 들어온 사람을 읽지 못했어요',
      ),
    name: async (uid) => (await detail(uid)).row.name,
    brief: async (uid) => {
      const d = await detail(uid);
      return { name: d.row.name, friendCode: d.row.friendCode, awayImg: d.awayImage?.url ?? null };
    },
    presence: async (uid) => (await detail(uid)).row.live.presence,
    focusSec: async (uid) => (await detail(uid)).row.focusTotalSec,
    license: async (uid) => (await detail(uid)).row.licenseState,
  };
}

/** `api` 마다 하나 — 들고 있는 것은 받는 중인 요청뿐이다. */
export const createServerUserPort = perApi(build);
