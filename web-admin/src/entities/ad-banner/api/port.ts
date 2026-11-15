import type { Versioned } from '@/shared/api';
import type { AdSlide } from '../model/adBanner';

/** 런처 배너 슬라이드 — 통째로 읽고 통째로 바꾼다. */
export interface AdBannerPort {
  get(): Promise<Versioned<AdSlide[]>>;
  /** 빈 배열이면 배너가 숨겨진다. `from` 은 화면이 읽은 값 · 번호 — 그 사이 바뀌었으면 `conflict`. */
  save(from: Versioned<AdSlide[]>, slides: AdSlide[]): Promise<void>;
}
