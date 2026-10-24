import type { Lang } from '@/shared/i18n';
import type { RemotePart } from './remote-parts';

/* 얼굴 레이어 그림 — 프로토타입(PR #428)의 시안 그림을 도형 자료로 옮긴 것. 좌표는 200×200 얼굴 판(가운데 100),
   한 짝은 (0,0) 을 가운데로 그리고 자리(SLOT)에 놓는다. ⚠️ 그림은 시안 수준이다 — 디자이너 그림이 오면 이 표만 바꾼다. */

const INK = '#2A2320';

export type Shape =
  | { k: 'path'; d: string; fill?: string; stroke?: string; w?: number }
  | {
      k: 'ellipse';
      cx?: number;
      cy?: number;
      rx: number;
      ry: number;
      fill?: string;
      stroke?: string;
      w?: number;
      alpha?: number;
    }
  /** 관리자가 올린 그림 — 가운데를 (0,0) 에 두고 w × h(얼굴 판 단위)로 그린다 */
  | { k: 'img'; src: string; w: number; h: number };

type Names = Record<Lang, string>;

export interface LayerItem {
  id: string;
  name: Names;
  /** 뜬 눈 얼굴에 그릴 것 — color 는 고른 색(동공만 쓴다) */
  open: (color: string) => Shape[];
  /** 감은눈 얼굴에 그릴 것 — 없으면 open 과 같다(동공 · 하이라이트는 이것이 있을 때만 감은눈에 그린다 — drawFace) */
  closed?: Shape[];
}

/** 눈 폴더 안 층(아래 → 위) — 폴더를 옮기면 셋이 같이, 층을 고르면 그 층만 폴더 안에서 움직인다 */
export const EYE_PARTS = ['pupil', 'highlight', 'eyeline'] as const;
export type EyePart = (typeof EYE_PARTS)[number];

/** 그림을 고르는 레이어 */
export type LayerKind = EyePart | 'brows' | 'mouth' | 'cheek';
/** 자리 · 크기 · 회전을 고치는 대상 — 레이어 + 눈 폴더 */
export type AdjTarget = LayerKind | 'eyes';

const line = (d: string, w: number, stroke = INK): Shape => ({ k: 'path', d, stroke, w });

