/* sim-chat-history.js — 💬 대화 기록(서버 3일 · 이 PC 저장 · 커서 이어 받기) — chat-history.js · firebase-init 연결 · app.js 배선 · 규칙 · 서버 함수 · 처리방침
   실행:  node sim-chat-history.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 기록을 «지우는» 길이 여럿이라(방장 지우기 · 채널 삭제 · 직접 나감 · 서버 3일) 하나만 어긋나도
     «재부팅하면 대화가 사라졌다» 또는 «지운 대화가 다시 보인다» 가 된다. 지우면 안 되는 길(서버 3일 · 튕김)과 지워야 하는 길을 가짜 저장소로 굴린다.
   ・1절: 순수 함수 — 순서(ts 먼저) · 합치기(나중 것이 이김) · 지우기 표시 · 커서 · 채널 · 저장하는 방
   ・2절: 기록 열기 — 첫 받기 전엔 안 그림(입장 컷) · 저장 → 다시 열면 저장분 먼저 + 그 뒤만 · 지우기 표시 · 투게더룸은 저장 안 함 · 채널 정리 · 방 지우기 · 채널마다 최근 300줄
   ・3절: 연결 · 배선 — firebase-init(ts 커서 · 지운 줄은 안 넘김) · app.js(직접 나갈 때만 지움) · 규칙 ts 색인 · 설정 버튼
   ・4절: 서버 함수 — 3일 · 300줄 값이 앱과 같다 · 표시 줄은 남긴다 · 300줄 넘는 옛 줄 지우기(같은 ts 경계) · 방 종류별 보관 일수(config/chatKeepDays) ·
          300줄 정리는 서울 04시 실행만 · 매시간 예약 · 규칙 범위 · 처리방침 문구 */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (...c) => { for (const f of c) for (const d of ['', 'parts/', 'app/parts/', 'app/', 'hosting/', 'hosting/help/']) if (fs.existsSync(d + f)) return d + f; return null; };
const read = (...c) => { const f = find(...c); return f ? fs.readFileSync(f, 'utf8') : null; };
const MOD = read('chat-history.js'), FI = read('firebase-init.js'), APP = _joinRenderer(read('app.js')), HTML = read('desk-companion-prototype.html');
const RULES_SRC = stripReadGate(read('firebase-database-rules.json')), FX = read('functions/index.js'), PRIV = read('privacy.html');
const EXP_PATH = find('functions/chat-expire.js');
if (!MOD || !FI || !APP || !HTML || !RULES_SRC || !FX || !PRIV || !EXP_PATH) {
  say('  ? 원본 못 찾음 — chat-history.js · firebase-init.js · app.js · desk-companion-prototype.html · firebase-database-rules.json · functions/index.js · functions/chat-expire.js · privacy.html');
  process.exit(2);
}
const M = new Function(MOD.replace(/^export (function|const) /mg, '$1 ') +
  '\nreturn { CHAT_SERVER_KEEP_MS, CHAT_CURSOR_MARGIN_MS, CHAT_FIRST_LIMIT, CHAT_KEEP_MAX, CLEAR_SYS, CLEAR_MARK, chatOrder, mergeMsgs, applyClear, capList, sinceOf, keepsLocal, tabsToDrop, createChatHistory };')();

