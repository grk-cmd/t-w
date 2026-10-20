// DB 모양과 시간 기준은 앱(app/parts/room-index.js · room-stats.js · firebase-init.js)과 functions/room-stats.js 를 따른다.
export type Channel = 'workingroom' | 'togetherroom';

export interface RoomIndexEntry {
  lastSeen?: number;
  channel?: Channel;
  open?: boolean;
  /** 방 서버 이름 — 방 서버(t-w-server)가 올린 줄. Firebase rooms/{방} 에 사람이 없어도 정상이다. */
  srv?: string;
}

export interface RoomStats {
  workingroom?: number;
  togetherroom?: number;
  at?: number;
  /** 그중 방 서버 몫(functions/room-stats.js 가 srv 줄을 따로 셈) — 이미 위 두 칸에 들어 있다. */
  server?: { workingroom?: number; togetherroom?: number };
}

export const SECRET_ROOM_PREFIX = 'SCRT-';
// 하트비트가 30초라 세 번 놓치면 끝난 방으로 본다 — 앱 getRoomCounts · cleanGhostRooms, functions ROOM_LIVE_MS 와 같다.
export const ROOM_LIVE_MS = 90 * 1000;
// functions 가 1분마다 쓰므로 이보다 낡았으면 함수가 멈춘 것이다 — 앱 ROOM_STATS_FRESH_MS 와 같다.
export const ROOM_STATS_FRESH_MS = 3 * 60 * 1000;

/**
 * 전체 채널별 방 상한의 기본값 — config/roomLimits 가 없을 때 앱 · 방 서버가 쓰는 값(0.11.4 원격 설정).
 * 실제 값은 config/roomLimits(model/roomConfig.ts). config/roomServer/limits 는 방 서버 한 대 보호용이라 이것과 다르다.
 */
export const ROOM_TOTAL_LIMITS: Record<Channel, number> = { workingroom: 300, togetherroom: 300 };

export const CHANNEL_LABEL: Record<Channel, string> = {
  workingroom: '워킹룸',
  togetherroom: '투게더룸',
};

export const isSecretRoom = (code: string) => code.startsWith(SECRET_ROOM_PREFIX);

/** 방 서버가 올린 줄이면 그 서버 이름, 아니면 null. */
export const serverOf = (entry: RoomIndexEntry | null | undefined): string | null =>
  typeof entry?.srv === 'string' && entry.srv ? entry.srv : null;

// 앱은 channel 이 없으면 워킹룸으로 센다.
export const roomChannel = (entry: RoomIndexEntry | null | undefined): Channel =>
  entry?.channel === 'togetherroom' ? 'togetherroom' : 'workingroom';

export function isRoomAlive(entry: RoomIndexEntry | null | undefined, now: number): boolean {
  const seen = Number(entry?.lastSeen);
  return Number.isFinite(seen) && now - seen < ROOM_LIVE_MS;
}

// 앱 _isMemberKey 와 같다 — `_meta` · `_photo` 같은 밑줄 키와 chatLog 는 사람이 아니다.
export const isMemberKey = (key: string) => !key.startsWith('_') && key !== 'chatLog';

/** 방에 들어간 사람 한 명 — 사용자 코드(없을 수 있음) · 방에 보낸 이름(앱이 20자로 자른다). */
export interface RoomPerson {
  userId: string | null;
  name: string;
}

/** rooms/{방} 을 키만 받아 본 결과. lastSeen 은 roomIndex 에 없는 방만 멤버 신호에서 직접 읽는다. */
export interface RoomProbe {
  members: number;
  lastSeen: number | null;
  /** 멤버마다 name · userId 두 칸 — 사람으로 찾기용. 못 읽었으면 없음. */
  people?: RoomPerson[];
}

/** 멤버 칸에서 읽은 name · userId 를 사람 하나로 — 모양이 틀린 칸은 빈 이름 · null. */
export function toRoomPerson(name: unknown, userId: unknown): RoomPerson {
  return {
    userId: typeof userId === 'string' && userId ? userId : null,
    name: typeof name === 'string' ? name : '',
  };
}

/**
 * 방 서버(t-w-server)에 지금 열린 방 — API `GET /v1/admin/rooms/live`(방 서버 `/internal/rooms` 를 그대로).
 * 시크릿룸도 들어 있다(roomIndex 에는 안 적힌다 — 모든 앱이 읽는 공용 장부라 코드가 드러난다).
 */
export interface LiveRoom {
  code: string;
  channel: Channel;
  secret: boolean;
  open: boolean;
  host: string | null;
  members: RoomPerson[];
}

