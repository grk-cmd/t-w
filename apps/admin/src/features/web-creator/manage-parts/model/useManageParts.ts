import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  reorderWebParts,
  setWebPartStatus,
  WEB_PARTS_KEY,
  type ItemStatus,
  type WebPart,
} from '@/entities/web-creator/part';
import { useApi } from '@/shared/api';
import { savePart, type SavePart } from './savePart';

// 실패해도 다시 읽는다 — 남이 먼저 고쳤으면(409) 새 version · 진열대 번호로 다시 누를 수 있게
function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: WEB_PARTS_KEY });
}

export function useSaveWebPart() {
  const api = useApi();
  const onSettled = useInvalidate();
  return useMutation({ mutationFn: (save: SavePart) => savePart(api, save), onSettled });
}

export function useSetWebPartStatus() {
  const api = useApi();
  const onSettled = useInvalidate();
  return useMutation({
    mutationFn: ({ part, status }: { part: WebPart; status: ItemStatus }) =>
      setWebPartStatus(api, part, status),
    onSettled,
  });
}

export function useReorderWebParts() {
  const api = useApi();
  const onSettled = useInvalidate();
  return useMutation({
    mutationFn: ({ ids, shelfVersion }: { ids: readonly string[]; shelfVersion: number }) =>
      reorderWebParts(api, ids, shelfVersion),
    onSettled,
  });
}
