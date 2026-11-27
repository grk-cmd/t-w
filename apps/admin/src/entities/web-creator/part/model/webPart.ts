/* 웹 생성기 파츠 — 서버 카탈로그의 그림 상품(/v2/admin/catalog/products · 처음 규격 grk-cmd/t-w#517). 홈페이지 캐릭터 만들기가 기본 그림 뒤에 붙여 보여 준다.
   이 화면은 «그림 조각 하나짜리 상품» 을 파츠 하나로 다룬다(여러 조각 · 파일 보관함 · 권한 고르기는 다음 일).
   검사 규칙은 홈페이지(apps/web model/remote-parts.ts)와 서버가 같은 값을 쓴다 — 셋 중 하나만 바꾸지 않는다. */

/** 지금 받는 조각(#517 §2) — 다른 면 · 3D 가 열리면 여기와 고르기를 더한다 */
export const PIECE_TARGET = { kind: 'baseModel' } as const;
/** 그림 조각 — 규격은 kind 하나로 종류를 정한다(dimension 칸은 없다 · 보내면 400) */
export const PIECE_KIND = 'decal';
export const PIECE_SURFACE = 'face';

export const WEB_PART_SLOTS = ['pupil', 'highlight', 'eyeline', 'brows', 'mouth', 'cheek', 'acc'] as const;
export type WebPartSlot = (typeof WEB_PART_SLOTS)[number];

/** 흰 그림이 기본인 자리 — 하이라이트는 흰색 · 동공은 흰 부분을 홈페이지가 고른 눈 색으로 칠한다. 미리보기를 어두운 바탕에 */
export const LIGHT_SLOTS: readonly WebPartSlot[] = ['pupil', 'highlight'];

export const SLOT_LABELS: Record<WebPartSlot, string> = {
  pupil: '동공',
  highlight: '하이라이트',
  eyeline: '아이라인',
  brows: '눈썹',
  mouth: '입',
  cheek: '볼',
  acc: '액세서리',
};

/** 상품 상태 — 지우지 않고 상태를 바꾼다(#517 §3) */
export const ITEM_STATUSES = ['draft', 'active', 'archived'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: '초안',
  active: '진열 중',
  archived: '단종',
};

export const PART_LANGS = ['ko', 'en', 'ja'] as const;
export type PartLang = (typeof PART_LANGS)[number];
export type PartNames = Record<PartLang, string>;

export const PART_NAME_MAX = 20;
/** 그림 크기 상한(얼굴 판 200 단위) */
export const PART_SIZE_MAX = 200;
export const PART_IMAGE_MAX_BYTES = 512 * 1024;
/** 그림 한 변 픽셀 상한 — 서버가 PNG 머리로 먼저 거절한다(#517 §10) */
export const PART_IMAGE_MAX_PX = 1024;

/** 상품 안 그림(얼굴) 조각 하나 */
export interface WebPiece {
  id: string;
  slot: WebPartSlot;
  src: string;
  /** 눈 감은 얼굴 그림(표정 closed) — 없으면 null */
  closedSrc: string | null;
  w: number;
  h: number;
  /** 파일 해시 — 고치기 때 안 바꾼 그림은 이 값을 다시 보낸다. 모르면 null(그림을 다시 골라야 함) */
  image: string | null;
  closedImage: string | null;
}

/** 목록 한 줄 = 상품 하나 */
export interface WebPart {
  id: string;
  name: PartNames;
  status: ItemStatus;
  thumb: string | null;
  /** 이 화면이 고칠 수 있는 «그림(얼굴) 조각 하나짜리» 상품이면 그 조각 · 아니면 null(상태 · 순서만) */
  piece: WebPiece | null;
  pieceCount: number;
  /** 고칠 때 싣는 번호 — 그 사이 남이 고쳤으면 서버가 409 */
  version: number;
}

/** 폼이 고치는 칸 — 그림은 따로(새로 고를 때만 올린다) */
export interface WebPartDraft {
  slot: WebPartSlot;
  name: PartNames;
  w: number;
  h: number;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isSlot = (v: unknown): v is WebPartSlot =>
  typeof v === 'string' && (WEB_PART_SLOTS as readonly string[]).includes(v);
const isStatus = (v: unknown): v is ItemStatus =>
  typeof v === 'string' && (ITEM_STATUSES as readonly string[]).includes(v);
const sizeOk = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= PART_SIZE_MAX;

/** 폼 값의 문제 — 없으면 null. 서버도 같은 규칙으로 막지만 보내기 전에 알려 준다. */
export function draftProblem(d: WebPartDraft): string | null {
  for (const l of PART_LANGS) {
    const n = d.name[l].trim();
    if (!n) return `이름(${l})을 넣어 주세요`;
    if (n.length > PART_NAME_MAX) return `이름(${l})은 ${PART_NAME_MAX}자까지예요`;
  }
  if (!sizeOk(d.w) || !sizeOk(d.h)) return `크기는 0 보다 크고 ${PART_SIZE_MAX} 이하여야 해요`;
  return null;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** 앞 8바이트가 PNG 표시인가 — 확장자 · MIME 은 바꿀 수 있어 내용으로 본다 */
export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= PNG_SIG.length && PNG_SIG.every((b, i) => bytes[i] === b);
}

/** PNG 머리(IHDR)의 가로 · 세로 — 머리가 없으면 null */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isPng(bytes) || bytes.length < 24) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

