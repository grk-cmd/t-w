// 두 판(Firebase 판 · API 판) 가운데 어느 쪽인가 — 빌드 때 `VITE_ADMIN_BACKEND` 하나로 정한다(통째).
// 이 값을 읽는 곳은 이 파일 · `shared/api/backend.ts` 뿐이다 — 화면 · 메뉴는 판을 모른다.

export type Backend = 'firebase' | 'api';

export const BACKENDS: readonly Backend[] = ['firebase', 'api'];

/** 값이 없거나 모르는 글자면 던진다 — 짐작하지 않는다. */
export function parseBackend(raw: unknown): Backend {
  if (raw === 'firebase' || raw === 'api') return raw;
  throw new Error(
    `VITE_ADMIN_BACKEND 는 'firebase' 또는 'api' 여야 해요 (지금: ${raw === undefined || raw === '' ? '없음' : String(raw)})`,
  );
}

export const BACKEND: Backend = parseBackend(import.meta.env.VITE_ADMIN_BACKEND);

/** 화면 머리에 적는 이름. */
export const BACKEND_LABEL: string = BACKEND === 'api' ? 'API 판' : 'Firebase 판';

/** 이 빌드의 커밋(짧은 해시) — 빌드 때 vite 가 넣는다. */
export const BUILD_COMMIT: string =
  typeof __ADMIN_BUILD_COMMIT__ === 'string' ? __ADMIN_BUILD_COMMIT__ : 'unknown';

/** e2e 에서 서버(가짜)가 있나 — API 판만 있다. Firebase 판 e2e 는 에뮬레이터 RTDB 로 읽는다. */
export const E2E_HAS_FAKE_API: boolean = BACKEND === 'api';

/** 옛 API 읽기가 «못 닿으면 RTDB» 로 넘어가도 되나 — Firebase 판만. API 판은 API 하나라 넘어가는 길이 없다. */
export const LEGACY_FALLBACK_ALLOWED: boolean = BACKEND === 'firebase';
