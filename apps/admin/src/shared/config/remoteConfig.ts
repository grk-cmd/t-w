/**
 * 0.11.4 원격 설정(방 정원 · 가입 스위치 · 방 서버 장부 등록) 편집 잠금.
 * 앱 0.11.4 가 퍼지기 전에는 값을 바꾸면 옛 앱(0.11.3 — 정원 · 상한이 앱에 박혀 있음)과 어긋나므로 화면에서 막아 둔다.
 * 풀 때는 false 로 바꿔 관리자만 다시 배포한다.
 */
export const REMOTE_CONFIG_EDIT_LOCKED = true;
export const REMOTE_CONFIG_LOCK_NOTE = '🔒 잠금 — 앱 0.11.4 가 퍼진 뒤 엽니다(지금은 보기만)';

/**
 * 전체 방 상한(config/roomLimits)은 따로 연다 — 실제 방 수가 기본 300 을 넘어 값을 맞춰야 해서.
 * 지금 이 값을 보는 곳은 0.11.4 이상 앱의 Firebase 방 열기뿐이다. 0.11.3 은 250 이 박혀 있어 안 읽고,
 * 방 서버는 장부 등록(잠금)이 켜져야 이 값으로 합계를 막는다 — 그래서 바꿔도 지금 사용자에게 바로 생기는 변화는 없다.
 */
export const ROOM_LIMITS_EDIT_LOCKED = false;