const BUILTIN_LAYERS: Record<LayerKind, readonly LayerItem[]> = {
  pupil: [
    { id: 'none', name: { ko: '없음', en: 'None', ja: 'なし' }, open: () => [] },
    {
      id: 'dot',
      name: { ko: '콩', en: 'Dot', ja: 'てん' },
      open: (c) => [{ k: 'ellipse', rx: 5, ry: 5.5, fill: c }],
    },
    {
      id: 'round',
      name: { ko: '동그랑', en: 'Round', ja: 'まる' },
      open: (c) => [{ k: 'ellipse', rx: 8, ry: 9.5, fill: c }],
    },
    {
      id: 'big',
      name: { ko: '큰', en: 'Big', ja: 'おおきい' },
      open: (c) => [{ k: 'ellipse', rx: 9.5, ry: 11, fill: c }],
    },
    {
      id: 'cat',
      name: { ko: '고양이', en: 'Cat', ja: 'ねこ' },
      open: (c) => [
        { k: 'ellipse', rx: 9, ry: 10.5, fill: c },
        { k: 'ellipse', rx: 2.2, ry: 8, fill: INK },
      ],
    },
  ],
  /** 빛반사 — 동공 위에 얹는 하얀 점(색은 동공 색과 상관없다) */
  highlight: [
    { id: 'none', name: { ko: '없음', en: 'None', ja: 'なし' }, open: () => [] },
    {
      id: 'dot',
      name: { ko: '콩', en: 'Dot', ja: 'てん' },
      open: () => [{ k: 'ellipse', cx: 3, cy: -4, rx: 3, ry: 3, fill: '#fff' }],
    },
    {
      id: 'double',
      name: { ko: '두 개', en: 'Double', ja: 'ふたつ' },
      open: () => [
        { k: 'ellipse', cx: 3.5, cy: -5, rx: 4, ry: 4, fill: '#fff' },
        { k: 'ellipse', cx: -4, cy: 5, rx: 1.8, ry: 1.8, fill: '#fff' },
      ],
    },
    {
      id: 'big',
      name: { ko: '큰', en: 'Big', ja: 'おおきい' },
      open: () => [{ k: 'ellipse', cx: 2.5, cy: -3.5, rx: 4.5, ry: 5, fill: '#fff' }],
    },
    {
      id: 'star',
      name: { ko: '반짝', en: 'Sparkle', ja: 'キラキラ' },
      open: () => [{ k: 'path', d: 'M3 -10q1 4 4 5q-3 1-4 5q-1-4-4-5q3-1 4-5z', fill: '#fff' }],
    },
  ],
  eyeline: [
    {
      id: 'none',
      name: { ko: '없음', en: 'None', ja: 'なし' },
      open: () => [],
      // 아이라인이 없어도 감은눈은 보여야 한다
      closed: [line('M-11 -1q11 9 22 0', 3.5)],
    },
    {
      id: 'thin',
      name: { ko: '얇은', en: 'Thin', ja: 'ほそい' },
      open: () => [line('M-13 -9q13-10 26 0', 3)],
      closed: [line('M-11 -1q11 9 22 0', 3.5)],
    },
    {
      id: 'thick',
      name: { ko: '굵은', en: 'Thick', ja: 'ふとい' },
      open: () => [line('M-14 -8q14-12 28 0', 5)],
      closed: [line('M-12 -1q12 10 24 0', 5)],
    },
    {
      id: 'lash',
      name: { ko: '속눈썹', en: 'Lashes', ja: 'まつげ' },
      open: () => [line('M-14 -8q14-12 28 0M14 -8l5-5M10 -12l3-6', 3.5)],
      closed: [line('M-12 -1q12 10 24 0M12 -1l5 3', 3.5)],
    },
    {
      id: 'smile',
      name: { ko: '웃는', en: 'Smiling', ja: 'にっこり' },
      open: () => [line('M-11 4q11-13 22 0', 4.5)],
    },
    {
      id: 'sleepy',
      name: { ko: '졸린', en: 'Sleepy', ja: 'ねむい' },
      open: () => [line('M-13 -4h26', 3.5)],
      closed: [line('M-12 0h24', 3.5)],
    },
  ],
  brows: [
    { id: 'none', name: { ko: '없음', en: 'None', ja: 'なし' }, open: () => [] },
    { id: 'arc', name: { ko: '얇은', en: 'Thin', ja: 'ほそい' }, open: () => [line('M-12 2q12-8 24 0', 3)] },
    {
      id: 'thick',
      name: { ko: '굵은', en: 'Thick', ja: 'ふとい' },
      open: () => [{ k: 'path', d: 'M-7 -3h14a3 3 0 0 1 0 6h-14a3 3 0 0 1 0-6z', fill: INK }],
    },
    {
      id: 'worry',
      name: { ko: '걱정', en: 'Worried', ja: 'こまり' },
      open: () => [line('M-10 -3l20 6', 3.5)],
    },
  ],
  mouth: [
    {
      id: 'smile',
      name: { ko: '미소', en: 'Smile', ja: 'ほほえみ' },
      open: () => [line('M-10 -2q10 9 20 0', 3.5)],
    },
    {
      id: 'cat',
      name: { ko: '고양이', en: 'Cat', ja: 'ねこ' },
      open: () => [line('M-14 -4q7 9 14 0q7 9 14 0', 3.5)],
    },
    {
      id: 'open',
      name: { ko: '헤', en: 'Open', ja: 'あーん' },
      open: () => [
        { k: 'path', d: 'M-11 -6h22q-2 16-11 16t-11-16z', fill: '#9A3B3B', stroke: INK, w: 3 },
        line('M-6 5q6-4 12 0', 3, '#F28A8A'),
      ],
    },
    { id: 'flat', name: { ko: '일자', en: 'Flat', ja: 'いちもんじ' }, open: () => [line('M-8 -1h16', 3.5)] },
    {
      id: 'o',
      name: { ko: '오', en: 'Oh', ja: 'お' },
      open: () => [{ k: 'ellipse', rx: 5, ry: 6, fill: '#9A3B3B', stroke: INK, w: 3 }],
    },
  ],
  cheek: [
    { id: 'none', name: { ko: '없음', en: 'None', ja: 'なし' }, open: () => [] },
    {
      id: 'blush',
      name: { ko: '발그레', en: 'Blush', ja: 'ぽっ' },
      open: () => [{ k: 'ellipse', rx: 13, ry: 7, fill: '#FF8FA8', alpha: 0.6 }],
    },
    {
      id: 'lines',
      name: { ko: '빗금', en: 'Lines', ja: 'しゃせん' },
      open: () => [line('M-8 4l5-8M0 4l5-8M8 4l5-8', 2.5, '#F06A88')],
    },
    {
      id: 'freckle',
      name: { ko: '주근깨', en: 'Freckles', ja: 'そばかす' },
      open: () =>
        [
          [-2, -6],
          [6, 0],
          [-6, 2],
        ].map(([cx, cy]) => ({ k: 'ellipse', cx, cy, rx: 2, ry: 2, fill: '#B5784F' }) as Shape),
    },
  ],
};

