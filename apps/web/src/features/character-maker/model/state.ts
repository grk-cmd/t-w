import {
  ACC_LIMITS,
  ACC_MAX,
  EYE_COLORS,
  LAYERS,
  LIMITS,
  PAIRED,
  findAcc,
  isEyePart,
  type AdjTarget,
  type LayerKind,
} from './catalog';

/** 자리 고치기 한 벌 — x · y 는 얼굴 판 픽셀(200 판), s 는 배율, r 은 도. 눈 폴더 안 층은 폴더 기준(폴더 크기 · 회전을 따라간다) */
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

/** 붙인 액세서리 하나 — uid 는 이 상태 안에서만 쓰는 번호(지우고 다시 붙여도 겹치지 않게 accSeq 로 센다) */
export interface Acc {
  uid: number;
  id: string;
  a: Adjust;
}

/** 웹 생성기 한 벌 — 코드로 앱에 가져가는 칸(skin · top · bot · 얼굴 그림)의 원본 */
export interface CreatorState {
  skin: number;
  pupil: string;
  highlight: string;
  eyeline: string;
  brows: string;
  mouth: string;
  cheek: string;
  /** 동공 색 — 오드아이가 아니면 L · R 이 같다 */
  pupilColor: { L: string; R: string };
  oddEye: boolean;
  adj: Record<AdjTarget, AdjustSet>;
  sym: boolean;
  acc: Acc[];
  accSeq: number;
  img: FaceImage | null;
  top: string;
  bot: string;
}

export const SKIN_COUNT = 5;
/** 새 액세서리를 옆으로 비켜 붙이는 간격(얼굴 판) */
const ACC_STEP = 14;
const one = (): Adjust => ({ x: 0, y: 0, s: 1, r: 0 });
const KINDS = Object.keys(LAYERS) as LayerKind[];
const TARGETS = Object.keys(PAIRED) as AdjTarget[];

export function freshAdjust(): Record<AdjTarget, AdjustSet> {
  const a = {} as Record<AdjTarget, AdjustSet>;
  for (const k of TARGETS) a[k] = PAIRED[k] ? { L: one(), R: one() } : { C: one() };
  return a;
}

export const DEFAULT_STATE: CreatorState = {
  skin: 1,
  pupil: 'round',
  highlight: 'dot',
  eyeline: 'thin',
  brows: 'arc',
  mouth: 'smile',
  cheek: 'blush',
  pupilColor: { L: EYE_COLORS[0], R: EYE_COLORS[0] },
  oddEye: false,
  adj: freshAdjust(),
  sym: true,
  acc: [],
  accSeq: 0,
  img: null,
  top: '#9dba8a',
  bot: '#d98e73',
};

export type Range = readonly [number, number];
const clamp = (v: number, [lo, hi]: Range) => Math.min(hi, Math.max(lo, v));
// 0 − 값: 0 을 뒤집어도 −0 이 아닌 0 으로(같은 자리 판정이 −0 · 0 으로 갈리지 않게)
export const mirrorAdjust = (a: Adjust): Adjust => ({ x: 0 - a.x, y: a.y, s: a.s, r: 0 - a.r });
/** 대칭일 때 반대 짝 — 눈 폴더 안 층은 폴더가 이미 오른쪽을 뒤집어 그리므로 같은 값(또 뒤집으면 어긋난다) */
export const pairOf = (target: AdjTarget, a: Adjust): Adjust =>
  isEyePart(target) ? { ...a } : mirrorAdjust(a);

/** 다음 accAdd 가 붙일 번호 — 붙인 것을 바로 고르려고 화면도 같은 규칙을 쓴다 */
export const nextAccUid = (s: CreatorState): number => s.accSeq + 1;

export type Action =
  | { t: 'item'; kind: LayerKind; id: string }
  /** 동공 색 — 오드아이가 아니면 side 와 상관없이 양쪽 */
  | { t: 'pupilColor'; side: 'L' | 'R'; color: string }
  /** 오드아이 끄면 오른쪽을 왼쪽 색으로 맞춘다 */
  | { t: 'oddEye'; on: boolean }
  | { t: 'skin'; skin: number }
  | { t: 'cloth'; part: 'top' | 'bot'; color: string }
  | { t: 'adjust'; target: AdjTarget; side: Side; key: keyof Adjust; value: number }
  /** 텍스처 위에서 끌기 — x · y 를 한 번에 */
  | { t: 'move'; target: AdjTarget; side: Side; x: number; y: number }
  | { t: 'resetAdjust'; target: AdjTarget }
  | { t: 'sym'; on: boolean }
  | { t: 'accAdd'; id: string }
  | { t: 'accRemove'; uid: number }
  | { t: 'accAdjust'; uid: number; key: keyof Adjust; value: number }
  | { t: 'accMove'; uid: number; x: number; y: number }
  | { t: 'image'; img: FaceImage | null }
  | { t: 'replace'; state: CreatorState };

const HEX = /^#[0-9a-fA-F]{6}$/;

