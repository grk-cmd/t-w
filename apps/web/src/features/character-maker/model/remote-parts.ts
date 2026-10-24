import { API_ORIGIN } from '@/shared/config';
import type { Lang } from '@/shared/i18n';
import type { LayerKind } from './catalog';

/** 관리자가 올린 그림 파츠(데칼)가 들어갈 자리 — 얼굴 레이어 또는 액세서리 */
export type PartSlot = LayerKind | 'acc';

/* 서버 규격(grk-cmd/t-w#517 · /v1/decal-sets): 데칼은 늘 세트 안에 있고, 세트는 모델(target) 하나에 얹힌다.
   생성기가 그릴 수 있는 것은 기본 몸 모델의 얼굴 면뿐 — 다른 모델 · 면 · 모르는 slot 은 건너뛴다(서버가 먼저 늘어도 깨지지 않게). */
const TARGET_KIND = 'baseModel';
const SURFACE = 'face';
const SLOTS: readonly PartSlot[] = ['pupil', 'highlight', 'eyeline', 'brows', 'mouth', 'cheek', 'acc'];
const LANGS: readonly Lang[] = ['ko', 'en', 'ja'];
/** 그림 한 변 상한(얼굴 판 200 단위) — 얼굴 판을 넘는 그림은 받지 않는다 */
const SIZE_MAX = 200;
const NAME_MAX = 20;
/** 그림은 API 서버의 이 아래만 — 서버의 다른 경로를 그림으로 받지 않는다 */
const PART_IMAGE_PATH = '/v1/decal-images/';
/** 펼친 데칼 수 상한 — 응답이 비정상으로 커도 고르기 판이 터지지 않게 */
const PARTS_MAX = 200;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

/** 서버에서 받은 데칼 하나 — 고르기 판의 항목 하나. 검사를 통과한 것만 */
export interface RemotePart {
  /** 데칼 id(서버가 만든다 · 세트를 고쳐도 남는다) */
  id: string;
  slot: PartSlot;
  /** 고르기 판에 보이는 이름 — 그 데칼이 든 세트 이름 */
  name: Record<Lang, string>;
  /** PNG 주소 — 우리 API 서버의 그림 경로만 */
  src: string;
  /** 감은눈 그림(아이라인만) — 없으면 기본 감은 줄 */
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

function parseDecal(v: unknown, name: Record<Lang, string>): RemotePart | null {
  if (!isObj(v)) return null;
  const { id, surface, slot, src, closedSrc, w, h } = v;
  if (surface !== SURFACE) return null;
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  if (typeof slot !== 'string' || !(SLOTS as readonly string[]).includes(slot)) return null;
  if (!partImageUrlOk(src) || !sizeOk(w) || !sizeOk(h)) return null;
  // 감은눈 그림은 아이라인만 쓴다 — 다른 자리에 실려 오면 버린다
  const closed = slot === 'eyeline' && partImageUrlOk(closedSrc) ? closedSrc : null;
  return { id, slot: slot as PartSlot, name, src, closedSrc: closed, w, h };
}

/** 서버 응답 data({ sets }) → 고르기 판 항목(데칼 하나씩). 배열 순서가 진열 순서라 그대로 둔다.
    기본 몸 모델이 아닌 세트 · 얼굴 면이 아닌 데칼 · 모양이 틀린 것은 빼고, 같은 데칼 id 는 앞의 것만 */
export function parseRemoteParts(data: unknown): RemotePart[] {
  const sets = isObj(data) && Array.isArray(data.sets) ? data.sets : [];
  const seen = new Set<string>();
  const out: RemotePart[] = [];
  for (const set of sets) {
    if (!isObj(set) || set.hidden === true) continue;
    if (!isObj(set.target) || set.target.kind !== TARGET_KIND) continue;
    if (typeof set.id !== 'string' || !ID_RE.test(set.id) || !Array.isArray(set.decals)) continue;
    const name = parseNames(set.name);
    if (!name) continue;
    for (const d of set.decals) {
      const p = parseDecal(d, name);
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
      if (out.length >= PARTS_MAX) return out;
    }
  }
  return out;
}
