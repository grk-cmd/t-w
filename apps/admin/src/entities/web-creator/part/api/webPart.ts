import { useQuery } from '@tanstack/react-query';
import { ApiError, useApi, type Api } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  DECAL_SURFACE,
  DECAL_TARGET,
  parseAdminParts,
  type WebPart,
  type WebPartDraft,
} from '../model/webPart';

const SETS = '/v1/admin/decal-sets';
const IMAGES = '/v1/admin/decal-images';
export const WEB_PARTS_KEY = ['webParts'] as const;

/** 이 환경에는 API 가 없다(dev · e2e) — 웹 생성기 파츠는 자체 서버에만 있어 예전 방식(RTDB)이 없다 */
export class NoApiError extends Error {
  constructor() {
    super('이 환경에는 자체 서버 API 가 없어 웹 생성기 파츠를 볼 수 없어요(운영 관리자에서만)');
    this.name = 'NoApiError';
  }
}

/** 쓰기 실패 글 — 서버가 400 · 404 로 까닭(«PNG 가 아니에요» · «이미 지운 세트예요» · 409 «쓰는 세트가 있어요»)을 보내면 그 글을 붙인다.
    공용 errorMessage 는 서버 글을 버려 다른 화면에 영향 없게 여기서만 붙인다. */
export function webPartErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && (err.kind === 'request' || err.status === 404) && err.message)
    return `${fallback} — ${err.message}`;
  return errorMessage(err, fallback);
}

const need = (api: Api | null): Api => {
  if (!api) throw new NoApiError();
  return api;
};
const one = (id: string) => `${SETS}/${encodeURIComponent(id)}`;

/** 숨긴 것까지 · 이 모델의 세트 전부(순서 바꾸기는 빠짐없이 보내야 해서 모델로 자른다) */
export async function listWebParts(api: Api | null): Promise<WebPart[]> {
  return parseAdminParts(await need(api).get<unknown>(SETS, { target: DECAL_TARGET.kind }));
}

/** 그림 한 장 올리기 → 해시. 세트는 이 해시만 가리킨다(같은 그림은 서버에 한 벌) */
export async function uploadDecalImage(api: Api | null, bytes: Uint8Array): Promise<string> {
  const data = await need(api).upload<unknown>(IMAGES, bytes, 'image/png');
  const hash = typeof data === 'object' && data !== null ? (data as { hash?: unknown }).hash : null;
  if (typeof hash !== 'string' || !hash) throw new Error('그림을 올렸지만 서버 응답 모양이 달라요');
  return hash;
}

const decalBody = (draft: WebPartDraft, image: string, closedImage: string | null) => ({
  surface: DECAL_SURFACE,
  slot: draft.slot,
  image,
  ...(draft.slot === 'eyeline' && closedImage ? { closedImage } : {}),
  w: draft.w,
  h: draft.h,
});

/** 새 파츠 = 데칼 한 장짜리 세트. image · closedImage 는 올린 그림의 해시 */
export function createWebPart(api: Api | null, draft: WebPartDraft, image: string, closedImage?: string) {
  return need(api).send<unknown>('POST', SETS, {
    target: DECAL_TARGET,
    name: draft.name,
    hidden: draft.hidden,
    decals: [decalBody(draft, image, closedImage ?? null)],
  });
}

/** 고치기 — 데칼 목록을 통째로 바꾸는 규격이라 안 바꾼 그림도 지금 해시를 다시 보낸다(데칼 id 는 그대로) */
export function updateWebPart(
  api: Api | null,
  part: WebPart,
  draft: WebPartDraft,
  image?: string,
  closedImage?: string,
) {
  const a = need(api);
  const d = part.decal;
  if (!d) throw new Error('여러 장 세트는 이 화면에서 고칠 수 없어요');
  const img = image ?? d.image;
  if (!img) throw new Error('지금 그림의 이름을 알 수 없어요 — 그림을 다시 골라 주세요');
  // 아이라인에서 다른 자리로 바꾸면 decalBody 가 감은눈 그림을 빼고, 서버가 지운다
  const closed = closedImage ?? d.closedImage;
  return a.send<unknown>('PATCH', one(part.id), {
    name: draft.name,
    hidden: draft.hidden,
    decals: [{ id: d.id, ...decalBody(draft, img, closed) }],
  });
}

/** 숨기기 · 보이기 — 다른 칸은 그대로 */
export function setWebPartHidden(api: Api | null, id: string, hidden: boolean) {
  return need(api).send<unknown>('PATCH', one(id), { hidden });
}

export function deleteWebPart(api: Api | null, id: string) {
  return need(api).send<unknown>('DELETE', one(id));
}

/** 진열 순서 다시 매기기 — ids 는 이 모델의 세트 전부(숨긴 것 포함) */
export function reorderWebParts(api: Api | null, ids: readonly string[]) {
  return need(api).send<unknown>('PUT', `${SETS}/order`, { target: DECAL_TARGET, ids });
}

export function useWebParts() {
  const api = useApi();
  // 서버가 아직 이 길을 모르면(배포 전) 404 — 다시 해 봐도 같다
  return useQuery({ queryKey: WEB_PARTS_KEY, queryFn: () => listWebParts(api), retry: false });
}
