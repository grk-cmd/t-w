import { createContext, useContext } from 'react';
import type { PartImages } from '../lib/draw-front';

/** 서버 파츠 목록을 받는 형편 — 받는 중 · 받음 · 못 받음(빈 고르기 칸에 다른 안내를 띄운다) */
export type RemoteLoad = 'loading' | 'ready' | 'failed';

/** 서버 그림 파츠를 그리는 데 필요한 것 — 그림 찾기 · 바뀐 횟수(그림이 새로 들어오면 늘어 다시 그리게 한다) · 목록 형편 */
export interface PartArt {
  images: PartImages;
  rev: number;
  load: RemoteLoad;
}

const PartArtContext = createContext<PartArt>({ images: () => null, rev: 0, load: 'loading' });

/** 생성기가 맨 위에서 한 번 건다 — 고르기 판 · 텍스처 칸이 같은 그림을 본다 */
export const PartArtProvider = PartArtContext.Provider;
export const usePartArt = (): PartArt => useContext(PartArtContext);
