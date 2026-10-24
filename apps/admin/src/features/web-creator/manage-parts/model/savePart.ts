import {
  createWebPart,
  updateWebPart,
  uploadPartFile,
  type WebPart,
  type WebPartDraft,
} from '@/entities/web-creator/part';
import type { Api } from '@/shared/api';

/** 저장할 것 — part 가 없으면 새 파츠(그림 필수), 있으면 고치기. 그림은 PNG 바이트(바꿀 때만) ·
    closedImage: 바이트면 바꿈 · null 이면 뺌 · 없으면 그대로 */
export interface SavePart {
  part: WebPart | null;
  draft: WebPartDraft;
  image?: Uint8Array;
  closedImage?: Uint8Array | null;
}

/** 파일을 먼저 올려 해시를 받고, 상품은 그 해시로 만든다(#517 §9).
    본 그림 → 감은 그림 → 상품 차례 — 중간에 실패하면 올린 파일만 남고(안 쓰는 파일은 서버 보관함에서 지운다) 상품은 그대로 */
export async function savePart(api: Api | null, { part, draft, image, closedImage }: SavePart) {
  if (!part && !image) throw new Error('새 파츠는 그림이 있어야 해요');
  const imageHash = image ? await uploadPartFile(api, image) : undefined;
  const closedHash = closedImage ? await uploadPartFile(api, closedImage) : closedImage;
  if (part) return updateWebPart(api, part, draft, { image: imageHash, closed: closedHash });
  if (!imageHash) throw new Error('새 파츠는 그림이 있어야 해요'); // 위 확인으로 오지 않는다 — 타입 좁히기
  return createWebPart(api, draft, imageHash, closedHash ?? undefined);
}
