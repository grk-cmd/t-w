// DB 모양과 시간 기준은 앱(app/parts/room-index.js · room-stats.js · firebase-init.js)과 functions/room-stats.js 를 따른다.
export type Channel = 'workingroom' | 'togetherroom';

export interface RoomIndexEntry {
  lastSeen?: number;
  channel?: Channel;
  open?: boolean;
}

export interface RoomStats {
  workingroom?: number;
  togetherroom?: number;
  at?: number;
}

export const SECRET_ROOM_PREFIX = 'SCRT-';
// 하트비트가 30초라 세 번 놓치면 끝난 방으로 본다 — 앱 getRoomCounts · cleanGhostRooms, functions ROOM_LIVE_MS 와 같다.
export const ROOM_LIVE_MS = 90 * 1000;
// functions 가 1분마다 쓰므로 이보다 낡았으면 함수가 멈춘 것이다 — 앱 ROOM_STATS_FRESH_MS 와 같다.
export const ROOM_STATS_FRESH_MS = 3 * 60 * 1000;

export const CHANNEL_LABEL: Record<Channel, string> = {
  workingroom: '워킹룸',
  togetherroom: '투게더룸',
};

export const isSecretRoom = (code: string) => code.startsWith(SECRET_ROOM_PREFIX);

// 앱은 channel 이 없으면 워킹룸으로 센다.
export const roomChannel = (entry: RoomIndexEntry | null | undefined): Channel =>
  entry?.channel === 'togetherroom' ? 'togetherroom' : 'workingroom';

export function isRoomAlive(entry: RoomIndexEntry | null | undefined, now: number): boolean {
  const seen = Number(entry?.lastSeen);
  return Number.isFinite(seen) && now - seen < ROOM_LIVE_MS;
}

// 앱 _isMemberKey 와 같다 — `_meta` · `_photo` 같은 밑줄 키와 chatLog 는 사람이 아니다.
export const isMemberKey = (key: string) => !key.startsWith('_') && key !== 'chatLog';

/** rooms/{방} 을 키만 받아 본 결과. lastSeen 은 roomIndex 에 없는 방만 멤버 신호에서 직접 읽는다. */
export interface RoomProbe {
  members: number;
  lastSeen: number | null;
}

/** rooms 에는 있는데 roomIndex 에 줄이 없는 방 — 시크릿룸은 원래 roomIndex 에 안 적히므로 빼고. */
export function orphanCodes(index: Record<string, unknown>, codes: readonly string[]): string[] {
  return codes.filter((code) => !(code in index) && !isSecretRoom(code)).sort();
}

/** 전체 종료 대상 — 앱 closeAllRooms 처럼 rooms 의 모든 방(시크릿룸 포함) + roomIndex 에만 남은 줄. */
export function allRoomCodes(index: Record<string, unknown>, codes: readonly string[]): string[] {
  return [...new Set([...Object.keys(index), ...codes])].sort();
}

const probeAlive = (probe: RoomProbe | undefined, now: number) =>
  isRoomAlive({ lastSeen: probe?.lastSeen ?? undefined }, now);

/**
 * 유령 방 코드 — roomIndex 에서 신호가 90초 넘게 끊긴 줄 + 멤버 신호가 끊긴 고아 방.
 * 고아 방은 살펴본 결과(probes)가 있어야 넣는다. 시크릿룸은 roomIndex 를 안 쓰니 자동 청소에서 뺀다.
 */
export function ghostCodes(
  index: Record<string, RoomIndexEntry | null>,
  now: number,
  rooms: { codes?: readonly string[]; probes?: Record<string, RoomProbe> } = {},
): string[] {
  const indexed = Object.keys(index).filter((code) => !isSecretRoom(code) && !isRoomAlive(index[code], now));
  const orphans = orphanCodes(index, rooms.codes ?? []).filter(
    (code) => rooms.probes?.[code] && !probeAlive(rooms.probes[code], now),
  );
  return [...indexed, ...orphans].sort();
}

