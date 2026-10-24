/* 웹 생성기 파츠(관리자가 올린 PNG) — 홈페이지 캐릭터 만들기가 기본 그림 뒤에 붙여 보여 준다.
   검사 규칙은 홈페이지(apps/web model/remote-parts.ts)와 서버가 같은 값을 쓴다 — 셋 중 하나만 바꾸지 않는다. */

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

export interface WebPart {
  id: string;
  slot: WebPartSlot;
  name: PartNames;
  src: string;
  closedSrc: string | null;
  w: number;
  h: number;
  order: number;
  hidden: boolean;
}

/** 폼이 고치는 칸 — 그림은 따로(새로 고를 때만 보낸다) */
export interface WebPartDraft {
  slot: WebPartSlot;
  name: PartNames;
  w: number;
  h: number;
  order: number;
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
  if (!Number.isFinite(d.order)) return '순서는 숫자여야 해요';
  return null;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** 앞 8바이트가 PNG 표시인가 — 확장자 · MIME 은 바꿀 수 있어 내용으로 본다 */
export function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= PNG_SIG.length && PNG_SIG.every((b, i) => bytes[i] === b);
}

/** 올릴 그림의 문제 — 없으면 null */
export function imageProblem(bytes: Uint8Array): string | null {
  if (!isPng(bytes)) return 'PNG 그림만 올릴 수 있어요';
  if (bytes.length > PART_IMAGE_MAX_BYTES) return `그림은 ${PART_IMAGE_MAX_BYTES / 1024}KB 까지예요`;
  return null;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function parseOne(v: unknown): WebPart | null {
  if (!isObj(v) || !isObj(v.name)) return null;
  const { id, slot, src, closedSrc, w, h, order, hidden } = v;
  if (typeof id !== 'string' || !id || !isSlot(slot) || typeof src !== 'string') return null;
  const name = {} as PartNames;
  for (const l of PART_LANGS) name[l] = typeof v.name[l] === 'string' ? (v.name[l] as string) : '';
  if (!sizeOk(w) || !sizeOk(h)) return null;
  return {
    id,
    slot,
    name,
    src,
    closedSrc: typeof closedSrc === 'string' ? closedSrc : null,
    w,
    h,
    order: typeof order === 'number' && Number.isFinite(order) ? order : 0,
    hidden: hidden === true,
  };
}

/** 관리자 목록 응답 data → 파츠(숨긴 것 포함) · 자리 → 순서 차례. 모양이 틀린 줄은 뺀다. */
export function parseAdminParts(data: unknown): WebPart[] {
  const list = isObj(data) && Array.isArray(data.parts) ? data.parts : [];
  return list
    .map(parseOne)
    .filter((p): p is WebPart => p !== null)
    .sort((a, b) => WEB_PART_SLOTS.indexOf(a.slot) - WEB_PART_SLOTS.indexOf(b.slot) || a.order - b.order);
}

/** 새 파츠 폼의 처음 값 */
export const emptyDraft = (slot: WebPartSlot = 'pupil'): WebPartDraft => ({
  slot,
  name: { ko: '', en: '', ja: '' },
  w: 24,
  h: 24,
  order: 0,
  hidden: false,
});
