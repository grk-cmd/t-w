export const USER_PRESENCE = 'presence';
export const userPresenceKey = (uid: string) => [USER_PRESENCE, uid];
export const userBriefKey = (uid: string) => ['userBrief', uid];
export const userDetailKey = (uid: string) => ['userDetail', uid];
/** 서버 키셋 사용자 목록(API 판)의 쿼리 이름표 — 지급 · 삭제 같은 쓰기 뒤 줄을 다시 받을 때 쓴다. */
export const USER_KEYSET_KEY = ['users', 'keyset'];
