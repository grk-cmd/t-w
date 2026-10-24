import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createWebPart,
  deleteWebPart,
  updateWebPart,
  WEB_PARTS_KEY,
  type WebPartDraft,
} from '@/entities/web-creator/part';
import { useApi } from '@/shared/api';

/** 저장할 것 — id 가 없으면 새 파츠(그림 필수), 있으면 고치기(그림은 바꿀 때만) */
export interface SavePart {
  id: string | null;
  draft: WebPartDraft;
  image?: string;
  closedImage?: string;
}

export function useSaveWebPart() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, draft, image, closedImage }: SavePart) => {
      if (id) return updateWebPart(api, id, draft, image, closedImage);
      if (!image) throw new Error('새 파츠는 그림이 있어야 해요');
      return createWebPart(api, draft, image, closedImage);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: WEB_PARTS_KEY }),
  });
}

export function useDeleteWebPart() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWebPart(api, id),
    onSuccess: () => client.invalidateQueries({ queryKey: WEB_PARTS_KEY }),
  });
}
