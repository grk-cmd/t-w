// API 판 — 홈페이지 소식 · 내려받기. 응답은 엄격하게 읽는다(wire): 약속과 다른 칸이 있으면 빈 목록 · 0 · 빈 값으로 덮지 않고 PortError 로 던진다.
// 계약(칸 · 실패)은 홈페이지 짝 PR #1235 «서버 작업 필요» 한 곳 — 공개 GET /v2/site 와 같은 모양.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminPath,
  isPortError,
  portCall,
  useApi,
  wireArray,
  wireBool,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  wireTime,
  type Api,
} from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  SITE_LANGS,
  type SiteDownload,
  type SiteNews,
  type SiteNewsDraft,
  type SiteText,
} from '../model/site';

const NEWS_KEY = ['site', 'news'];
const DOWNLOAD_KEY = ['site', 'download'];
const NEWS = adminPath('/site/news');
const DOWNLOAD = adminPath('/site/download');
const enc = encodeURIComponent;

/** 화면 실패 글 — 포트 실패(주소 없음 · 응답 모양 · 서버 글)는 그 까닭을, 그 밖은 공용 글 */
export const siteErrorMessage = (error: unknown, fallback: string) =>
  isPortError(error) ? error.message : errorMessage(error, fallback);
/** 다른 곳에서 먼저 고쳤다(409) — 덮지 않고 다시 받는다 */
export const isSiteConflict = (error: unknown) => isPortError(error, 'conflict');

/** 세 언어 칸 — 안 쓴 언어도 '' 로 온다(계약) */
function siteText(v: unknown, what: string): SiteText {
  const o = wireObject(v, what);
  const out: SiteText = { ko: '', en: '', ja: '' };
  for (const l of SITE_LANGS) out[l] = wireString(o[l], `${what}.${l}`);
  return out;
}

/** 소식 한 건 — 모양이 틀리면 던진다(몰래 빼거나 1970년으로 채우지 않는다) */
export function siteNewsFromWire(v: unknown, what = '소식'): SiteNews {
  const o = wireObject(v, what);
  return {
    id: wireString(o.id, `${what}.id`),
    pinned: wireBool(o.pinned, `${what}.pinned`),
    title: siteText(o.title, `${what}.title`),
    body: siteText(o.body, `${what}.body`),
    publishedAt: wireTime(o.publishedAt, `${what}.publishedAt`),
    version: wireNumber(o.version, `${what}.version`),
  };
}

/** 소식 목록(GET …/news 의 data) — 고정 먼저 · 최신 순 */
export function siteNewsListFromWire(data: unknown): SiteNews[] {
  return wireArray(wireObject(data, '소식 목록').items, '소식 목록의 items')
    .map((n, i) => siteNewsFromWire(n, `items[${i}]`))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt - a.publishedAt);
}

/** 내려받기(GET · PUT …/download 의 data) */
export function siteDownloadFromWire(data: unknown): SiteDownload {
  const o = wireObject(data, '내려받기');
  const f = wireObject(o.files, '내려받기의 files');
  return {
    open: wireBool(o.open, '내려받기의 open'),
    version: wireNullableString(o.version, '내려받기의 version'),
    files: {
      win: wireNullableString(f.win, 'files.win'),
      macArm64: wireNullableString(f.macArm64, 'files.macArm64'),
      macX64: wireNullableString(f.macX64, 'files.macX64'),
    },
    rev: wireNumber(o.rev, '내려받기의 rev'),
  };
}

export async function listSiteNews(api: Api | null): Promise<SiteNews[]> {
  return siteNewsListFromWire(await portCall(api, (a) => a.get<unknown>(NEWS), '소식을 불러오지 못했어요'));
}
export async function createSiteNews(api: Api | null, draft: SiteNewsDraft): Promise<SiteNews> {
  return siteNewsFromWire(
    await portCall(api, (a) => a.send<unknown>('POST', NEWS, { body: draft }), '올리지 못했어요'),
  );
}
export async function updateSiteNews(
  api: Api | null,
  from: SiteNews,
  draft: SiteNewsDraft,
): Promise<SiteNews> {
  return siteNewsFromWire(
    await portCall(
      api,
      (a) =>
        a.send<unknown>('PATCH', `${NEWS}/${enc(from.id)}`, { body: { ...draft, version: from.version } }),
      '고치지 못했어요',
    ),
  );
}
export async function deleteSiteNews(api: Api | null, from: SiteNews): Promise<void> {
  await portCall(
    api,
    (a) => a.send<unknown>('DELETE', `${NEWS}/${enc(from.id)}`, { query: { version: from.version } }),
    '내리지 못했어요',
  );
}

export async function getSiteDownload(api: Api | null): Promise<SiteDownload> {
  return siteDownloadFromWire(
    await portCall(api, (a) => a.get<unknown>(DOWNLOAD), '내려받기를 불러오지 못했어요'),
  );
}
export async function putSiteDownload(
  api: Api | null,
  next: { open: boolean; version: string | null; rev: number },
): Promise<SiteDownload> {
  return siteDownloadFromWire(
    await portCall(api, (a) => a.send<unknown>('PUT', DOWNLOAD, { body: next }), '저장하지 못했어요'),
  );
}

export function useSiteNews() {
  const api = useApi();
  return useQuery({ queryKey: NEWS_KEY, queryFn: () => listSiteNews(api), retry: false });
}
export function useSiteDownload() {
  const api = useApi();
  return useQuery({ queryKey: DOWNLOAD_KEY, queryFn: () => getSiteDownload(api), retry: false });
}
export function useRefreshSite() {
  const client = useQueryClient();
  return {
    news: () => client.invalidateQueries({ queryKey: NEWS_KEY }),
    download: () => client.invalidateQueries({ queryKey: DOWNLOAD_KEY }),
  };
}
