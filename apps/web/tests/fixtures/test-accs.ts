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

/* 동공 · 기본 아이라인도 서버 상품이다 — 처음 얼굴(FIRST_ITEM)은 자리 목록 맨 앞 */
const face = (id: string, slot: 'pupil' | 'eyeline', closed: boolean) => ({
  id,
  slot,
  name: { ko: id, en: id, ja: id },
  src: `${API_ORIGIN}/v1/assets/h2${id}.png`,
  closedSrc: closed ? `${API_ORIGIN}/v1/assets/h2${id}c.png` : null,
  w: 16,
  h: 18,
});
/** 시험용 동공 그림 주소 · 아이라인 뜬 / 감은 그림 주소 */
export const PUPIL_SRC = `${API_ORIGIN}/v1/assets/h2round.png`;
export const LINE_SRC = `${API_ORIGIN}/v1/assets/h2thin.png`;
export const LINE_SHUT_SRC = `${API_ORIGIN}/v1/assets/h2thinc.png`;
export const THIN = 'w:thin';
export const ROUND = 'w:round';

/** 이 describe 안에서는 시험용 얼굴(동공 둘 · 아이라인 둘 — 맨 앞이 처음 얼굴)과 액세서리 셋을 쓴다 */
export function useTestFace() {
  beforeEach(() =>
    setRemoteParts([
      face('round', 'pupil', false),
      face('cat', 'pupil', false),
      face('thin', 'eyeline', true),
      face('thick', 'eyeline', false),
      acc('mole'),
      acc('star'),
      acc('bandage'),
    ]),
  );
  afterEach(() => setRemoteParts([]));
}

/** 이 describe 안에서는 시험용 액세서리 셋을 쓴다 */
export function useTestAccs() {
  beforeEach(() => setRemoteParts([acc('mole'), acc('star'), acc('bandage')]));
  afterEach(() => setRemoteParts([]));
}
