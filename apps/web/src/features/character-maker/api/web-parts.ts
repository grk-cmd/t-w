import { API_ORIGIN } from '@/shared/config';
import { parseRemoteParts, type RemotePart } from '../model/remote-parts';

/** 이 시간 안에 답이 없으면 못 불러온 것으로 — 고르기 판이 서버를 기다리지 않게 */
const TIMEOUT_MS = 6000;
/** 생성기가 그리는 면만 묻는다(grk-cmd/t-w#517 §6-1) — 상품은 통째로 오고, 그릴 수 없는 조각은 파서가 건너뛴다.
    토큰은 싣지 않는다(익명 기준 — 잠긴 상품엔 조각이 없다) */
const PRODUCTS_PATH = '/v1/products?target=baseModel&surface=face';

/** 실패와 «올린 파츠 없음» 을 가른다 — 둘 다 칸이 비지만 고르기 판 안내가 다르다 */
export type WebPartsResult = { t: 'ok'; parts: RemotePart[] } | { t: 'failed'; why: string };

/** 관리자가 올린 꾸미기 상품(공개 목록 · 기본 몸 모델의 얼굴 면) — 로그인 없이 읽는다. 응답은 서버 봉투 { success, data: { products } } */
export async function fetchWebParts(
  fetchFn: typeof fetch = fetch,
  base: string = API_ORIGIN,
  timeoutMs: number = TIMEOUT_MS,
): Promise<WebPartsResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${base}${PRODUCTS_PATH}`, { credentials: 'omit', signal: abort.signal });
    if (!res.ok) return { t: 'failed', why: `HTTP ${res.status}` };
    const body = (await res.json()) as { success?: unknown; data?: unknown } | null;
    if (!body || body.success !== true) return { t: 'failed', why: '응답 모양이 다름' };
    return { t: 'ok', parts: parseRemoteParts(body.data) };
  } catch {
    return { t: 'failed', why: abort.signal.aborted ? '시간 초과' : '연결 안 됨' };
  } finally {
    clearTimeout(timer);
  }
}
