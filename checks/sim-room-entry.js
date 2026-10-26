/* ═══ 🛰 sim-room-entry.js — 🛰 방 서버 provider · 🔢 방 개수 · 방 만들기 · 랜덤 참여 · 🚪 방 입장 · 나가기 · 승계 · 해산 모듈 구조 (2026-10-14 신설 · 앱 FSD 33번) ═══════════════
   app.js 의 방 서버 · 입장 · 방 개수 세 구역 본문 을 parts/room/room-entry.js 로 옮겼다(글자 그대로 · 바뀐 줄 13 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(방 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(CHANNEL_NAMES · NET_READY_WAIT_MS · ROOM_PREFIX · _mockRoomAllowed · _srFmtDate · _updateRoomCountUI · _waitFirebaseApi · doLeaveRoom · makeMockProvider · refreshInviteUI · startRoom · startRoomCountWatch · syncFriendSeats)
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

const FN_DEPS = ["_chatNotifyIncoming","_clearHiddenSeats","_onDeviceSessionLost","_pokeFresh","_refreshChatMembers","applyCharToSeat","applyEquippedPartsToSeat","createSeat","deserializeDefFromNetwork","getDisplayName","getMyUserId","layoutSeats","maxPeople","myExpCells","pruneSeatPartsAgainstDef","refitSeatAfterParts","removeSeatLabels","renderSeatTabs","retryDefAfter","serializeDefForNetwork","showChatBubble","spawnFloater","toast","triggerPet","uiIconEl","updateMyStatusChipPosition","_rcStore"];
const VAL_DEPS = ["FLOATER_BURST","Presence","chatUiMod","rideBenchMod","scene","seats","settingsMod","slots","tricksMod","twNav"];
const GET_DEPS = ["EXP_CELLS","awayPicMod","curSlot","focusLevelMod","isAdmin","isPremium","officeMode"];
const SET_DEPS = [];
const EXPORTS = ["CHANNEL_NAMES","NET_READY_WAIT_MS","ROOM_PREFIX","_mockRoomAllowed","_srFmtDate","_updateRoomCountUI","_waitFirebaseApi","doLeaveRoom","makeMockProvider","refreshInviteUI","startRoom","startRoomCountWatch","syncFriendSeats"];
const MOVED = ["_roomServerNet","_roomServerOn","_onServerRoomMeta","makeServerProvider","ROOM_SERVER_LOST_MSG","ROOM_SERVER_BUSY_MSG","_roomServerJoinMessage","ROOM_SERVER_CONNECTING_TOAST_MS","_myRoomLicensed","_startRoomOnServer","_srvRoomStats","_srvRoomStatsAt","_addServerRoomCounts","_withServerRoomCounts","_serverRandomRooms","NET_READY_WAIT_MS","_mockRoomAllowed","_waitFirebaseApi","makeMockProvider","mockFriendDef","_charIdentityFingerprint","_deskStateFingerprint","_applyRemoteBenchSeats","_applyRemoteRides","syncFriendSeats","ROOM_PREFIX","ROOM_CODE_RE","_roomPrefixFor","_myRoomPrefix","genRoomCode","presenceChanged","_srFmtDate","_mySecretRoomCode","_refreshSecretRoomUI","refreshInviteUI","_verLt","_ensureRoomVersionOk","startRoom","_bindDonate","CHANNEL_NAMES","roomLimitOf","_channelFullMsg","_paintRoomLimits","_paintMaxPeople","_liveRoomCount","_updateRoomCountUI","_roomCountTimer","refreshRoomCountOnce","_roomCountUnsub","_paintRoomCounts","startRoomCountWatch","doCreateRoomInChannel","RANDOM_JOIN_TRIES","doJoinRandomRoom","_hoppingRoom","_setHopBusy","doHopRandomRoom","_refreshChannelPickUI","_joiningRoom","_resolveRoomCode","doJoinRoom","doJoinSecretRoom","doLeaveRoom","doCopyRoomCode","fsInviteCreate","fsInviteJoinBtn","fsInviteLeaveBtn","fsInviteRoomCopyBtn","_setupRoomCodeInput","_setupSecretCodeInput"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  EXP_CELLS: ()=>expBarMod.EXP_CELLS,","  FLOATER_BURST: floatersMod.FLOATER_BURST,","  Presence: Presence,","  _chatNotifyIncoming: (...a)=>chatPrefsMod._chatNotifyIncoming(...a),","  _clearHiddenSeats: (...a)=>hiddenSeatsMod._clearHiddenSeats(...a),","  _onDeviceSessionLost: (...a)=>deviceLostMod._onDeviceSessionLost(...a),","  _pokeFresh: (...a)=>roomSyncMod._pokeFresh(...a),","  _refreshChatMembers: (...a)=>chatPrefsMod._refreshChatMembers(...a),","  applyCharToSeat: (...a)=>applyCharToSeat(...a),","  applyEquippedPartsToSeat: (...a)=>applyEquippedPartsToSeat(...a),","  awayPicMod: ()=>awayPicMod,","  chatUiMod: chatUiMod,","  createSeat: (...a)=>createSeat(...a),","  curSlot: ()=>curSlot,","  deserializeDefFromNetwork: (...a)=>roomSyncMod.deserializeDefFromNetwork(...a),","  focusLevelMod: ()=>focusLevelMod,","  getDisplayName: (...a)=>getDisplayName(...a),","  getMyUserId: (...a)=>getMyUserId(...a),","  isAdmin: ()=>isAdmin,","  isPremium: ()=>isPremium,","  layoutSeats: (...a)=>layoutSeats(...a),","  maxPeople: (...a)=>maxPeople(...a),","  myExpCells: (...a)=>expBarMod.myExpCells(...a),","  officeMode: ()=>officeMode,","  pruneSeatPartsAgainstDef: (...a)=>pruneSeatPartsAgainstDef(...a),","  refitSeatAfterParts: (...a)=>seatRefitMod.refitSeatAfterParts(...a),","  removeSeatLabels: (...a)=>overheadMod.removeSeatLabels(...a),","  renderSeatTabs: (...a)=>seatPanelMod.renderSeatTabs(...a),","  retryDefAfter: (...a)=>roomSyncMod.retryDefAfter(...a),","  rideBenchMod: rideBenchMod,","  scene: scene,","  seats: seats,","  serializeDefForNetwork: (...a)=>roomSyncMod.serializeDefForNetwork(...a),","  settingsMod: settingsMod,","  showChatBubble: (...a)=>showChatBubble(...a),","  slots: slots,","  spawnFloater: (...a)=>floatersMod.spawnFloater(...a),","  toast: (...a)=>toast(...a),","  tricksMod: tricksMod,","  triggerPet: (...a)=>triggerPet(...a),","  uiIconEl: (...a)=>statusChipMod.uiIconEl(...a),","  updateMyStatusChipPosition: (...a)=>statusChipMod.updateMyStatusChipPosition(...a),","  _rcStore: (...a)=>acctStateMod._rcStore(...a),","  twNav: twNav,"];

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

/* 내 코드(getMyUserId)가 없는 기기 — 방 만들기 창(refreshInviteUI)이 부르는 firebaseAPI 이름들 */
function callsWith(src, uid){
  const any = anything(), calls = [];
  const fa = new Proxy({}, { get: (t, k) => new Proxy(function(){}, { apply: () => { calls.push(String(k)); return any; }, get: () => any }) });   // chatHistory.bindChannel 같은 칸도 받는다
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  deps.getMyUserId = () => uid;
  const win = new Proxy({ firebaseAPI: fa }, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    NET_PRE + src + '\nreturn window.TwRoomEntry;')(win, any, ls, any, fa, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  try{ api.createRoomEntry(deps).refreshInviteUI(); }catch(_){}
  return calls;
}
const judgeNoUid = (src) => !callsWith(src, null).includes('getMySecretRoom') && callsWith(src, 'ME').includes('getMySecretRoom');

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 내 코드 없음 — 그 요청 0');
chk(judgeNoUid(MOD), '내 코드 없음 → 방 만들기 창 시크릿룸 읽기(getMySecretRoom) 0 · 코드 있으면 읽는다');
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
{
  const m2 = MOD.replace(/\n *if\(!getMyUserId\(\)\) return;   \/\/ 내 코드가 없으면 시크릿룸[^\n]*/, '');
  chk(m2 !== MOD && !judgeNoUid(m2), '내 코드 확인을 빼면 — 내 코드 없음 판정이 빨강');
}
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
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
