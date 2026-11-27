/** 바깥 주소는 여기 한 곳 — 우리 도메인만(CLAUDE.md «새 사이트 · 바깥 주소»). */
export const SITE_ORIGIN = 'https://together-working.com';
export const HELP_URL = 'https://help.together-working.com/';
export const PRIVACY_URL = 'https://help.together-working.com/privacy';
/** 자체 서버 API — 웹 생성기 파츠(관리자가 올린 그림)를 공개 카탈로그(`GET /v2/catalog`)에서 읽는다 */
export const API_ORIGIN = 'https://api.together-working.com';
/** 관리자가 올린 파츠 그림을 바로 받는 Firebase Storage(운영 버킷) — 카탈로그 `files` 의 다운로드 URL 이 이 호스트 · 버킷일 때만 쓴다.
    API 서버가 그림 바이트를 내지 않게(서버 부하) · 홈페이지 CSP img-src 에도 같은 주소 */
export const STORAGE_ORIGIN = 'https://firebasestorage.googleapis.com';
export const STORAGE_BUCKET = 'together-working.firebasestorage.app';