export interface LiveRooms {
  at: number;
  rooms: LiveRoom[];
}

export const LIVE_ROOMS_PATH = '/v1/admin/rooms/live';
/** 방 서버 방 줄의 «서버 이름» 자리 — 응답에는 서버 이름이 없다(roomIndex srv 줄이 있으면 그 이름을 쓴다). */
export const LIVE_SERVER_LABEL = '방 서버';

/** API 응답 모양 검사 — 틀리면 null(화면은 «방 서버 목록 못 받음»). 줄 하나가 틀리면 그 줄만 버린다. */
export function parseLiveRooms(v: unknown): LiveRooms | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { at?: unknown; rooms?: unknown };
  if (typeof o.at !== 'number' || !Array.isArray(o.rooms)) return null;
  const rooms: LiveRoom[] = [];
  for (const r of o.rooms as unknown[]) {
    if (!r || typeof r !== 'object') continue;
    const x = r as Record<string, unknown>;
    if (typeof x.code !== 'string' || !x.code) continue;
    if (x.channel !== 'workingroom' && x.channel !== 'togetherroom') continue;
    const members = Array.isArray(x.members)
      ? (x.members as unknown[])
          .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
          .map((m) => toRoomPerson(m.name, m.userId))
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
  return { at: o.at, rooms };
}

/** rooms 에는 있는데 roomIndex 에 줄이 없는 방 — 시크릿룸은 원래 roomIndex 에 안 적히므로 빼고. */
export function orphanCodes(index: Record<string, unknown>, codes: readonly string[]): string[] {
  return codes.filter((code) => !(code in index) && !isSecretRoom(code)).sort();
}

/**
 * 전체 종료 대상 — 앱 closeAllRooms 처럼 rooms 의 모든 방(시크릿룸 포함) + roomIndex 에만 남은 줄.
 * 방 서버 줄은 뺀다 — Firebase 에서 지워도 방 서버 방은 닫히지 않고 30초 뒤 줄이 되살아난다.
 */
export function allRoomCodes(
  index: Record<string, RoomIndexEntry | null>,
  codes: readonly string[],
): string[] {
  const serverOnly = (code: string) => !!serverOf(index[code]) && !codes.includes(code);
  return [...new Set([...Object.keys(index), ...codes])].filter((code) => !serverOnly(code)).sort();
}

const probeAlive = (probe: RoomProbe | undefined, now: number) =>
  isRoomAlive({ lastSeen: probe?.lastSeen ?? undefined }, now);

/**
 * 유령 방 코드 — roomIndex 에서 신호가 90초 넘게 끊긴 줄 + 멤버 신호가 끊긴 고아 방.
 * 고아 방은 살펴본 결과(probes)가 있어야 넣는다. 시크릿룸은 roomIndex 를 안 쓰니 자동 청소에서 뺀다.
 * 방 서버 줄은 뺀다 — 방은 방 서버에 있어 rooms 를 지워도 닫히지 않고, 낡은 줄은 functions roomStats 가 10분 뒤 걷는다.
 */
export function ghostCodes(
  index: Record<string, RoomIndexEntry | null>,
  now: number,
  rooms: { codes?: readonly string[]; probes?: Record<string, RoomProbe> } = {},
): string[] {
  const indexed = Object.keys(index).filter(
    (code) => !isSecretRoom(code) && !serverOf(index[code]) && !isRoomAlive(index[code], now),
  );
  const orphans = orphanCodes(index, rooms.codes ?? []).filter(
    (code) => rooms.probes?.[code] && !probeAlive(rooms.probes[code], now),
  );
  return [...indexed, ...orphans].sort();
}

/**
 * indexed: roomIndex 에 줄이 있음 · server: 방 서버가 올린 줄(Firebase 에 멤버 없음이 정상) ·
 * orphan: rooms 에만 있음 · secret: 시크릿룸(roomIndex 를 안 씀).
 */
export type RoomKind = 'indexed' | 'server' | 'orphan' | 'secret';

export interface RoomRow {
  code: string;
  kind: RoomKind;
  /** roomIndex 에 없는 방은 모른다. */
  channel: Channel | null;
  open: boolean;
  lastSeen: number | null;
  alive: boolean;
  secret: boolean;
  /** 방 서버 이름 — 방 서버 방이면. 인원은 방 서버에 있어 Firebase 로는 모른다. */
  server: string | null;
  /** rooms/{방} 의 멤버 키 수 · 방 서버 방이면 방 서버가 센 수 — 아직 못 셌으면 null. */
  members: number | null;
  /** 들어간 사람 — 아직 못 읽었으면 null. */
  people: RoomPerson[] | null;
}

