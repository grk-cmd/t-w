/** 쿼리 키 — 훅 · 두 판이 같이 쓴다. */
export const REPORTS_KEY = ['reports'];
export const REPORTS_KEYSET_KEY = [...REPORTS_KEY, 'keyset'];
/** 열쇠가 ['reports', …] 로 시작해 신고 목록을 새로 받을 때 함께 다시 센다. */
export const userReportCountKey = (uid: string) => [...REPORTS_KEY, 'count', uid];
