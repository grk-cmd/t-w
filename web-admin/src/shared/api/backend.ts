// 포트 하나 · 구현 둘(Firebase 판 · API 판) 을 고르는 도우미. 화면은 포트만 부르고 판을 모른다.
import { BACKEND, type Backend } from '@/shared/config';
import { ApiError, type Api } from './api';
import { apiErrorText } from './errorText';

/**
 * 포트가 돌려주는 실패의 갈래 — 판이 달라도 화면은 이 다섯으로만 가른다.
 * `conflict` 는 API 판만 낸다(Firebase 판은 지금처럼 마지막 쓰기가 이긴다).
 */
export type PortErrorKind = 'unreachable' | 'denied' | 'notFound' | 'conflict' | 'invalid';

export const NO_API_TEXT = '이 환경에는 API 주소가 없어요 — 빌드 값 VITE_API_BASE_URL 로 정해 주세요';

export class PortError extends Error {
  readonly kind: PortErrorKind;
  /** 서버 `code`(API 판). 없으면 ''. */
  readonly code: string;
  /** 서버 실패 봉투의 `items`(겹친 시크릿룸 목록 같은 덧붙임). 없으면 null. */
  readonly items: unknown;

  constructor(kind: PortErrorKind, message: string, code = '', items: unknown = null) {
    super(message);
    this.name = 'PortError';
    this.kind = kind;
    this.code = code;
    this.items = items;
  }
}

export const isPortError = (error: unknown, kind?: PortErrorKind): error is PortError =>
  error instanceof PortError && (kind === undefined || error.kind === kind);

/** API 판의 서버 오류 → 포트 실패. 그 밖의 오류는 닿지 못한 것으로 본다. */
export function toPortError(error: unknown, fallback = '서버에 연결하지 못했어요'): PortError {
  if (error instanceof PortError) return error;
  const text = apiErrorText(error, fallback);
  if (!(error instanceof ApiError)) return new PortError('unreachable', text);
  switch (error.kind) {
    case 'auth':
      return new PortError('denied', text, error.code, error.items);
    case 'notFound':
      return new PortError('notFound', text, error.code, error.items);
    case 'request':
      return new PortError(error.status === 409 ? 'conflict' : 'invalid', text, error.code, error.items);
    default: // unavailable · notReady
      return new PortError('unreachable', text, error.code, error.items);
  }
}

/**
 * 판마다 만드는 함수를 적고, 그 판의 것 하나만 부른다(다른 판 공장은 부르지 않는다).
 * 한쪽을 빼먹으면 타입 오류.
 */
export function pickBackend<T>(makers: Record<Backend, () => T>, backend: Backend = BACKEND): T {
  return makers[backend]();
}

/**
 * 저장이 `conflict`(다른 곳에서 먼저 고침)로 실패하면 그 화면의 값을 다시 받는다 — 서버가 덮지 않으므로 화면이 새 값을 보고 다시 결정한다.
 * Firebase 판은 `conflict` 를 내지 않아 아무 일도 하지 않는다.
 */
export const refreshOnConflict = (refresh: () => unknown) => (error: unknown) => {
  if (isPortError(error, 'conflict')) void refresh();
};

/** `perApi` 가 만든 포트 보관함을 비우는 함수들 — 로그아웃 때 한꺼번에 부른다. */
const portStores: Array<() => void> = [];

/**
 * 로그아웃 — 포트가 들고 있던 상태(받아 둔 목록 · 진행 중 요청 · 다시 보낼 요청 번호)를 모두 버린다.
 * 다음에 들어오는 계정이 이전 계정의 상태를 이어받지 않게 한다. 이미 만들어진 포트는 화면과 함께 사라진다.
 */
export function resetPortState(): void {
  for (const reset of portStores) reset();
}

/**
 * `api` 마다 포트를 하나만 만든다 — 훅을 부르는 곳마다 따로 만들면 포트가 들고 있는 상태(받아 둔 목록 · 보낸 것)가
 * 읽는 훅과 쓰는 훅에 나뉘어 버린다. `api` 가 없으면(주소 없음) 하나만 둔다.
 * 읽은 값의 `version` 은 포트가 아니라 화면이 들고 있다 — 포트 상태는 로그아웃(`resetPortState`)에 모두 버려진다.
 */
export function perApi<T>(make: (api: Api | null) => T): (api: Api | null) => T {
  let made = new WeakMap<Api, T>();
  let none: T | undefined;
  portStores.push(() => {
    made = new WeakMap<Api, T>();
    none = undefined;
  });
  return (api) => {
    if (!api) return (none ??= make(null));
    let port = made.get(api);
    if (port === undefined) {
      port = make(api);
      made.set(api, port);
    }
    return port;
  };
}

/** API 판 호출 한 번 — 서버 오류를 포트 실패(`PortError`)로 바꿔 던진다. `api` 가 없으면(주소 없음) «주소 없음». */
export async function portCall<T>(
  api: Api | null,
  call: (api: Api) => Promise<T>,
  fallback = '서버에 연결하지 못했어요',
): Promise<T> {
  if (!api) throw new PortError('unreachable', NO_API_TEXT);
  try {
    return await call(api);
  } catch (error) {
    throw toPortError(error, fallback);
  }
}
