/*
 * 💬 서버 대화 3일 보관 — 매일 3일 지난 줄을 지운다(앱 app/parts/chat-history.js 의 CHAT_SERVER_KEEP_MS 와 같은 값 · 검사 sim-chat-history.js).
 * 그보다 오래된 대화는 각자 PC 저장(워킹룸 · 시크릿룸)에만 남는다. 공용 투게더룸은 PC 에도 안 남기므로 3일 뒤엔 없다.
 *
 * rooms/{방}/chatLog · rooms/{방}/_chatTab/{s1|s2} 를 ts 색인(규칙 .indexOn)으로 «3일 전까지» 만 받아 지운다 — 남길 줄은 받지 않는다.
 * 방 목록 · 탭 목록은 shallow(키만)로 본다.
 * ★ 방장 지우기 표시 줄(sys: 'clr')은 남긴다 — 꺼져 있던 사람의 PC 저장이 다음 접속 때 이 줄로 비워진다.
 *   다음 [지우기] 가 노드를 통째로 지우므로 표시 줄은 한 기록에 늘 하나뿐이다.
 */
'use strict';

const CHAT_SERVER_KEEP_MS = 3 * 24 * 3600 * 1000;
const CLEAR_SYS = 'clr';
const TAB_IDS = ['s1', 's2'];   // 규칙 _chatTab/$tabId 와 같다

/* 한 기록에서 cut(ts) 이하를 지운다 — 표시 줄은 남긴다. 지운 줄 수를 돌려준다. */
async function expireLog(db, path, cut){
  const snap = await db.ref(path).orderByChild('ts').endAt(cut).get();
  const upd = {};
  let n = 0;
  snap.forEach(c => {
    const v = c.val();
    if (v && v.sys === CLEAR_SYS) return;
    upd[c.key] = null; n++;
  });
  if (n) await db.ref(path).update(upd);
  return n;
}

/* shallow(p) → 키만 담긴 객체(없으면 null) — room-stats.js adminShallow */
async function runChatExpire(db, now, shallow){
  const cut = now - CHAT_SERVER_KEEP_MS;
  const rooms = Object.keys((await shallow('rooms')) || {});
  let logs = 0, removed = 0, failed = 0;
  for (const code of rooms){
    try{
      const keys = (await shallow('rooms/' + code)) || {};
      const paths = [];
      if (keys.chatLog) paths.push('rooms/' + code + '/chatLog');
      if (keys._chatTab){
        const tabs = (await shallow('rooms/' + code + '/_chatTab')) || {};
        TAB_IDS.forEach(id => { if (tabs[id]) paths.push('rooms/' + code + '/_chatTab/' + id); });
      }
      for (const p of paths){ removed += await expireLog(db, p, cut); logs++; }
    }catch(e){ failed++; }
  }
  const sum = { rooms: rooms.length, logs, removed, failed };
  console.log('[chatExpire]', JSON.stringify(sum));
  return sum;
}

module.exports = { runChatExpire, expireLog, CHAT_SERVER_KEEP_MS, CLEAR_SYS, TAB_IDS };