/** 올릴 그림의 문제 — 없으면 null */
export function imageProblem(bytes: Uint8Array): string | null {
  if (!isPng(bytes)) return 'PNG 그림만 올릴 수 있어요';
  if (bytes.length > PART_IMAGE_MAX_BYTES) return `그림은 ${PART_IMAGE_MAX_BYTES / 1024}KB 까지예요`;
  const size = pngSize(bytes);
  if (!size) return 'PNG 머리를 읽지 못했어요';
  if (size.width > PART_IMAGE_MAX_PX || size.height > PART_IMAGE_MAX_PX)
    return `그림은 가로 · 세로 ${PART_IMAGE_MAX_PX}px 까지예요`;
  return null;
}

/** 미리보기용 data 주소 */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** 상품 목록 한 벌 — 진열 순서대로 · 순서 바꾸기에 실을 진열대 번호 */
export interface WebPartList {
  parts: WebPart[];
  /** 진열대 `PRODUCT:baseModel` 의 version — 진열대가 아직 없으면 0 */
  shelfVersion: number;
}

/** 이 모델 상품의 진열대 범위 — 서버 ShelfScope.OfProducts(`PRODUCT:{모델}`) */
export const SHELF_SCOPE = `PRODUCT:${PIECE_TARGET.kind}`;

/** 서버 상태(DRAFT · ACTIVE · ARCHIVED) ↔ 이 화면의 상태 */
export const toServerState = (s: ItemStatus) => s.toUpperCase();
const fromServerState = (v: unknown): ItemStatus | null => {
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  return isStatus(s) ? s : null;
};

const hashOf = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** 해시 → 그림 주소. 응답의 files 에 있으면 그것(Storage 주소), 없으면 서버가 주는 공개 주소 */
type FileUrl = (hash: string) => string;

function parsePiece(v: unknown, url: FileUrl): WebPiece | null {
  if (!isObj(v)) return null;
  const { id, kind, target, surface, slot, w, h } = v;
  if (kind !== PIECE_KIND || !isObj(target) || target.kind !== PIECE_TARGET.kind || surface !== PIECE_SURFACE)
    return null;
  const image = hashOf(v.imageHash);
  if (typeof id !== 'string' || !id || !isSlot(slot) || !image || !sizeOk(w) || !sizeOk(h)) return null;
  const closed = isObj(v.variantHashes) ? hashOf(v.variantHashes.closed) : null;
  return { id, slot, src: url(image), closedSrc: closed && url(closed), w, h, image, closedImage: closed };
}

function parseProduct(v: unknown, url: FileUrl): WebPart | null {
  if (!isObj(v) || !isObj(v.names) || !isObj(v.target) || !isObj(v.listing)) return null;
  const status = fromServerState(v.listing.state);
  if (typeof v.productId !== 'string' || !v.productId || v.target.kind !== PIECE_TARGET.kind || !status)
    return null;
  if (typeof v.version !== 'number' || !Number.isInteger(v.version)) return null;
  const pieces = Array.isArray(v.pieces) ? v.pieces : [];
  const name = {} as PartNames;
  for (const l of PART_LANGS) name[l] = typeof v.names[l] === 'string' ? (v.names[l] as string) : '';
  const piece = pieces.length === 1 ? parsePiece(pieces[0], url) : null;
  const thumb = hashOf(v.thumb);
  return {
    id: v.productId,
    name,
    status,
    thumb: thumb ? url(thumb) : (piece?.src ?? null),
    piece,
    pieceCount: pieces.length,
    version: v.version,
  };
}

/**
 * 관리자 카탈로그 응답 data({ products, shelves, files }) → 이 모델의 상품 · 진열대 번호.
 * 서버 배열 순서가 곧 진열 순서다(GET /v2/admin/catalog). assetBase 는 API 기준 주소 — files 에 없는 해시는
 * `{assetBase}/v2/catalog/assets/{hash}.png` 로 받는다.
 */
export function parseAdminParts(data: unknown, assetBase: string): WebPartList {
  const files = isObj(data) && isObj(data.files) ? data.files : {};
  const url: FileUrl = (hash) => {
    const f = files[hash];
    return typeof f === 'string' && f ? f : `${assetBase}/v2/catalog/assets/${hash}.png`;
  };
  const list = isObj(data) && Array.isArray(data.products) ? data.products : [];
  const shelves = isObj(data) && Array.isArray(data.shelves) ? data.shelves : [];
  const shelf = shelves.find((s): s is Record<string, unknown> => isObj(s) && s.scope === SHELF_SCOPE);
  return {
    parts: list.map((v) => parseProduct(v, url)).filter((p): p is WebPart => p !== null),
    shelfVersion: shelf && typeof shelf.version === 'number' ? shelf.version : 0,
  };
}

/** 목록에서 i 번째를 한 칸 옮긴 id 순서 — 끝을 넘으면 null */
export function movedIds(parts: readonly WebPart[], i: number, by: -1 | 1): string[] | null {
  const j = i + by;
  if (i < 0 || i >= parts.length || j < 0 || j >= parts.length) return null;
  const ids = parts.map((p) => p.id);
  [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
  return ids;
}

/** 새 파츠 폼의 처음 값 */
export const emptyDraft = (slot: WebPartSlot = 'pupil'): WebPartDraft => ({
  slot,
  name: { ko: '', en: '', ja: '' },
  w: 24,
  h: 24,
});
