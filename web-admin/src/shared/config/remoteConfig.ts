/**
 * 0.11.4 원격 설정(방 상한 · 정원 · 가입 스위치 · 방 서버 장부 등록) 편집 잠금.
 * 앱 0.11.4 가 퍼지고 방 서버 v0.1.4 가 올라가기 전에는 값을 바꾸면 옛 앱 · 지금 방 서버와 어긋나므로 화면에서 막아 둔다.
 * 풀 때는 false 로 바꿔 관리자만 다시 배포한다.
 */
export const REMOTE_CONFIG_EDIT_LOCKED = true;
export const REMOTE_CONFIG_LOCK_NOTE =
  '🔒 잠금 — 앱 0.11.4 · 방 서버 v0.1.4 가 나간 뒤 엽니다(지금은 보기만)';