/** 상태 바꾸기 — 범위 밖 값은 잘라 넣고, 모르는 그림 · 색 모양은 받지 않는다(그대로 돌려준다) */
export function reduce(s: CreatorState, a: Action): CreatorState {
  switch (a.t) {
    case 'item':
      if (s[a.kind] === a.id || !LAYERS[a.kind].some((it) => it.id === a.id)) return s;
      return { ...s, [a.kind]: a.id };
    case 'pupilColor': {
      if (!HEX.test(a.color)) return s;
      const next = s.oddEye ? { ...s.pupilColor, [a.side]: a.color } : { L: a.color, R: a.color };
      return next.L === s.pupilColor.L && next.R === s.pupilColor.R ? s : { ...s, pupilColor: next };
    }
    case 'oddEye':
      if (a.on === s.oddEye) return s;
      return a.on
        ? { ...s, oddEye: true }
        : { ...s, oddEye: false, pupilColor: { L: s.pupilColor.L, R: s.pupilColor.L } };
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
      return patchAdjust(s, a.target, a.side, { [a.key]: a.value });
    case 'move':
      return patchAdjust(s, a.target, a.side, { x: a.x, y: a.y });
    case 'resetAdjust':
      return { ...s, adj: { ...s.adj, [a.target]: freshAdjust()[a.target] } };
    case 'sym': {
      if (a.on === s.sym) return s;
      if (!a.on) return { ...s, sym: false };
      // 다시 켜면 오른쪽 짝을 왼쪽의 거울로 맞춘다 — 따로 고친 오른쪽이 남으면 다음 조정 때 갑자기 뛴다
      const adj = { ...s.adj };
      for (const k of TARGETS) {
        const L = adj[k].L;
        if (PAIRED[k] && L) adj[k] = { ...adj[k], R: pairOf(k, L) };
      }
      return { ...s, sym: true, adj };
    }
    case 'accAdd': {
      if (s.acc.length >= ACC_MAX || !findAcc(a.id)) return s;
      const uid = nextAccUid(s);
      // 새것은 붙어 있는 수만큼 옆으로 비켜 붙인다 — 모두 한 자리에 겹치면 고르기 어렵다
      const at: Adjust = { ...one(), x: ACC_STEP * s.acc.length - ACC_STEP * 2 };
      return { ...s, acc: [...s.acc, { uid, id: a.id, a: at }], accSeq: uid };
    }
    case 'accRemove': {
      const acc = s.acc.filter((x) => x.uid !== a.uid);
      return acc.length === s.acc.length ? s : { ...s, acc };
    }
    case 'accAdjust':
      return patchAcc(s, a.uid, { [a.key]: a.value });
    case 'accMove':
      return patchAcc(s, a.uid, { x: a.x, y: a.y });
    case 'image':
      return { ...s, img: a.img };
    case 'replace':
      return a.state;
  }
}

/** 고친 값 — 범위로 자르고, 하나라도 숫자가 아니면 null, 바뀐 게 없으면 cur 그대로 */
function applyPatch(cur: Adjust, patch: Partial<Adjust>, limits: Record<keyof Adjust, Range>): Adjust | null {
  const next = { ...cur };
  for (const k of Object.keys(patch) as (keyof Adjust)[]) {
    const v = patch[k];
    if (v === undefined || !Number.isFinite(v)) return null;
    next[k] = clamp(v, limits[k]);
  }
  return (Object.keys(next) as (keyof Adjust)[]).every((k) => next[k] === cur[k]) ? cur : next;
}

/** 한 짝의 자리를 고친다 — 바뀐 게 없으면 같은 상태, 대칭이면 반대 짝은 거울로 */
function patchAdjust(s: CreatorState, target: AdjTarget, side: Side, patch: Partial<Adjust>): CreatorState {
  const cur = s.adj[target][side];
  if (!cur) return s;
  const next = applyPatch(cur, patch, LIMITS);
  if (!next || next === cur) return s;
  const set: AdjustSet = { ...s.adj[target], [side]: next };
  if (s.sym && side !== 'C') set[side === 'L' ? 'R' : 'L'] = pairOf(target, next);
  return { ...s, adj: { ...s.adj, [target]: set } };
}

function patchAcc(s: CreatorState, uid: number, patch: Partial<Adjust>): CreatorState {
  const i = s.acc.findIndex((x) => x.uid === uid);
  const cur = s.acc[i];
  if (!cur) return s;
  const next = applyPatch(cur.a, patch, ACC_LIMITS);
  if (!next || next === cur.a) return s;
  const acc = s.acc.slice();
  acc[i] = { ...cur, a: next };
  return { ...s, acc };
}

/** 무작위 얼굴 — 자리 · 액세서리는 그대로 두고 그림 · 색만 고른다(오드아이는 끈다) */
export function randomState(s: CreatorState, rnd: () => number = Math.random): CreatorState {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length) % xs.length] as T;
  const color = pick(EYE_COLORS);
  const out: CreatorState = {
    ...s,
    skin: Math.floor(rnd() * SKIN_COUNT) % SKIN_COUNT,
    pupilColor: { L: color, R: color },
    oddEye: false,
  };
  // 동공은 «없음» 을 빼고 고른다 — 무작위로 눈이 사라지지 않게
  for (const k of KINDS) {
    const items = k === 'pupil' ? LAYERS[k].filter((it) => it.id !== 'none') : LAYERS[k];
    out[k] = pick(items).id;
  }
  return out;
}