/** indexed: roomIndex 에 줄이 있음 · orphan: rooms 에만 있음 · secret: 시크릿룸(roomIndex 를 안 씀). */
export type RoomKind = 'indexed' | 'orphan' | 'secret';

export interface RoomRow {
  code: string;
  kind: RoomKind;
  /** roomIndex 에 없는 방은 모른다. */
  channel: Channel | null;
  open: boolean;
  lastSeen: number | null;
  alive: boolean;
  secret: boolean;
  /** rooms/{방} 의 멤버 키 수 — 아직 못 셌으면 null. */
  members: number | null;
}

// 시크릿룸은 맨 아래, 나머지는 살아 있는 방이 위 · 그 안에서는 최근 신호 순.
export function roomRows(
  index: Record<string, RoomIndexEntry | null>,
  now: number,
  rooms: { codes?: readonly string[]; probes?: Record<string, RoomProbe> } = {},
): RoomRow[] {
  const probes = rooms.probes ?? {};
  const members = (code: string) => probes[code]?.members ?? null;
  const indexed: RoomRow[] = Object.entries(index).map(([code, e]) => {
    const seen = Number(e?.lastSeen);
    return {
      code,
      kind: isSecretRoom(code) ? 'secret' : 'indexed',
      channel: roomChannel(e),
      open: e?.open === true,
      lastSeen: Number.isFinite(seen) ? seen : null,
      alive: isRoomAlive(e, now),
      secret: isSecretRoom(code),
      members: members(code),
    };
  });
  const rest: RoomRow[] = (rooms.codes ?? [])
    .filter((code) => !(code in index))
    .map((code) => ({
      code,
      kind: isSecretRoom(code) ? 'secret' : 'orphan',
      channel: null,
      open: false,
      lastSeen: probes[code]?.lastSeen ?? null,
      alive: !isSecretRoom(code) && probeAlive(probes[code], now),
      secret: isSecretRoom(code),
      members: members(code),
    }));
  return [...indexed, ...rest].sort(
    (a, b) =>
      Number(a.secret) - Number(b.secret) ||
      Number(b.alive) - Number(a.alive) ||
      (b.lastSeen ?? 0) - (a.lastSeen ?? 0) ||
      a.code.localeCompare(b.code),
  );
}

export interface RoomStatsSummary {
  total: number;
  workingroom: number;
  togetherroom: number;
  at: number | null;
  fresh: boolean;
}

export function roomStatsSummary(stats: RoomStats | null, now: number): RoomStatsSummary | null {
  if (!stats || typeof stats.workingroom !== 'number' || typeof stats.togetherroom !== 'number') return null;
  const at = typeof stats.at === 'number' ? stats.at : null;
  return {
    total: stats.workingroom + stats.togetherroom,
    workingroom: stats.workingroom,
    togetherroom: stats.togetherroom,
    at,
    fresh: at !== null && now - at < ROOM_STATS_FRESH_MS,
  };
}

export function formatAgo(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

// 경로에 들어가므로 . # $ [ ] / 가 섞이면 안 된다. 방 코드는 WORK-AB12 · PLAY- · SCRT- · 옛 COZY- 꼴이다.
export function normalizeRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return /^[A-Z0-9]+-[A-Z0-9]+$/.test(code) && code.length <= 40 ? code : null;
}

/**
 * 방 종료 = rooms/{방} 과 roomIndex/{방} 삭제. 안에 있던 사람은 방 구독이 빈 값을 받아 튕겨 나간다.
 * 한 묶음(db.commit)으로 보내므로 규칙에 하나라도 막히면 아무것도 지워지지 않는다.
 */
export function closeRoomsWrite(codes: string[]): Record<string, null> {
  const out: Record<string, null> = {};
  for (const code of codes) {
    out[`rooms/${code}`] = null;
    out[`roomIndex/${code}`] = null;
  }
  return out;
}
