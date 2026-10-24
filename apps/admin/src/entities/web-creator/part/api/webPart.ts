import { useQuery } from '@tanstack/react-query';
import { ApiError, useApi, type Api } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  parseAdminParts,
  PIECE_KIND,
  PIECE_SURFACE,
  PIECE_TARGET,
  type ItemStatus,
  type WebPart,
  type WebPartDraft,
} from '../model/webPart';

const ITEMS = '/v1/admin/items';
const ASSETS = '/v1/admin/assets';
export const WEB_PARTS_KEY = ['webParts'] as const;

/** 이 환경에는 API 가 없다(dev · e2e) — 웹 생성기 파츠는 자체 서버에만 있어 예전 방식(RTDB)이 없다 */
export class NoApiError extends Error {
  constructor() {
    super('이 환경에는 자체 서버 API 가 없어 웹 생성기 파츠를 볼 수 없어요(운영 관리자에서만)');
    this.name = 'NoApiError';
  }
}

/** 쓰기 실패 글 — 서버가 400 · 404 로 까닭(«PNG 가 아니에요» · «없는 상품이에요» · 409 «쓰는 상품이 있어요»)을 보내면 그 글을 붙인다.
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
const one = (id: string) => `${ITEMS}/${encodeURIComponent(id)}`;

/** 이 모델의 상품 — 기본은 단종을 뺀 것(순서 바꾸기는 이 목록 전부를 보내야 한다), archived 면 단종만 */
export async function listWebParts(api: Api | null, archived = false): Promise<WebPart[]> {
  const params = { target: PIECE_TARGET.kind, status: archived ? 'archived' : undefined };
  return parseAdminParts(await need(api).get<unknown>(ITEMS, params));
}

/** 파일 한 장 올리기 → 해시. 상품은 이 해시만 가리킨다(같은 파일은 서버에 한 벌) */
export async function uploadPartFile(api: Api | null, bytes: Uint8Array): Promise<string> {
  const data = await need(api).upload<unknown>(ASSETS, bytes, 'image/png');
  const hash = typeof data === 'object' && data !== null ? (data as { hash?: unknown }).hash : null;
  if (typeof hash !== 'string' || !hash) throw new Error('그림을 올렸지만 서버 응답 모양이 달라요');
  return hash;
}

const pieceBody = (draft: WebPartDraft, image: string, closed: string | null) => ({
  ...PIECE_KIND,
  target: PIECE_TARGET,
  surface: PIECE_SURFACE,
  slot: draft.slot,
  image,
  ...(closed ? { variants: { closed } } : {}),
  w: draft.w,
  h: draft.h,
});

/** 새 파츠 = 조각 하나짜리 상품(서버가 «초안» 으로 만든다). 썸네일은 그 그림 · 권한은 기본(모두) */
export function createWebPart(api: Api | null, draft: WebPartDraft, image: string, closedImage?: string) {
  return need(api).send<unknown>('POST', ITEMS, {
    target: PIECE_TARGET,
    name: draft.name,
    thumb: image,
    pieces: [pieceBody(draft, image, closedImage ?? null)],
  });
}

/** 고칠 때 바꾸는 파일 — image: 새 그림 해시(없으면 그대로) · closed: 새 감은 그림 해시 · null 이면 뺌 · 없으면 그대로 */
export interface PartFiles {
  image?: string;
  closed?: string | null;
}

/** 고치기 — 조각 목록을 통째로 바꾸는 규격이라 안 바꾼 그림도 지금 해시를 다시 보낸다(조각 id 는 그대로) */
export function updateWebPart(api: Api | null, part: WebPart, draft: WebPartDraft, files: PartFiles = {}) {
  const a = need(api);
  const p = part.piece;
  if (!p) throw new Error('조각이 여러 개인 상품은 이 화면에서 고칠 수 없어요');
  const image = files.image ?? p.image;
  if (!image) throw new Error('지금 그림의 이름을 알 수 없어요 — 그림을 다시 골라 주세요');
  const closed = files.closed === undefined ? p.closedImage : files.closed;
  if (files.closed === undefined && p.closedSrc && !p.closedImage)
    throw new Error('지금 감은 얼굴 그림의 이름을 알 수 없어요 — 다시 고르거나 빼 주세요');
  return a.send<unknown>('PATCH', one(part.id), {
    name: draft.name,
    ...(files.image ? { thumb: files.image } : {}),
    pieces: [{ id: p.id, ...pieceBody(draft, image, closed) }],
  });
}

/** 상태 바꾸기 — 초안 · 진열 · 단종(지우지 않는다 · 되돌릴 수 있다) */
export function setWebPartStatus(api: Api | null, id: string, status: ItemStatus) {
  return need(api).send<unknown>('PATCH', one(id), { status });
}

/** 진열 순서 다시 매기기 — ids 는 이 모델의 단종 아닌 상품 전부(초안 포함) */
export function reorderWebParts(api: Api | null, ids: readonly string[]) {
  return need(api).send<unknown>('PUT', `${ITEMS}/order`, { target: PIECE_TARGET, ids });
}

export function useWebParts(archived = false) {
  const api = useApi();
  // 서버가 아직 이 길을 모르면(배포 전) 404 — 다시 해 봐도 같다
  return useQuery({
    queryKey: [...WEB_PARTS_KEY, archived ? 'archived' : 'live'],
    queryFn: () => listWebParts(api, archived),
    retry: false,
  });
}
