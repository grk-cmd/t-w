import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createWebPart,
  deleteWebPart,
  reorderWebParts,
  setWebPartHidden,
  updateWebPart,
  uploadDecalImage,
  WEB_PARTS_KEY,
  type WebPart,
  type WebPartDraft,
} from '@/entities/web-creator/part';
import { useApi } from '@/shared/api';

/** 저장할 것 — part 가 없으면 새 파츠(그림 필수), 있으면 고치기(그림은 바꿀 때만). 그림은 PNG 바이트 */
export interface SavePart {
  part: WebPart | null;
  draft: WebPartDraft;
  image?: Uint8Array;
  closedImage?: Uint8Array;
}

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: WEB_PARTS_KEY });
}

/** 그림을 먼저 올려 해시를 받고, 세트는 그 해시로 만든다(#517 §1) */
export function useSaveWebPart() {
  const api = useApi();
  const onSuccess = useInvalidate();
  return useMutation({
    mutationFn: async ({ part, draft, image, closedImage }: SavePart) => {
      if (!part && !image) throw new Error('새 파츠는 그림이 있어야 해요');
      // 본 그림 → 감은눈 그림 → 세트 차례 — 중간에 실패하면 올린 그림만 남고(안 쓰는 그림은 서버가 정리) 세트는 그대로
      const imageHash = image ? await uploadDecalImage(api, image) : undefined;
      const closedHash =
        draft.slot === 'eyeline' && closedImage ? await uploadDecalImage(api, closedImage) : undefined;
      if (part) return updateWebPart(api, part, draft, imageHash, closedHash);
      if (!imageHash) throw new Error('새 파츠는 그림이 있어야 해요'); // 위 확인으로 오지 않는다 — 타입 좁히기
      return createWebPart(api, draft, imageHash, closedHash);
    },
    onSuccess,
  });
}

export function useSetWebPartHidden() {
  const api = useApi();
  const onSuccess = useInvalidate();
  return useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => setWebPartHidden(api, id, hidden),
    onSuccess,
  });
}

export function useDeleteWebPart() {
  const api = useApi();
  const onSuccess = useInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteWebPart(api, id), onSuccess });
}

export function useReorderWebParts() {
  const api = useApi();
  const onSuccess = useInvalidate();
  return useMutation({ mutationFn: (ids: readonly string[]) => reorderWebParts(api, ids), onSuccess });
}
