/* 웹 생성기 파츠 — 서버 규격 grk-cmd/t-w#517(/v1 데칼 세트). 홈페이지 캐릭터 만들기가 기본 그림 뒤에 붙여 보여 준다.
   이 화면은 «데칼 한 장짜리 세트» 를 파츠 하나로 다룬다(세트 여러 장 편집은 다음 일).
   검사 규칙은 홈페이지(apps/web model/remote-parts.ts)와 서버가 같은 값을 쓴다 — 셋 중 하나만 바꾸지 않는다. */

/** 지금 받는 모델 · 면(#517 §2) — 다른 면이 열리면 여기와 면 고르기를 더한다 */
export const DECAL_TARGET = { kind: 'baseModel' } as const;
export const DECAL_SURFACE = 'face';

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

export const PART_LANGS = ['ko', 'en', 'ja'] as const;
export type PartLang = (typeof PART_LANGS)[number];
export type PartNames = Record<PartLang, string>;

export const PART_NAME_MAX = 20;
/** 그림 크기 상한(얼굴 판 200 단위) */
export const PART_SIZE_MAX = 200;
export const PART_IMAGE_MAX_BYTES = 512 * 1024;
/** 그림 한 변 픽셀 상한 — 서버가 PNG 머리로 먼저 거절한다(#517 §8) */
export const PART_IMAGE_MAX_PX = 1024;

/** 세트 안 데칼 하나(얼굴 면) */
export interface WebDecal {
  id: string;
  slot: WebPartSlot;
  src: string;
  closedSrc: string | null;
  w: number;
  h: number;
  /** 그림 해시 — 고치기 때 그림을 바꾸지 않으면 이 값을 다시 보낸다. 모르면 null(그림을 다시 골라야 함) */
  image: string | null;
  closedImage: string | null;
}

/** 목록 한 줄 = 세트 하나 */
export interface WebPart {
  id: string;
  name: PartNames;
  hidden: boolean;
  /** 이 화면이 고칠 수 있는 «얼굴 데칼 한 장짜리» 세트면 그 데칼 · 아니면 null(숨기기 · 지우기 · 순서만) */
  decal: WebDecal | null;
  decalCount: number;
  /** 목록 썸네일 — 첫 데칼 그림 */
  thumb: string | null;
}

/** 폼이 고치는 칸 — 그림은 따로(새로 고를 때만 올린다) */
export interface WebPartDraft {
  slot: WebPartSlot;
  name: PartNames;
  w: number;
  h: number;
  hidden: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isSlot = (v: unknown): v is WebPartSlot =>
  typeof v === 'string' && (WEB_PART_SLOTS as readonly string[]).includes(v);
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

/** 그림 해시 — 응답에 실리면 그 값, 아니면 그림 주소의 파일 이름(이름이 곧 내용 해시 · #517 §3-2) */
function imageHash(given: unknown, src: unknown): string | null {
  if (typeof given === 'string' && given) return given;
  if (typeof src !== 'string') return null;
  const m = /\/v1\/decal-images\/([A-Za-z0-9_-]+)\.png$/.exec(src);
  return m?.[1] ?? null;
}

function parseDecal(v: unknown): WebDecal | null {
  if (!isObj(v)) return null;
  const { id, surface, slot, src, closedSrc, w, h } = v;
  if (typeof id !== 'string' || !id || surface !== DECAL_SURFACE || !isSlot(slot)) return null;
  if (typeof src !== 'string' || !sizeOk(w) || !sizeOk(h)) return null;
  const closed = typeof closedSrc === 'string' ? closedSrc : null;
  return {
    id,
    slot,
    src,
    closedSrc: closed,
    w,
    h,
    image: imageHash(v.image, src),
    closedImage: closed ? imageHash(v.closedImage, closed) : null,
  };
}

function parseSet(v: unknown): WebPart | null {
  if (!isObj(v) || !isObj(v.name) || !isObj(v.target)) return null;
  if (typeof v.id !== 'string' || !v.id || v.target.kind !== DECAL_TARGET.kind) return null;
  const decals = Array.isArray(v.decals) ? v.decals : [];
  const name = {} as PartNames;
  for (const l of PART_LANGS) name[l] = typeof v.name[l] === 'string' ? (v.name[l] as string) : '';
  const only = decals.length === 1 ? parseDecal(decals[0]) : null;
  const first = decals.find((d) => isObj(d) && typeof d.src === 'string') as { src: string } | undefined;
  return {
    id: v.id,
    name,
    hidden: v.hidden === true,
    decal: only,
    decalCount: decals.length,
    thumb: first?.src ?? null,
  };
}

/** 관리자 목록 응답 data({ sets }) → 세트 목록(숨긴 것 포함). 서버가 진열 순서로 보내므로 순서는 그대로. */
export function parseAdminParts(data: unknown): WebPart[] {
  const list = isObj(data) && Array.isArray(data.sets) ? data.sets : [];
  return list.map(parseSet).filter((p): p is WebPart => p !== null);
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
  hidden: false,
});
