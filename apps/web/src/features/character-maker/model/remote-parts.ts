import { API_ORIGIN } from '@/shared/config';
import type { Lang } from '@/shared/i18n';
import type { LayerKind } from './catalog';

/** 관리자가 올린 그림 조각(decal)이 들어갈 자리 — 얼굴 레이어 또는 액세서리 */
export type PartSlot = LayerKind | 'acc';

/* 서버 규격(grk-cmd/t-w#517 · /v1/items): 조각(piece)은 늘 상품(item) 안에 있다.
   생성기가 그릴 수 있는 것은 «그림(decal) · 기본 몸 모델 · 얼굴 면» 뿐 — 3D 모양(part) · 다른 모델 · 면 · 모르는 slot 은 건너뛴다(서버가 먼저 늘어도 깨지지 않게).
   조각 종류는 kind 하나로 정한다(규격에서 dimension 칸은 빠졌다 — 와도 보지 않는다).
   잠긴 상품(locked)은 조각이 오지 않는다 — 🔒 칸은 화면을 정한 뒤에 그린다(#517 §13). */
const PIECE_KIND = 'decal';
const TARGET_KIND = 'baseModel';
const SURFACE = 'face';
const SLOTS: readonly PartSlot[] = ['pupil', 'highlight', 'eyeline', 'brows', 'mouth', 'cheek', 'acc'];
const LANGS: readonly Lang[] = ['ko', 'en', 'ja'];
/** 그림 한 변 상한(얼굴 판 200 단위) — 얼굴 판을 넘는 그림은 받지 않는다 */
const SIZE_MAX = 200;
const NAME_MAX = 20;
/** 파일은 API 서버의 이 아래만 — 서버의 다른 경로를 그림으로 받지 않는다 */
const PART_IMAGE_PATH = '/v1/assets/';
/** 펼친 조각 수 상한 — 응답이 비정상으로 커도 고르기 판이 터지지 않게 */
const PARTS_MAX = 200;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

/** 서버에서 받은 그림 조각 하나 — 고르기 판의 항목 하나. 검사를 통과한 것만 */
export interface RemotePart {
  /** 조각 id(서버가 만든다 · 상품을 고쳐도 남는다) */
  id: string;
  slot: PartSlot;
  /** 고르기 판에 보이는 이름 — 그 조각이 든 상품 이름 */
  name: Record<Lang, string>;
  /** PNG 주소 — 우리 API 서버의 파일 경로만 */
  src: string;
  /** 눈 감은 얼굴 그림(표정 closed) — 없으면 아이라인은 기본 감은 줄, 나머지는 src 그대로 */
  closedSrc: string | null;
  /** 그림 크기(얼굴 판 단위) — 가운데를 레이어 자리에 맞춰 그린다 */
  w: number;
  h: number;
}

/** 그림 주소는 우리 API 서버의 https 만 — 홈페이지 보안 설정(CSP img-src)이 허락하는 곳과 같아야 한다.
    남이 고른 주소를 캔버스에 그리지 않는다(앱으로 가져갈 때 캔버스가 막히지 않게도). */
export function partImageUrlOk(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  try {
    const url = new URL(u);
    return url.origin === API_ORIGIN && url.pathname.startsWith(PART_IMAGE_PATH);
  } catch {
    return false;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const sizeOk = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= SIZE_MAX;
const onBaseModel = (target: unknown) => isObj(target) && target.kind === TARGET_KIND;

function parseNames(name: unknown): Record<Lang, string> | null {
  if (!isObj(name)) return null;
  const names = {} as Record<Lang, string>;
  for (const l of LANGS) {
    const n = name[l];
    if (typeof n !== 'string' || !n.trim() || n.length > NAME_MAX) return null;
    names[l] = n.trim();
  }
  return names;
}

function parsePiece(v: unknown, name: Record<Lang, string>): RemotePart | null {
  if (!isObj(v)) return null;
  const { id, kind, target, surface, slot, src, variants, w, h } = v;
  if (kind !== PIECE_KIND || !onBaseModel(target) || surface !== SURFACE) return null;
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  if (typeof slot !== 'string' || !(SLOTS as readonly string[]).includes(slot)) return null;
  if (!partImageUrlOk(src) || !sizeOk(w) || !sizeOk(h)) return null;
  // 모르는 표정 · 틀린 주소는 버리고 기본 그림으로(빠진 표정 = 기본 · #517 §2)
  const closed = isObj(variants) && partImageUrlOk(variants.closed) ? variants.closed : null;
  return { id, slot: slot as PartSlot, name, src, closedSrc: closed, w, h };
}

/** 서버 응답 data({ items }) → 고르기 판 항목(조각 하나씩). 상품 배열 순서가 진열 순서라 상품 차례대로 펼친다.
    잠긴 상품 · 기본 몸 모델이 아닌 상품 · 그릴 수 없는 조각 · 모양이 틀린 것은 빼고, 같은 조각 id 는 앞의 것만 */
export function parseRemoteParts(data: unknown): RemotePart[] {
  const items = isObj(data) && Array.isArray(data.items) ? data.items : [];
  const seen = new Set<string>();
  const out: RemotePart[] = [];
  for (const item of items) {
    if (!isObj(item) || item.locked === true || !onBaseModel(item.target)) continue;
    if (typeof item.id !== 'string' || !ID_RE.test(item.id) || !Array.isArray(item.pieces)) continue;
    const name = parseNames(item.name);
    if (!name) continue;
    for (const piece of item.pieces) {
      const p = parsePiece(piece, name);
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
      if (out.length >= PARTS_MAX) return out;
    }
  }
  return out;
}
