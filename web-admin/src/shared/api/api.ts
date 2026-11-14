// 자체 API 서버(t-w-server api/) 통로. 기능 코드가 fetch · 토큰을 직접 다루지 않게 하고, 테스트에서는 가짜 fetch 를 넣는다.

/** 운영 API — 운영 Firebase(together-working) 토큰만 받는다. */
export const PROD_API_BASE_URL = 'https://api.together-working.com';
const PROD_PROJECT_ID = 'together-working';

/** 이 시간 안에 답이 없으면 끊고 «연결 안 됨» 으로 본다. */
export const API_TIMEOUT_MS = 8000;

/** API 판 서버 길의 기준 경로 — 서버가 새 길을 /v2 로 옮겼다. 바뀌면 이 한 줄만 고친다. */
export const ADMIN_API_BASE = '/v2/admin';

/** `adminPath('/admins/me')` → `/v2/admin/admins/me` */
export const adminPath = (path: string): string => `${ADMIN_API_BASE}${path}`;

/**
 * - `unavailable` — 닿지 못함(네트워크 · CORS · 타임아웃 · 5xx · 봉투가 아닌 응답 · `missingRoute: 'unavailable'` 일 때의 404).
 * - `notReady` — 501. 서버가 아직 관리자 API 를 열지 않았다(점검 전 Firebase 모드).
 * - `auth` — 401 · 403. 그대로 보여 준다.
 * - `notFound` — `missingRoute: 'notFound'` 일 때의 404. 그 자원이 없다(서버 `code` 로 가른다).
 * - `request` — 그 밖의 4xx(409 포함).
 */
export type ApiErrorKind = 'unavailable' | 'notReady' | 'auth' | 'notFound' | 'request';

/**
 * 404 를 어떻게 볼까 — Firebase 판은 «서버가 아직 모르는 길»(`unavailable`), API 판은 «그 자원 없음»(`notFound`).
 */
export type MissingRoute = 'unavailable' | 'notFound';

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
  /** 파일 올리기(POST) — 본문은 바이트 그대로 · Content-Type 은 contentType. 실패 규칙은 send 와 같다. */
  upload<T>(path: string, bytes: Uint8Array, contentType: string): Promise<T>;
}

/**
 * 붙은 Firebase 프로젝트에 맞는 API 주소. 운영만 있다 — dev(로컬 · e2e)는 null.
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
  /** 404 를 어떻게 볼까 — 판마다 다르다(`MissingRoute`). */
  missingRoute: MissingRoute;
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');

export function createApi({
  baseUrl,
  token,
  fetch = globalThis.fetch,
  timeoutMs = API_TIMEOUT_MS,
  missingRoute,
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
    raw?: { bytes: Uint8Array; contentType: string },
  ): Promise<T> {
    const idToken = await token();
    if (!idToken) throw new ApiError('auth', 401, 'AUTH_REQUIRED', '로그인이 필요해요');

    const headers: Record<string, string> = { Authorization: `Bearer ${idToken}` };
    const init: RequestInit = { method, headers };
    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    if (raw) {
      headers['Content-Type'] = raw.contentType;
      init.body = raw.bytes as BodyInit;
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
    if (res.status === 501) {
      throw new ApiError('notReady', res.status, code, message || '서버가 아직 이 기능을 열지 않았어요');
    }
    if (res.status === 404 && missingRoute === 'unavailable') {
      // 서버가 아직 이 길을 모르는 판(배포 전 · 옛 서버)일 때다 — 닿지 못한 것과 같이 본다
      throw new ApiError('unavailable', res.status, code, message || `API 오류 (${res.status})`);
    }
    if (res.status >= 500) {
      throw new ApiError('unavailable', res.status, code, message || `API 오류 (${res.status})`);
    }
    if (!res.ok) {
      throw new ApiError(
        res.status === 404 ? 'notFound' : 'request',
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
    upload: (path, bytes, contentType) => request('POST', path, undefined, undefined, { bytes, contentType }),
  };
}
