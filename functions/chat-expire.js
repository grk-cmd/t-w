/*
 * 💬 서버 대화 3일 보관 — 매일 3일 지난 줄을 지운다(앱 app/parts/chat-history.js 의 CHAT_SERVER_KEEP_MS 와 같은 값 · 검사 sim-chat-history.js).
 * 3일이 안 됐어도 기록마다 최근 CHAT_KEEP_MAX(300) 줄을 넘는 옛 줄을 같이 지운다(앱의 CHAT_KEEP_MAX 와 같은 값).
 *   하루 한 번이라 그 사이엔 300줄을 넘을 수 있다 — 앱이 화면 · PC 저장을 늘 300줄로 자르므로 사용자에겐 300줄까지만 보인다.
 * 그보다 오래된 대화는 각자 PC 저장(워킹룸 · 시크릿룸)에만 남는다. 공용 투게더룸은 PC 에도 안 남기므로 3일 뒤엔 없다.
 *
 * rooms/{방}/chatLog · rooms/{방}/_chatTab/{s1|s2} 를 ts 색인(규칙 .indexOn)으로 «3일 전까지» 만 받아 지운다 — 남길 줄은 받지 않는다.
 * 방 목록 · 탭 목록은 shallow(키만)로 본다.
 * ★ 방장 지우기 표시 줄(sys: 'clr')은 남긴다 — 꺼져 있던 사람의 PC 저장이 다음 접속 때 이 줄로 비워진다.
 *   다음 [지우기] 가 노드를 통째로 지우므로 표시 줄은 한 기록에 늘 하나뿐이다.
 */
'use strict';

const CHAT_SERVER_KEEP_MS = 3 * 24 * 3600 * 1000;
const CHAT_KEEP_MAX = 300;
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

/* 최근 CHAT_KEEP_MAX 줄을 넘는 옛 줄을 지운다 — 표시 줄은 남긴다. 지운 줄 수를 돌려준다.
   ★ 먼저 최근 CHAT_KEEP_MAX + 1 줄만 받아 넘는지 본다(안 넘으면 그 줄만 받고 끝). 넘으면 경계 ts 이하를 받아 지운다.
     ts 가 같은 줄은 경계 쪽에서 남길 줄과 겹칠 수 있어 남길 키로 한 번 더 거른다. */
async function trimLog(db, path){
  const top = await db.ref(path).orderByChild('ts').limitToLast(CHAT_KEEP_MAX + 1).get();
  const rows = [];
  top.forEach(c => { rows.push({ key: c.key, v: c.val() }); });
  if (rows.length <= CHAT_KEEP_MAX) return 0;
  const keep = new Set(rows.slice(1).map(r => r.key));
  const edge = rows[0].v && typeof rows[0].v.ts === 'number' ? rows[0].v.ts : null;
  const old = await db.ref(path).orderByChild('ts').endAt(edge).get();
  const upd = {};
  let n = 0;
  old.forEach(c => {
    if (keep.has(c.key)) return;
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
  let logs = 0, removed = 0, trimmed = 0, failed = 0;
  for (const code of rooms){
    try{
      const keys = (await shallow('rooms/' + code)) || {};
      const paths = [];
      if (keys.chatLog) paths.push('rooms/' + code + '/chatLog');
      if (keys._chatTab){
        const tabs = (await shallow('rooms/' + code + '/_chatTab')) || {};
        TAB_IDS.forEach(id => { if (tabs[id]) paths.push('rooms/' + code + '/_chatTab/' + id); });
      }
      for (const p of paths){ removed += await expireLog(db, p, cut); trimmed += await trimLog(db, p); logs++; }
    }catch(e){ failed++; }
  }
  const sum = { rooms: rooms.length, logs, removed, trimmed, failed };
  console.log('[chatExpire]', JSON.stringify(sum));
  return sum;
}

module.exports = { runChatExpire, expireLog, trimLog, CHAT_SERVER_KEEP_MS, CHAT_KEEP_MAX, CLEAR_SYS, TAB_IDS };
