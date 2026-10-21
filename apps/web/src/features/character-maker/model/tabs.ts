import { EYE_PARTS, type AdjTarget, type EyePart } from './catalog';

/** 고르기 판 탭 — 생성기가 들고 있어서 텍스처 칸도 지금 무엇을 고르고 있는지 안다 */
export type MakerTab = 'skin' | 'eyes' | 'brows' | 'mouth' | 'cheek' | 'acc' | 'image' | 'cloth';

/** 눈 탭에서 고른 마디 — 폴더(눈 전체) 또는 그 안 층 */
export type EyeNode = 'eyes' | EyePart;

/** 고르기 판에서 지금 고른 것 */
export interface Selection {
  tab: MakerTab;
  eyeNode: EyeNode;
  /** 액세서리 탭에서 고른 것 — 없으면 null */
  acc: number | null;
}

export const DEFAULT_SELECTION: Selection = { tab: 'skin', eyeNode: 'eyes', acc: null };

/** 텍스처 칸에서 끌어 옮길 대상 */
export type DragTarget = { t: 'adj'; target: AdjTarget } | { t: 'acc'; uid: number };

/** 고른 것 → 끌 대상(피부 · 내 그림 · 옷 탭이나 고른 액세서리가 없으면 null — 액세서리 탭은 누른 곳에서 가까운 것을 잡는다) */
export function dragTargetOf(sel: Selection): DragTarget | { t: 'acc-any' } | null {
  switch (sel.tab) {
    case 'eyes':
      return { t: 'adj', target: sel.eyeNode };
    case 'brows':
    case 'mouth':
    case 'cheek':
      return { t: 'adj', target: sel.tab };
    case 'acc':
      return { t: 'acc-any' };
    default:
      return null;
  }
}

export const isEyeNode = (v: string): v is EyeNode =>
  v === 'eyes' || (EYE_PARTS as readonly string[]).includes(v);