/** 쌓는 차례(아래 → 위) — 'eyes' 는 눈 폴더(그 안은 EYE_PARTS 차례) */
export const DRAW_ORDER = ['cheek', 'eyes', 'brows', 'mouth'] as const;
/** 짝으로 나오는 것 — 왼쪽 짝을 놓고 오른쪽은 좌우를 뒤집어 놓는다(눈 폴더 안 층도 폴더를 따라 짝) */
export const PAIRED: Record<AdjTarget, boolean> = {
  eyes: true,
  highlight: true,
  pupil: true,
  eyeline: true,
  brows: true,
  cheek: true,
  mouth: false,
};
export const isEyePart = (t: AdjTarget): t is EyePart => (EYE_PARTS as readonly string[]).includes(t);
/** 얼굴 판 한 변(단위) — 자리(SLOT) · 조정 값 · 그리기가 모두 이 좌표. 오른쪽 짝은 FACE_UNITS − 왼쪽 자리 */
export const FACE_UNITS = 200;

/** 200×200 얼굴 판에서의 기본 자리 — 짝은 왼쪽 짝 x(오른쪽은 200 − x), 하나짜리는 가운데. 눈 폴더 안 층은 폴더 가운데(0,0)가 기본 */
export const SLOT: Record<'eyes' | 'brows' | 'mouth' | 'cheek', { x: number; y: number }> = {
  eyes: { x: 66, y: 112 },
  brows: { x: 66, y: 88 },
  cheek: { x: 48, y: 134 },
  mouth: { x: 100, y: 142 },
};
/** 동공 색 고르기 */
export const EYE_COLORS = ['#3B2A22', '#2E5E9C', '#3E8A5A', '#8A4FB5', '#C2593A'] as const;
/** 옷 색 바로 고르기(그 밖은 색 고르개) — 앱 기본값이 맨 앞 */
export const TOP_COLORS = [
  '#9dba8a',
  '#9AD8C6',
  '#FF9BB3',
  '#BEC2EE',
  '#FFC24B',
  '#FFFFFF',
  '#5C6B8A',
] as const;
export const BOT_COLORS = [
  '#d98e73',
  '#5C6B8A',
  '#3E3E46',
  '#BEC2EE',
  '#9AD8C6',
  '#FFFFFF',
  '#FF9BB3',
] as const;
/** 조정 범위 — 자리(얼굴 판 픽셀) · 크기(배율) · 회전(도) */
export const LIMITS = { x: [-80, 80], y: [-80, 80], s: [0.3, 2.5], r: [-45, 45] } as const;

export const findItem = (kind: LayerKind, id: string): LayerItem =>
  layers[kind].find((it) => it.id === id) ?? (layers[kind][0] as LayerItem);

