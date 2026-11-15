import type { LicensePageQuery, LicensePageView, LicenseStatsView } from '../model/licenseView';

/** 🔑 라이선스 키 읽기 — 통계 · 한 쪽. 쓰기는 features/license/* 의 포트가 한다. */
export interface LicensePort {
  /** 통계 칸. */
  stats(): Promise<LicenseStatsView>;
  /** 키 목록 한 쪽(검색어 포함). */
  page(query: LicensePageQuery): Promise<LicensePageView>;
}
