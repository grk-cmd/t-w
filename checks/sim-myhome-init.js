/* ═══ 🏠 sim-myhome-init.js — 🏠 마이홈 1단계 모듈 구조 (2026-10-14 신설 · 앱 FSD 44번 남은 몫) ═══════════════
   app.js 의 마이홈 처음 준비 구역 본문 을 parts/myhome/myhome-init.js 로 옮겼다(글자 그대로 · 바뀐 줄 24 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(마이홈 처음 준비 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(initMyHome)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 그대로 · 부르는 곳은 mhInitMod.이름 · html(app.js 앞)
   ・2-2절: 내 코드 없음 — initMyHome 이 내 경로를 하나도 안 부르고 우편만 멈춘다(공지는 notice-feed 가 따로)
   ・2-3절: 받은 뒤 화면 — 우편 · 소식이 바뀌면 목록 · 🔔 다시 그리고 새로 온 것만 토스트(우편은 종류 이름 · 소식은 업데이트/우편/공지 표시) · 🐞 답변이면 배지(해금 안내 우편은 서버 알림이라 앱이 따라잡지 않는다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · myhome-init.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["myhome-init.js","parts/myhome/myhome-init.js","app/parts/myhome/myhome-init.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — myhome-init.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_waitForFirebaseAPI","getMyUserId","toast"];
const VAL_DEPS = ["MY_FRIEND_CODE_KEY","friendManage","friendsSub","mailFeed","mhScheduler","noticeFeed","presenceLock"];
const GET_DEPS = ["friendRequests","_myFriendRequests","_myHomeFriends","_myHomeReady","focusLevelMod","inboxMod","myHomeOpen"];
const SET_DEPS = ["_myFriendRequests","_myHomeFriends","_myHomeReady"];
const EXPORTS = ["initMyHome","onMailChanged","onNewsChanged"];
const MOVED = ["initMyHome","_myInbox","_myInboxReady","_inboxBroadcast"];   // 옮긴 꼭대기 선언 + 서버 원본이 되어 걷은 let 셋          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  MY_FRIEND_CODE_KEY: MY_FRIEND_CODE_KEY,","  _myFriendRequests: ()=>_myFriendRequests,","  _myHomeFriends: ()=>_myHomeFriends,","  _myHomeReady: ()=>_myHomeReady,","  _waitForFirebaseAPI: (...a)=>_waitForFirebaseAPI(...a),","  focusLevelMod: ()=>focusLevelMod,","  friendManage: friendManage,","  friendRequests: ()=>friendRequestsPortMod,","  friendsSub: friendsSubMod,","  getMyUserId: (...a)=>getMyUserId(...a),","  inboxMod: ()=>inboxMod,","  mailFeed: mailFeed,","  mhScheduler: mhScheduler,","  myHomeOpen: ()=>myHomeOpen,","  noticeFeed: noticeFeed,","  presenceLock: presenceLockMod,","  toast: (...a)=>toast(...a),","  setMyFriendRequests: (v)=>{ _myFriendRequests = v; },","  setMyHomeFriends: (v)=>{ _myHomeFriends = v; },","  setMyHomeReady: (v)=>{ _myHomeReady = v; },"];

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
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwMyHomeInit;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createMyHomeInit(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwMyHomeInit = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwMyHomeInit(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("MH_INIT_MOD_OFF") && app.includes("const mhInitMod = TwMyHomeInit.createMyHomeInit({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const mhInitMod = TwMyHomeInit\\.createMyHomeInit\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const mhInitMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 mhInitMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/myhome/myhome-init.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/myhome/myhome-init.js 를 app.js 보다 먼저 싣는다');
  return r;
}

/* 내 코드(getMyUserId)가 없는 기기 — initMyHome 이 부르는 firebaseAPI 이름들(콜백은 안 부른다) */
async function callsWith(src, uid){
  const any = anything(), calls = [];
  const fa = new Proxy({}, { get: (t, k) => (...a) => { calls.push(String(k)); return any; } });
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  let done; const fin = new Promise(r => { done = r; });
  deps.getMyUserId = () => uid;
  deps.presenceLock = { startOnlineFor: (id, me) => { calls.push('presence.me=' + (me && me.tag)); return true; } };
  deps.friendsSub = new Proxy({}, { get: (t, k) => (...a) => { calls.push('friendsSub.' + String(k) + '(' + (a.length ? String(a[0]) : '') + ')'); return any; } });
  deps.mailFeed = new Proxy({}, { get: (t, k) => (...a) => { calls.push('mailFeed.' + String(k) + '(' + (a.length ? String(a[0]) : '') + ')'); return any; } });
  deps._waitForFirebaseAPI = (cb) => { Promise.resolve(cb()).then(done, done); };
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const api = new Function('window', 'document', 'localStorage', 'firebaseAPI', 'module', src + '\nreturn window.TwMyHomeInit;')(win, any, ls, fa, undefined);
  const session = { alive: () => true, on: (u) => u, setInterval(){}, onReset(){} };
  api.createMyHomeInit(deps).initMyHome(uid, { tag: 'ME-ANSWER' }, session);   // app-boot 가 서버가 확인한 코드 · 그 확인의 me 를 넘긴다
  await Promise.race([fin, new Promise(r => setTimeout(r, 200))]);
  return calls;
}
const judgeNoUid = async (src) => {
  const none = await callsWith(src, null), mine = await callsWith(src, 'ME');
  return none.join() === 'friendsSub.start(null),mailFeed.stop()' && mine.filter(c => !c.startsWith('friendsSub.')).slice(0, 1).join() === 'presence.me=ME-ANSWER' && !mine.includes('createMyPresence');   // 접속 고정은 app-boot 가 넘긴 확인의 me 로 앉힌다 · Firebase 접속 표시는 만들지 않는다   // 친구 목록은 «코드 없음» 으로 시작해 둬야 친구 탭이 «불러오는 중» 에 안 멈춘다
};

