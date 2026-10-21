import { EYE_COLORS, LAYERS, LIMITS, PAIRED, type LayerKind } from './catalog';

/** 자리 고치기 한 벌 — x · y 는 얼굴 판 픽셀(200 판), s 는 배율, r 은 도 */
export interface Adjust {
  x: number;
  y: number;
  s: number;
  r: number;
}
export type Side = 'L' | 'R' | 'C';
export type AdjustSet = Partial<Record<Side, Adjust>>;

export interface FaceImage {
  /** 사용자가 고른 그림 — 이 브라우저 안에서만 쓰는 dataURL(서버로 보내지 않는다) */
  dataUrl: string;
  pos: 'under' | 'top';
  on: 'both' | 'open' | 'closed';
}

/** 웹 생성기 한 벌 — 코드로 앱에 가져가는 칸(skin · top · bot · 얼굴 그림)의 원본 */
export interface CreatorState {
  skin: number;
  eyes: string;
  eyeColor: string;
  brows: string;
  mouth: string;
  cheek: string;
  adj: Record<LayerKind, AdjustSet>;
  sym: boolean;
  img: FaceImage | null;
  top: string;
  bot: string;
}

export const SKIN_COUNT = 5;
const one = (): Adjust => ({ x: 0, y: 0, s: 1, r: 0 });
const KINDS = Object.keys(LAYERS) as LayerKind[];

export function freshAdjust(): Record<LayerKind, AdjustSet> {
  const a = {} as Record<LayerKind, AdjustSet>;
  for (const k of KINDS) a[k] = PAIRED[k] ? { L: one(), R: one() } : { C: one() };
  return a;
}

export const DEFAULT_STATE: CreatorState = {
  skin: 1,
  eyes: 'round',
  eyeColor: EYE_COLORS[0],
  brows: 'arc',
  mouth: 'smile',
  cheek: 'blush',
  adj: freshAdjust(),
  sym: true,
  img: null,
  top: '#9dba8a',
  bot: '#d98e73',
};

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));
// 0 − 값: 0 을 뒤집어도 −0 이 아닌 0 으로(같은 자리 판정이 −0 · 0 으로 갈리지 않게)
export const mirrorAdjust = (a: Adjust): Adjust => ({ x: 0 - a.x, y: a.y, s: a.s, r: 0 - a.r });

export type Action =
  | { t: 'item'; kind: LayerKind; id: string }
  | { t: 'eyeColor'; color: string }
  | { t: 'skin'; skin: number }
  | { t: 'cloth'; part: 'top' | 'bot'; color: string }
  | { t: 'adjust'; kind: LayerKind; side: Side; key: keyof Adjust; value: number }
  /** 텍스처 위에서 끌기 — x · y 를 한 번에 */
  | { t: 'move'; kind: LayerKind; side: Side; x: number; y: number }
  | { t: 'resetAdjust'; kind: LayerKind }
  | { t: 'sym'; on: boolean }
  | { t: 'image'; img: FaceImage | null }
  | { t: 'replace'; state: CreatorState };

const HEX = /^#[0-9a-fA-F]{6}$/;

/** 상태 바꾸기 — 범위 밖 값은 잘라 넣고, 모르는 그림 · 색 모양은 받지 않는다(그대로 돌려준다) */
export function reduce(s: CreatorState, a: Action): CreatorState {
  switch (a.t) {
    case 'item':
      if (s[a.kind] === a.id || !LAYERS[a.kind].some((it) => it.id === a.id)) return s;
      return { ...s, [a.kind]: a.id };
    case 'eyeColor':
      return HEX.test(a.color) && a.color !== s.eyeColor ? { ...s, eyeColor: a.color } : s;
    case 'skin':
      return Number.isInteger(a.skin) && a.skin >= 0 && a.skin < SKIN_COUNT && a.skin !== s.skin
        ? { ...s, skin: a.skin }
        : s;
    case 'cloth': {
      if (!HEX.test(a.color)) return s;
      const c = a.color.toLowerCase();
      return c === s[a.part] ? s : { ...s, [a.part]: c };
    }
    case 'adjust':
      return patchAdjust(s, a.kind, a.side, { [a.key]: a.value });
    case 'move':
      return patchAdjust(s, a.kind, a.side, { x: a.x, y: a.y });
    case 'resetAdjust':
      return { ...s, adj: { ...s.adj, [a.kind]: freshAdjust()[a.kind] } };
    case 'sym': {
      if (a.on === s.sym) return s;
      if (!a.on) return { ...s, sym: false };
      // 다시 켜면 오른쪽 짝을 왼쪽의 거울로 맞춘다 — 따로 고친 오른쪽이 남으면 다음 조정 때 갑자기 뛴다
      const adj = { ...s.adj };
      for (const k of KINDS) {
        const L = adj[k].L;
        if (PAIRED[k] && L) adj[k] = { ...adj[k], R: mirrorAdjust(L) };
      }
      return { ...s, sym: true, adj };
    }
    case 'image':
      return { ...s, img: a.img };
    case 'replace':
      return a.state;
  }
}

/** 한 짝의 자리를 고친다 — 범위로 자르고, 바뀐 게 없으면 같은 상태, 대칭이면 반대 짝은 거울로 */
function patchAdjust(s: CreatorState, kind: LayerKind, side: Side, patch: Partial<Adjust>): CreatorState {
  const cur = s.adj[kind][side];
  if (!cur) return s;
  const next = { ...cur };
  for (const k of Object.keys(patch) as (keyof Adjust)[]) {
    const v = patch[k];
    if (v === undefined || !Number.isFinite(v)) return s;
    next[k] = clamp(v, LIMITS[k]);
  }
  if ((Object.keys(next) as (keyof Adjust)[]).every((k) => next[k] === cur[k])) return s;
  const set: AdjustSet = { ...s.adj[kind], [side]: next };
  if (s.sym && side !== 'C') set[side === 'L' ? 'R' : 'L'] = mirrorAdjust(next);
  return { ...s, adj: { ...s.adj, [kind]: set } };
}

/** 무작위 얼굴 — 자리는 그대로 두고 그림 · 색만 고른다 */
export function randomState(s: CreatorState, rnd: () => number = Math.random): CreatorState {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length) % xs.length] as T;
  return {
    ...s,
    skin: Math.floor(rnd() * SKIN_COUNT) % SKIN_COUNT,
    eyes: pick(LAYERS.eyes).id,
    eyeColor: pick(EYE_COLORS),
    brows: pick(LAYERS.brows).id,
    mouth: pick(LAYERS.mouth).id,
    cheek: pick(LAYERS.cheek).id,
  };
}
