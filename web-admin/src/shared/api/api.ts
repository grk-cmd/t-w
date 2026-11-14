// 자체 API 서버(t-w-server api/) 통로. 기능 코드가 fetch · 토큰을 직접 다루지 않게 하고, 테스트에서는 가짜 fetch 를 넣는다.

/** 운영 API — 운영 Firebase(together-working) 토큰만 받는다. */
export const PROD_API_BASE_URL = 'https://api.together-working.com';
const PROD_PROJECT_ID = 'together-working';

/** 이 시간 안에 답이 없으면 끊고 «연결 안 됨» 으로 본다 — 예전 방식(RTDB)으로 넘어가는 기준이라 길게 두지 않는다. */
export const API_TIMEOUT_MS = 8000;

/**
 * - `unavailable` — 닿지 못함(네트워크 · CORS · 타임아웃 · 5xx · 봉투가 아닌 응답).
 * - `auth` — 401 · 403. 그대로 보여 준다(권한 문제를 RTDB 로 덮으면 모른 채 지나간다).
 * - `request` — 그 밖의 4xx(404 · 409 포함). 404 는 그 자원의 «없음» 이다(서버 `code` 로 가른다).
 */
export type ApiErrorKind = 'unavailable' | 'auth' | 'request';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** 서버 ErrorType 이름(AUTH_REQUIRED · ACCESS_DENIED …). 봉투를 못 읽었으면 ''. */
  readonly code: string;
  /** 실패 봉투의 `items`(겹친 코드 목록 같은 덧붙임). 없으면 null. */
  readonly items: unknown;

  constructor(kind: ApiErrorKind, status: number, code: string, message: string, items: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.items = items;
  }
}

/** 다른 곳에서 먼저 고쳤다(409 `CONCURRENT_UPDATE`) — 덮지 않고 그 자원만 다시 받는다. */
export function isApiConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409 && error.code === 'CONCURRENT_UPDATE';
}

/**
 * 예전 방식(RTDB)으로 넘어가도 되는 실패인가 — 닿지 못한 것 · 404(옮기는 동안 서버에 아직 없는 길).
 * 권한 · 그 밖의 요청 오류는 그대로 보여 준다.
 * TODO(D12-9): 화면이 모두 API 로 옮겨지면 이 갈래와 viaApiOr 를 함께 걷는다.
 */
export function shouldFallback(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === 'unavailable' || error.status === 404);
}

/** 예전 방식으로 읽은 까닭 — 이 환경에 API 가 없음(dev · e2e) · API 에 닿지 못함. */
export type ApiFallback = 'no-api' | 'unavailable';

/**
 * API 읽기 사본은 RTDB 를 몇 초 늦게 따라온다. 쓰기 직후 바로 다시 읽으면 옛 값이 오므로 이만큼 기다렸다 다시 읽는다.
 * (사본은 1초마다 반영 — 넉넉히 잡는다.)
 */
export const REPLICA_LAG_MS = 3000;

/** API 를 먼저, 닿지 못하면(또는 이 환경에 없으면) 예전 방식으로. 권한 · 요청 오류는 그대로 던진다. */
export async function viaApiOr<T>(
  api: Api | null,
  fromApi: (api: Api) => Promise<T>,
  fromFallback: (fallback: ApiFallback) => Promise<T>,
): Promise<T> {
  if (!api) return fromFallback('no-api');
  try {
    return await fromApi(api);
  } catch (error) {
    if (shouldFallback(error)) return fromFallback('unavailable');
    throw error;
  }
}

export function isApiAuthError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.kind === 'auth';
}

export type ApiParams = Record<string, string | number | undefined>;

export type ApiSendMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiSendOptions {
  /** JSON 본문. DELETE 는 본문을 싣지 않는다(판은 `query.version`). */
  body?: unknown;
  query?: ApiParams;
}

export interface Api {
  /** 성공 봉투의 data 만 돌려준다. 실패는 ApiError. */
  get<T>(path: string, params?: ApiParams): Promise<T>;
  /** 쓰기. 고쳐 쓰기는 본문에 `version`, DELETE 는 `query.version`. */
  send<T>(method: ApiSendMethod, path: string, options?: ApiSendOptions): Promise<T>;
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
  items?: unknown;
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

  async function request<T>(
    method: 'GET' | ApiSendMethod,
    path: string,
    params?: ApiParams,
    body?: unknown,
  ): Promise<T> {
    const idToken = await token();
    if (!idToken) throw new ApiError('auth', 401, 'AUTH_REQUIRED', '로그인이 필요해요');

    const headers: Record<string, string> = { Authorization: `Bearer ${idToken}` };
    const init: RequestInit = { method, headers };
    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    let res: Response;
    let parsed: Envelope | null = null;
    try {
      res = await fetch(url(path, params), { ...init, signal: abort.signal });
      try {
        parsed = (await res.json()) as Envelope;
      } catch {
        parsed = null;
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

    const code = text(parsed?.code);
    const message = text(parsed?.message);
    if (res.status === 401 || res.status === 403) {
      throw new ApiError(
        'auth',
        res.status,
        code || (res.status === 401 ? 'AUTH_REQUIRED' : 'ACCESS_DENIED'),
        message,
      );
    }
    if (res.status >= 500) {
      throw new ApiError('unavailable', res.status, code, message || `API 오류 (${res.status})`);
    }
    if (!res.ok) {
      throw new ApiError(
        'request',
        res.status,
        code,
        message || `API 요청 오류 (${res.status})`,
        parsed?.items ?? null,
      );
    }
    // 본문 없는 성공(204)
    if (res.status === 204) return undefined as T;
    // 앞단(Caddy)의 오류 페이지처럼 봉투가 아닌 2xx 도 서버 문제로 본다
    if (!parsed || parsed.success !== true) {
      throw new ApiError('unavailable', res.status, code, message || 'API 응답 모양이 달라요');
    }
    return parsed.data as T;
  }

  return {
    get: (path, params) => request('GET', path, params),
    send: (method, path, options = {}) => request(method, path, options.query, options.body),
  };
}
