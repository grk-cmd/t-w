import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  reorderWebParts,
  setWebPartStatus,
  WEB_PARTS_KEY,
  type ItemStatus,
} from '@/entities/web-creator/part';
import { useApi } from '@/shared/api';
import { savePart, type SavePart } from './savePart';

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: WEB_PARTS_KEY });
}

export function useSaveWebPart() {
  const api = useApi();
  const onSuccess = useInvalidate();
  return useMutation({ mutationFn: (save: SavePart) => savePart(api, save), onSuccess });
}

export function useSetWebPartStatus() {
  const api = useApi();
  const onSuccess = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ItemStatus }) => setWebPartStatus(api, id, status),
    onSuccess,
  });
}

export function useReorderWebParts() {
  const api = useApi();
  const onSuccess = useInvalidate();
  return useMutation({ mutationFn: (ids: readonly string[]) => reorderWebParts(api, ids), onSuccess });
}
