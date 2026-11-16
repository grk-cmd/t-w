// API 판 — `GET /v2/admin/secret-rooms?ownerUserCode=&live=true` — 그 사람의 열린 방(끝나지 않은 것)만. 거르기는 서버가 한다.
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireError,
  wireNullableString,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import type { SecretRoomPub } from '../model/secretRoom';
import type { SecretRoomPort } from './port';

const BASE = adminPath('/secret-rooms');

function nullableTime(value: unknown, what: string): number | null {
  if (value === null) return null;
  const at = Date.parse(wireString(value, what));
  if (Number.isNaN(at)) throw wireError(what, 'ISO 시각');
  return at;
}

/** 방 한 줄 — 칸이 약속과 다르면 줄을 버리지 않고 던진다. `code` · `name` · 시각의 null 만 문서가 약속한 «없음». */
export function toRoomRow(w: unknown) {
  const o = wireObject(w, '시크릿룸 줄');
  const id = wireString(o.secretRoomId, '시크릿룸의 secretRoomId');
  const what = (field: string) => `시크릿룸 ${id} 의 ${field}`;
  return {
    code: wireNullableString(o.code, what('code')),
    ownerUserCode: wireString(o.ownerUserCode, what('ownerUserCode')),
    name: wireNullableString(o.name, what('name')),
    expiresAt: nullableTime(o.expiresAt, what('expiresAt')),
    endedAt: nullableTime(o.endedAt, what('endedAt')),
    id,
  };
}

/** `live=true` 로 받은 목록 — 끝난 방이 섞였거나 한 사람에 열린 방이 둘 이상이면 약속과 다른 응답. 없으면 null. */
export function toLiveRoom(w: unknown, what: string) {
  const rooms = wireArray(w, what).map(toRoomRow);
  if (rooms.some((r) => r.endedAt !== null)) throw wireError(what, '끝나지 않은 방만');
  if (rooms.length > 1) throw wireError(what, '열린 방 하나');
  const [room] = rooms;
  if (!room) return null;
  if (room.code === null) throw wireError(`시크릿룸 ${room.id} 의 code`, '열린 방의 글자');
  return { ...room, code: room.code };
}

function build(api: Api | null): SecretRoomPort {
  return {
    ofUser: (uid) =>
      portCall(
        api,
        async (a) => {
          const room = toLiveRoom(
            await a.get<unknown>(BASE, { ownerUserCode: uid, live: 'true' }),
            '시크릿룸 목록',
          );
          if (room === null) return null;
          const pub: SecretRoomPub = { owner: room.ownerUserCode };
          if (room.name !== null) pub.name = room.name;
          if (room.expiresAt !== null) pub.exp = room.expiresAt;
          return { code: room.code, pub };
        },
        '시크릿룸을 불러오지 못했어요',
      ),
  };
}

export const createServerSecretRoomPort = perApi(build);