say('§1 순수 함수');
const m = (id, ts, o) => Object.assign({ id, ts, name: 'a', text: id }, o || {});
chk(JSON.stringify([m('k2', 100), m('k1', 200)].sort(M.chatOrder).map(x => x.id)) === '["k2","k1"]', '순서는 서버 ts 먼저(키는 보낸 사람 시계라 믿지 않는다)');
chk(JSON.stringify([m('b', 5), m('a', 5)].sort(M.chatOrder).map(x => x.id)) === '["a","b"]', 'ts 가 같으면 id 로 — 늘 결말이 있다');
const mg = M.mergeMsgs([m('a', 1), m('b', 2)], [m('b', 9), m('c', 3)]);
chk(mg.map(x => x.id).join() === 'a,c,b' && mg.find(x => x.id === 'b').ts === 9, '합치기 — 같은 id 는 나중 것(ts 확정값)이 이기고 겹치지 않는다');
const cl = M.applyClear([m('a', 1), m('b', 2), m('x', 3, { sys: 'clr' }), m('c', 4)]);
chk(cl.list.map(x => x.id).join() === 'x,c' && cl.dropped.join() === 'a,b', '★ 지우기 표시 줄보다 앞은 버리고 표시 줄 · 그 뒤는 남긴다');
chk(M.applyClear([m('a', 1)]).dropped.length === 0, '표시 줄이 없으면 그대로');
chk(M.sinceOf([]) === null && M.sinceOf([m('a', 10000000), m('b', 20000000)]) === 20000000 - M.CHAT_CURSOR_MARGIN_MS, '커서 = 가장 늦은 ts − 여유(같은 ts · 늦게 확정된 줄) · 저장 없으면 null(처음 받기)');
chk(M.keepsLocal('WORK-AB12', 'workingroom') && M.keepsLocal('SCRT-AB12', 'togetherroom') && !M.keepsLocal('PLAY-AB12', 'togetherroom') && !M.keepsLocal(null, 'workingroom'),
  '★ 이 PC 저장 — 워킹룸 · 시크릿룸은 저장 · 공용 투게더룸은 안 함');
chk(M.tabsToDrop({ s1: 10, s2: 20 }, { s1: { ts: 10 } }).join() === 's2' && M.tabsToDrop({ s1: 10 }, { s1: { ts: 11 } }).join() === 's1',
  '채널 정리 — 지운 채널 · 같은 자리(s1)에 새로 만든 채널은 저장을 비운다');
chk(M.CLEAR_MARK.sys === M.CLEAR_SYS && M.CLEAR_MARK.name.length <= 20 && M.CLEAR_MARK.text.length > 0, '지우기 표시 줄 — 옛 앱엔 평범한 한 줄(이름 · 글이 규칙 안)');

