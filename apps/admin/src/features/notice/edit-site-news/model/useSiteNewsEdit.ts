import { useMutation } from '@tanstack/react-query';
import {
  createSiteNews,
  deleteSiteNews,
  updateSiteNews,
  useRefreshSite,
  type SiteNews,
  type SiteNewsDraft,
} from '@/entities/homepage/site';
import { useApi } from '@/shared/api';

/** 쓰기 뒤엔 성공 · 실패 모두 목록을 다시 받는다 — 409(다른 곳에서 먼저 고침)면 덮지 않고 새 글을 보고 다시 정한다 */
export function useSiteNewsEdit() {
  const api = useApi();
  const refresh = useRefreshSite().news;
  const settle = { onSettled: () => void refresh() };
  return {
    create: useMutation({ mutationFn: (draft: SiteNewsDraft) => createSiteNews(api, draft), ...settle }),
    update: useMutation({
      mutationFn: ({ from, draft }: { from: SiteNews; draft: SiteNewsDraft }) =>
        updateSiteNews(api, from, draft),
      ...settle,
    }),
    remove: useMutation({ mutationFn: (from: SiteNews) => deleteSiteNews(api, from), ...settle }),
  };
}
