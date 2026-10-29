/* ═══ 🛰 sim-room-entry.js — 🚪 방 입장 · 나가기 · 승계 · 해산 · 방 만들기 · 랜덤 참여 모듈(room/room-entry.js — 앱 FSD 33번 · 0.13 방 포트 하나) ═══════════════
   모듈 모양 · app.js 연결 · 입장 흐름(가짜 방 포트 · 가짜 Presence 위에서 실제로 굴린다)을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(CHANNEL_NAMES · ROOM_PREFIX · _mockRoomAllowed · _srFmtDate · doLeaveRoom · makeMockProvider · refreshInviteUI · startRoom · syncFriendSeats · onRoomChanged · doCreateRoomInChannel · _myRoomLicensed)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 42줄 그대로 · 부르는 곳은 roomEntryMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · room-entry.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["room-entry.js","parts/room/room-entry.js","app/parts/room/room-entry.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — room-entry.js'); process.exit(2); }
/* 🛰 네트워크 준비 기다리기(shared/net-ready.js — 모듈이 TwNetReady.whenNetReady 를 부른다) — 가짜 window 위에 진짜 파일을 먼저 싣는다 */
const NET = ["net-ready.js","parts/shared/net-ready.js","app/parts/shared/net-ready.js"].map(read).find(Boolean);
if(!NET){ say('  ? 원본 못 찾음 — net-ready.js'); process.exit(2); }
const NET_PRE = NET + '\nvar TwNetReady = window.TwNetReady;\n';
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_chatNotifyIncoming","_clearHiddenSeats","_onDeviceSessionLost","_pokeFresh","_refreshChatMembers","applyCharToSeat","applyEquippedPartsToSeat","createSeat","deserializeDefFromNetwork","getDisplayName","getMyUserId","layoutSeats","maxPeople","myExpCells","pruneSeatPartsAgainstDef","refitSeatAfterParts","removeSeatLabels","renderSeatTabs","retryDefAfter","serializeDefForNetwork","showChatBubble","spawnFloater","toast","triggerPet","updateMyStatusChipPosition","_rcStore","mySecretRoom","paintRoomInfo"];
const VAL_DEPS = ["FLOATER_BURST","Presence","chatUiMod","rideBenchMod","roomRt","roomSettings","scene","seats","settingsMod","slots","tricksMod","twNav"];
const GET_DEPS = ["EXP_CELLS","awayPicMod","curSlot","focusLevelMod","isAdmin","isPremium","officeMode"];
const SET_DEPS = [];
const EXPORTS = ["doCreateRoomInChannel","_myRoomLicensed","CHANNEL_NAMES","ROOM_PREFIX","_mockRoomAllowed","_srFmtDate","doLeaveRoom","makeMockProvider","refreshInviteUI","startRoom","syncFriendSeats","onRoomChanged"];
const MOVED = ["_roomServerNet","_roomServerOn","_onServerRoomMeta","makeServerProvider","ROOM_SERVER_LOST_MSG","ROOM_SERVER_BUSY_MSG","_roomServerJoinMessage","ROOM_SERVER_CONNECTING_TOAST_MS","_myRoomLicensed","_startRoomOnServer","_serverRandomRooms","NET_READY_WAIT_MS","_mockRoomAllowed","_waitFirebaseApi","makeMockProvider","mockFriendDef","_charIdentityFingerprint","_deskStateFingerprint","_applyRemoteBenchSeats","_applyRemoteRides","syncFriendSeats","ROOM_PREFIX","ROOM_CODE_RE","_roomPrefixFor","_myRoomPrefix","genRoomCode","presenceChanged","_srFmtDate","_refreshSecretRoomUI","refreshInviteUI","_verLt","_ensureRoomVersionOk","startRoom","_bindDonate","CHANNEL_NAMES","roomLimitOf","_channelFullMsg","_paintMaxPeople","doCreateRoomInChannel","RANDOM_JOIN_TRIES","doJoinRandomRoom","_hoppingRoom","_setHopBusy","doHopRandomRoom","_joiningRoom","_resolveRoomCode","doJoinRoom","doJoinSecretRoom","doLeaveRoom","doCopyRoomCode","fsInviteCreate","fsInviteJoinBtn","fsInviteLeaveBtn","fsInviteRoomCopyBtn","_setupRoomCodeInput","_setupSecretCodeInput"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  EXP_CELLS: ()=>expBarMod.EXP_CELLS,","  FLOATER_BURST: floatersMod.FLOATER_BURST,","  Presence: Presence,","  _chatNotifyIncoming: (...a)=>chatPrefsMod._chatNotifyIncoming(...a),","  _clearHiddenSeats: (...a)=>hiddenSeatsMod._clearHiddenSeats(...a),","  _onDeviceSessionLost: (...a)=>deviceLostMod._onDeviceSessionLost(...a),","  _pokeFresh: (...a)=>roomSyncMod._pokeFresh(...a),","  _refreshChatMembers: (...a)=>chatPrefsMod._refreshChatMembers(...a),","  applyCharToSeat: (...a)=>applyCharToSeat(...a),","  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),","  awayPicMod: ()=>awayPicMod,","  chatUiMod: chatUiMod,","  createSeat: (...a)=>createSeat(...a),","  curSlot: ()=>curSlot,","  deserializeDefFromNetwork: (...a)=>roomSyncMod.deserializeDefFromNetwork(...a),","  focusLevelMod: ()=>focusLevelMod,","  getDisplayName: (...a)=>getDisplayName(...a),","  getMyUserId: (...a)=>getMyUserId(...a),","  isAdmin: ()=>isAdmin,","  isPremium: ()=>isPremium,","  layoutSeats: (...a)=>layoutSeats(...a),","  maxPeople: (...a)=>maxPeople(...a),","  myExpCells: (...a)=>expBarMod.myExpCells(...a),","  officeMode: ()=>officeMode,","  pruneSeatPartsAgainstDef: (...a)=>pruneSeatPartsAgainstDef(...a),","  refitSeatAfterParts: (...a)=>seatRefitMod.refitSeatAfterParts(...a),","  removeSeatLabels: (...a)=>overheadMod.removeSeatLabels(...a),","  renderSeatTabs: (...a)=>seatPanelMod.renderSeatTabs(...a),","  retryDefAfter: (...a)=>roomSyncMod.retryDefAfter(...a),","  rideBenchMod: rideBenchMod,","  scene: scene,","  seats: seats,","  serializeDefForNetwork: (...a)=>roomSyncMod.serializeDefForNetwork(...a),","  settingsMod: settingsMod,","  showChatBubble: (...a)=>showChatBubble(...a),","  slots: slots,","  spawnFloater: (...a)=>floatersMod.spawnFloater(...a),","  toast: (...a)=>toast(...a),","  tricksMod: tricksMod,","  triggerPet: (...a)=>triggerPet(...a),","  updateMyStatusChipPosition: (...a)=>statusChipMod.updateMyStatusChipPosition(...a),","  _rcStore: (...a)=>acctStateMod._rcStore(...a),","  twNav: twNav,","  mySecretRoom: ()=>roomLobbyProvider.mySecretRoom(),","  paintRoomInfo: ()=>roomInfoUi.paint(),","  roomSettings: TwRoomSettings,","  roomRt: TwRoomRt.store,"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    NET_PRE + src + '\nreturn window.TwRoomEntry;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createRoomEntry(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwRoomEntry = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwRoomEntry(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("ROOM_ENTRY_MOD_OFF") && app.includes("const roomEntryMod = TwRoomEntry.createRoomEntry({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const roomEntryMod = TwRoomEntry\\.createRoomEntry\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const roomEntryMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 roomEntryMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/room/room-entry.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/room/room-entry.js 를 app.js 보다 먼저 싣는다');
  return r;
}

/* 방 창(refreshInviteUI)이 부르는 firebaseAPI 이름들 · 내 시크릿룸 판정(deps.mySecretRoom)을 물은 횟수 */
function callsWith(src, uid){
  const any = anything(), calls = [];
  const fa = new Proxy({}, { get: (t, k) => new Proxy(function(){}, { apply: () => { calls.push(String(k)); return any; }, get: () => any }) });   // chatHistory.bindChannel 같은 칸도 받는다
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  deps.getMyUserId = () => uid;
  let asked = 0;
  deps.mySecretRoom = () => { asked++; return Promise.resolve(null); };
  const win = new Proxy({ firebaseAPI: fa }, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    NET_PRE + src + '\nreturn window.TwRoomEntry;')(win, any, ls, any, fa, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  try{ api.createRoomEntry(deps).refreshInviteUI(); }catch(_){}
  return { calls, asked };
}
/* 내 시크릿룸은 provider(room-lobby-provider.js — 내 코드 없음 · 소유 · 만료 판정) 한 곳에 묻는다 — 방 창이 따로 읽지 않는다 */
/* 모달이 열린 채 방을 나오면 로비에 한 번 알린다(NAV.ROOM_LOBBY) — 방 안 → 밖으로 바뀐 순간만 */
function leaveSignals(src){
  const any = anything(), went = [];
  let inRoom = true;
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  deps.mySecretRoom = () => Promise.resolve(null);
  deps.Presence = new Proxy({}, { get: (t, k) => k === 'active' ? () => inRoom : any });
  deps.twNav = { NAV: { ROOM_LOBBY: 'roomLobby', LEAVE_ROOM: 'leaveRoom' }, on: () => {}, go: (n) => { went.push(n); } };
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  // 갈아타기 중 깃발을 시험에서만 바꾸려고 내놓는 이름에 하나 더한다(모듈 원본은 그대로)
  const src2 = src.replace('return {\n  doCreateRoomInChannel,', 'return {\n  __setHop: (v)=>{ _hoppingRoom = v; },\n  doCreateRoomInChannel,');
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    NET_PRE + src2 + '\nreturn window.TwRoomEntry;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  const m = api.createRoomEntry(deps);
  const n = () => went.filter(x => x === 'roomLobby').length;
  const step = (room, hop) => { inRoom = room; if(hop !== undefined) m.__setHop(hop); m.refreshInviteUI(); return n(); };
  const plain = [step(false), step(true), step(true), step(false), step(false)].join();
  // 갈아타기 성공: 안 → (갈아타는 중 밖) → 새 방 안 → finally(안) — 알림 없음
  went.length = 0; step(true, false);
  const hopOk = [step(false, true), step(true, true), step(true, false)].join();
  // 갈아타기 실패: 안 → (갈아타는 중 밖) → finally(밖) — 그때 한 번
  went.length = 0; step(true, false);
  const hopFail = [step(false, true), step(false, false)].join();
  return plain + '|' + hopOk + '|' + hopFail;
}
const judgeLeave = (src) => { try{ return leaveSignals(src).split('|')[0] === '0,0,0,1,1'; }catch(_){ return false; } };
const judgeHop = (src) => { try{ const r = leaveSignals(src).split('|'); return r[1] === '0,0,0' && r[2] === '0,1'; }catch(_){ return false; } };
const judgeSecret = (src) => { const r = callsWith(src, 'ME'); return !r.calls.includes('getMySecretRoom') && !r.calls.includes('getSecretRoomPub') && r.asked === 1; };

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 내 시크릿룸 — 판정 한 곳');
chk(judgeSecret(MOD), 'F1 시크릿룸 칸은 provider 의 mySecretRoom 에 한 번 묻는다 · firebaseAPI 를 직접 읽지 않는다');
chk(judgeLeave(MOD), '★ 방 안 → 밖으로 바뀐 순간에만 로비에 알린다(NAV.ROOM_LOBBY) — 처음 · 계속 밖 · 계속 안은 안 알림');
chk(judgeHop(MOD), '★ 방 갈아타기 — 새 방에 들어가면 알림 0 · 실패해 밖에 남으면 그때 한 번');
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
{
  const m2 = MOD.replace('Promise.resolve(mySecretRoom()).then(', "firebaseAPI.getMySecretRoom(getMyUserId()); Promise.resolve(mySecretRoom()).then(");
  chk(m2 !== MOD && !judgeSecret(m2), '방 창이 시크릿룸을 따로 읽으면 — 판정 한 곳이 빨강');
  const m3 = MOD.replace('const left = !_hoppingRoom && _wasInRoom && !on;', 'const left = !on;');
  chk(m3 !== MOD && !judgeLeave(m3), '나온 순간이 아니라 밖일 때마다 알리면 — 로비 알림 판정이 빨강');
  const m4 = MOD.replace('const left = !_hoppingRoom && _wasInRoom && !on;', 'const left = _wasInRoom && !on;').replace('if(!_hoppingRoom) _wasInRoom = on;', '_wasInRoom = on;');
  chk(m4 !== MOD && !judgeHop(m4), '갈아타는 중을 안 거르면 — 갈아타기 판정이 빨강');
}
/* 입장 흐름 — 가짜 방 포트(roomRt) · 가짜 Presence 위에서 startRoom · 만들기 · 랜덤을 실제로 굴린다 */
const RS = (() => { const src = ["room-settings.js","parts/room/room-settings.js","app/parts/room/room-settings.js"].map(read).find(Boolean); const w = {}; new Function('window', src)(w); return w.TwRoomSettings; })();
async function flow(src, o){
  const any = anything();
  const log = { starts: [], toasts: [], stops: 0, peeks: [], errs: [] };
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  let active = false;
  const results = (o.results || []).slice();
  deps.Presence = new Proxy({
    start: async (code, def, name, cb, opts) => { log.starts.push({ code, create: opts && opts.provider && opts.provider.create }); const r = results.shift() || { ok: true, others: 1, meta: { channel: 'workingroom' } }; active = !!r.ok; return r; },
    stop: async () => { log.stops++; active = false; },
    active: () => active, roomCode: () => null,
  }, { get: (t, k) => (k in t ? t[k] : any) });
  deps.roomRt = { makeProvider: (h, po) => ({ create: (po && po.create) || null }), peek: async (c) => { log.peeks.push(c); return o.peek === undefined ? { exists: false, count: 0 } : o.peek; },
    random: async () => (o.random === undefined ? [] : o.random), isReady: () => true, myCode: () => 'u1' };
  deps.mySecretRoom = async () => o.mySecret || null;
  deps.toast = (m) => { log.toasts.push(m); };
  deps.slots = [{ skin: 1 }]; deps.curSlot = () => 0;
  deps.roomSettings = RS;
  deps.maxPeople = () => 10;
  deps.isPremium = () => !!o.premium; deps.isAdmin = () => false;
  deps._rcStore = () => ({ refresh: async () => {}, minRoomVer: () => null, maxPeople: () => 10, roomLimitOf: () => 300, onChange: () => {} });
  const win = new Proxy({ companion: undefined, _deviceSessionLost: false, _pendingRoomChannel: null, _pendingRoomOpen: false }, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  globalThis.TwErrorCodes = { notify: (c) => log.errs.push(c) };
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    NET_PRE + src + '\nreturn window.TwRoomEntry;')(win, any, ls, any, any, undefined, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  const m = api.createRoomEntry(deps);
  await o.run(m);
  for(let k = 0; k < 10; k++) await Promise.resolve();
  return { log, win };
}
const flowRows = async (src) => {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    let f = await flow(src, { run: (m) => m.startRoom('WORK-AB12') });
    t(f.log.starts.length === 1 && f.log.starts[0].create === null && f.log.toasts.includes('방에 연결됐어요: WORK-AB12'), '코드로 들어가기 — create 없이 · 들어가면 «연결됐어요»');
    f = await flow(src, { results: [{ ok: false, code: 'channelFull' }], run: (m) => m.startRoom('WORK-AB12') });
    t(/워킹룸이 지금 꽉 찼어요/.test(f.log.toasts.join()) && f.win._pendingRoomChannel === null, '서버 channelFull → 꽉 찼다는 안내 · 만들기 표시를 지운다');
    f = await flow(src, { results: [{ ok: false, code: 'timeout' }], run: (m) => m.startRoom('WORK-AB12') });
    t(f.log.toasts.includes('서버에 연결하지 못했어요 — 잠시 후 다시 시도해 주세요'), '못 붙음(timeout 등) → «잠시 후 다시»');
    f = await flow(src, { results: [{ ok: true, others: 0, meta: { channel: 'togetherroom' } }, { ok: true, others: 0, meta: { channel: 'togetherroom' } }], run: (m) => m.startRoom('WORK-AB12') });
    t(f.log.stops === 1 && f.log.starts.map(x => x.code).join() === 'WORK-AB12,PLAY-AB12', '★ 빈 방이 투게더룸으로 열렸는데 접두어가 WORK- 면 PLAY- 로 옮겨 연다(한 번만)');
    f = await flow(src, { run: (m) => m.doCreateRoomInChannel('togetherroom', { title: '수다', max: 4, open: true, music: true }) });
    const c = f.log.starts[0] && f.log.starts[0].create;
    t(f.log.starts.length === 1 && /^PLAY-[A-Z0-9]{4}$/.test(f.log.starts[0].code) && JSON.stringify(c) === '{"channel":"togetherroom","open":true,"title":"수다","max":4,"music":true}', '★ 만들기 → PLAY- 코드 · join.create 에 고른 값');
    t(f.win._pendingRoomChannel === null && f.win._pendingRoomOpen === false, '  들어간 뒤 만들기 표시를 비운다');
    f = await flow(src, { mySecret: { code: 'SCRT-AB12', name: 'x', expiresAt: null }, run: (m) => m.startRoom('SCRT-AB12') });
    t(f.log.peeks.join() === 'SCRT-AB12' && JSON.stringify(f.log.starts[0].create) === '{"channel":"togetherroom","music":false}', '★ 내 시크릿룸이 비어 있으면(peek 0명) 주인이 연다 — create { togetherroom · music }');
    f = await flow(src, { mySecret: { code: 'SCRT-AB12' }, peek: { exists: true, count: 2 }, run: (m) => m.startRoom('SCRT-AB12') });
    t(f.log.starts[0].create === null, '  사람이 있으면 create 없이(듣던 곡을 지우지 않게)');
    f = await flow(src, { mySecret: { code: 'SCRT-ZZZZ' }, run: (m) => m.startRoom('SCRT-AB12') });
    t(f.log.peeks.length === 0 && f.log.starts[0].create === null, '  남의 시크릿룸이면 들여다보지 않고 create 없이(입장 판정은 서버)');
    f = await flow(src, { results: [{ ok: false, code: 'secretClosed' }], run: (m) => m.startRoom('SCRT-AB12') });
    t(f.log.toasts.includes('없는 시크릿룸이거나 이용 기간이 끝났어요'), '  서버 secretClosed → 안내');
  }catch(e){ t(false, '흐름이 던짐 — ' + String(e && e.message || e).slice(0, 120)); }
  return r;
};
/* 랜덤 참여 — doJoinRandomRoom 을 떼어 굴린다(못 물음 null · 없음 [] · 있음) */
const randomRows = async (src) => {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const a = src.indexOf('async function doJoinRandomRoom(){'), b = src.indexOf('\n}\n', a) + 2;
  const run = async (list) => {
    const log = { toasts: [], starts: [], errs: [] };
    const f = new Function('_randomRooms', 'toast', 'startRoom', 'TwErrorCodes', src.slice(a, b) + '\nreturn doJoinRandomRoom;')(
      async () => list, (m) => log.toasts.push(m), (c) => log.starts.push(c), { notify: (c) => log.errs.push(c) });
    await f();
    return log;
  };
  const n = await run(null), e = await run([]), y = await run(['WORK-AAAA', 'WORK-BBBB']);
  t(a > 0 && n.errs.join() === 'E-ROOM-01' && !n.starts.length, '랜덤 참여 — 못 물으면 E-ROOM-01(빈 목록과 다르게)');
  t(e.toasts.length === 1 && /참여할 수 있는 방이 없어요/.test(e.toasts[0]) && !e.starts.length, '  없으면 «방을 만들어 보세요»');
  t(y.starts.join() === 'WORK-AAAA', '  있으면 서버가 고른 첫 방으로(따로 정원을 확인하지 않는다)');
  return r;
};
globalThis.__rsCheck = (async () => {
  const F = await flowRows(MOD);
  say('── 4. 입장 흐름(가짜 방 포트)');
  F.forEach(([ok, msg]) => chk(ok, msg));
  (await randomRows(MOD)).forEach(([ok, msg]) => chk(ok, msg));
  const broke = await flowRows(MOD.replace("    if(m && (m[1] + '-') !== want){", "    if(false){"));
  chk(broke.some(([ok]) => !ok), '깨 보기: 빈 방 접두어 옮기기를 빼면 입장 흐름이 빨강');
  const broke2 = await flowRows(MOD.replace("srOpen = _secretOpenFields(true, pk ? (pk.exists ? pk.count : 0) : null);", "srOpen = undefined;"));
  chk(broke2.some(([ok]) => !ok), '깨 보기: 시크릿룸 «주인이 연다» 를 빼면 입장 흐름이 빨강');
})();
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/room/room-entry.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const roomEntryMod = TwRoomEntry.createRoomEntry({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwRoomEntry = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const roomEntryMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('roomEntryMod.' + x)); if(n){ ls[i] = ls[i].replace('roomEntryMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createRoomEntry(deps){', 'function createRoomEntry(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
globalThis.__rsCheck.then(() => {   // 위 입장 흐름 절은 비동기 — 끝난 뒤 센다
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
});
