import { ApiError } from './api';

/** 다른 곳에서 먼저 고쳤을 때 모든 화면이 같은 말을 쓴다. */
export const CONFLICT_TEXT = '다른 곳에서 바꾼 내용을 받아왔어요';

/**
 * 서버 오류 `code` → 화면 문구. 이 표 한 곳만 — 화면마다 문구를 다시 쓰지 않는다.
 * 모르는 `code` 는 서버가 준 `message` 를 그대로 보인다(`apiErrorText`).
 */
export const API_ERROR_TEXT: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: '로그인이 풀렸어요 — 다시 로그인해 주세요',
  ACCESS_DENIED: '관리자 계정이 아니에요',
  CONCURRENT_UPDATE: CONFLICT_TEXT,
  // 설정
  OPS_UNKNOWN_KEY: '서버가 모르는 설정이에요',
  OPS_INVALID_VALUE: '설정 값이 올바르지 않아요',
  OPS_VERSION_ABOVE_LATEST: '공개된 최신 릴리스보다 높아요',
  OPS_RELEASES_UNAVAILABLE: '릴리스 목록을 읽지 못해 저장을 막았어요',
  // 공지 · 방
  NOTICE_NOT_FOUND: '이미 내려갔어요',
  NOTICE_TOO_MANY_PINNED: '고정은 20개까지예요',
  NOTICE_TOO_MANY_SLIDES: '슬라이드는 3장까지예요',
  NOTICE_INVALID_URL: '주소가 올바르지 않아요',
  ROOM_REALTIME_UNAVAILABLE: '방 서버에 닿지 못했어요',
  // 사용자
  USER_NOT_FOUND: '없는 사용자예요',
  USER_NO_PASSWORD_LOGIN: '구글 로그인만 쓰는 계정이에요',
  USER_ADMIN_TARGET: '관리자 계정은 지울 수 없어요',
  // 라이선스
  LICENSE_SECRET_ROOM_CODE_TAKEN: '이미 쓰고 있는 시크릿룸 코드예요',
  // 신고 · 제보
  REPORT_IMAGE_CHANGED: '그 사이 그림이 바뀌었어요',
  BUG_NOT_FOUND: '지워진 글이에요',
  BUG_ANSWER_CONFLICT: '다른 관리자가 먼저 답했어요',
  // 카탈로그
  CATALOG_INVALID_ITEM: '항목 값이 올바르지 않아요',
};

/** 오류 → 화면 문구. 표에 있으면 그 문구, 서버 오류인데 표에 없으면 서버 `message`, 그 밖은 `fallback`. */
export function apiErrorText(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  return API_ERROR_TEXT[error.code] ?? (error.kind === 'unavailable' ? fallback : error.message || fallback);
}