say('§2 기록 열기 (가짜 저장소 · 가짜 서버)');
function memStore(){
  const msgs = new Map(), tabs = new Map();
  const k = (r, t, id) => r + '\u0001' + t + '\u0001' + id;
  return {
    msgs, tabs,
    async load(r, t){ return [...msgs.entries()].filter(([key]) => key.startsWith(r + '\u0001' + t + '\u0001')).map(([, v]) => Object.assign({}, v)); },
    async put(r, t, list){ list.forEach(x => msgs.set(k(r, t, x.id), Object.assign({}, x))); },
    async del(r, t, ids){ ids.forEach(id => msgs.delete(k(r, t, id))); },
    async wipeTab(r, t){ for (const key of [...msgs.keys()]) if (key.startsWith(r + '\u0001' + t + '\u0001')) msgs.delete(key); tabs.delete(r + '\u0001' + t); },
    async wipeRoom(r){ for (const key of [...msgs.keys()]) if (key.startsWith(r + '\u0001')) msgs.delete(key); for (const key of [...tabs.keys()]) if (key.startsWith(r + '\u0001')) tabs.delete(key); },
    async wipeAll(){ msgs.clear(); tabs.clear(); },
    async count(){ return msgs.size; },
    async getTabs(r){ const o = {}; for (const [key, v] of tabs) if (key.startsWith(r + '\u0001')) o[key.split('\u0001')[1]] = v; return o; },
    async setTab(r, t, ts){ tabs.set(r + '\u0001' + t, ts); },
  };
}
const tick = () => new Promise(r => setImmediate(r));
async function run(){
  const store = memStore();
  let chan = 'workingroom', subs = [], sent = [];
  const H = M.createChatHistory({
    store, channel: () => chan,
    subscribeSince: (room, tab, since, onMsg, onReady) => { const s = { room, tab, since, onMsg, onReady, off: false }; subs.push(s); return () => { s.off = true; }; },
    clearLog: async () => ({ ok: true }),
    sendLog: async (room, msg, tab) => { sent.push({ room, msg, tab }); },
    setTimeout: (f) => { Promise.resolve().then(f); return 1; },
  });
  let got = [];
  let close = H.open('WORK-AB12', 'general', l => got.push(l.map(x => x.id).join()));
  await tick();
  chk(subs.length === 1 && subs[0].since === null && got.length === 0, '★ 저장이 없으면 since=null(마지막 줄들) · 서버 첫 받기 전엔 안 그린다(빈 목록 → 입장 컷 오판 방지)');
  subs[0].onMsg(m('a', 1000)); subs[0].onMsg(m('b', 2000)); subs[0].onReady();
  await tick(); await tick();
  chk(got[got.length - 1] === 'a,b', '첫 받기가 끝나면 한 번에 그린다');
  chk(store.msgs.size === 2, '워킹룸은 이 PC 에 저장');
  subs[0].onMsg(m('b', 2500));   // ts 확정(child_changed)
  await tick(); await tick();
  chk(store.msgs.size === 2 && [...store.msgs.values()].find(x => x.id === 'b').ts === 2500, 'ts 가 확정되면 같은 줄을 고쳐 쓴다(겹치지 않음)');
  close();
  chk(subs[0].off, '닫으면 구독도 끊는다');
  // 다시 열기 — 서버에선 a 가 3일 지나 지워졌다고 치자(구독은 지운 줄을 안 넘긴다)
  got = [];
  close = H.open('WORK-AB12', 'general', l => got.push(l.map(x => x.id).join()));
  await tick(); await tick();
  chk(got[0] === 'a,b', '★ 다시 열면 저장분을 먼저 그린다 — 서버에서 3일이 지나 지워진 줄도 남아 있다');
  chk(subs[1].since === 2500 - M.CHAT_CURSOR_MARGIN_MS || subs[1].since === 0, '그 뒤만 이어 받는다(커서 = 저장된 마지막 ts − 여유)');
  subs[1].onMsg(m('b', 2500)); subs[1].onMsg(m('c', 3000)); subs[1].onReady();
  await tick(); await tick();
  chk(got[got.length - 1] === 'a,b,c' && store.msgs.size === 3, '여유 구간에서 다시 온 줄은 겹치지 않고 새 줄만 붙는다');
  // 방장 지우기
  const r = await H.clear('WORK-AB12', 'general');
  chk(r.ok && sent.length === 1 && sent[0].msg.sys === 'clr' && sent[0].tab === 'general', '방장 [지우기] — 서버를 비운 뒤 표시 줄을 남긴다');
  subs[1].onMsg(Object.assign({ id: 'z', ts: 4000 }, sent[0].msg));
  await tick(); await tick();
  chk(got[got.length - 1] === 'z' && store.msgs.size === 1, '★ 표시 줄을 받으면 그 앞을 화면 · 저장에서 모두 지운다(꺼져 있던 사람은 다음 접속 때 같은 길)');
  close();
  // 투게더룸
  chan = 'togetherroom';
  got = [];
  H.open('PLAY-CD34', 'general', l => got.push(l.map(x => x.id).join()));
  await tick();
  const sp = subs[subs.length - 1];
  sp.onMsg(m('p', 1)); sp.onReady();
  await tick(); await tick();
  chk(got[got.length - 1] === 'p' && ![...store.msgs.keys()].some(k => k.startsWith('PLAY-CD34')), '★ 공용 투게더룸 — 화면엔 보이지만 이 PC 엔 저장 안 함');
  await H.wipeRoom('PLAY-CD34');
  chan = 'togetherroom';
  H.open('SCRT-EF56', 's1', () => {});
  await tick();
  const ss = subs[subs.length - 1];
  ss.onMsg(m('s', 1)); ss.onReady();
  await tick(); await tick();
  chk([...store.msgs.keys()].some(k => k.startsWith('SCRT-EF56\u0001s1')), '시크릿룸은 채널이 togetherroom 이어도 저장(코드 SCRT-)');
  // 채널 정리
  await H.syncTabs('SCRT-EF56', { s1: { name: 'a', ts: 10 } });
  chk(store.tabs.get('SCRT-EF56\u0001s1') === 10 && [...store.msgs.keys()].some(k => k.startsWith('SCRT-EF56\u0001s1')), '채널을 적어 둔다(아직 지우지 않음)');
  await H.syncTabs('SCRT-EF56', {});
  chk(![...store.msgs.keys()].some(k => k.startsWith('SCRT-EF56\u0001s1')), '★ 채널이 지워지면 그 채널 저장을 비운다');
  // 방 지우기 · 전부 지우기
  await store.put('WORK-AB12', 'general', [m('q', 1)]); await store.put('WORK-ZZ99', 'general', [m('w', 1)]);
  await H.wipeRoom('WORK-AB12');
  chk(![...store.msgs.keys()].some(k => k.startsWith('WORK-AB12')) && [...store.msgs.keys()].some(k => k.startsWith('WORK-ZZ99')), '방 지우기는 그 방만');
  chk(await H.count() === 1, '저장된 줄 수(설정 › 지우기 첫 누름)');
  await H.wipeAll();
  chk(await H.count() === 0, '전부 지우기(설정 · 계정 놓기)');
  // 채널마다 최근 CHAT_KEEP_MAX 줄 — 화면 · 이 PC 저장 둘 다
  let last = null;
  chan = 'workingroom';
  H.open('WORK-BIG1', 'general', l => { last = l; });
  await tick();
  const sb = subs[subs.length - 1];
  for (let i = 0; i < M.CHAT_KEEP_MAX + 5; i++) sb.onMsg(m('m' + String(i).padStart(5, '0'), 1000 + i));
  sb.onReady();
  await tick(); await tick();
  chk(M.CHAT_KEEP_MAX === 300 && last && last.length === M.CHAT_KEEP_MAX && last[0].id === 'm00005' && store.msgs.size === M.CHAT_KEEP_MAX,
    '★ 채널마다 최근 ' + M.CHAT_KEEP_MAX + '줄 — 화면도 이 PC 저장도, 넘으면 옛 줄부터 지운다');
  // 예전 앱이 상한 없이 쌓아 둔 저장 — 열면 최근 줄만 남기고 저장에서도 지운다
  store.msgs.clear();
  await store.put('WORK-OLD1', 'general', Array.from({ length: M.CHAT_KEEP_MAX + 20 }, (_, i) => m('o' + String(i).padStart(5, '0'), 2000 + i)));
  let last2 = null;
  H.open('WORK-OLD1', 'general', l => { last2 = l; });
  await tick(); await tick();
  chk(last2 && last2.length === M.CHAT_KEEP_MAX && last2[0].id === 'o00020' && store.msgs.size === M.CHAT_KEEP_MAX, '★ 예전에 상한 없이 쌓인 저장도 열 때 최근 ' + M.CHAT_KEEP_MAX + '줄로 줄인다');
  const cl = M.capList([m('a', 1), m('b', 2)]);
  chk(cl.list.length === 2 && cl.dropped.length === 0, '  상한 안이면 그대로');
}

