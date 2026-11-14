// 포트 하나 · 구현 둘(Firebase 판 · API 판) 을 고르는 도우미. 화면은 포트만 부르고 판을 모른다.
import { BACKEND, type Backend } from '@/shared/config';
import { ApiError } from './api';
import { apiErrorText } from './errorText';

/**
 * 포트가 돌려주는 실패의 갈래 — 판이 달라도 화면은 이 다섯으로만 가른다.
 * `conflict` 는 API 판만 낸다(Firebase 판은 지금처럼 마지막 쓰기가 이긴다).
 */
export type PortErrorKind = 'unreachable' | 'denied' | 'notFound' | 'conflict' | 'invalid';

export class PortError extends Error {
  readonly kind: PortErrorKind;
  /** 서버 `code`(API 판). 없으면 ''. */
  readonly code: string;

  constructor(kind: PortErrorKind, message: string, code = '') {
    super(message);
    this.name = 'PortError';
    this.kind = kind;
    this.code = code;
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
      return new PortError('denied', text, error.code);
    case 'notFound':
      return new PortError('notFound', text, error.code);
    case 'request':
      return new PortError(error.status === 409 ? 'conflict' : 'invalid', text, error.code);
    default: // unavailable · notReady
      return new PortError('unreachable', text, error.code);
  }
}

/**
 * 판마다 만드는 함수를 적고, 그 판의 것 하나만 부른다(다른 판 공장은 부르지 않는다).
 * 한쪽을 빼먹으면 타입 오류 — 아직 못 쓴 판은 `notPorted` 로 적는다.
 */
export function pickBackend<T>(makers: Record<Backend, () => T>, backend: Backend = BACKEND): T {
  return makers[backend]();
}

/**
 * 아직 이 판이 없는 포트 — 만들 때는 던지지 않고, 어떤 일이든 부르면 «이 화면은 아직 API 판이 없어요» 로 실패한다.
 * 톱니 2(`tests/app/backend-ratchet.test.ts`)가 이 이름을 센다.
 */
export function notPorted<T extends object>(name: string): T {
  const fail = () => {
    throw new PortError('unreachable', `이 화면은 아직 API 판이 없어요 (${name})`);
  };
  return new Proxy({} as T, { get: (_target, prop) => (prop === 'then' ? undefined : fail) });
}
