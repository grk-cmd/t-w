import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRefreshBugBoard } from '@/entities/bug-board';
import { useDb } from '@/shared/api';
import { applyReleaseFixes, previewReleaseFixes, type ApplyOptions, type FixTarget } from './applyRelease';
import { getReleaseTpl, RELEASE_TPL_KEY, saveReleaseTpl } from './releaseTpl';

export function useReleaseTpl() {
  const db = useDb();
  return useQuery({ queryKey: RELEASE_TPL_KEY, queryFn: () => getReleaseTpl(db) });
}

export function useSaveReleaseTpl() {
  const db = useDb();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (tpl: string | null) => saveReleaseTpl(db, tpl),
    onSuccess: () => client.invalidateQueries({ queryKey: RELEASE_TPL_KEY }),
  });
}

/** 확인 창을 열기 전 — 대상 제보 · 저장된 템플릿을 함께(템플릿은 캐시를 같이 쓴다). */
export function usePreviewRelease() {
  const db = useDb();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (latest: string) => {
      const [targets, tpl] = await Promise.all([
        previewReleaseFixes(db, latest),
        client.fetchQuery({ queryKey: RELEASE_TPL_KEY, queryFn: () => getReleaseTpl(db) }),
      ]);
      return { targets, tpl };
    },
  });
}

export function useApplyRelease() {
  const db = useDb();
  const client = useQueryClient();
  const refreshBugs = useRefreshBugBoard();
  return useMutation({
    mutationFn: ({ targets, opts }: { targets: readonly FixTarget[]; opts: ApplyOptions }) =>
      applyReleaseFixes(db, targets, opts),
    onSuccess: (r, { opts }) => {
      if (!r.ok) return;
      void refreshBugs();
      if (opts.saveTpl) void client.invalidateQueries({ queryKey: RELEASE_TPL_KEY });
    },
  });
}
