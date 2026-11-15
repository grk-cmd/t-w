export {
  refreshLicenses,
  patchLicenseRows,
  useLicensePage,
  useLicenses,
  useLicenseStats,
  useLoadAllLicenses,
  useRefreshLicenses,
  useReloadLicenses,
} from './api/hooks';
export { useLicensePort, type LicensePort } from './api/index';
// 쓰기 내용 · 통째 읽기 — features/license/* 의 Firebase 판과 사용자 화면(D12-8a 에서 포트로)이 쓴다. D12-Z 에서 걷는다.
export {
  createLicense,
  listLicenses,
  newLicenseWrite,
  removeLicensesWrite,
  revokeLicensesWrite,
} from './api/firebase';
export {
  countLicenses,
  filterLicenses,
  genLicenseKey,
  KEY_CHARS,
  licenseStatus,
  NOTE_MAX,
  type License,
  type LicenseCounts,
  type LicenseStatus,
} from './model/license';
export {
  LICENSE_QUERY_MAX,
  pageFromAll,
  pageFromApi,
  rowFromApi,
  rowFromLicense,
  sourceNote,
  statsFromAll,
  statsFromApi,
  type ApiLicenseItem,
  type ApiLicensePage,
  type ApiLicenseStats,
  type LicenseFallback,
  type LicensePageQuery,
  type LicensePageView,
  type LicenseRow,
  type LicenseSource,
  type LicenseStatsView,
} from './model/licenseView';
