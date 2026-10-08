// config/roomServer — 앱 room-server-gate.js 가 읽는 관리자 스위치. 규칙과 같은 모양 · 같은 형식 검사.
export interface RoomServerConfig {
  on: boolean;
  follow: boolean;
  /** 서버 이름 → wss 주소 */
  servers: Record<string, string>;
  /** 사용자 코드 → 서버 이름(이 사람이 만드는 방이 열리는 서버) */
  allow: Record<string, string>;
}

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
export const DEFAULT_SERVER_NAMES = { prod: 'rooms-1', dev: 'rooms-dev-1' } as const;

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
    follow: o.follow === true,
    servers: strMap(o.servers, (k) => SERVER_NAME_RE.test(k)),
    allow: strMap(o.allow, (k) => USER_CODE_RE.test(k)),
  };
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
