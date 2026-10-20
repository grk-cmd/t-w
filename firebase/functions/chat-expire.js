/*
 * 💬 서버 대화 보관 — 매시간 보관 일수가 지난 줄을 지운다. 기본 3일(앱 app/parts/chat-history.js 의 CHAT_SERVER_KEEP_MS 와 같은 값 · 검사 sim-chat-history.js).
 * 방 종류마다 일수를 다르게 둘 수 있다 — config/chatKeepDays = { default?, togetherroom?, workingroom?, secret?, … }(일 · 1~30).
 *   종류 이름은 열어 두었다(규칙은 영소문자 키만 본다) — 새 방 종류가 생기면 함수 · 규칙을 안 고치고 설정 한 칸만 더한다.
 *   칸이 없으면 default, default 도 없으면 3일. 종류를 모르는 방(방 정보가 이미 지워진 빈 방)도 default.
 * 보관 일수가 안 됐어도 기록마다 최근 CHAT_KEEP_MAX(300) 줄을 넘는 옛 줄을 지운다(앱의 CHAT_KEEP_MAX 와 같은 값).
 *   이건 하루 한 번(서울 04시 실행)만 — 기록마다 최근 301줄을 받아야 해서 매시간 하면 다운로드가 24배다.
 *   그 사이엔 300줄을 넘을 수 있다 — 앱이 화면 · PC 저장을 늘 300줄로 자르므로 사용자에겐 300줄까지만 보인다.
 * 그보다 오래된 대화는 각자 PC 저장(워킹룸 · 시크릿룸)에만 남는다. 공용 투게더룸은 PC 에도 안 남기므로 3일 뒤엔 없다.
 *
 * rooms/{방}/chatLog · rooms/{방}/_chatTab/{s1|s2} 를 ts 색인(규칙 .indexOn)으로 «3일 전까지» 만 받아 지운다 — 남길 줄은 받지 않는다.
 * 방 목록 · 탭 목록은 shallow(키만)로 본다.
 * ★ 방장 지우기 표시 줄(sys: 'clr')은 남긴다 — 꺼져 있던 사람의 PC 저장이 다음 접속 때 이 줄로 비워진다.
 *   다음 [지우기] 가 노드를 통째로 지우므로 표시 줄은 한 기록에 늘 하나뿐이다.
 */
'use strict';

const DAY_MS = 24 * 3600 * 1000;
const CHAT_SERVER_KEEP_MS = 3 * DAY_MS;
const KEEP_DAYS_PATH = 'config/chatKeepDays';
const KEEP_DAYS_MIN = 1, KEEP_DAYS_MAX = 30;   // 규칙 config/chatKeepDays 와 같은 범위
const SECRET_PREFIX = 'SCRT-';
const TRIM_HOUR_KST = 4;                       // 300줄 정리를 하는 시각(서울) — 예전 매일 04:30 자리
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

const okDays = (v) => typeof v === 'number' && v % 1 === 0 && v >= KEEP_DAYS_MIN && v <= KEEP_DAYS_MAX;

/* config/chatKeepDays → { defMs, byKind: { 종류: ms } } — 범위 밖 값은 없는 것으로 본다(규칙이 막지만 함수도 믿지 않는다). */
function keepPolicy(cfg){
  const byKind = {};
  let defMs = CHAT_SERVER_KEEP_MS;
  if (cfg && typeof cfg === 'object'){
    for (const [k, v] of Object.entries(cfg)){
      if (!okDays(v)) continue;
      if (k === 'default') defMs = v * DAY_MS;
      else byKind[k] = v * DAY_MS;
    }
  }
  return { defMs, byKind };
}

/* 방 종류 — 시크릿룸은 코드로, 나머지는 방 정보의 channel 로. Firebase 방은 rooms/{방}/_meta, 방 서버 방은 roomDir/{방}/meta.
   둘 다 없으면 null(빈 방이라 방 정보가 이미 지워졌다 → default). 한 칸씩만 읽는다. */
async function roomKind(db, code){
  if (code.startsWith(SECRET_PREFIX)) return 'secret';
  const fb = (await db.ref('rooms/' + code + '/_meta/channel').get()).val();
  if (typeof fb === 'string') return fb;
  const srv = (await db.ref('roomDir/' + code + '/meta/channel').get()).val();
  return typeof srv === 'string' ? srv : null;
}

const kstHour = (now) => new Date(now + 9 * 3600 * 1000).getUTCHours();

/* shallow(p) → 키만 담긴 객체(없으면 null) — room-stats.js adminShallow
   trim: 300줄 정리까지 할지(기본은 서울 04시 실행일 때만). */
async function runChatExpire(db, now, shallow, { trim = kstHour(now) === TRIM_HOUR_KST } = {}){
  const policy = keepPolicy((await db.ref(KEEP_DAYS_PATH).get()).val());
  // 종류별 칸이 없으면 방 종류를 읽지 않는다 — 모든 방이 같은 일수라 읽을 까닭이 없다
  const needKind = Object.keys(policy.byKind).length > 0;
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
      if (!paths.length) continue;
      const kind = needKind ? await roomKind(db, code) : null;
      const keepMs = (kind && policy.byKind[kind]) || policy.defMs;
      for (const p of paths){
        removed += await expireLog(db, p, now - keepMs);
        if (trim) trimmed += await trimLog(db, p);
        logs++;
      }
    }catch(e){ failed++; }
  }
  const sum = { rooms: rooms.length, logs, removed, trimmed, failed, trim };
  console.log('[chatExpire]', JSON.stringify(sum));
  return sum;
}

module.exports = { runChatExpire, expireLog, trimLog, keepPolicy, roomKind, CHAT_SERVER_KEEP_MS, CHAT_KEEP_MAX, CLEAR_SYS, TAB_IDS, KEEP_DAYS_MIN, KEEP_DAYS_MAX };
