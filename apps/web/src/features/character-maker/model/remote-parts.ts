import { API_ORIGIN } from '@/shared/config';
import type { Lang } from '@/shared/i18n';
import type { LayerKind } from './catalog';

/** 관리자가 올린 그림 파츠가 들어갈 자리 — 얼굴 레이어 또는 액세서리 */
export type PartSlot = LayerKind | 'acc';

const SLOTS: readonly PartSlot[] = ['pupil', 'highlight', 'eyeline', 'brows', 'mouth', 'cheek', 'acc'];
const LANGS: readonly Lang[] = ['ko', 'en', 'ja'];
/** 그림 한 변 상한(얼굴 판 200 단위) — 얼굴 판을 넘는 그림은 받지 않는다 */
const SIZE_MAX = 200;
const NAME_MAX = 20;
/** 그림은 API 서버의 이 아래만 — 서버의 다른 경로를 그림으로 받지 않는다 */
const PART_IMAGE_PATH = '/web-creator/images/';
/** 목록 상한 — 응답이 비정상으로 커도 고르기 판이 터지지 않게 */
const PARTS_MAX = 200;

/** 서버(관리자 편집)에서 받은 그림 파츠 하나 — 검사를 통과한 것만 */
export interface RemotePart {
  id: string;
  slot: PartSlot;
  name: Record<Lang, string>;
  /** PNG 주소 — 우리 도메인 https 만 */
  src: string;
  /** 감은눈 그림(아이라인만) — 없으면 기본 감은 줄 */
  closedSrc: string | null;
  /** 그림 크기(얼굴 판 단위) — 가운데를 레이어 자리에 맞춰 그린다 */
  w: number;
  h: number;
  order: number;
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

function parseOne(v: unknown): RemotePart | null {
  if (!isObj(v)) return null;
  const { id, slot, name, src, closedSrc, w, h, order, hidden } = v;
  if (hidden === true) return null;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  if (typeof slot !== 'string' || !(SLOTS as readonly string[]).includes(slot)) return null;
  if (!isObj(name)) return null;
  const names = {} as Record<Lang, string>;
  for (const l of LANGS) {
    const n = name[l];
    if (typeof n !== 'string' || !n.trim() || n.length > NAME_MAX) return null;
    names[l] = n.trim();
  }
  if (!partImageUrlOk(src) || !sizeOk(w) || !sizeOk(h)) return null;
  // 감은눈 그림은 아이라인만 쓴다 — 다른 자리에 실려 오면 버린다
  const closed = slot === 'eyeline' && partImageUrlOk(closedSrc) ? closedSrc : null;
  return {
    id,
    slot: slot as PartSlot,
    name: names,
    src,
    closedSrc: closed,
    w,
    h,
    order: typeof order === 'number' && Number.isFinite(order) ? order : 0,
  };
}

/** 서버 응답 data → 그림 파츠 목록. 모양이 틀린 항목 · 숨긴 항목은 빼고, 같은 id 는 앞의 것만 · order 차례로 */
export function parseRemoteParts(data: unknown): RemotePart[] {
  const list = isObj(data) && Array.isArray(data.parts) ? data.parts : [];
  const seen = new Set<string>();
  const out: RemotePart[] = [];
  for (const v of list.slice(0, PARTS_MAX)) {
    const p = parseOne(v);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out.sort((a, b) => a.order - b.order);
}
