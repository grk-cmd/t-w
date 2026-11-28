import { API_ORIGIN } from '@/shared/config';

/** 이 시간 안에 답이 없으면 못 불러온 것으로 — 화면이 서버를 오래 기다리지 않게 */
export const PUBLIC_TIMEOUT_MS = 6000;

/** 실패와 «없음» 을 가른다 — data 가 비어도 ok · 못 받으면 failed(까닭은 콘솔 · 시험용) */
export type PublicResult = { t: 'ok'; data: unknown } | { t: 'failed'; why: string };

/** 우리 서버 공개 GET(로그인 없음 · 토큰 · 쿠키 안 실음) — 봉투 { success, data } 의 data 만. 공개 길은 모두 이것을 부른다 */
export async function getPublic(
  path: string,
  fetchFn: typeof fetch = fetch,
  base: string = API_ORIGIN,
  timeoutMs: number = PUBLIC_TIMEOUT_MS,
): Promise<PublicResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${base}${path}`, { credentials: 'omit', signal: abort.signal });
    if (!res.ok) return { t: 'failed', why: `HTTP ${res.status}` };
    const body = (await res.json()) as { success?: unknown; data?: unknown } | null;
    if (!body || body.success !== true) return { t: 'failed', why: '응답 모양이 다름' };
    return { t: 'ok', data: body.data };
  } catch {
    return { t: 'failed', why: abort.signal.aborted ? '시간 초과' : '연결 안 됨' };
  } finally {
    clearTimeout(timer);
  }
}