run().then(() => {
  say('§3 연결 · 배선');
  chk(/import \{ createChatHistory, createIdbChatStore, chatOrder \} from "\.\/(?:(?:\.\.\/)?[\w-]+\/)?chat-history\.js"/.test(FI) && /const _chatOrder = chatOrder;/.test(FI),
    'firebase-init 은 chat-history.js 를 연결만 · 순서 함수는 한 벌');
  const sub = (FI.match(/subscribeChatSince\(room, tabId, since, onMsg, onReady, limit\)\{[\s\S]*?\n    \},/) || [''])[0];
  chk(/orderByChild\('ts'\), startAt\(since\)/.test(sub) && /onChildAdded\(q, one\)/.test(sub) && /onChildChanged\(q, one\)/.test(sub) && !/onChildRemoved/.test(sub),
    '★ 이어 받기는 ts 커서 · 새 줄 · 고친 줄만 — 지워진 줄(서버 3일)은 안 넘긴다');
  chk(/onlyOnce: true/.test(sub), '첫 받기 끝(onReady)은 한 번만');
  chk(/\.\.\.\(msg\.sys \? \{ sys:/.test(FI), 'sendChatLog 가 표시 줄(sys)을 싣는다');
  chk(/indexedDB/.test(FI) && /firebaseConfig\.databaseURL/.test(FI), '저장 DB 이름에 DB 주소 — 운영 · dev 가 섞이지 않는다');
  chk(/bindSettings\(document/.test(FI) && /id="progChatHistWipe"/.test(HTML), '설정 › 시스템 [이 PC 에 저장된 대화 지우기]');
  const leave = (APP.match(/async function doLeaveRoom\(opt\)\{[\s\S]*?_clearHiddenSeats\(\);/) || [''])[0];
  chk(/opt && opt\.wipeChat === true/.test(leave) && /wipeRoom\(_leftRoom\)/.test(leave), '★ 방 나가기는 opt.wipeChat === true 일 때만 그 방 저장을 지운다(클릭 이벤트가 opt 로 와도 안 지움)');
  chk(/inviteLeave'\)\.onclick=\(\)=>doLeaveRoom\(\{ wipeChat: true \}\)/.test(APP) && /fsInviteLeaveBtn\.onclick=\(\)=>doLeaveRoom\(\{ wipeChat: true \}\)/.test(APP),
    '[나가기] 버튼 둘 — 지운다');
  chk(/_roomDisbanding = false; \}\);/.test(APP) && /doLeaveRoom\(\{ wipeChat: true \}\)\)\.catch\(\(\)=>\{\}\)\.then\(\(\)=>\{ window\._roomDisbanding/.test(APP), '방 해산 — 지운다');
  chk(/^twNav\.on\(twNav\.NAV\.LEAVE_ROOM, doLeaveRoom\);/m.test(APP), '  창 열기 통로의 방 나가기는 doLeaveRoom 그대로(부탁할 때 인자를 안 넘기면 기록을 안 지운다)');
  const noWipe = [/doLeaveRoom\(\)\)\.catch\(\(\)=>\{\}\)\.then\(\(\)=>\{ window\._roomOverCapLeaving/, /function _onDeviceSessionLost\(\)\{[\s\S]{0,300}?twNav\.go\(twNav\.NAV\.LEAVE_ROOM\)\)/,   /* 창 열기 통로로 나간다 — 걸린 함수가 인자 없는 doLeaveRoom(모듈 순환 끊기 6) */
    /방 서버와 연결이 끊겨 방에서 나왔어요[\s\S]{0,80}?doLeaveRoom\(\)\)/];
  chk(noWipe.every(re => re.test(APP)), '★ 튕김(정원 초과 · 다른 기기 로그인 · 방 서버 끊김)은 안 지운다 — 다시 들어오면 이어진다');
  chk(/firebaseAPI\.chatHistory\.open\(room, tab, _onList\)/.test(APP) && /_ch \? _ch\.clear\(room, _chatMyTabId\(\)\)/.test(APP) && /chatHistory\.syncTabs\(room, _chatTabMeta\(\)\)/.test(APP) && /chatHistory\.wipeAll\(\)/.test(APP),
    'app.js 배선 — 열기 · 방장 지우기 · 채널 정리 · 계정 놓기');
  const R = JSON.parse(RULES_SRC);
  const room = R.rules.rooms.$room;
  chk(JSON.stringify(room.chatLog['.indexOn']) === '["ts"]' && JSON.stringify(room._chatTab.$tabId['.indexOn']) === '["ts"]', '★ 규칙 — chatLog · _chatTab 에 ts 색인(커서 · 서버 정리가 통째로 받지 않게)');

  say('§4 서버 함수 · 처리방침');
  const X = require(path.resolve(EXP_PATH));
  chk(X.CHAT_SERVER_KEEP_MS === M.CHAT_SERVER_KEEP_MS && M.CHAT_SERVER_KEEP_MS === 3 * 24 * 3600 * 1000 && X.CLEAR_SYS === M.CLEAR_SYS, '서버 보관 3일 · 표시 값이 앱과 같다');
  chk(X.CHAT_KEEP_MAX === M.CHAT_KEEP_MAX, '★ 서버 줄 수 상한이 앱과 같다 (' + X.CHAT_KEEP_MAX + ')');
  const updates = [];
  /* 가짜 기록 — ts 순 정렬 · endAt · limitToLast 만 */
  const reads = [];
  const mkDb = (rowsOf, valOf) => ({ ref: (p) => {
    const rows = () => rowsOf(p).slice().sort((a, b) => (a.v.ts ?? -1) - (b.v.ts ?? -1));
    const snap = (arr) => ({ forEach: (fn) => arr.forEach(x => fn({ key: x.key, val: () => x.v })) });
    return {
      orderByChild: () => ({ endAt: (cut) => ({ get: async () => snap(rows().filter(x => (x.v.ts ?? -1) <= cut)) }),
                             limitToLast: (k) => ({ get: async () => snap(rows().slice(-k)) }) }),
      get: async () => { reads.push(p); const v = valOf ? valOf(p) : undefined; return { val: () => (v === undefined ? null : v) }; },
      update: async (u) => { updates.push({ p, u }); } };
  } });
  const fakeDb = mkDb(() => [{ key: 'o1', v: { ts: 1 } }, { key: 'c', v: { ts: 2, sys: 'clr' } }]);
  return X.expireLog(fakeDb, 'rooms/R/chatLog', 10).then(async n => {
    chk(n === 1 && updates.length === 1 && 'o1' in updates[0].u && !('c' in updates[0].u), '★ 3일 지난 줄은 지우고 방장 지우기 표시 줄은 남긴다');
    // 300줄 상한 — 표시 줄 하나 + 305줄. 경계 줄(k0004 · 지움)과 남길 첫 줄(k0005)이 같은 ts
    const big = [{ key: 'c', v: { ts: 0, sys: 'clr' } }].concat(Array.from({ length: 305 }, (_, i) => ({ key: 'k' + String(i).padStart(4, '0'), v: { ts: 100 + (i === 4 ? 5 : i) } })));
    updates.length = 0;
    const t = await X.trimLog(mkDb(() => big), 'rooms/R/chatLog');
    const del = updates.length ? Object.keys(updates[0].u) : [];
    chk(t === 5 && del.length === 5 && !del.includes('c') && del.every(k => k < 'k0005'),
      '★ 기록마다 최근 ' + X.CHAT_KEEP_MAX + '줄을 넘는 옛 줄을 지운다 — 표시 줄은 남기고, 같은 ts 경계에서 남길 줄은 안 지운다');
    updates.length = 0;
    const t2 = await X.trimLog(mkDb(() => big.slice(0, 300)), 'rooms/R/chatLog');
    chk(t2 === 0 && updates.length === 0, '  ' + X.CHAT_KEEP_MAX + '줄 이하면 아무것도 안 지운다');
    updates.length = 0;
    const sum = await X.runChatExpire(fakeDb, 10 + X.CHAT_SERVER_KEEP_MS, async (p) => (p === 'rooms' ? { R: true } : p === 'rooms/R' ? { chatLog: true, _chatTab: true } : { s1: true }), { trim: true });
    chk(sum.rooms === 1 && sum.logs === 2 && sum.failed === 0, '방마다 #일반 · 채널 기록을 본다(shallow 로 키만)');
    chk(!reads.some(p => /_meta|roomDir/.test(p)), '★ 종류별 칸이 없으면 방 종류를 안 읽는다(설정이 비면 예전과 같은 다운로드)');

    // 방 종류별 보관 일수 — 범위 밖 값 · 0 · 소수는 버린다
    const D = 24 * 3600 * 1000;
    const pol = X.keepPolicy({ default: 2, secret: 1, workingroom: 0, togetherroom: 31, couple: 1.5 });
    chk(pol.defMs === 2 * D && JSON.stringify(pol.byKind) === JSON.stringify({ secret: D }), 'keepPolicy — default · 종류별 · 범위(1~30 정수) 밖은 없는 것으로');
    chk(X.keepPolicy(null).defMs === X.CHAT_SERVER_KEEP_MS, '설정이 없으면 3일');

    // 시크릿룸 1일 · 워킹룸(방 서버 방) 기본 3일 · 종류 모르는 방 기본 — 1.5일 된 줄
    const now = 100 * D;
    const old15 = [{ key: 'm', v: { ts: now - 1.5 * D } }];
    const kdb = mkDb(() => old15, (p) => ({ 'config/chatKeepDays': { secret: 1, workingroom: 3 }, 'roomDir/W/meta/channel': 'workingroom' })[p]);
    updates.length = 0; reads.length = 0;
    const ks = await X.runChatExpire(kdb, now, async (p) => (p === 'rooms' ? { 'SCRT-AB12': true, W: true, Z: true } : { chatLog: true }), { trim: false });
    const hit = updates.map(u => u.p).sort();
    chk(JSON.stringify(hit) === '["rooms/SCRT-AB12/chatLog"]', '★ 시크릿룸만 1일 — 방 서버 워킹룸(roomDir) · 종류 모르는 방은 3일이라 1.5일 된 줄을 남긴다');
    chk(!reads.includes('rooms/SCRT-AB12/_meta/channel') && reads.includes('rooms/W/_meta/channel') && reads.includes('roomDir/W/meta/channel'),
      '종류 — 시크릿룸은 코드로 · 나머지는 rooms/_meta 다음 roomDir/meta 한 칸씩');
    chk(ks.trimmed === 0 && ks.trim === false, '300줄 정리는 trim 일 때만(매시간 실행은 지우기만)');
    const H = 3600 * 1000, base = Date.UTC(2026, 9, 14);
    const trimAt = async (ms) => (await X.runChatExpire(mkDb(() => []), ms, async () => null)).trim;
    chk(await trimAt(base + (4 - 9 + 24) % 24 * H + 30 * 60000) === true && await trimAt(base + 30 * 60000) === false, '기본 trim — 서울 04시 실행만 true');
    return sum;
  }).then(() => {
    chk(/exports\.chatExpire = onSchedule\(\{ schedule: '30 \* \* \* \*', timeZone: 'Asia\/Seoul'/.test(FX) && /require\('\.\/chat-expire'\)\.runChatExpire/.test(FX), '매시간 30분 예약 함수(functions/index.js)');
    const KD = JSON.parse(RULES_SRC).rules.config.chatKeepDays;
    chk(KD && KD['.read'] === true && /admins/.test(KD['.write']) && /\^\[a-z\]\{1,20\}\$/.test(KD.$kind['.validate']) && /<= 30/.test(KD.$kind['.validate']) && />= 1/.test(KD.$kind['.validate']) && X.KEEP_DAYS_MIN === 1 && X.KEEP_DAYS_MAX === 30,
      '★ 규칙 config/chatKeepDays — 관리자만 쓰기 · 종류 이름 열어 둠(영소문자) · 1~30 이 함수와 같다');
    chk(/3일/.test(PRIV) && /이 PC|이용자 PC/.test(PRIV) && /대화 기록/.test(PRIV), '처리방침 — 서버 3일 · PC 저장 · 지우는 법');
    say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 대화는 서버 3일 · 이 PC 에 채널마다 최근 300줄 남고, 지울 때만 지운다'));
    process.exit(fail ? 1 : 0);
  });
}).catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
