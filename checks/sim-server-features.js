/* sim-server-features.js — 서버가 아직 안 받는 0.14 기능 표(shared/server-features.js)와 입구 닫기
   실행:  node checks/run.js sim-server-features
   ★ 왜 이 검사가 있는가 — 0.14 의 몇 기능은 Firebase DB · Functions 에 직접 읽고 쓰게 만들어졌고, 0.13 은 Firebase DB 쓰기를 잠갔다.
     서버가 받을 때까지 입구만 닫아 두는데, 입구가 하나라도 열려 있으면 버튼을 눌렀을 때 조용히 실패하거나 오류 번호가 뜬다.
   ・1절: 표 — 이름 일곱 · 서버가 받은 것(ON)만 true · 모르는 이름은 던진다 · 바꿀 수 없다
   ・2절: 입구 — 모듈을 실제로 불러 «꺼져 있으면 닫힌다» 를 본다(플레이리스트 👍 · #공지 · #집중 · 친구 신청 사유 · 내 색)
   ・3절: 배선 — app.js 가 기능마다 표에 묻는다 · html · smoke 가 app.js 보다 먼저 싣는다
   ・4절: mutation test */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.join(__dirname, '../apps/desktop/app/parts', f), path.join(__dirname, '../apps/desktop/app', f), path.join(__dirname, '../checks', f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = {};
for (const f of ['shared/server-features.js', 'app.js', 'desk-companion-prototype.html', 'smoke.js', 'status/playlist-like-ui.js', 'chat/chat-notice.js', 'chat/chat-focus.js', 'myhome/friend-req-btn.js', 'shared/theme-ui.js', 'account/account.js', 'shared/room-focus-days.js']) {
  SRC[f] = read(f);
  if (SRC[f] == null) { say('  ? 원본 못 찾음 — ' + f); process.exit(2); }
}
const NAMES = ['xmas', 'chatNotice', 'chatFocus', 'playlistLike', 'googleChange', 'friendReqMsg', 'themeCustomSave'];
/* 서버가 받은 기능 — 켜 둔다 · googleChange: PUT /v2/me/google(#1101) · friendReqMsg: POST · GET /v2/me/friend-requests 의 message(t-w-server #364) · themeCustomSave: GET · PUT /v2/me/theme-custom(t-w-server #363) */
const ON = ['googleChange', 'friendReqMsg', 'themeCustomSave'];
const loadSF = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwServerFeatures; };

function judgeTable(src) {
  const r = {};
  try {
    const S = loadSF(src);
    r.names = Object.keys(S.FEATURES).sort().join() === NAMES.slice().sort().join();
    r.allOff = NAMES.every(n => S.on(n) === ON.includes(n));
    let threw = false; try { S.on('없는이름'); } catch (_) { threw = true; }
    r.throws = threw;
    r.frozen = Object.isFrozen(S.FEATURES) && Object.isFrozen(S);
  } catch (e) { r.err = String(e && e.message || e); }
  return r;
}

say('── 1. 표');
const T = judgeTable(SRC['shared/server-features.js']);
chk(T.names, '이름 일곱(xmas · chatNotice · chatFocus · playlistLike · googleChange · friendReqMsg · themeCustomSave)');
chk(T.allOff, '서버가 받은 것(' + ON.join(' · ') + ')만 켜짐 · 나머지는 꺼짐');
chk(T.throws, '모르는 이름은 던진다(글자를 잘못 쓰면 조용히 꺼진 채 남지 않게)');
chk(T.frozen, '표와 모듈은 바꿀 수 없다');

