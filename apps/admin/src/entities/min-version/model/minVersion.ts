// 앱 _verLt · app-version-gate.js isBelow 와 같은 비교 — 세 자리 숫자, 꼬리(-beta 등)는 보지 않는다.
export const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
export const MIN_VERSION_MAX = 20; // 규칙 config/minRoomVer · config/minAppVer

/** room: 방 입장만 막는다(앱 _ensureRoomVersionOk). app: 앱 전체를 «업데이트해 주세요» 로 막는다(app-version-gate.js). */
export type MinVersionKind = 'room' | 'app';

export const MIN_VERSIONS = {
  room: {
    path: 'config/minRoomVer',
    action: 'settings.minRoomVer',
    title: '방 입장 최소 버전',
    blocked: '업데이트 전까지 방에 못 들어가요',
    tooHigh: '모두 방에서 막혀요',
  },
  app: {
    path: 'config/minAppVer',
    action: 'settings.minAppVer',
    title: '앱 최소 버전',
    blocked: '업데이트 전까지 앱을 못 써요(«업데이트해 주세요» 화면만 떠요)',
    tooHigh: '모두 앱을 못 써요',
  },
} as const satisfies Record<
  MinVersionKind,
  { path: string; action: string; title: string; blocked: string; tooHigh: string }
>;

const parts = (v: string) =>
  v
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((n) => parseInt(n, 10) || 0);

/** a < b 면 음수, 같으면 0, a > b 면 양수. */
export function compareVersion(a: string, b: string): number {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/**
 * 저장하면 안 되는 이유, 없으면 null. latest 는 공개된 최신 정식 버전(모르면 null).
 * 최신보다 높으면 그 버전인 앱이 아직 없어 모두 막힌다 — 그래서 막는다.
 */
export function minVersionProblem(
  kind: MinVersionKind,
  next: string,
  current: string | null,
  latest: string | null,
): string | null {
  const v = next.trim();
  if (!VERSION_RE.test(v)) return '0.10.2 처럼 숫자 세 자리로 넣어 주세요';
  if (current !== null && compareVersion(v, current) === 0) return '지금 값과 같아요';
  if (latest === null) return '최신 릴리스를 확인하지 못했어요 — 새로고침 뒤 다시';
  if (compareVersion(v, latest) > 0)
    return `최신 릴리스(${latest})보다 높아요 — ${MIN_VERSIONS[kind].tooHigh}`;
  return null;
}
