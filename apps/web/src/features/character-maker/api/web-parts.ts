import { getPublic, PUBLIC_TIMEOUT_MS } from '@/shared/api';
import { API_ORIGIN } from '@/shared/config';
import { parseRemoteParts, type RemotePart } from '../model/remote-parts';

/** 카탈로그에서 상품만 · 기본 몸 모델 것만 묻는다. 면(surface)은 서버가 거르지 않아 파서가 거른다 — 그릴 수 없는 조각도 파서가 건너뛴다.
    토큰은 싣지 않는다(익명 기준 — 잠긴 상품엔 조각이 없다) */
const PRODUCTS_PATH = '/v2/catalog?only=products&target=baseModel';

/** 실패와 «올린 파츠 없음» 을 가른다 — 둘 다 칸이 비지만 고르기 판 안내가 다르다 */
export type WebPartsResult = { t: 'ok'; parts: RemotePart[] } | { t: 'failed'; why: string };

/** 관리자가 올린 꾸미기 상품(공개 카탈로그 · 기본 몸 모델 상품) — 로그인 없이 읽는다. 응답은 서버 봉투 { success, data: { products } } */
export async function fetchWebParts(
  fetchFn: typeof fetch = fetch,
  base: string = API_ORIGIN,
  timeoutMs: number = PUBLIC_TIMEOUT_MS,
): Promise<WebPartsResult> {
  const r = await getPublic(PRODUCTS_PATH, fetchFn, base, timeoutMs);
  return r.t === 'ok' ? { t: 'ok', parts: parseRemoteParts(r.data) } : r;
}
