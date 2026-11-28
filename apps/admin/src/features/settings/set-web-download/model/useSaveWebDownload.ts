import { useMutation } from '@tanstack/react-query';
import { putSiteDownload, useRefreshSite } from '@/entities/homepage/site';
import { useApi } from '@/shared/api';

/** 저장 뒤엔 성공 · 실패 모두 다시 받는다 — 409(다른 곳에서 먼저 고침)면 새 값을 보고 다시 정한다 */
export function useSaveWebDownload() {
  const api = useApi();
  const refresh = useRefreshSite().download;
  return useMutation({
    mutationFn: (next: { open: boolean; version: string | null; rev: number }) => putSiteDownload(api, next),
    onSettled: () => void refresh(),
  });
}
