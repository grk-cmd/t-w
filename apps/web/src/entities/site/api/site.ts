import { getPublic } from '@/shared/api';
import { API_ORIGIN } from '@/shared/config';
import { parseSite, type Site } from '../model/site';

/** 홈페이지 소식 · 내려받기 — 로그인 없이 읽는 공개 길(관리자가 웹 관리자에서 고친다) */
export const SITE_PATH = '/v2/site';

/** 실패와 «소식 없음 · 내려받기 닫힘» 을 가른다 — 못 받았을 때 닫힘으로 보이지 않게 */
export type SiteResult = { t: 'ok'; site: Site } | { t: 'failed'; why: string };

/** 응답 data 는 { news, download } — 다운로드 칸 모양이 틀리면 실패(모르는 채로 단추를 열지 않게) */
export async function fetchSite(
  fetchFn: typeof fetch = fetch,
  base: string = API_ORIGIN,
  timeoutMs?: number,
): Promise<SiteResult> {
  const r = await getPublic(SITE_PATH, fetchFn, base, timeoutMs);
  if (r.t === 'failed') return r;
  const site = parseSite(r.data);
  return site ? { t: 'ok', site } : { t: 'failed', why: '응답 모양이 다름' };
}
