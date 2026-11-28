import { useMutation } from '@tanstack/react-query';
import {
  isSiteConflict,
  createSiteNews,
  deleteSiteNews,
  updateSiteNews,
  useRefreshSite,
  type SiteNews,
  type SiteNewsDraft,
} from '@/entities/homepage/site';
import { isPortError, useApi } from '@/shared/api';

/** 들고 있던 글(옛 판)로는 다시 쓸 수 없는 실패 — 409(먼저 고침) · 404(먼저 내림) */
export const isStaleNewsError = (err: unknown) => isSiteConflict(err) || isPortError(err, 'notFound');

/** 쓰기가 실패했을 때 쓰던 폼을 비울지 — 실패한 글이 지금 고치는 그 글이고 옛 판 실패일 때만.
    다른 글을 내리다 실패해도 쓰던 글(새 글 · 다른 글 고치기)은 그대로 둔다 */
export function endsEdit(editingId: string | null, failedId: string, err: unknown): boolean {
  return editingId === failedId && isStaleNewsError(err);
}

/** 옛 판 실패 글 — 고치던 그 글이면 폼이 닫혔으니 «다시 열어 주세요», 다른 글(내리기)이면 목록만 다시 받았으니 «확인하고 다시» */
export const STALE_EDIT_TEXT =
  '다른 곳에서 먼저 고쳤거나 내렸어요 — 목록을 다시 불러왔어요. 글을 다시 [고치기] 로 열어 주세요';
export const STALE_LIST_TEXT =
  '다른 곳에서 먼저 고쳤거나 내렸어요 — 목록을 다시 불러왔어요. 확인하고 다시 해 주세요';
export const staleNewsText = (endedEdit: boolean) => (endedEdit ? STALE_EDIT_TEXT : STALE_LIST_TEXT);

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
