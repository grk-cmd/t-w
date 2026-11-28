import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminPath, useApi, type Api } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  siteDownloadOf,
  siteNewsItemOf,
  siteNewsOf,
  type SiteDownload,
  type SiteNews,
  type SiteNewsDraft,
} from '../model/site';

const NEWS_KEY = ['site', 'news'];
const DOWNLOAD_KEY = ['site', 'download'];
const NEWS = adminPath('/site/news');
const DOWNLOAD = adminPath('/site/download');
const enc = encodeURIComponent;

/** 이 환경에는 API 가 없다(dev · e2e) — 홈페이지 소식 · 내려받기는 자체 서버에만 있다 */
export class NoSiteApiError extends Error {
  constructor() {
    super('이 환경에는 자체 서버 API 가 없어 홈페이지 소식 · 내려받기를 볼 수 없어요(운영 관리자에서만)');
    this.name = 'NoSiteApiError';
  }
}
const needApi = (api: Api | null): Api => {
  if (!api) throw new NoSiteApiError();
  return api;
};
/** 화면 실패 글 — API 가 없는 환경이면 그 까닭을, 아니면 공용 글(errorMessage) */
export const siteErrorMessage = (error: unknown, fallback: string) =>
  error instanceof NoSiteApiError ? error.message : errorMessage(error, fallback);

/** 서버가 준 한 건이 모양이 틀리면 저장은 됐어도 화면을 믿을 수 없다 — 던져서 목록을 다시 받게 */
const itemOrThrow = (v: unknown): SiteNews => {
  const n = siteNewsItemOf(v);
  if (!n) throw new Error('서버 답 모양이 달라요 — 목록을 다시 불러와 주세요');
  return n;
};

export async function listSiteNews(api: Api | null): Promise<SiteNews[]> {
  const d = await needApi(api).get<{ items?: unknown }>(NEWS);
  return siteNewsOf(d?.items);
}
export async function createSiteNews(api: Api | null, draft: SiteNewsDraft): Promise<SiteNews> {
  return itemOrThrow(await needApi(api).send<unknown>('POST', NEWS, { body: draft }));
}
export async function updateSiteNews(
  api: Api | null,
  from: SiteNews,
  draft: SiteNewsDraft,
): Promise<SiteNews> {
  return itemOrThrow(
    await needApi(api).send<unknown>('PATCH', `${NEWS}/${enc(from.id)}`, {
      body: { ...draft, version: from.version },
    }),
  );
}
export async function deleteSiteNews(api: Api | null, from: SiteNews): Promise<void> {
  await needApi(api).send<unknown>('DELETE', `${NEWS}/${enc(from.id)}`, { query: { version: from.version } });
}

export async function getSiteDownload(api: Api | null): Promise<SiteDownload> {
  const d = siteDownloadOf(await needApi(api).get<unknown>(DOWNLOAD));
  if (!d) throw new Error('서버 답 모양이 달라요');
  return d;
}
export async function putSiteDownload(
  api: Api | null,
  next: { open: boolean; version: string | null; rev: number },
): Promise<SiteDownload> {
  const d = siteDownloadOf(await needApi(api).send<unknown>('PUT', DOWNLOAD, { body: next }));
  if (!d) throw new Error('서버 답 모양이 달라요 — 다시 불러와 주세요');
  return d;
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
