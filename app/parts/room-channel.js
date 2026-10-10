/*
 * 방 채널 · 시크릿룸 판정에 쓰는 값. 규칙(firebase-database-rules.json)의 channel 정규식과
 * 서버 함수(functions/room-stats.js)도 같은 값을 쓴다 — 바꾸면 같이 바꾼다.
 */
export const CHANNEL = Object.freeze({ WORKING: 'workingroom', TOGETHER: 'togetherroom' });
export const SECRET_ROOM_PREFIX = 'SCRT-';

export const isChannel = (v) => v === CHANNEL.WORKING || v === CHANNEL.TOGETHER;
export const isSecretRoom = (code) => String(code || '').indexOf(SECRET_ROOM_PREFIX) === 0;

// 코드 접두어가 정하는 채널 — PLAY- 는 투게더룸, WORK- 는 워킹룸(빈 방을 열 때 코드를 채널에 맞춰 옮기므로 둘이 같다).
// 시크릿룸은 늘 투게더룸. 옛 COZY- 처럼 접두어로 알 수 없으면 null.
export function channelFromRoomCode(code){
  const c = String(code || '');
  if(c.indexOf('PLAY-') === 0 || isSecretRoom(c)) return CHANNEL.TOGETHER;
  if(c.indexOf('WORK-') === 0) return CHANNEL.WORKING;
  return null;
}
// 사람이 있는데 표지(_meta.channel)를 잃은 방을 되살릴 채널. 들어오는 사람의 라이선스로 정하면
// 무료 사용자 한 명이 먼저 들어오는 것만으로 투게더룸이 워킹룸으로 굳는다 — 접두어를 먼저 본다.
export function recoverChannelFor(code, licensed){
  return channelFromRoomCode(code) || (licensed ? CHANNEL.TOGETHER : CHANNEL.WORKING);
}