say('── 2. 입구 — 모듈을 불러 «꺼져 있으면 닫힌다»');
/* 가짜 DOM — 요소마다 style · classList · textContent 만 */
function fakeDoc() {
  const els = {};
  const mk = (id) => els[id] || (els[id] = { id, style: {}, hidden: false, textContent: '', disabled: false, value: '', dataset: {},
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, toggle(c, on){ (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    addEventListener(){}, removeEventListener(){}, appendChild(){}, append(){}, querySelector(){ return null; }, querySelectorAll(){ return []; }, getBoundingClientRect(){ return { left: 0, right: 0, top: 0, bottom: 0 }; }, closest(){ return null; }, focus(){}, set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html || ''; } });
  return { els, getElementById: mk, createElement: () => mk('_' + Math.random()), addEventListener(){}, removeEventListener(){}, body: mk('body') };
}
/* 👍 플레이리스트 반응 — 꺼져 있으면 읽지 않고 줄을 숨긴다 */
function judgeLike(src, on) {
  const doc = fakeDoc(); let reads = 0;
  const g = { document: doc, window: { innerWidth: 1000 } };
  const lib = { presetKey: (i) => (i >= 0 ? String(i) : null), view: (c, st) => (c && c.ownerId ? { mode: 'count', count: st && st.loaded ? st.count : null } : { mode: 'none' }) };
  const w = {}; new Function('window', 'module', 'document', SRC['status/playlist-like-ui.js'].replace(/^/, ''))(w, undefined, doc);
  const ui = w.TwPlaylistLikeUi.createPlaylistLikeUi({ likeRules: lib, net: () => ({ read: async () => { reads++; return { count: 3, mine: false }; } }), getMyUserId: () => 'u1', notifyError(){}, enabled: () => on });
  ui.render({ ro: true, ownerId: 'u2', setIdx: 0 });
  return { reads, rowShown: doc.els.myPlLikeRow ? doc.els.myPlLikeRow.style.display !== 'none' : false };
}
{
  const off = judgeLike(SRC, false), onv = judgeLike(SRC, true);
  chk(off.reads === 0 && !off.rowShown, '👍 꺼져 있으면 읽지 않고(0번) 반응 줄을 숨긴다');
  chk(onv.reads === 1, '  켜면 읽는다(입구만 닫았다 — 기능 코드는 그대로)');
}
/* #공지 · #집중 — available() 이 꺼져 있으면 false · 구독도 없음 */
function judgeRoomTab(file, globalName, factory, on) {
  const doc = fakeDoc(); let subs = 0;
  const w = {}; new Function('window', 'module', SRC['shared/room-focus-days.js'])(w, undefined);   // #집중 이 읽는 날 키 규칙
  new Function('window', 'module', 'document', SRC[file])(w, undefined, doc);
  const mod = w[globalName][factory]({ document: doc, escHtml: (s) => s, toast(){}, getMyUserId: () => 'u1', roomCode: () => '1234*', roomState: { isSecretCode: () => true, isSecretRoom: () => true },
    notifyError(){}, enabled: () => on, sync: { add(){} }, todayKey: () => 'd1',
    provider: { subscribe: () => { subs++; return () => {}; }, add: async () => ({ ok: true }), edit: async () => ({ ok: true }), remove: async () => ({ ok: true }), pin: async () => ({ ok: true }), compact: async () => ({ ok: true }), removeMine: async () => ({ ok: true }) } });
  try { mod.start(); } catch (_) {}
  return { available: mod.available(), subs };
}
for (const [file, g, f, label] of [['chat/chat-notice.js', 'TwChatNotice', 'createChatNotice', '#공지'], ['chat/chat-focus.js', 'TwChatFocus', 'createChatFocus', '#집중']]) {
  let off = null, onv = null;
  try { off = judgeRoomTab(file, g, f, false); onv = judgeRoomTab(file, g, f, true); } catch (e) { say('    (불러오기 실패: ' + (e && e.message) + ')'); }
  chk(!!off && off.available === false && off.subs === 0, label + ' 꺼져 있으면 탭이 없고(available false) 구독하지 않는다');
  chk(!!onv && onv.available === true, '  켜면 시크릿룸에서 쓸 수 있다');
}
/* 친구 신청 — 사유 칸은 reasonOn 이 켜졌을 때만, 꺼져 있으면 빈 사유로 보낸다 */
{
  const fr = SRC['myhome/friend-req-btn.js'];
  chk(/const withReason = reasonOn\(\);/.test(fr) && /if\(withReason\) body\.append\(lead, ta, cnt\); else body\.append\(lead\);/.test(fr) && /sendFriendReq\(uid, name, withReason \? cleanReason\(ta\.value\) : ''\)/.test(fr),
    '[친구 신청] 사유 칸 — 꺼져 있으면 칸 없이 묻고 빈 사유로 보낸다');
}
/* 👑 내 색 — 서버 길이 없으면 이 PC 에만(서버 쓰기 · 읽기 · 실패 알림 없음) */
{
  const th = SRC['shared/theme-ui.js'];
  chk(/if\(!uid \|\| !serverOn\(\)\) return;[^\n]*\n  const r = await saveCustom\(uid, saved\);/.test(th) && /async function pullCustom\(\)\{\n  const uid = getMyUserId\(\);\n  if\(!uid \|\| !serverOn\(\)\) return;/.test(th),
    '👑 내 색 — 꺼져 있으면 저장 · 받기 전에 돌아간다(이 PC 저장은 그 앞에서 이미 했다)');
}
/* 구글 [바꾸기] — 꺼져 있으면 단추를 숨기고 누를 수도 없다 */
chk(/const gcOn = TwServerFeatures\.on\('googleChange'\);\n  show\('acctMGoogleChange', gcOn, 'inline-block'\);/.test(SRC['account/account.js']), '구글 [바꾸기] — 꺼져 있으면 단추를 숨긴다');

say('── 3. 배선');
{
  const A = SRC['app.js'];
  chk(/if\(TwServerFeatures\.on\('xmas'\)\) TwXmasWindow\.createXmasWindow\(/.test(A), '🎄 크리스마스 창은 표가 켜졌을 때만 만든다(런처 버튼은 html 에서 hidden 으로 시작)');
  const H = SRC['desk-companion-prototype.html'];
  chk(/<button[^>]*id="lcXmas" hidden>/.test(H), '  런처 [🎄 크리스마스] 버튼은 hidden 으로 시작');
  for (const n of ['chatNotice', 'chatFocus', 'playlistLike', 'friendReqMsg', 'themeCustomSave'])
    chk(A.includes("TwServerFeatures.on('" + n + "')"), "app.js 가 '" + n + "' 를 표에 묻는다");
  chk(/isSecretRoom: \(\)=>TwServerFeatures\.on\('chatFocus'\) && /.test(A), '  #집중 올리기(room-focus-sync)도 같은 이름으로 닫는다');
  const a = H.indexOf('<script src="parts/shared/server-features.js"></script>'), b = H.indexOf('<script src="parts/app.js"></script>');
  chk(a > 0 && b > a, 'html 이 server-features.js 를 app.js 보다 먼저 싣는다');
  chk(/PRELOAD\.push\('server-features\.js'\);/.test(SRC['smoke.js']), 'smoke 가 server-features.js 를 미리 싣는다');
  chk(!/serverNow: \(\)=>firebaseAPI\.serverNow\(\)/.test(A) && !/whenNetReady\([^)]*'loadThemeCustom'\)/.test(A), '0.13 firebaseAPI 에 없는 이름(serverNow · loadThemeCustom)을 기다리지 않는다');
}

say('── 4. mutation test');
{
  const src = SRC['shared/server-features.js'];
  const muts = [
    ['하나를 켬', src.replace('xmas: false,', 'xmas: true,'), (r) => !r.allOff],
    ['받은 기능을 끔', src.replace('googleChange: true,', 'googleChange: false,'), (r) => !r.allOff],
    ['서버가 받은 것을 끔', src.replace('friendReqMsg: true,', 'friendReqMsg: false,'), (r) => !r.allOff],
    ['내 색 저장을 끔', src.replace('themeCustomSave: true,', 'themeCustomSave: false,'), (r) => !r.allOff],
    ['모르는 이름을 던지지 않음', src.replace("throw new Error('[server-features] 모르는 기능 이름 — ' + name);", 'return false;'), (r) => !r.throws],
    ['표를 얼리지 않음', src.replace('const FEATURES = Object.freeze({', 'const FEATURES = ({'), (r) => !r.frozen],
    ['이름 하나 뺌', src.replace(/  themeCustomSave: true,[^\n]*\n/, ''), (r) => !r.names],
  ];
  for (const [label, m, red] of muts) chk(m !== src && red(judgeTable(m)), 'mutation test: ' + label + ' → 빨강');
  const like = SRC['status/playlist-like-ui.js'];
  const likeM = like.replace('    if(!enabled()) c = null;', '');
  const saved = SRC['status/playlist-like-ui.js']; SRC['status/playlist-like-ui.js'] = likeM;
  const r = judgeLike(SRC, false); SRC['status/playlist-like-ui.js'] = saved;
  chk(likeM !== like && r.reads > 0, 'mutation test: 👍 입구 닫기를 빼면 꺼져 있어도 읽는다 → 빨강');
  const nt = SRC['chat/chat-notice.js'], ntM = nt.replace('!!(enabled() && isSecretRoom() && roomCode())', '!!(isSecretRoom() && roomCode())');
  SRC['chat/chat-notice.js'] = ntM; let r2 = null; try { r2 = judgeRoomTab('chat/chat-notice.js', 'TwChatNotice', 'createChatNotice', false); } catch (_) {} SRC['chat/chat-notice.js'] = nt;
  chk(ntM !== nt && !!r2 && r2.available === true, 'mutation test: #공지 입구 닫기를 빼면 꺼져 있어도 탭이 생긴다 → 빨강');
}

say('── 5. 서버 길이 없는 provider 자리(noServer)');
(async () => {
  const judgeNo = async (src) => {
    const r = {};
    try {
      const S = loadSF(src);
      const p = S.noServer('xmas');
      let e1 = null; try { await p.where(); } catch (e) { e1 = e; }
      let e2 = null; try { await p.subscribe(1, 2); } catch (e) { e2 = e; }
      r.rejects = !!e1 && e1.code === S.MISSING_CODE && !!e2 && e2.code === S.MISSING_CODE;
      r.notThenable = p.then === undefined;   // await p 자체가 거절로 바뀌지 않게
      let threw = false; try { S.noServer('없는이름'); } catch (_) { threw = true; }
      r.throws = threw;
    } catch (e) { r.err = String(e && e.message || e); }
    return r;
  };
  const src = SRC['shared/server-features.js'];
  const N = await judgeNo(src);
  chk(N.rejects, '어떤 메서드를 불러도 SERVER_PATH_MISSING 으로 거절한다(옛 Firebase 통로를 부르지 않는다)');
  chk(N.notThenable, '  provider 자체는 Promise 처럼 보이지 않는다(await 로 넘겨도 그대로)');
  chk(N.throws, '  모르는 이름은 던진다');
  const m1 = src.replace("Promise.reject(Object.assign(new Error('[server-features] 서버 경로 없음 — ' + name + '.' + String(k)), { code: MISSING_CODE }))", 'Promise.resolve(null)');
  chk(m1 !== src && !(await judgeNo(m1)).rejects, 'mutation test: 거절 대신 null 로 풀면 → 빨강');
  const m2 = src.replace("(k === 'then' ? undefined : ", "(false ? undefined : ");
  chk(m2 !== src && !(await judgeNo(m2)).notThenable, 'mutation test: then 을 막지 않으면 → 빨강');
  const A = SRC['app.js'] || '';
  chk(!/firebaseAPI\.(xmas|chatNotice|roomFocus|playlistLike|loadThemeCustom|saveThemeCustom)\b/.test(A), 'app.js 는 꺼진 기능의 옛 Firebase 통로를 부르지 않는다(noServer 자리)');
  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
