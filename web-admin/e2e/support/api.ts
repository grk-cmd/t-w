import type { Page, Route } from '@playwright/test';

// 앱이 e2e 빌드에서 서버로 쓰는 주소(src/shared/api/firebase.ts 의 E2E_API_BASE_URL 과 같게).
const API_BASE_URL = 'http://127.0.0.1:18080';

export interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  /** 보낸 JSON 본문. 없으면 undefined. */
  body: unknown;
}

/** 성공은 `data`, 실패는 `status` + `code`(+ `message` · `items`). */
export interface ApiReply {
  status?: number;
  data?: unknown;
  code?: string;
  message?: string;
  items?: unknown;
}

export type ApiHandler = (request: ApiRequest) => ApiReply | Promise<ApiReply>;

export interface FakeApi {
  /** 이 길(`GET /v1/admin/x` 꼴)에 대한 답을 정한다 — 같은 길을 다시 정하면 바뀐다. */
  on(route: string, handler: ApiHandler | ApiReply): void;
  /** 지금까지 받은 요청(받은 차례대로) — 화면마다 «받는 요청 · 보낸 본문» 을 판정한다. */
  readonly requests: ApiRequest[];
  requestsTo(route: string): ApiRequest[];
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

const key = (method: string, path: string) => `${method.toUpperCase()} ${path}`;

/**
 * 서버를 대신한다 — 로그인은 에뮬레이터가, `/v1/**` 응답은 시험이 준다.
 * 정하지 않은 길은 404 `DATA_ROUTE_NOT_FOUND`(옮기지 않은 화면은 아직 Firebase 로 읽는다).
 */
export async function fakeApi(page: Page): Promise<FakeApi> {
  const handlers = new Map<string, ApiHandler>();
  const requests: ApiRequest[] = [];

  await page.route(`${API_BASE_URL}/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    const url = new URL(req.url());
    const text = req.postData();
    const request: ApiRequest = {
      method: req.method(),
      path: url.pathname,
      query: url.searchParams,
      body: text ? JSON.parse(text) : undefined,
    };
    requests.push(request);

    const handler = handlers.get(key(request.method, request.path));
    const reply: ApiReply = handler
      ? await handler(request)
      : { status: 404, code: 'DATA_ROUTE_NOT_FOUND', message: '없는 길이에요' };
    const status = reply.status ?? 200;
    await route.fulfill({
      status,
      headers: CORS,
      contentType: 'application/json',
      body: JSON.stringify(
        status < 300
          ? { success: true, data: reply.data ?? null, message: null }
          : {
              success: false,
              data: null,
              code: reply.code ?? 'ERROR',
              message: reply.message ?? '',
              items: reply.items,
            },
      ),
    });
  });

  return {
    on: (route, handler) => handlers.set(route, typeof handler === 'function' ? handler : () => handler),
    requests,
    requestsTo: (route) => requests.filter((r) => key(r.method, r.path) === route),
  };
}

/** 관리자 확인(`GET /v1/admin/admins/me`)의 답 — 관리자. */
export const ADMIN_ME: ApiReply = {
  data: { name: '시험 관리자', grantedAt: '2026-01-01T00:00:00Z', version: 1 },
};

/** 관리자 확인의 답 — 관리자 계정이 아님(403). */
export const NOT_ADMIN: ApiReply = { status: 403, code: 'ACCESS_DENIED', message: '접근 권한이 없습니다.' };