/* 액세서리 — 얼굴 어디든 여러 개(최대 ACC_MAX) 붙여 하나씩 옮긴다. 자리는 얼굴 판 가운데 기준. */
export interface AccItem {
  id: string;
  name: Names;
  shapes: Shape[];
  /** 감은눈 얼굴에 그릴 것 — 없으면 shapes */
  closed?: Shape[];
}
export const ACC_MAX = 5;
export const ACC_SLOT = { x: 100, y: 120 } as const;
/** 액세서리 자리 범위 — 얼굴 판 어디로든 */
export const ACC_LIMITS = { x: [-100, 100], y: [-120, 80], s: [0.3, 2.5], r: [-180, 180] } as const;
const BUILTIN_ACCS: readonly AccItem[] = [
  {
    id: 'bandage',
    name: { ko: '반창고', en: 'Bandage', ja: 'ばんそうこう' },
    shapes: [
      {
        k: 'path',
        d: 'M-16 -6h32a6 6 0 0 1 0 12h-32a6 6 0 0 1 0-12z',
        fill: '#F3C9A4',
        stroke: '#B98A63',
        w: 1.5,
      },
      { k: 'path', d: 'M-6 -6h12v12h-12z', fill: '#FBE3CC' },
      { k: 'ellipse', cx: -2, cy: -2, rx: 0.8, ry: 0.8, fill: '#B98A63' },
      { k: 'ellipse', cx: 2, cy: 2, rx: 0.8, ry: 0.8, fill: '#B98A63' },
    ],
  },
  {
    id: 'scar',
    name: { ko: '상처', en: 'Scar', ja: 'きず' },
    shapes: [line('M-10 -10l20 20M10 -10l-20 20', 3, '#C0504D')],
  },
  {
    id: 'scarline',
    name: { ko: '흉터', en: 'Stitches', ja: 'ぬいあと' },
    shapes: [line('M-16 0h32M-10 -5v10M-2 -5v10M6 -5v10M14 -5v10', 2.2, '#8E3B3B')],
  },
  {
    id: 'mole',
    name: { ko: '점', en: 'Mole', ja: 'ほくろ' },
    shapes: [{ k: 'ellipse', rx: 2.6, ry: 2.6, fill: '#4A3328' }],
  },
  {
    id: 'tear',
    name: { ko: '눈물', en: 'Tear', ja: 'なみだ' },
    shapes: [{ k: 'path', d: 'M0 -9q7 9 0 14q-7-5 0-14z', fill: '#8FD3FF', stroke: '#4A9BD1', w: 1.5 }],
  },
  {
    id: 'star',
    name: { ko: '별', en: 'Star', ja: 'ほし' },
    shapes: [
      {
        k: 'path',
        d: 'M0 -10l3 6.5 7 .8-5.2 4.8 1.4 7L0 5.6l-6.2 3.5 1.4-7L-10 -2.7l7-.8z',
        fill: '#FFD34D',
        stroke: '#C99A1C',
        w: 1.2,
      },
    ],
  },
  {
    id: 'heart',
    name: { ko: '하트', en: 'Heart', ja: 'ハート' },
    shapes: [
      {
        k: 'path',
        d: 'M0 8q-11-7-9-13q3-6 9 0q6-6 9 0q2 6-9 13z',
        fill: '#FF6F91',
        stroke: '#C94767',
        w: 1.2,
      },
    ],
  },
  {
    id: 'sweat',
    name: { ko: '땀', en: 'Sweat', ja: 'あせ' },
    shapes: [{ k: 'path', d: 'M0 -10q8 10 0 15q-8-5 0-15z', fill: '#BFE8FF', stroke: '#6FB6E0', w: 1.5 }],
  },
];
export const findAcc = (id: string): AccItem | null => accs.find((a) => a.id === id) ?? null;

/* 관리자가 올린 그림 파츠(서버) — 기본 그림 뒤에 붙인다. 서버에 닿지 못하면 기본 그림만 쓴다.
   id 앞에 «w:» 를 붙여 기본 그림 id 와 겹치지 않게 한다. */
let layers: Record<LayerKind, readonly LayerItem[]> = BUILTIN_LAYERS;
let accs: readonly AccItem[] = BUILTIN_ACCS;

/** 레이어 하나의 고를 수 있는 그림 — 기본 + 서버 */
export const layerItems = (kind: LayerKind): readonly LayerItem[] => layers[kind];
/** 붙일 수 있는 액세서리 — 기본 + 서버 */
export const accItems = (): readonly AccItem[] => accs;
export const LAYER_KINDS = Object.keys(BUILTIN_LAYERS) as LayerKind[];

/** 아이라인 그림에 감은 얼굴 그림이 없으면 기본 감은 줄 — 감은눈 얼굴이 비지 않게(다른 자리는 없으면 뜬 그림 그대로) */
const FALLBACK_CLOSED = BUILTIN_LAYERS.eyeline.find((it) => it.id === 'thin')?.closed ?? [];

/** 서버 그림 파츠를 고르기 목록에 넣는다(다시 부르면 바꿔 끼운다 · 빈 목록이면 기본만) */
export function setRemoteParts(parts: readonly RemotePart[]): void {
  const img = (src: string, p: RemotePart): Shape => ({ k: 'img', src, w: p.w, h: p.h });
  const next = { ...BUILTIN_LAYERS };
  const nextAcc: AccItem[] = [...BUILTIN_ACCS];
  for (const p of parts) {
    const id = `w:${p.id}`;
    const shut = p.closedSrc ? [img(p.closedSrc, p)] : undefined;
    if (p.slot === 'acc') {
      nextAcc.push(
        shut
          ? { id, name: p.name, shapes: [img(p.src, p)], closed: shut }
          : { id, name: p.name, shapes: [img(p.src, p)] },
      );
      continue;
    }
    const closed = shut ?? (p.slot === 'eyeline' ? FALLBACK_CLOSED : undefined);
    const item: LayerItem = closed
      ? { id, name: p.name, open: () => [img(p.src, p)], closed }
      : { id, name: p.name, open: () => [img(p.src, p)] };
    next[p.slot] = [...next[p.slot], item];
  }
  layers = next;
  accs = nextAcc;
}
