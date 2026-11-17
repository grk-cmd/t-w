// API 판 — 받는 사람 확인 `POST /v2/admin/licenses/preview { friendCodes: [코드] }`(쓰는 것 없음 · 이름을 방 이름으로 쓴다),
// 이미 방이 있는 사람은 `GET /secret-rooms?friendCode=&live=true`(열린 방만) 로 읽어 연장 · 코드 바꿈을 미리 알린다. 발급 `POST /v2/admin/secret-rooms { requestId, friendCode, code?, name, months?, confirmTakeover }` — 끝나는 날 · 이어붙임 · 옛 방 끝내기 · 우편은 서버가 한다.
// 남이 가진 코드면 409 `LICENSE_SECRET_ROOM_CODE_TAKEN` 의 `items` 로 알려 주고, 확인받은 뒤 `confirmTakeover: true` 로 다시 보낸다.
import {
  existingRoomWarning,
  formatDay,
  hasConfusingChars,
  OWNER_NAME_MAX,
  parseMonths,
  parseWantCode,
  SECRET_PREFIX,
  isUserId,
  toLiveRoom,
  type TakenRoom,
} from '@/entities/secret-room';
import {
  adminPath,
  isPortError,
  perApi,
  PortError,
  portCall,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import { isServerPlan, type GrantSecretRoomPort, type ServerSecretPlan } from './port';

const PREVIEW = adminPath('/licenses/preview');
const ROOMS = adminPath('/secret-rooms');
const TAKEN_CODE = 'LICENSE_SECRET_ROOM_CODE_TAKEN';

function isoTime(value: unknown, what: string): number {
  const at = Date.parse(wireString(value, what));
  if (Number.isNaN(at)) throw wireError(what, 'ISO 시각');
  return at;
}

const nullableTime = (value: unknown, what: string): number | null =>
  value === null ? null : isoTime(value, what);

/** 409 `items` — 그 코드를 지금 가진 방. 모양이 약속과 다르면 던진다. */
function toTaken(items: unknown): TakenRoom[] {
  return wireArray(items, '겹친 시크릿룸 목록').map((w, i) => {
    const at = `겹친 시크릿룸 ${i + 1}번째 줄의`;
    const o = wireObject(w, `겹친 시크릿룸 ${i + 1}번째 줄`);
    return {
      secretRoomId: wireString(o.secretRoomId, `${at} secretRoomId`),
      ownerUserCode: wireString(o.ownerUserCode, `${at} ownerUserCode`),
      expiresAt: nullableTime(o.expiresAt, `${at} expiresAt`),
      endedAt: nullableTime(o.endedAt, `${at} endedAt`),
    };
  });
}

function build(api: Api | null): GrantSecretRoomPort {
  const once = createPayloadRequestId();

  return {
    needsKey: false,

    async prepare(input) {
      const raw = input.target.trim();
      if (!raw) return { ok: false, error: '친구코드를 입력해 주세요' };
      const months = parseMonths(input.months);
      if (!months.ok) return months;
      const wanted = parseWantCode(input.want);
      if (!wanted.ok) return wanted;
      // 사람은 친구코드로만 가리킨다(설계) — 유저 코드로 우회하는 길이 없다.
      if (isUserId(raw))
        return { ok: false, error: '친구코드(MATE-XXXX)로 넣어 주세요 — 유저 코드는 받지 않아요' };

      const [row] = await portCall(
        api,
        async (a) =>
          wireArray(await a.send<unknown>('POST', PREVIEW, { body: { friendCodes: [raw] } }), '미리 보기'),
        '받는 사람을 확인하지 못했어요',
      );
      const o = wireObject(row, '미리 보기 줄');
      if (!wireBool(o.found, '미리 보기 줄의 found'))
        return { ok: false, error: '해당 친구코드를 가진 유저를 찾을 수 없어요' };
      const friendCode = wireString(o.friendCode, '미리 보기 줄의 friendCode');
      const wantCode = wanted.want ? SECRET_PREFIX + wanted.want : '';
      // 서버는 이미 방이 있는 사람에게 연장 · 코드 바꿈을 조용히 한다 — 먼저 그 사람의 방을 읽어 알린다.
      const mine = await portCall(
        api,
        async (a) => toLiveRoom(await a.get<unknown>(ROOMS, { friendCode, live: 'true' }), '시크릿룸 목록'),
        '그 사람의 시크릿룸을 확인하지 못했어요',
      );
      const warnings: string[] = [];
      if (mine !== null) {
        warnings.push(
          existingRoomWarning(
            { code: mine.code, expiresAt: mine.expiresAt },
            wantCode,
            months.months,
            Date.now(),
          ),
        );
      }
      const plan: ServerSecretPlan = {
        via: 'server',
        friendCode,
        // 방 이름 칸은 글자로 보낸다 — 받는 사람 이름이 없으면(null) 빈 이름.
        name: (wireNullableString(o.name, '미리 보기 줄의 name') ?? '').slice(0, OWNER_NAME_MAX),
        code: wantCode,
        months: months.months,
        confusing: hasConfusingChars(wanted.want),
        warnings,
        takeover: false,
      };
      return { ok: true, plan };
    },

    async grant(plan) {
      if (!isServerPlan(plan)) throw new PortError('invalid', '이 판의 계획이 아니에요');
      const body = {
        friendCode: plan.friendCode,
        ...(plan.code ? { code: plan.code } : {}),
        name: plan.name,
        months: plan.months || null,
        confirmTakeover: plan.takeover,
      };
      let room: Record<string, unknown>;
      try {
        room = await once(body, (requestId) =>
          portCall(
            api,
            async (a) =>
              wireObject(await a.send<unknown>('POST', ROOMS, { body: { requestId, ...body } }), '시크릿룸'),
            '발급하지 못했어요',
          ),
        );
      } catch (error) {
        // 남이 가진 코드 — 실패가 아니라 «한 번 더 확인» 이다. 그 밖의 실패는 그대로 던진다.
        if (isPortError(error, 'conflict') && error.code === TAKEN_CODE)
          return { ok: false, denied: false, taken: toTaken(error.items) };
        throw error;
      }
      const id = wireString(room.secretRoomId, '시크릿룸의 secretRoomId');
      const what = (field: string) => `시크릿룸 ${id} 의 ${field}`;
      const expiresAt = nullableTime(room.expiresAt, what('expiresAt'));
      if (plan.months > 0 && expiresAt === null) throw wireError(what('expiresAt'), '끝나는 시각');
      const code = wireNullableString(room.code, what('code'));
      if (code === null) throw wireError(what('code'), '글자');
      return {
        ok: true,
        code,
        period: expiresAt === null ? '영구' : `${plan.months}개월 · ${formatDay(expiresAt)} 까지`,
        recipient: wireString(room.ownerUserCode, what('ownerUserCode')),
        recipientName: plan.name,
        sent: null,
        linked: null,
        expiredOld: '',
        expireFailed: '',
      };
    },
  };
}

export const createServerGrantSecretRoomPort = perApi(build);
