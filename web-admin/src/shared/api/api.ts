// 자체 API 서버(t-w-server api/) 통로. 기능 코드가 fetch · 토큰을 직접 다루지 않게 하고, 테스트에서는 가짜 fetch 를 넣는다.

/** 운영 API — 운영 Firebase(together-working) 토큰만 받는다. */
export const PROD_API_BASE_URL = 'https://api.together-working.com';
const PROD_PROJECT_ID = 'together-working';

/** 이 시간 안에 답이 없으면 끊고 «연결 안 됨» 으로 본다 — 예전 방식(RTDB)으로 넘어가는 기준이라 길게 두지 않는다. */
export const API_TIMEOUT_MS = 8000;

/**
 * - `unavailable` — 닿지 못함(네트워크 · CORS · 타임아웃 · 5xx · 404 · 봉투가 아닌 응답). 예전 방식으로 넘어가도 된다.
 * - `auth` — 401 · 403. 넘어가지 않고 그대로 보여 준다(권한 문제를 RTDB 로 덮으면 모른 채 지나간다).
 * - `request` — 그 밖의 4xx(보낸 값이 틀림). 화면 쪽 버그라 넘어가지 않는다.
 */
export type ApiErrorKind = 'unavailable' | 'auth' | 'request';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** 서버 ErrorType 이름(AUTH_REQUIRED · ACCESS_DENIED …). 봉투를 못 읽었으면 ''. */
  readonly code: string;

  constructor(kind: ApiErrorKind, status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

/** 예전 방식(RTDB)으로 넘어가도 되는 실패인가 — 닿지 못한 것만. 권한 · 요청 오류는 그대로 보여 준다. */
export function shouldFallback(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'unavailable';
}

export function isApiAuthError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.kind === 'auth';
}

export type ApiParams = Record<string, string | number | undefined>;

export interface Api {
  /** 성공 봉투의 data 만 돌려준다. 실패는 ApiError. */
  get<T>(path: string, params?: ApiParams): Promise<T>;
}

/**
 * 붙은 Firebase 프로젝트에 맞는 API 주소. 운영만 있다 — dev(로컬 · e2e)는 null 이라 예전 방식으로 읽는다.
 * override(VITE_API_BASE_URL)를 주면 그 값을 쓴다(빈 문자열이면 «없음»).
 */
export function apiBaseUrl(projectId: string, override?: string): string | null {
  if (override !== undefined) return override.trim().replace(/\/+$/, '') || null;
  return projectId === PROD_PROJECT_ID ? PROD_API_BASE_URL : null;
}

interface Envelope {
  success?: unknown;
  data?: unknown;
  code?: unknown;
  message?: unknown;
}

interface Options {
  baseUrl: string;
  /** 지금 로그인한 사람의 Firebase ID 토큰. 로그인 전이면 null. */
  token: () => Promise<string | null>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

export function createApi({
  baseUrl,
  token,
  fetch = globalThis.fetch,
  timeoutMs = API_TIMEOUT_MS,
}: Options): Api {
  const url = (path: string, params: ApiParams = {}) => {
    const u = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
    }
    return u;
  };

  return {
    async get<T>(path: string, params?: ApiParams): Promise<T> {
      const idToken = await token();
      if (!idToken) throw new ApiError('auth', 401, 'AUTH_REQUIRED', '로그인이 필요해요');

      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), timeoutMs);
      let res: Response;
      let body: Envelope | null = null;
      try {
        res = await fetch(url(path, params), {
          headers: { Authorization: `Bearer ${idToken}` },
          signal: abort.signal,
        });
        try {
          body = (await res.json()) as Envelope;
        } catch {
          body = null;
        }
      } catch {
        // 네트워크 · CORS 거절 · 타임아웃(abort) — 브라우저는 셋을 가르지 않고 TypeError · AbortError 로만 알려 준다
        throw new ApiError(
          'unavailable',
          0,
          '',
          abort.signal.aborted ? 'API 응답이 늦어요' : 'API 에 연결하지 못했어요',
        );
      } finally {
        clearTimeout(timer);
      }

      const code = text(body?.code);
      const message = text(body?.message);
      if (res.status === 401 || res.status === 403) {
        throw new ApiError(
          'auth',
          res.status,
          code || (res.status === 401 ? 'AUTH_REQUIRED' : 'ACCESS_DENIED'),
          message,
        );
      }
      // 404 는 서버가 아직 이 기능을 모르는 판(배포 전)일 때다 — 닿지 못한 것과 같이 본다
      if (res.status >= 500 || res.status === 404) {
        throw new ApiError('unavailable', res.status, code, message || `API 오류 (${res.status})`);
      }
      if (!res.ok)
        throw new ApiError('request', res.status, code, message || `API 요청 오류 (${res.status})`);
      // 앞단(Caddy)의 오류 페이지처럼 봉투가 아닌 2xx 도 서버 문제로 본다
      if (!body || body.success !== true) {
        throw new ApiError('unavailable', res.status, code, message || 'API 응답 모양이 달라요');
      }
      return body.data as T;
    },
  };
}
