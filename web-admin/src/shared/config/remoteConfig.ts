/**
 * 0.11.4 원격 설정(방 정원 · 가입 스위치 · 방 서버 장부 등록) 편집 잠금.
 * 앱 0.11.4 가 퍼지기 전에는 값을 바꾸면 옛 앱(0.11.3 — 정원 · 상한이 앱에 박혀 있음)과 어긋나므로 화면에서 막아 둔다.
 * 풀 때는 false 로 바꿔 관리자만 다시 배포한다.
 */
export const REMOTE_CONFIG_EDIT_LOCKED = true;
export const REMOTE_CONFIG_LOCK_NOTE = '🔒 잠금 — 앱 0.11.4 가 퍼진 뒤 엽니다(지금은 보기만)';

/** 전체 방 상한은 정원 · 가입 스위치와 따로 연다 — 실제 방 수가 옛 앱 기본값을 넘어 값을 맞춰야 해서. */
export const ROOM_LIMITS_EDIT_LOCKED = false;
