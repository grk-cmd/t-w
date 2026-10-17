// 서버(t-w-server)가 읽는 운영 원격 설정 — 앱은 읽지 않는다. 범위 · 형식은 규칙 .validate · 서버 ConfigRules 와 같다(셋을 같이 고친다).
// 칸이 없으면 서버는 자기 기본값(env)을 쓴다 — 여기 def 는 화면 안내용(서버 기본값과 같게).

/** 정수 칸 하나 — 빈 칸으로 저장하면 그 칸을 지운다(= 서버 기본값). */
export interface IntField {
  key: string;
  label: string;
  min: number;
  max: number;
  def: number;
  unit: string;
  /** 칸 옆 안내(적용 시점이 다른 칸 등). */
  note?: string;
}

/** 한 노드 아래 정수 칸 묶음 — 칸마다 따로 쓴다(같은 노드의 다른 칸은 건드리지 않는다). */
export interface IntGroup {
  path: string;
  fields: readonly IntField[];
}

export type IntValues = Partial<Record<string, number>>;

// config/apiCache/{…} — 공개 GET 의 Cache-Control max-age(초). 0 이면 매번 다시 묻는다.
export const API_CACHE: IntGroup = {
  path: 'config/apiCache',
  fields: [
    { key: 'config', label: '원격 설정 /v1/config', min: 0, max: 600, def: 30, unit: '초' },
    { key: 'count', label: '방 개수 /v1/rooms/count', min: 0, max: 600, def: 15, unit: '초' },
    { key: 'card', label: '명함 /v1/users/…/card', min: 0, max: 600, def: 60, unit: '초' },
    { key: 'leaderboard', label: '랭킹 /v1/leaderboard', min: 0, max: 600, def: 60, unit: '초' },
  ],
};

// config/roomServer/frame — 방 서버 한 프레임 크기 상한. 웹소켓 maxPayload(1MB)는 시작 때 고정이라 그보다 크게는 못 늘린다.
export const ROOM_FRAME: IntGroup = {
  path: 'config/roomServer/frame',
  fields: [
    {
      key: 'maxBytes',
      label: '큰 프레임(join · def)',
      min: 65_536,
      max: 1_048_576,
      def: 1_048_576,
      unit: '바이트',
    },
    { key: 'maxSmallBytes', label: '나머지 프레임', min: 1024, max: 65_536, def: 16_384, unit: '바이트' },
  ],
};

export const RESTART_NOTE = '다음 재시작부터 적용';

// config/roomServer/timing 중 방 서버만 읽는 칸. 같은 노드의 joinWaitMs · clientGiveUpMs(앱) 등 다른 칸은 그대로 둔다.
export const ROOM_TIMING: IntGroup = {
  path: 'config/roomServer/timing',
  fields: [
    {
      key: 'roomStatsRefreshMs',
      label: '전체 방 수 다시 읽기',
      min: 5000,
      max: 600_000,
      def: 15_000,
      unit: 'ms',
    },
    { key: 'statsLogMs', label: '[stats] 로그 주기', min: 5000, max: 3_600_000, def: 60_000, unit: 'ms' },
    {
      key: 'restoreWindowMs',
      label: '재시작 뒤 방 되살리기 창',
      min: 0,
      max: 1_800_000,
      def: 150_000,
      unit: 'ms',
      note: RESTART_NOTE,
    },
  ],
};

const intIn = (v: unknown, f: IntField): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= f.min && v <= f.max;

/** 서버 값 → 칸별 정수. 범위 밖 · 숫자 아닌 칸은 없는 것으로(서버도 그 칸만 기본값). */
export function parseIntGroup(group: IntGroup, raw: unknown): IntValues {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: IntValues = {};
  for (const f of group.fields) if (intIn(o[f.key], f)) out[f.key] = o[f.key] as number;
  return out;
}

/** 입력 → 정수. 빈 칸은 null(칸 지움 = 서버 기본값), 잘못된 값은 undefined. */
export function parseIntField(f: IntField, input: string): number | null | undefined {
  const t = input.trim();
  if (t === '') return null;
  if (!/^[0-9]+$/.test(t)) return undefined;
  const n = Number(t);
  return intIn(n, f) ? n : undefined;
}

/** 바뀐 칸만 쓰기 묶음으로(경로 → 값 · null 은 지움). */
export function intGroupChanges(
  group: IntGroup,
  before: IntValues,
  next: Partial<Record<string, number | null>>,
): Record<string, number | null> {
  const updates: Record<string, number | null> = {};
  for (const f of group.fields) {
    if (!(f.key in next)) continue;
    const v = next[f.key] ?? null;
    if ((before[f.key] ?? null) !== v) updates[`${group.path}/${f.key}`] = v;
  }
  return updates;
}

/** 작업 기록 · 확인 창 글 — «statsLogMs 기본 → 30000 · roomStatsRefreshMs 15000 → 기본». */
export function intGroupDetail(
  group: IntGroup,
  before: IntValues,
  updates: Record<string, number | null>,
): string {
  return group.fields
    .filter((f) => `${group.path}/${f.key}` in updates)
    .map((f) => `${f.key} ${before[f.key] ?? '기본'} → ${updates[`${group.path}/${f.key}`] ?? '기본'}`)
    .join(' · ');
}

// config/logLevel/{api,realtime} — 각 서버의 로그 수준. 없으면 서버 기본(info).
export const LOG_LEVEL_PATH = 'config/logLevel';
export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export const LOG_TARGETS = [
  { key: 'api', label: 'API 서버' },
  { key: 'realtime', label: '방 서버' },
] as const;
export type LogTarget = (typeof LOG_TARGETS)[number]['key'];
export type LogLevels = Partial<Record<LogTarget, LogLevel>>;

export const isLogLevel = (v: unknown): v is LogLevel =>
  typeof v === 'string' && (LOG_LEVELS as readonly string[]).includes(v);

export function parseLogLevels(raw: unknown): LogLevels {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: LogLevels = {};
  for (const { key } of LOG_TARGETS) if (isLogLevel(o[key])) out[key] = o[key] as LogLevel;
  return out;
}

// config/apiCors — API 관리자 경로의 브라우저 허용 출처. 비면 서버 env(CORS_ALLOWED_ORIGINS).
export const API_CORS_PATH = 'config/apiCors';
export const API_CORS_MAX = 20;
export const API_CORS_ORIGIN_MAX = 200;
/** 규칙과 같은 식 — https:// + 호스트(소문자 · 숫자 · 점 · -)만. 와일드카드 · 포트 · 경로 · 끝 / 는 안 된다. */
export const API_CORS_RE = /^https:\/\/[a-z0-9.-]+$/;

export const isCorsOrigin = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= API_CORS_ORIGIN_MAX && API_CORS_RE.test(v);

/** 서버 값(배열 또는 0..19 키 객체) → 출처 목록. 형식이 틀린 줄은 버린다(서버도 그 줄만 버린다). */
export function parseCorsOrigins(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const vals = Array.isArray(raw)
    ? raw
    : Object.entries(raw as Record<string, unknown>)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, v]) => v);
  return vals.filter(isCorsOrigin);
}
