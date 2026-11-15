// API 판 — 열린 방 보기 · 닫기. `GET /v2/admin/rooms` 한 번이 «지금 열린 방 전부(시크릿룸 · 사람 포함)» 라서
// Firebase 판의 roomIndex · rooms · 멤버 읽기를 이 한 응답으로 채운다(방은 realtime 메모리라 유령 · 마지막 신호가 없다).
// 닫기 `POST /v2/admin/rooms/close { codes ≤500 }` 또는 `{ all: true }` → `{ closed, missing }`.
import { adminPath, perApi, portCall, type Api } from '@/shared/api';
import type { Channel, LiveRoom, RoomIndexEntry, RoomProbe, RoomStats } from '../model/room';
import { toRoomPerson } from '../model/room';
import type { RoomPort } from './port';

const PATH = adminPath('/rooms');
const CLOSE_MAX = 500;
/** 여러 카드가 한꺼번에 열려도 목록 요청은 한 번 — 이 시간 안에는 받은 것을 쓴다. */
const FRESH_MS = 2000;

interface Listing {
  /** 서버가 목록을 만든 시각. */
  at: number;
  /** 우리가 받은 시각 — 서버 시계와 이 PC 시계의 차를 잰다. */
  receivedAt: number;
  rooms: LiveRoom[];
  counts: Partial<Record<Channel, number>>;
}

type BoardPort = Pick<
  RoomPort,
  'getIndex' | 'getCodes' | 'probeRooms' | 'getStats' | 'getLive' | 'serverTimeOffset' | 'close' | 'closeAll'
>;

function parse(data: unknown, receivedAt: number): Listing {
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const at = typeof o.at === 'string' ? Date.parse(o.at) : NaN;
  const rooms: LiveRoom[] = [];
  for (const r of Array.isArray(o.rooms) ? (o.rooms as unknown[]) : []) {
    if (!r || typeof r !== 'object') continue;
    const x = r as Record<string, unknown>;
    if (typeof x.code !== 'string' || !x.code) continue;
    if (x.channel !== 'workingroom' && x.channel !== 'togetherroom') continue;
    const members = Array.isArray(x.members)
      ? (x.members as unknown[])
          .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
          .map((m) => toRoomPerson(m.name, m.userCode))
      : [];
    rooms.push({
      code: x.code,
      channel: x.channel,
      secret: x.secret === true,
      open: x.open === true,
      host: typeof x.host === 'string' && x.host ? x.host : null,
      members,
    });
  }
  const c = (o.counts && typeof o.counts === 'object' ? o.counts : {}) as Record<string, unknown>;
  const counts: Listing['counts'] = {};
  if (typeof c.workingroom === 'number') counts.workingroom = c.workingroom;
  if (typeof c.togetherroom === 'number') counts.togetherroom = c.togetherroom;
  return { at: Number.isNaN(at) ? receivedAt : at, receivedAt, rooms, counts };
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

  async function closeBy(body: { codes: string[] } | { all: true }): Promise<string[]> {
    cached = null; // 일부만 닫히고 실패해도 목록은 다시 받는다
    const done = await portCall(
      api,
      (a) => a.send<{ closed?: unknown }>('POST', `${PATH}/close`, { body }),
      '방을 닫지 못했어요',
    );
    cached = null;
    return Array.isArray(done?.closed) ? done.closed.filter((c): c is string => typeof c === 'string') : [];
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
      for (let i = 0; i < codes.length; i += CLOSE_MAX)
        await closeBy({ codes: codes.slice(i, i + CLOSE_MAX) });
    },
    closeAll: () => closeBy({ all: true }),
  };
}

/** `api` 마다 하나 — 목록 캐시를 읽는 쪽 · 닫는 쪽이 같이 쓴다. */
export const createServerRoomBoard = perApi(build);
