/*
 * 방 채널 · 시크릿룸 판정에 쓰는 값. 규칙(firebase-database-rules.json)의 channel 정규식과
 * 서버 함수(functions/room-stats.js)도 같은 값을 쓴다 — 바꾸면 같이 바꾼다.
 */
export const CHANNEL = Object.freeze({ WORKING: 'workingroom', TOGETHER: 'togetherroom' });
export const SECRET_ROOM_PREFIX = 'SCRT-';

export const isChannel = (v) => v === CHANNEL.WORKING || v === CHANNEL.TOGETHER;
export const isSecretRoom = (code) => String(code || '').indexOf(SECRET_ROOM_PREFIX) === 0;
