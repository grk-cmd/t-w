import type { License } from '../model/license';
import type { LicensePageQuery, LicensePageView, LicenseStatsView } from '../model/licenseView';

/** 🔑 라이선스 키 읽기 — 통계 · 한 쪽 · (Firebase 판) 통째 목록. 쓰기는 features/license/* 의 포트가 한다. */
export interface LicensePort {
  /** 통계 칸. */
  stats(): Promise<LicenseStatsView>;
  /** 키 목록 한 쪽(검색어 포함). */
  page(query: LicensePageQuery): Promise<LicensePageView>;
  /** 통째 목록 — 지금 받는다(캐시 · 구독 없음). Firebase 판 원본 읽기. */
  list(): Promise<Record<string, License>>;
  /** 통째 목록 — 받아 둔 것이 있으면 그대로(통계 · 목록 폴백 · 일괄 발급이 한 번을 나눠 쓴다). */
  all(): Promise<Record<string, License>>;
}