// 시크릿룸은 맨 아래, 나머지는 살아 있는 방이 위 · 그 안에서는 최근 신호 순.
const byRoomOrder = (a: RoomRow, b: RoomRow) =>
  Number(a.secret) - Number(b.secret) ||
  Number(b.alive) - Number(a.alive) ||
  (b.lastSeen ?? 0) - (a.lastSeen ?? 0) ||
  a.code.localeCompare(b.code);

export function roomRows(
  index: Record<string, RoomIndexEntry | null>,
  now: number,
  rooms: { codes?: readonly string[]; probes?: Record<string, RoomProbe> } = {},
): RoomRow[] {
  const probes = rooms.probes ?? {};
  const members = (code: string) => probes[code]?.members ?? null;
  const people = (code: string) => probes[code]?.people ?? null;
  const indexed: RoomRow[] = Object.entries(index).map(([code, e]) => {
    const seen = Number(e?.lastSeen);
    const server = serverOf(e);
    return {
      code,
      kind: isSecretRoom(code) ? 'secret' : server ? 'server' : 'indexed',
      channel: roomChannel(e),
      open: e?.open === true,
      lastSeen: Number.isFinite(seen) ? seen : null,
      alive: isRoomAlive(e, now),
      secret: isSecretRoom(code),
      server,
      members: server ? null : members(code),
      people: server ? null : people(code),
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
      server: null,
      members: members(code),
      people: people(code),
    }));
  return [...indexed, ...rest].sort(byRoomOrder);
}

/**
 * 방 서버 목록을 합친다 — roomIndex 에 srv 줄이 있는 방은 인원 · 사람 · 시크릿 여부를 채우고,
 * 줄이 없는 방(시크릿룸)은 새 줄로 더한다. 방 서버가 지금 연 방이라 살아 있다(신호 시각 = 받은 시각).
 */
export function mergeLiveRooms(rows: readonly RoomRow[], live: LiveRooms | null): RoomRow[] {
  if (!live) return [...rows];
  const byCode = new Map(live.rooms.map((r) => [r.code, r]));
  const merged = rows.map((row) => {
    const l = byCode.get(row.code);
    if (!l) return row;
    byCode.delete(row.code);
    return {
      ...row,
      channel: l.channel,
      open: l.open,
      secret: row.secret || l.secret,
      alive: true,
      server: row.server ?? LIVE_SERVER_LABEL,
      members: l.members.length,
      people: l.members,
    };
  });
  const added: RoomRow[] = [...byCode.values()].map((l) => ({
    code: l.code,
    kind: l.secret ? 'secret' : 'server',
    channel: l.channel,
    open: l.open,
    lastSeen: live.at,
    alive: true,
    secret: l.secret,
    server: LIVE_SERVER_LABEL,
    members: l.members.length,
    people: l.members,
  }));
  return [...merged, ...added].sort(byRoomOrder);
}

/** 방 코드 · 들어간 사람 이름 · 사용자 코드로 찾기(대소문자 무시 · 포함). 빈 검색은 전부. */
export function filterRooms(rows: readonly RoomRow[], query: string): RoomRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  const has = (v: string | null) => !!v && v.toLowerCase().includes(q);
  return rows.filter((r) => has(r.code) || (r.people ?? []).some((p) => has(p.name) || has(p.userId)));
}

export interface RoomStatsSummary {
  total: number;
  workingroom: number;
  togetherroom: number;
  at: number | null;
  fresh: boolean;
  /** 그중 방 서버 몫 — 함수가 따로 세기 전(배포 전) 값이면 null. */
  server: Record<Channel, number> | null;
}

export function roomStatsSummary(stats: RoomStats | null, now: number): RoomStatsSummary | null {
  if (!stats || typeof stats.workingroom !== 'number' || typeof stats.togetherroom !== 'number') return null;
  const at = typeof stats.at === 'number' ? stats.at : null;
  const s = stats.server;
  const server =
    s && typeof s === 'object'
      ? { workingroom: Number(s.workingroom) || 0, togetherroom: Number(s.togetherroom) || 0 }
      : null;
  return {
    total: stats.workingroom + stats.togetherroom,
    workingroom: stats.workingroom,
    togetherroom: stats.togetherroom,
    at,
    fresh: at !== null && now - at < ROOM_STATS_FRESH_MS,
    server,
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
