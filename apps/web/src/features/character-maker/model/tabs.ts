import type { LayerKind } from './catalog';

/** 고르기 판 탭 — 생성기가 들고 있어서 텍스처 칸도 지금 탭을 안다 */
export type MakerTab = 'skin' | LayerKind | 'image' | 'cloth';

/** 얼굴 레이어 탭이면 그 레이어(텍스처 칸에서 끌어 옮길 수 있다) */
export const layerOfTab = (t: MakerTab): LayerKind | null =>
  t === 'eyes' || t === 'brows' || t === 'mouth' || t === 'cheek' ? t : null;
