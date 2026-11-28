import { API_ORIGIN } from '@/shared/config';
import { parseSite, type Site } from '../model/site';

/** 이 시간 안에 답이 없으면 못 불러온 것으로 */
const TIMEOUT_MS = 6000;
/** 홈페이지 소식 · 내려받기 — 로그인 없이 읽는 공개 길(관리자가 웹 관리자에서 고친다) */
export const SITE_PATH = '/v2/site';

/** 실패와 «소식 없음 · 내려받기 닫힘» 을 가른다 — 못 받았을 때 닫힘으로 보이지 않게 */
export type SiteResult = { t: 'ok'; site: Site } | { t: 'failed'; why: string };

/** 응답은 서버 봉투 { success, data: { news, download } } */
export async function fetchSite(
  fetchFn: typeof fetch = fetch,
  base: string = API_ORIGIN,
  timeoutMs: number = TIMEOUT_MS,
): Promise<SiteResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${base}${SITE_PATH}`, { credentials: 'omit', signal: abort.signal });
    if (!res.ok) return { t: 'failed', why: `HTTP ${res.status}` };
    const body = (await res.json()) as { success?: unknown; data?: unknown } | null;
    if (!body || body.success !== true) return { t: 'failed', why: '응답 모양이 다름' };
    const site = parseSite(body.data);
    return site ? { t: 'ok', site } : { t: 'failed', why: '응답 모양이 다름' };
  } catch {
    return { t: 'failed', why: abort.signal.aborted ? '시간 초과' : '연결 안 됨' };
  } finally {
    clearTimeout(timer);
  }
}
