/*
 * 💬 대화 기록 지움 남기기 — rooms/{방}/chatLog · rooms/{방}/_chatTab/{탭} 이 통째로 지워지면 누가 · 몇 줄을 지웠는지 함수 로그에 남긴다.
 * [왜] 규칙상 대화 기록은 누구나 통째로 지울 수 있다(.write: true). 방 서버 방의 대화가 서버 함수 기록 없이 사라진 일이 있어(10-19 PLAY-BFBT 70줄)
 *   어느 앱 · 어느 계정이 지웠는지 알아야 길을 막을 수 있다. 지우기를 막지는 않는다 — 기록만.
 * 한 줄씩 지우는 3일 정리(chat-expire.js)는 노드가 남아 있는 동안은 이 트리거가 안 돈다. 마지막 줄까지 지워 노드가 없어질 때만 «admin» 으로 한 번 찍힌다.
 * 방 노드(rooms/{방})를 통째로 지워도 아래 경로마다 한 번씩 돈다.
 * 검사: checks/sim-chat-delete-log.js
 */
'use strict';

const CLEAR_SYS = 'clr';            // 방장 [지우기] 표시 줄 — app/parts/chat/chat-history.js CLEAR_SYS 와 같은 값
const MAIN_TAB = 'general';         // chatLog 자리 — app/parts/chat/chat-tabs.js GENERAL 과 같은 값

/* 지워진 기록(지우기 전 값) → 로그에 남길 요약. 대화 글은 싣지 않는다(시각 · 줄 수 · 보낸 사람 수만). */
function summarizeDeleted(room, tab, before, authType, authId){
  const rows = (before && typeof before === 'object') ? Object.values(before) : [];
  let first = null, last = null, clearMark = false;
  const senders = new Set();
  for (const r of rows){
    if (!r || typeof r !== 'object') continue;
    const ts = typeof r.ts === 'number' ? r.ts : null;
    if (ts !== null){
      if (first === null || ts < first) first = ts;
      if (last === null || ts > last) last = ts;
    }
    if (r.sys === CLEAR_SYS) clearMark = true;
    if (typeof r.uid === 'string' && r.uid) senders.add(r.uid);
  }
  return {
    room: String(room || ''),
    tab: tab || MAIN_TAB,
    lines: rows.length,
    senders: senders.size,
    first,
    last,
    clearMark,
    by: authType || 'unknown',
    authId: authId || null,
  };
}

module.exports = { summarizeDeleted, CLEAR_SYS, MAIN_TAB };
