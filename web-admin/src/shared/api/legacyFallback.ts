// Firebase 판 전용 — 지금 운영 코드가 옛 API 를 «먼저 읽고 못 닿으면 RTDB» 로 읽는 길(8곳).
// API 판은 이 파일을 쓰지 않는다(API 하나 · 넘어가는 길 없음). 각 묶음의 a PR 이 쓰는 곳을 `firebase.ts` 로 옮기고,
// 마지막 a 뒤 이 파일은 Firebase 판과 같이 걷는다(D12-Z). 새로 쓰는 곳을 늘리지 않는다 — 톱니 1 이 센다.
import { LEGACY_FALLBACK_ALLOWED } from '@/shared/config';
import { ApiError, type Api } from './api';

/**
 * 예전 방식(RTDB)으로 넘어가도 되는 실패인가 — 닿지 못한 것 · 아직 안 연 서버(501) · 404(Firebase 판은 `missingRoute: 'unavailable'` 라 이것도 `unavailable`).
 * 권한 · 그 밖의 요청 오류는 그대로 보여 준다.
 */
export function shouldFallback(error: unknown, allowed: boolean = LEGACY_FALLBACK_ALLOWED): boolean {
  return allowed && error instanceof ApiError && (error.kind === 'unavailable' || error.kind === 'notReady');
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
  allowed: boolean = LEGACY_FALLBACK_ALLOWED,
): Promise<T> {
  if (!api) {
    // API 판은 넘어가지 않는다 — 주소가 없으면 닿지 못한 것으로 멈춘다
    if (!allowed) throw new ApiError('unavailable', 0, '', 'API 주소가 없어요');
    return fromFallback('no-api');
  }
  try {
    return await fromApi(api);
  } catch (error) {
    if (shouldFallback(error, allowed)) return fromFallback('unavailable');
    throw error;
  }
}
