import type { AdSlide } from '../model/adBanner';

/** 런처 배너 슬라이드 — 통째로 읽고 통째로 바꾼다. */
export interface AdBannerPort {
  get(): Promise<AdSlide[]>;
  /** 빈 배열이면 배너가 숨겨진다. */
  save(slides: AdSlide[]): Promise<void>;
}
