// config/roomServer — 앱 room-server-gate.js 가 읽는 관리자 스위치. 규칙과 같은 모양 · 같은 형식 검사.
export interface RoomServerConfig {
  /** 켜면 시범 이용자는 서버에 방을 열고, 누구든 서버에 있는 방으로 따라간다. 끄면 다음 입장부터 전원 Firebase(비상 정지). */
  on: boolean;
  /** 서버 이름 → wss 주소 */
  servers: Record<string, string>;
  /** 사용자 코드 → 서버 이름(이 사람이 만드는 방이 열리는 서버) */
  allow: Record<string, string>;
  /** 채널별 방 개수 상한 — 칸이 없거나 틀리면 null(방 서버는 기본값 ROOM_LIMIT_DEFAULT). */
  limits: Record<Channel, number | null>;
}

export const CHANNELS = ['workingroom', 'togetherroom'] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel, string> = { workingroom: '워킹룸', togetherroom: '투게더룸' };
// 방 서버(t-w-server realtime/src/domain/rules.ts ROOM_LIMITS · ROOM_LIMIT_MIN/MAX) · 규칙 .validate 와 같은 값.
export const ROOM_LIMIT_DEFAULT = 250;
export const ROOM_LIMIT_MIN = 1;
export const ROOM_LIMIT_MAX = 100_000;

export const ROOM_SERVER_PATH = 'config/roomServer';
export const SERVER_NAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const SERVER_URL_RE = /^wss?:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?$/;
export const SERVER_URL_MAX = 200;
export const USER_CODE_RE = /^u[0-9a-z]{6,40}$/;

// 앱 CSP connect-src · room-server-gate.js ROOM_SERVER_URLS 와 같은 주소 — 여기 없는 주소는 앱이 쓰지 않는다.
export const APP_SERVER_URLS = [
  'wss://rooms.togetherworking.duckdns.org',
  'wss://rooms-dev.togetherworking.duckdns.org',
  'ws://127.0.0.1:8787',
  'ws://localhost:8787',
];
// 서버가 roomDir 에 적는 이름의 기본값(운영 · dev)
export const DEFAULT_SERVER_NAMES = { prod: 'realtime-1', dev: 'realtime-dev-1' } as const;

const strMap = (v: unknown, ok: (k: string, s: string) => boolean): Record<string, string> => {
  if (!v || typeof v !== 'object') return {};
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === 'string' && ok(e[0], e[1]),
    ),
  );
};

export function parseRoomServerConfig(raw: unknown): RoomServerConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    on: o.on === true,
    servers: strMap(o.servers, (k) => SERVER_NAME_RE.test(k)),
    allow: strMap(o.allow, (k) => USER_CODE_RE.test(k)),
    limits: parseLimits(o.limits),
  };
}

export const isRoomLimit = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= ROOM_LIMIT_MIN && v <= ROOM_LIMIT_MAX;

function parseLimits(raw: unknown): Record<Channel, number | null> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    workingroom: isRoomLimit(o.workingroom) ? o.workingroom : null,
    togetherroom: isRoomLimit(o.togetherroom) ? o.togetherroom : null,
  };
}

/** 지금 방 서버가 쓰는 상한 — 칸이 없으면 기본값. */
export const effectiveLimit = (cfg: RoomServerConfig | undefined, ch: Channel): number =>
  cfg?.limits[ch] ?? ROOM_LIMIT_DEFAULT;

/** 입력 칸 글자 → 상한. 정수 1~100000 이 아니면 null. */
export function parseLimitInput(text: string): number | null {
  const t = text.trim();
  if (!/^[0-9]+$/.test(t)) return null;
  const n = Number(t);
  return isRoomLimit(n) ? n : null;
}

/** wss://호스트 → https://호스트/health (방 서버가 CORS 로 열어 둔 상태 주소). */
export function healthUrl(wsUrl: string): string | null {
  const m = /^(wss?):\/\/([A-Za-z0-9.-]+(?::[0-9]{1,5})?)\/*$/.exec(wsUrl.trim());
  if (!m) return null;
  return `${m[1] === 'wss' ? 'https' : 'http'}://${m[2]}/health`;
}

export const isAppServerUrl = (url: string): boolean =>
  APP_SERVER_URLS.includes(url.trim().replace(/\/+$/, ''));

/** 서버 한 줄을 저장하면 안 되는 이유, 없으면 null. */
export function serverProblem(name: string, url: string): string | null {
  if (!SERVER_NAME_RE.test(name)) return '이름은 영문 소문자 · 숫자 · - (32자까지)';
  const u = url.trim();
  if (u.length > SERVER_URL_MAX || !SERVER_URL_RE.test(u)) return '주소는 wss://호스트[:포트] 형식';
  return null;
}

/** 서버를 빼면 안 되는 이유 — 그 서버를 쓰는 시범 이용자가 남아 있으면. */
export function serverInUse(cfg: RoomServerConfig, name: string): number {
  return Object.values(cfg.allow).filter((s) => s === name).length;
}
