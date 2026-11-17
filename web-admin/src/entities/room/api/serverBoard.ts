// API 판 — 열린 방 보기 · 닫기. `GET /v2/admin/rooms` 한 번이 «지금 열린 방 전부(시크릿룸 · 사람 포함)» 라서
// Firebase 판의 roomIndex · rooms · 멤버 읽기를 이 한 응답으로 채운다(방은 realtime 메모리라 유령 · 마지막 신호가 없다).
// 닫기 `POST /v2/admin/rooms/close { codes ≤500 }` 또는 `{ all: true }` → `{ closed, missing }`.
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  PortError,
  type Api,
} from '@/shared/api';
import type { Channel, LiveRoom, RoomIndexEntry, RoomProbe, RoomStats } from '../model/room';
import { toRoomPerson } from '../model/room';
import { CLOSE_MAX, type CloseResult, type RoomPort } from './port';

const PATH = adminPath('/rooms');
/** 여러 카드가 한꺼번에 열려도 목록 요청은 한 번 — 이 시간 안에는 받은 것을 쓴다. */
const FRESH_MS = 2000;

interface Listing {
  /** 서버가 목록을 만든 시각. */
  at: number;
  /** 우리가 받은 시각 — 서버 시계와 이 PC 시계의 차를 잰다. */
  receivedAt: number;
  rooms: LiveRoom[];
  counts: Record<Channel, number>;
}

type BoardPort = Pick<
  RoomPort,
  'getIndex' | 'getCodes' | 'probeRooms' | 'getStats' | 'getLive' | 'serverTimeOffset' | 'close' | 'closeAll'
>;

function parse(data: unknown, receivedAt: number): Listing {
  const o = wireObject(data, '열린 방 목록');
  const at = Date.parse(wireString(o.at, '열린 방 목록의 at'));
  if (Number.isNaN(at)) throw wireError('열린 방 목록의 at', 'ISO 시각');
  const rooms: LiveRoom[] = wireArray(o.rooms, '열린 방 목록의 rooms').map((r, i) => {
    const x = wireObject(r, `rooms[${i}]`);
    if (x.channel !== 'workingroom' && x.channel !== 'togetherroom')
      throw wireError(`rooms[${i}].channel`, 'workingroom 또는 togetherroom');
    return {
      code: wireString(x.code, `rooms[${i}].code`),
      channel: x.channel,
      secret: wireBool(x.secret, `rooms[${i}].secret`),
      open: wireBool(x.open, `rooms[${i}].open`),
      host: wireNullableString(x.host, `rooms[${i}].host`),
      members: wireArray(x.members, `rooms[${i}].members`).map((m, k) => {
        const member = wireObject(m, `rooms[${i}].members[${k}]`);
        return toRoomPerson(
          wireNullableString(member.name, `rooms[${i}].members[${k}].name`),
          wireString(member.userCode, `rooms[${i}].members[${k}].userCode`),
        );
      }),
    };
  });
  const c = wireObject(o.counts, '열린 방 목록의 counts');
  // 서버는 두 채널의 방 수를 늘 함께 준다 — 하나라도 없으면 0 으로 두지 않고 던진다.
  const counts: Listing['counts'] = {
    workingroom: wireNumber(c.workingroom, 'counts.workingroom'),
    togetherroom: wireNumber(c.togetherroom, 'counts.togetherroom'),
  };
  return { at, receivedAt, rooms, counts };
}

function build(api: Api | null): BoardPort {
  let cached: Listing | null = null;
  let loading: Promise<Listing> | null = null;

  function listing(): Promise<Listing> {
    if (cached && Date.now() - cached.receivedAt < FRESH_MS) return Promise.resolve(cached);
    loading ??= portCall(
      api,
      async (a) => {
        const data = await a.get<unknown>(PATH);
        return (cached = parse(data, Date.now()));
      },
      '방 목록을 불러오지 못했어요',
    ).finally(() => {
      loading = null;
    });
    return loading;
  }

  async function closeBy(body: { codes: string[] } | { all: true }): Promise<CloseResult> {
    cached = null; // 일부만 닫히고 실패해도 목록은 다시 받는다
    const done = await portCall(
      api,
      (a) => a.send<unknown>('POST', `${PATH}/close`, { body }),
      '방을 닫지 못했어요',
    );
    cached = null;
    const o = wireObject(done, '방 닫기 결과');
    const codes = (name: 'closed' | 'missing') =>
      wireArray(o[name], `방 닫기 결과의 ${name}`).map((c, i) => wireString(c, `${name}[${i}]`));
    return { closed: codes('closed'), missing: codes('missing') };
  }

  return {
    async getIndex() {
      const { rooms, at } = await listing();
      // 목록에 있는 방은 방금 본 방이다 — 신호 시각은 목록 시각으로 둔다(화면은 `listing.lastSeen` 이 없으면 칸을 숨긴다).
      return Object.fromEntries(
        rooms.map((r): [string, RoomIndexEntry] => [
          r.code,
          { channel: r.channel, open: r.open, lastSeen: at },
        ]),
      );
    },
    async getCodes() {
      return (await listing()).rooms.map((r) => r.code);
    },
    async probeRooms(codes) {
      const { rooms } = await listing();
      const byCode = new Map(rooms.map((r) => [r.code, r]));
      const out: Record<string, RoomProbe> = {};
      for (const code of codes) {
        const room = byCode.get(code);
        if (room) out[code] = { members: room.members.length, lastSeen: null, people: room.members };
      }
      return out;
    },
    async getStats(): Promise<RoomStats | null> {
      const { counts, at } = await listing();
      return { ...counts, at };
    },
    // 방 서버 목록을 따로 받지 않는다 — 위 목록이 이미 방 서버 것이다.
    async getLive() {
      return null;
    },
    async serverTimeOffset() {
      const { at, receivedAt } = await listing();
      return at - receivedAt;
    },
    async close(codes) {
      // 서버가 한 번에 받는 만큼(500) — 넘으면 나눠 보내지 않고 막는다(일부만 닫히고 일부는 실패하는 일이 없게).
      if (codes.length > CLOSE_MAX)
        throw new PortError(
          'invalid',
          `방은 한 번에 ${CLOSE_MAX}개까지 닫을 수 있어요 (지금 ${codes.length}개)`,
        );
      return closeBy({ codes: [...codes] });
    },
    closeAll: () => closeBy({ all: true }),
  };
}

/** `api` 마다 하나 — 목록 캐시를 읽는 쪽 · 닫는 쪽이 같이 쓴다. */
export const createServerRoomBoard = perApi(build);
