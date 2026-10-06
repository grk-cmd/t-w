/*
 * 방 멤버 «살아 있음» 판정 — 하트비트를 방 구독 밖(roomAlive/{방}/{멤버id})으로 빼는 방식.
 *
 * [왜] 멤버 노드에 30초마다 lastSeen 을 쓰면 값이 매번 바뀌어 Firebase 가 방 인원 전원에게 밀어 준다.
 *   운영 프로파일(2026-10-06)에서 방 멤버 쓰기의 거의 전부가 이 21바이트짜리였고, 전체 다운로드의 절반 가까이였다.
 *   도장을 아무도 구독하지 않는 roomAlive 에 찍으면 쓰기만 남고 퍼지지 않는다. 유령(onDisconnect 가 못 지운 노드)
 *   정리는 서버 함수(functions/room-stats.js sweepRoomAlive)가 1분마다 도장을 보고 멤버 노드를 지운다.
 *   방 사람들은 노드가 지워지는 메시지 한 번만 받는다.
 *
 * [옛 앱과 섞일 때] 옛 앱은 멤버 노드 lastSeen 이 2분 넘게 안 바뀌면 그 사람을 숨긴다. 그래서 새 방식(hb:2)은
 *   «방 입장 최소 버전(config/minRoomVer)» 이 ROOM_ALIVE_MIN_VER 이상일 때만 켠다 — 그때는 방에 옛 앱이 없다.
 *   그 전에는 예전처럼 멤버 노드에 lastSeen 을 쓴다. 판정은 멤버마다 따로 한다(hb:2 면 노드가 있으면 산 것).
 *
 * Firebase 를 직접 import 하지 않는다 — 순수 함수만(검사 sim-room-alive.js).
 */

export const ROOM_ALIVE_MIN_VER = '0.10.3';          // hb:2 를 이해하는 첫 판. minRoomVer 가 이 이상이면 새 방식을 켠다
export const ROOM_ALIVE_HB = 2;                      // 멤버 노드 표시 — 이 멤버의 생존은 roomAlive 도장으로 판정한다
export const ROOM_ALIVE_STALE_MS = 150 * 1000;       // 도장 30초 × 5번 놓치면 유령 — 서버 함수 · 입장 검사 · 관리자 청소가 같이 쓴다

// "0.10.3" 꼴 비교 — 숫자 3칸, 빠진 칸은 0, 꼬리(-beta.1)는 뗀다. 못 읽으면 NaN → false
function verParts(v){
  return String(v == null ? '' : v).replace(/^v/, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0).concat([0, 0, 0]).slice(0, 3);
}
export function verAtLeast(v, min){
  if(v == null || v === '') return false;
  const a = verParts(v), b = verParts(min);
  for(let i = 0; i < 3; i++){ if(a[i] > b[i]) return true; if(a[i] < b[i]) return false; }
  return true;
}
export function aliveV2On(minRoomVer){ return verAtLeast(minRoomVer, ROOM_ALIVE_MIN_VER); }

// 멤버 하나가 살아 있나. hb:2 면 노드가 있다는 것 자체가 생존이다(유령은 서버가 노드를 지운다).
// 그 밖에는 예전 규칙 — lastSeen 이 있고 기준시각 대비 문턱 안이어야 한다.
export function isMemberAlive(m, now, staleMs){
  if(!m || typeof m !== 'object') return false;
  if(m.hb === ROOM_ALIVE_HB) return true;
  return !!(m.lastSeen && (now - m.lastSeen) < staleMs);
}

// 같은 사람(userId)의 두 세션 중 a 가 더 새것인가. hb:2 노드는 lastSeen 이 입장 때 값에 머물러 비교가 안 되므로
// memberId(앞부분이 입장 시각 base36 — 문자열 정렬 = 입장순)로 고른다.
export function isNewerSession(idA, mA, idB, mB){
  if((mA && mA.hb === ROOM_ALIVE_HB) || (mB && mB.hb === ROOM_ALIVE_HB)) return String(idA) > String(idB);
  return ((mA && mA.lastSeen) || 0) > ((mB && mB.lastSeen) || 0);
}

// roomIndex 도장은 방마다 한 명이면 된다 — 살아 있는 멤버 중 memberId 가 가장 작은(가장 먼저 온) 사람이 찍는다.
// friends 를 아직 모르면(입장 직후 첫 스냅샷 전) 찍는다 — 방 개수에서 빠지는 것보다 한 번 더 찍는 게 낫다.
export function isIndexToucher(myId, friends){
  if(!friends) return true;
  for(const id in friends){ if(id < myId) return false; }
  return true;
}

// 입장 검사 · 관리자 청소용 — 멤버 id 하나가 살아 있나. lastSeen(옛 방식) 또는 roomAlive 도장(새 방식) 중 하나라도 최근이면 산 것.
// lastSeen 이 아예 없는 항목은 예전 규칙대로 산 것으로 센다(checkRoomCapacity 와 같다).
export function isProbeAlive(lastSeen, aliveAt, now, staleMs){
  if(lastSeen == null && aliveAt == null) return true;
  if(lastSeen != null && (now - lastSeen) < staleMs) return true;
  if(typeof aliveAt === 'number' && (now - aliveAt) < ROOM_ALIVE_STALE_MS) return true;
  return false;
}
