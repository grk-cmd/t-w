/* 웹 생성기 파츠 — 서버 규격 grk-cmd/t-w#517(/v1 꾸미기 상품). 홈페이지 캐릭터 만들기가 기본 그림 뒤에 붙여 보여 준다.
   이 화면은 «2D 조각 하나짜리 상품» 을 파츠 하나로 다룬다(여러 조각 · 파일 보관함 · 권한 고르기는 다음 일).
   검사 규칙은 홈페이지(apps/web model/remote-parts.ts)와 서버가 같은 값을 쓴다 — 셋 중 하나만 바꾸지 않는다. */

/** 지금 받는 조각(#517 §2) — 다른 면 · 3D 가 열리면 여기와 고르기를 더한다 */
export const PIECE_TARGET = { kind: 'baseModel' } as const;
export const PIECE_KIND = { dimension: '2d', kind: 'decal' } as const;
export const PIECE_SURFACE = 'face';

export const WEB_PART_SLOTS = ['pupil', 'highlight', 'eyeline', 'brows', 'mouth', 'cheek', 'acc'] as const;
export type WebPartSlot = (typeof WEB_PART_SLOTS)[number];

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

/** 상품 안 2D 얼굴 조각 하나 */
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
  /** 이 화면이 고칠 수 있는 «2D 얼굴 조각 하나짜리» 상품이면 그 조각 · 아니면 null(상태 · 순서만) */
  piece: WebPiece | null;
  pieceCount: number;
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

/** 파일 해시 — 관리자 응답에 실린 값(#517 §7-2), 없으면 파일 주소의 이름(이름이 곧 내용 해시 · §6-2) */
function fileHash(given: unknown, src: unknown): string | null {
  if (typeof given === 'string' && given) return given;
  if (typeof src !== 'string') return null;
  return /\/v1\/assets\/([A-Za-z0-9_-]+)\.png$/.exec(src)?.[1] ?? null;
}

function parsePiece(v: unknown): WebPiece | null {
  if (!isObj(v)) return null;
  const { id, dimension, kind, target, surface, slot, src, w, h } = v;
  if (dimension !== PIECE_KIND.dimension || kind !== PIECE_KIND.kind) return null;
  if (!isObj(target) || target.kind !== PIECE_TARGET.kind || surface !== PIECE_SURFACE) return null;
  if (typeof id !== 'string' || !id || !isSlot(slot) || typeof src !== 'string' || !sizeOk(w) || !sizeOk(h))
    return null;
  // 관리자 응답의 variants 값이 주소인지 해시인지 규격(§7-2)이 둘 다로 읽혀 둘 다 받는다 — 주소면 미리보기 · 해시는 파일 이름에서
  const closed = isObj(v.variants) && typeof v.variants.closed === 'string' ? v.variants.closed : null;
  const closedIsUrl = closed !== null && closed.includes('/');
  return {
    id,
    slot,
    src,
    closedSrc: closedIsUrl ? closed : null,
    w,
    h,
    image: fileHash(v.image, src),
    closedImage: closed === null ? null : closedIsUrl ? fileHash(null, closed) : closed,
  };
}

function parseItem(v: unknown): WebPart | null {
  if (!isObj(v) || !isObj(v.name) || !isObj(v.target)) return null;
  if (typeof v.id !== 'string' || !v.id || v.target.kind !== PIECE_TARGET.kind || !isStatus(v.status))
    return null;
  const pieces = Array.isArray(v.pieces) ? v.pieces : [];
  const name = {} as PartNames;
  for (const l of PART_LANGS) name[l] = typeof v.name[l] === 'string' ? (v.name[l] as string) : '';
  const piece = pieces.length === 1 ? parsePiece(pieces[0]) : null;
  // 썸네일도 주소일 때만 그린다(해시로 오면 조각 그림으로)
  const thumb = typeof v.thumb === 'string' && v.thumb.includes('/') ? v.thumb : null;
  return {
    id: v.id,
    name,
    status: v.status,
    thumb: thumb ?? piece?.src ?? null,
    piece,
    pieceCount: pieces.length,
  };
}

/** 관리자 목록 응답 data({ items }) → 상품 목록. 서버가 진열 순서로 보내므로 순서는 그대로. */
export function parseAdminParts(data: unknown): WebPart[] {
  const list = isObj(data) && Array.isArray(data.items) ? data.items : [];
  return list.map(parseItem).filter((p): p is WebPart => p !== null);
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
