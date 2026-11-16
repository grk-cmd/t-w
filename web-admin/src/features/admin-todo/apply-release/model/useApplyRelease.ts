import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRefreshBugBoard } from '@/entities/bug-board';
import { refreshOnConflict, type Versioned } from '@/shared/api';
import { useApplyReleasePort } from '../api';
import type { ApplyOptions, FixTarget } from './applyRelease';
import { RELEASE_TPL_KEY, type ReleaseTemplate } from './releaseTpl';

export function useReleaseTpl() {
  const port = useApplyReleasePort();
  return useQuery({ queryKey: RELEASE_TPL_KEY, queryFn: () => port.template() });
}

export function useSaveReleaseTpl() {
  const port = useApplyReleasePort();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: RELEASE_TPL_KEY });
  return useMutation({
    mutationFn: ({ from, tpl }: { from: Versioned<ReleaseTemplate>; tpl: string | null }) =>
      port.saveTemplate(from, tpl),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}

/** 확인 창을 열기 전 — 대상 제보 · 저장된 템플릿을 함께(템플릿은 캐시를 같이 쓴다). */
export function usePreviewRelease() {
  const port = useApplyReleasePort();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (latest: string) => {
      const [targets, template] = await Promise.all([
        port.preview(latest),
        client.fetchQuery({ queryKey: RELEASE_TPL_KEY, queryFn: () => port.template() }),
      ]);
      return { targets, template };
    },
  });
}

export function useApplyRelease() {
  const port = useApplyReleasePort();
  const client = useQueryClient();
  const refreshBugs = useRefreshBugBoard();
  const refreshTpl = () => client.invalidateQueries({ queryKey: RELEASE_TPL_KEY });
  return useMutation({
    mutationFn: ({ targets, opts }: { targets: readonly FixTarget[]; opts: ApplyOptions }) =>
      port.apply(targets, opts),
    onSuccess: (r, { opts }) => {
      if (!r.ok) return;
      void refreshBugs();
      if (opts.saveTpl) void refreshTpl();
    },
    onError: refreshOnConflict(() => refreshBugs()),
  });
}