(async () => {
const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 내 코드 없음 — 내 경로 요청 0');
chk(await judgeNoUid(MOD), '내 코드 없음 → presence · 기기 · 프로필 · 친구 · 요청 · 우편 요청 0 · 친구 목록은 «코드 없음» 으로 시작(요청 없음) · 우편은 멈춤(앞 계정 것 비움) · 공지는 코드와 상관없이 따로 받는다 · 코드 있으면 presence 부터');
{
  const mine = await callsWith(MOD, 'ME');
  chk(!mine.some(c => /Profile/.test(c)) && !/setMyProfile/.test(MOD), '★ 내 이름을 Firebase 프로필 노드에 쓰지 않는다(이름의 원본은 PATCH /v2/me — user-name.js) · 마이홈 첫 준비는 이 쓰기를 기다리지 않는다');
}
say('── 2-3. 받은 뒤 화면');
{
  const act = [], toasts = [];
  const feedState = { status: 'ready', items: { m1: { tag: 'reward', title: '라이선스' }, b1: { tag: 'bug', title: '답변' } }, bc: { n1: { tag: 'update', title: '새 판' }, n2: { tag: 'reward', title: '보상' }, n3: { tag: 'notice', title: '점검' } } };
  const rec = (name) => (...a) => { act.push(name); };
  const any2 = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any2; });
  VAL_DEPS.forEach(n => { deps[n] = any2; });
  GET_DEPS.forEach(n => { deps[n] = () => any2; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  deps.toast = (m) => toasts.push(m);
  deps.mailFeed = { status: () => feedState.status, items: () => feedState.items };
  deps.noticeFeed = { broadcasts: () => feedState.bc };
  deps.inboxMod = () => ({ renderInbox: rec('render'), inboxTagLabel: (t) => '라벨:' + t });
  deps.mhScheduler = { refreshBellBadge: rec('bell'), isBellOpen: () => true, renderBellList: rec('bellList') };
  deps.focusLevelMod = () => ({ _notifyDanceUnlocks: rec('dance'), getFocusLevel: () => 7 });   // 불리면 안 되는 옛 이름 — 불리면 'dance' 가 찍힌다
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any2, set: (t, k, v) => { t[k] = v; return true; } });
  win._bugBoardRefreshBadge = rec('bugBadge');
  const api = new Function('window', 'document', 'localStorage', 'firebaseAPI', 'module', MOD + '\nreturn window.TwMyHomeInit;')(win, any2, { getItem: () => null }, any2, undefined);
  const m = api.createMyHomeInit(deps);
  m.onMailChanged({ addedIds: ['m1', 'b1', 'gone'] });
  chk(act.join() === 'render,bell,bellList,bugBadge' && toasts.join('|') === '📩 라벨:reward: 라이선스|📩 라벨:bug: 답변', '우편 — 해금 안내는 앱이 안 보낸다(서버 알림) · 목록 · 🔔 다시 그림 · 새로 온 것만 토스트(없어진 id 는 건너뜀) · 🐞 답변이면 배지');
  act.length = 0; toasts.length = 0; feedState.status = 'error';
  m.onMailChanged({ addedIds: [] });
  chk(act.join() === 'render,bell,bellList' && toasts.length === 0, '못 받음(error)일 때도 같다 · 새 우편이 없으면 토스트 없음');
  act.length = 0;
  m.onNewsChanged({ addedIds: ['n1', 'n2', 'n3'] });
  chk(act.join() === 'render,bell,bellList' && toasts.join('|') === '📩 🆕 업데이트: 새 판|📩 📩 우편: 보상|📩 📢 공지: 점검', '소식 — 목록 · 🔔 다시 그림 · 새 소식만 토스트(업데이트 · 우편 · 공지 표시)');
}
say('── 2-4. 세션 — 받은 친구 요청 구독의 해제 함수 · 우편 구독은 세션이 쥔다(S-2)');
/* 받은 요청 듣기가 돌려준 해제 함수 · 우편 시작에 넘긴 세션을 가짜 세션으로 모은다 — await 가 풀리는 가짜 deps 로 끝까지 돌린다 */
async function sessionRun(src, endFirst, ended, room){
  const log = { unsubCalled: 0, mailSession: null, watch: 0, presence: [] };
  const UNSUB = () => { log.unsubCalled++; };
  const session = { subs: [], timers: [], resets: [], alive: () => !ended, on(u){ this.subs.push(u); if(endFirst){ u(); } return u; },
    setInterval(fn, ms){ this.timers.push([fn, ms]); }, onReset(fn){ this.resets.push(fn); } };
  const deps = { MY_FRIEND_CODE_KEY: 'k', friendManage: { renderFriendRequests(){}, reqVisible: () => false, showFriendRequestPopup(){} }, friendsSub: { start(){}, stop(){} },
    mailFeed: { start: (id, sess) => { log.mailSession = sess; }, stop(){} }, noticeFeed: {}, mhScheduler: { loadBoard(){} }, presenceLock: { startOnlineFor: () => { log.presence.push('start'); return true; } },
    _waitForFirebaseAPI: (cb) => Promise.resolve(cb()), getMyUserId: () => 'ME', toast(){},
    friendRequests: () => ({ watchReceived: () => { log.watch++; return UNSUB; } }), _myFriendRequests: () => ({}), _myHomeFriends: () => ({}), _myHomeReady: () => false,
    focusLevelMod: () => ({}), inboxMod: () => ({}), myHomeOpen: () => false, setMyFriendRequests(){}, setMyHomeFriends(){}, setMyHomeReady(){} };
  const fa = { createMyPresence(){ log.presence.push('create'); } };   // 불리면 안 된다
  const doc = { getElementById: () => null };
  const ls = { getItem: () => null };
  const api = new Function('window', 'document', 'localStorage', 'firebaseAPI', 'module', src + '\nreturn window.TwMyHomeInit;')({}, doc, ls, fa, undefined);
  await api.createMyHomeInit(deps).initMyHome('ME', { tag: 'x' }, session);
  return { log, session };
}
{
  const r = await sessionRun(MOD, false);
  chk(r.log.watch === 1 && r.session.subs.length === 1 && r.log.mailSession === r.session, '★ 받은 요청 듣기의 해제 함수는 세션이 쥔다(버리지 않는다) · 우편 시작에 세션을 넘긴다');
  const r2 = await sessionRun(MOD, true);
  chk(r2.log.unsubCalled === 1, '  이미 끝난 세션에 걸면 바로 푼다 — 늦게 걸린 구독이 새 계정으로 새지 않는다');
  /* 접속 표시는 realtime 이 맡는다 — 온라인 고정만 앉히고 첫 표시를 켠다(Firebase 접속 표시 · 6시간 타이머 · 세션에 걸기 없음) */
  chk(r.log.presence.join() === 'start' && r.session.timers.length === 0 && r.session.resets.length === 0 && r.session.presence === undefined, '★ 접속 표시 — 온라인 고정을 앉혀 켤 뿐 Firebase 접속 표시 · 6시간 타이머 · 세션 걸기가 없다');
  const dead = await sessionRun(MOD, false, true);
  chk(dead.log.presence.length === 0 && dead.session.timers.length === 0 && dead.log.watch === 0, '  기다리는 사이 끝난 세션이면 아무것도 만들지 않는다(풀어 줄 세션이 없다)');
}
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
{
  const m2 = MOD.replace(/\n *if\(!myId\)\{ friendsSub\.start\(null\); mailFeed\.stop\(\); return; \}[^\n]*/, '');
  const m3 = MOD.replace('if(!myId){ friendsSub.start(null); ', 'if(!myId){ ');
  chk(m3 !== MOD && !(await judgeNoUid(m3)), '친구 목록 시작을 빼면(#320 되돌림 — 친구 탭이 «불러오는 중» 에 멈춤) 빨강');
  chk(m2 !== MOD && !(await judgeNoUid(m2)), '입구 가드를 지우면 — 내 코드 없음 판정이 빨강');
  const m4 = MOD.replace('session.on(friendRequests().watchReceived(', 'friendRequests().watchReceived(').replace(')));   // 해제 함수는 세션이', '));   // 해제 함수는 세션이');
  const r4 = m4 === MOD ? null : await sessionRun(m4, false);
  chk(r4 && r4.session.subs.length === 0, '받은 요청 해제 함수를 세션에 안 맡기면 빨강(2-4절)');
  const m7 = MOD.replace('    if(!session.alive()) return;', '');
  const r7 = m7 === MOD ? null : await sessionRun(m7, false, true);
  chk(r7 && r7.log.presence.length > 0, '끝난 세션 확인을 빼면(풀어 줄 세션 없이 만듦) 빨강');
}
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/myhome/myhome-init.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const mhInitMod = TwMyHomeInit.createMyHomeInit({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const mhInitMod = TwMyHomeInit.createMyHomeInit({", "const mhInitMod = TwMyHomeInit.createMyHomeInit({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwMyHomeInit = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const mhInitMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('mhInitMod.' + x)); if(n){ ls[i] = ls[i].replace('mhInitMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createMyHomeInit(deps){', 'function createMyHomeInit(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
