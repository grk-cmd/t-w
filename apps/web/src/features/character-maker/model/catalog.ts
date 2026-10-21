import type { Lang } from '@/shared/i18n';

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
    };

type Names = Record<Lang, string>;

export interface LayerItem {
  id: string;
  name: Names;
  /** 뜬 눈(또는 눈이 아닌 레이어) — color 는 고른 색(눈동자) */
  open: (color: string) => Shape[];
  /** 감은눈 얼굴에 그릴 것 — 없으면 open 과 같다 */
  closed?: Shape[];
}

export type LayerKind = 'eyes' | 'brows' | 'mouth' | 'cheek';

const line = (d: string, w: number, stroke = INK): Shape => ({ k: 'path', d, stroke, w });

export const LAYERS: Record<LayerKind, readonly LayerItem[]> = {
  eyes: [
    {
      id: 'dot',
      name: { ko: '콩', en: 'Dot', ja: 'てん' },
      open: () => [{ k: 'ellipse', rx: 7, ry: 7, fill: INK }],
      closed: [line('M-8 0h16', 4)],
    },
    {
      id: 'round',
      name: { ko: '동그랑', en: 'Round', ja: 'まる' },
      open: (c) => [
        { k: 'ellipse', rx: 10, ry: 12, fill: c, stroke: INK, w: 3 },
        { k: 'ellipse', cx: 3, cy: -5, rx: 3.5, ry: 3.5, fill: '#fff' },
      ],
      closed: [line('M-11 -2q11 10 22 0', 4)],
    },
    {
      id: 'sparkle',
      name: { ko: '반짝', en: 'Sparkle', ja: 'キラキラ' },
      open: (c) => [
        { k: 'ellipse', rx: 13, ry: 15, fill: c, stroke: INK, w: 3 },
        { k: 'ellipse', cx: 4, cy: -6, rx: 4.5, ry: 4.5, fill: '#fff' },
        { k: 'ellipse', cx: -5, cy: 6, rx: 2, ry: 2, fill: '#fff' },
        line('M-14 -12q14-8 28 0', 4),
      ],
      closed: [line('M-14 -4q14 14 28 0M-14 -4l-5 -4', 4)],
    },
    {
      id: 'smile',
      name: { ko: '웃는', en: 'Smiling', ja: 'にっこり' },
      open: () => [line('M-10 4q10-12 20 0', 4.5)],
    },
    {
      id: 'sleepy',
      name: { ko: '졸린', en: 'Sleepy', ja: 'ねむい' },
      open: (c) => [{ k: 'path', d: 'M-11 -4h22v4a11 9 0 0 1-22 0z', fill: c, stroke: INK, w: 3 }],
      closed: [line('M-11 0h22', 4)],
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

/** 쌓는 차례(아래 → 위) */
export const LAYER_ORDER: readonly LayerKind[] = ['cheek', 'eyes', 'brows', 'mouth'];
/** 짝으로 나오는 것 — 왼쪽 짝을 놓고 오른쪽은 좌우를 뒤집어 놓는다 */
export const PAIRED: Record<LayerKind, boolean> = { eyes: true, brows: true, cheek: true, mouth: false };
/** 200×200 얼굴 판에서의 기본 자리 — 짝은 왼쪽 짝 x(오른쪽은 200 − x), 하나짜리는 가운데 */
export const SLOT: Record<LayerKind, { x: number; y: number }> = {
  eyes: { x: 66, y: 112 },
  brows: { x: 66, y: 88 },
  cheek: { x: 48, y: 134 },
  mouth: { x: 100, y: 142 },
};
/** 눈동자 색 고르기 */
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
export const LIMITS = { x: [-40, 40], y: [-40, 40], s: [0.5, 1.8], r: [-45, 45] } as const;

export const findItem = (kind: LayerKind, id: string): LayerItem =>
  LAYERS[kind].find((it) => it.id === id) ?? (LAYERS[kind][0] as LayerItem);
