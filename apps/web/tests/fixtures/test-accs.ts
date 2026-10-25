import { afterEach, beforeEach } from 'vitest';
import { setRemoteParts } from '@/features/character-maker';
import { API_ORIGIN } from '@/shared/config';

/* 기본 액세서리는 서버 상품으로 옮겨 코드에 없다 — 액세서리를 쓰는 시험은 서버 조각처럼 넣어 쓴다 */
const acc = (id: string) => ({
  id,
  slot: 'acc' as const,
  name: { ko: id, en: id, ja: id },
  src: `${API_ORIGIN}/v1/assets/h2${id}.png`,
  closedSrc: null,
  w: 6,
  h: 6,
});

/** 고르기 판 id(서버 조각은 «w:» 가 붙는다) */
export const MOLE = 'w:mole';
export const STAR = 'w:star';
export const BANDAGE = 'w:bandage';

/** 이 describe 안에서는 시험용 액세서리 셋을 쓴다 */
export function useTestAccs() {
  beforeEach(() => setRemoteParts([acc('mole'), acc('star'), acc('bandage')]));
  afterEach(() => setRemoteParts([]));
}
