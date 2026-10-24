import { API_ORIGIN } from '@/shared/config';
import { parseRemoteParts, type RemotePart } from '../model/remote-parts';

/** 이 시간 안에 답이 없으면 기본 그림만 쓴다 — 고르기 판이 서버를 기다리지 않게 */
const TIMEOUT_MS = 6000;

/** 실패와 «올린 파츠 없음» 을 가른다 — 둘 다 화면은 기본 그림만이지만 원인이 다르다 */
export type WebPartsResult = { t: 'ok'; parts: RemotePart[] } | { t: 'failed'; why: string };

/** 관리자가 올린 웹 생성기 파츠(공개 목록) — 로그인 없이 읽는다. 응답은 서버 봉투 { success, data: { parts } } */
export async function fetchWebParts(
  fetchFn: typeof fetch = fetch,
  base: string = API_ORIGIN,
  timeoutMs: number = TIMEOUT_MS,
): Promise<WebPartsResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${base}/web-creator/parts`, { credentials: 'omit', signal: abort.signal });
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
