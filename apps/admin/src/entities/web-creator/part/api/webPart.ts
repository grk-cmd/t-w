import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi, type Api } from '@/shared/api';
import { parseAdminParts, type WebPart, type WebPartDraft } from '../model/webPart';

const BASE = '/admin/web-creator/parts';
export const WEB_PARTS_KEY = ['webParts'] as const;

/** 이 환경에는 API 가 없다(dev · e2e) — 웹 생성기 파츠는 자체 서버에만 있어 예전 방식(RTDB)이 없다 */
export class NoApiError extends Error {
  constructor() {
    super('이 환경에는 자체 서버 API 가 없어 웹 생성기 파츠를 볼 수 없어요(운영 관리자에서만)');
    this.name = 'NoApiError';
  }
}

const need = (api: Api | null): Api => {
  if (!api) throw new NoApiError();
  return api;
};
const one = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export async function listWebParts(api: Api | null): Promise<WebPart[]> {
  return parseAdminParts(await need(api).get<unknown>(BASE));
}

/** 새 파츠 — 그림(PNG base64)은 꼭 · 감은눈 그림은 아이라인만 */
export function createWebPart(api: Api | null, draft: WebPartDraft, image: string, closedImage?: string) {
  return need(api).send<unknown>('POST', BASE, {
    ...draft,
    image,
    ...(draft.slot === 'eyeline' && closedImage ? { closedImage } : {}),
  });
}

/** 고치기 — 그림은 새로 골랐을 때만 싣는다 */
export function updateWebPart(
  api: Api | null,
  id: string,
  draft: WebPartDraft,
  image?: string,
  closedImage?: string,
) {
  return need(api).send<unknown>('PATCH', one(id), {
    ...draft,
    ...(image ? { image } : {}),
    ...(draft.slot === 'eyeline' && closedImage ? { closedImage } : {}),
  });
}

export function deleteWebPart(api: Api | null, id: string) {
  return need(api).send<unknown>('DELETE', one(id));
}

export function useWebParts() {
  const api = useApi();
  // 서버가 아직 이 길을 모르면(배포 전) 404 — 다시 해 봐도 같다
  return useQuery({ queryKey: WEB_PARTS_KEY, queryFn: () => listWebParts(api), retry: false });
}

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
