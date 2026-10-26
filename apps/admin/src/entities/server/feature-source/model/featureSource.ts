// config/sources/{기능} = 'server' | 'firebase' — 앱이 기능마다 어디서 받을지 고르는 스위치(app/parts/shared/source-switch.js).
// 칸이 없으면 옛 스위치(친구 flags.friendsApi · 방 roomServer.on · 카탈로그 없음 — 늘 서버 · 가챠 없음 — 늘 옛 길)를 본다. 옛 앱은 옛 스위치만 읽으므로
// 쓸 때는 새 자리와 옛 자리를 한 묶음으로 같이 쓴다(웹 관리자 · 옛 관리자 · 옛 앱 · 새 앱이 같은 값을 보게).
export const SOURCES_PATH = 'config/sources';

export const FEATURES = ['friends', 'rooms', 'catalog', 'gacha'] as const;
export type Feature = (typeof FEATURES)[number];
export type Source = 'server' | 'firebase';
export type FeatureSources = Record<Feature, Source>;

export interface FeatureMeta {
  label: string;
  what: string;
  server: string;
  firebase: string;
  /** 옛 앱이 읽는 옛 스위치 칸 — 같이 쓴다. 없으면 null. */
  legacyPath: string | null;
  /** 옛 칸 값 → 받는 곳(새 칸이 없을 때). 앱 source-switch.js FEATURES 와 같다. */
  legacy: (v: unknown) => Source;
  /** 받는 곳 → 옛 칸에 쓸 값. */
  toLegacy: (s: Source) => unknown;
}

export const FEATURE_META: Record<Feature, FeatureMeta> = {
  friends: {
    label: '👥 친구 목록',
    what: '친구 목록(이름 · 레벨 · 소개 · 사진)을 받는 곳',
    server: '서버(GET /v1/me/friends)에서 먼저 받고, 못 받으면 파이어베이스로',
    firebase: '파이어베이스에서만 받아요(서버는 묻지 않음) — 서버에 문제가 있을 때',
    legacyPath: 'config/flags/friendsApi',
    legacy: (v) => (v === false ? 'firebase' : 'server'),
    toLegacy: (s) => s === 'server',
  },
  rooms: {
    label: '🛰 방',
    what: '방을 방 서버(웹소켓)로 열지 · 들어갈지',
    server: '방 서버 사용 — 허용 목록 · 비율 · 기본 서버에 따라 서버로(🛰 방 서버 화면에서 정함)',
    firebase: '비상 정지 — 다음 입장부터 전원 파이어베이스. 이미 서버 방에 있는 사람은 나갈 때까지 그대로',
    legacyPath: 'config/roomServer/on',
    legacy: (v) => (v === true ? 'server' : 'firebase'),
    toLegacy: (s) => s === 'server',
  },
  catalog: {
    label: '🗂️ 카탈로그',
    what: '카탈로그 본문(파츠 · 책상 · 아이템)을 받는 곳',
    server: '서버(읽기 사본 GET /v1/catalog)에서 먼저 받고, 못 받거나 버전이 다르면 파이어베이스로',
    firebase: '파이어베이스에서만 받아요 — 서버 사본에 문제가 있을 때',
    legacyPath: null,
    legacy: () => 'server',
    toLegacy: () => null,
  },
  gacha: {
    label: '🎰 가챠 뽑기',
    what: '파츠 가챠를 누가 뽑고 저장하는지',
    server:
      '서버(POST /v1/me/gacha/draws)가 확률 · 풀 · 남은 횟수를 정하고 저장해요 — 서버가 안 되면 뽑기가 실패로 떠요(앱이 대신 뽑지 않음). 이 PC 에만 있던 뽑기는 올라가지 않아요',
    firebase: '앱이 뽑아 파이어베이스에 저장해요(지금까지 길)',
    legacyPath: null,
    legacy: () => 'firebase',
    toLegacy: () => null,
  },
};

export const sourcePath = (f: Feature) => `${SOURCES_PATH}/${f}`;

/** 새 칸 → 받는 곳(모르는 값은 null = 칸 없음). */
export const cleanSource = (v: unknown): Source | null => (v === 'server' || v === 'firebase' ? v : null);

/** 새 칸 · 옛 칸 → 지금 앱이 고르는 받는 곳. 앱 pickSource 와 같은 규칙. */
export const effectiveSource = (f: Feature, value: unknown, legacy: unknown): Source =>
  cleanSource(value) ?? FEATURE_META[f].legacy(legacy);

/** 쓰기 묶음 — 새 칸과 옛 칸(있으면)을 같이. */
export function sourceUpdates(f: Feature, s: Source): Record<string, unknown> {
  const m = FEATURE_META[f];
  return { [sourcePath(f)]: s, ...(m.legacyPath ? { [m.legacyPath]: m.toLegacy(s) } : {}) };
}

export const sourceLabel = (s: Source) => (s === 'server' ? '서버' : '파이어베이스');

/** 확인 창 글 — 무엇이 바뀌는지와 언제 반영되는지. */
export function sourceConfirmText(f: Feature, s: Source): string {
  const m = FEATURE_META[f];
  return `«${m.label}» 을 ${sourceLabel(s)}(으)로 — ${s === 'server' ? m.server : m.firebase}. 앱은 원격 설정을 다시 읽을 때(최대 5분 · 방은 다음 입장) 반영돼요.`;
}
