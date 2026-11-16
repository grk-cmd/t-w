/* sim-presence-lock.js — 🔒 친구 탭 온라인 고정(myhome/presence-lock.js) · realtime 첫 표시 · 규칙(presencePref)
   ・1절: normalize · startOnline — 고정했을 때만 고른 값 · 틀린 모양은 «고정 없음 · 온라인»
   ・2절: 모듈을 가짜 DOM 으로 실제로 돌린다 — 켤 때 계정 확인의 me 에서 고정값 · 받기 전 누름은 덮지 않음 ·
          고정 중 토글만 저장 · 🔒 누르면 지금 값으로 저장 · 로그인 없음 · 저장 실패는 E-MH-13
   ・4절: 배선 — Firebase 접속 표시 없음 · html 버튼 · 싣는 순서 · app.js · myhome-init · myhome-ui 옛 토글 걷음 · 규칙 · 오류 번호 · smoke
   ・5절: 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = fs.existsSync(path.join(__dirname, 'apps')) ? __dirname : path.join(__dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const find = (rel) => fs.existsSync(P(rel)) ? P(rel) : path.join(__dirname, path.basename(rel));
const A = 'apps/desktop/app/';
const need = [A + 'parts/myhome/presence-lock.js', A + 'parts/firebase-init.js', A + 'desk-companion-prototype.html', A + 'parts/app.js',
  A + 'parts/myhome/myhome-init.js', A + 'parts/myhome/myhome-ui.js', A + 'parts/account/account.js', A + 'parts/shared/error-codes.js', 'firebase/firebase-database-rules.json', 'checks/smoke.js'];
const SRC = {};
for(const r of need){ const f = find(r); if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); } SRC[r] = fs.readFileSync(f, 'utf8'); }
const MOD = SRC[A + 'parts/myhome/presence-lock.js'], FBI = SRC[A + 'parts/firebase-init.js'];

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if(ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };
const tick = async (n = 6) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
/* 깨 보기가 영원히 안 풀리는 Promise 를 만들 수 있다 — 기다림에 상한을 둔다(안 풀리면 STUCK) */
const STUCK = { stuck: true };
const settle = (p) => Promise.race([p, tick(20).then(() => STUCK)]);
let done = false;
/* 중간에 멈춘 실행(남은 일이 없어 node 가 그냥 끝남)은 빨강 */
process.on('exit', (c) => { if(!done && c === 0){ console.log('  ✗ 검사가 끝까지 돌지 않았다(멈춤)'); process.exitCode = 1; } });

function el(){
  const h = {}; const cls = new Set(); const attr = {};
  return { innerHTML: '', textContent: '', title: '', h, attr,
    classList: { toggle: (c, on) => { if(on) cls.add(c); else cls.delete(c); }, contains: (c) => cls.has(c) },
    setAttribute: (k, v) => { attr[k] = v; },
    addEventListener: (ev, fn) => { h[ev] = fn; }, click(){ this.h.click(); } };
}
/* 모듈 하나를 가짜 세상에서 만든다 */
function world(src, o){
  const w = Object.assign({ uid: 'u1', saveFail: false }, o || {});
  const tog = el(), lock = el();
  const out = { tog, lock, saves: [], vis: [], toasts: [], errs: [] };
  const doc = { getElementById: (id) => id === 'mhPresenceToggle' ? tog : id === 'mhPresenceLock' ? lock : null };
  const win = {};
  new Function('window', 'document', src)(win, doc);
  out.T = win.TwPresenceLock;
  out.m = out.T.createPresenceLock({
    getMyUserId: () => w.uid,
    toast: (m) => out.toasts.push(m),
    notifyError: (c, e) => out.errs.push(c),
    savePref: async (uid, p) => { out.saves.push([uid, p.lock, p.online]); if(w.saveFail) throw new Error('거절'); },
    startVisible: (on) => out.vis.push('start:' + on),
    setVisible: (on) => out.vis.push('set:' + on),
  });
  return out;
}
const isOff = (w) => /mh-fdot off/.test(w.tog.innerHTML) && /오프라인/.test(w.tog.innerHTML);
const isOn = (w) => /mh-fdot on/.test(w.tog.innerHTML) && /> 온라인/.test(w.tog.innerHTML);

/* 계정 확인(GET /v2/me)의 답 중 접속 고정 칸 */
const meOf = (locked, online) => ({ presencePref: { locked, online } });
async function behave(src){
  const r = {};
  const T = world(src).T;
  r.pure = T.startOnline({ lock: true, online: false }) === false && T.startOnline({ lock: false, online: false }) === true && T.startOnline(null) === true
    && T.startOnline({ lock: true, online: true }) === true && T.startOnline({ lock: 'yes', online: false }) === true
    && JSON.stringify(T.normalize(null)) === '{"lock":false,"online":true}' && JSON.stringify(T.normalize({ lock: true, online: false, x: 1 })) === '{"lock":true,"online":false}'
    && JSON.stringify(T.normalize({ lock: 1, online: 0 })) === '{"lock":false,"online":true}' && !('CACHE_KEY' in T) && !('LOAD_WAIT_MS' in T);

  // 켤 때 — me 의 고정값(오프라인): 기다림 없이 바로(동기)
  let w = world(src);
  let v = w.m.startOnlineFor('u1', meOf(true, false));
  r.bootLocked = v === false && isOff(w) && w.lock.textContent === '🔒' && w.lock.attr['aria-pressed'] === 'true' && w.saves.length === 0 && w.vis.join() === 'start:false';
  // 고정 안 함이면 오프라인이 남아 있어도 온라인
  w = world(src);
  r.bootUnlocked = w.m.startOnlineFor('u1', meOf(false, false)) === true && isOn(w) && w.lock.textContent === '🔓';
  // 비어 있음({}) · me 가 없음 → 온라인
  w = world(src);
  const e1 = w.m.startOnlineFor('u1', { presencePref: {} }) === true && isOn(w);
  const w2 = world(src);
  r.bootEmpty = e1 && w2.m.startOnlineFor('u1', null) === true && isOn(w2);
  // 받기 전에 누름 — 받은 값으로 덮지 않는다
  w = world(src);
  w.tog.click();
  const t1 = w.m.startOnlineFor('u1', meOf(true, true)) === false && isOff(w) && w.vis.join() === 'set:false,start:false' && w.lock.textContent === '🔒';
  await tick();
  const t2 = JSON.stringify(w.saves) === '[["u1",true,false]]';
  // 받기 전 누름 · 고정 안 함 → 🔓 · 저장 없음
  w = world(src);
  w.tog.click(); w.m.startOnlineFor('u1', meOf(false, true)); await tick();
  r.touched = t1 && t2 && w.lock.textContent === '🔓' && w.saves.length === 0 && isOff(w);
  // 받기 전 누름이 받은 고정값과 같으면 다시 쓰지 않는다
  w = world(src);
  w.tog.click(); w.m.startOnlineFor('u1', meOf(true, false)); await tick();
  r.sameLock = w.saves.length === 0 && w.lock.textContent === '🔒';
  // 고정 안 함 · 토글 → 접속 표시만(저장 없음)
  w = world(src); w.m.startOnlineFor('u1', meOf(false, true));
  w.tog.click(); await tick();
  r.toggleUnlocked = w.saves.length === 0 && w.vis.join() === 'start:true,set:false' && isOff(w) && /오프라인으로 보여요/.test(w.toasts[0]);
  // 🔒 → 지금 값(오프라인)으로 저장 · 고정 중 토글 → 저장 · 🔓 → 풀림 저장
  w.lock.click(); await tick();
  const s1 = w.saves[0];
  w.tog.click(); await tick();
  const s2 = w.saves[1];
  w.lock.click(); await tick();
  const s3 = w.saves[2];
  r.lockFlow = JSON.stringify(s1) === '["u1",true,false]' && JSON.stringify(s2) === '["u1",true,true]' && JSON.stringify(s3) === '["u1",false,true]'
    && w.lock.textContent === '🔓' && /«오프라인» 으로 시작/.test(w.toasts[1]) && /고정을 풀었어요/.test(w.toasts[3]);
  // 로그인 없음 · 저장 실패
  w = world(src, { uid: '' }); w.lock.click(); await tick();
  const noUid = w.saves.length === 0 && /로그인/.test(w.toasts[0]) && w.lock.textContent === '🔓';
  w = world(src, { saveFail: true }); w.m.startOnlineFor('u1', meOf(false, true)); w.lock.click(); await tick();
  r.edge = noUid && w.errs.join() === 'E-MH-13' && w.lock.textContent === '🔒'
    && world(src).m.startOnlineFor('', meOf(true, false)) === true;
  // realtime 접속 표시 — 처음 값(고정값을 앉힌 뒤)과 누를 때마다. 로그인 없음이면 보내지 않는다
  w = world(src); w.m.startOnlineFor('u1', meOf(true, false)); w.tog.click(); w.tog.click();
  const vLocked = w.vis.join() === 'start:false,set:true,set:false';
  w = world(src); w.m.startOnlineFor('u1', null);
  const vFresh = w.vis.join() === 'start:true';
  w = world(src); w.m.startOnlineFor('', meOf(true, false));
  r.visible = vLocked && vFresh && w.vis.length === 0;
  return r;
}
function report(r){
  say('── 1. normalize · startOnline');
  chk(r.pure, '고정했을 때만 고른 값으로 시작 · 틀린 모양은 «고정 없음 · 온라인» · 이 PC 사본 키 · 읽기 시한은 없다');
  say('── 2. 모듈을 실제로 돌린다');
  chk(r.bootLocked, '켤 때 — 계정 확인의 me 에 «🔒 오프라인» 이면 오프라인으로 시작 · 🔒 표시 · 저장 · 접속 표시는 고정값을 앉힌 뒤에만');
  chk(r.visible, '★ realtime 접속 표시 — 처음 값은 고정값을 앉힌 뒤(오프라인 고정이면 false 로 시작) · 누를 때마다 · 로그인 없으면 보내지 않는다');
  chk(r.bootUnlocked, '  고정을 안 했으면 마지막이 오프라인이어도 온라인으로 시작(예전과 같다)');
  chk(r.bootEmpty, '  서버 칸이 비어 있거나 me 가 없으면 온라인');
  chk(r.touched, '  고정값을 받기 전에 누르면 누른 값을 지키고 고정 여부는 받은 값 — 고정이면 누른 값이 새 고정값(🔒 · 저장)');
  chk(r.sameLock, '  받기 전 누름이 받은 고정값과 같으면 다시 쓰지 않는다');
  chk(r.toggleUnlocked, '고정 안 함 — 토글은 접속 표시만 바꾸고 저장하지 않는다(예전과 같다)');
  chk(r.lockFlow, '🔒 누르면 지금 값으로 저장 · 고정 중 토글은 저장 · 🔓 누르면 풀림 저장 · 안내 문구');
  chk(r.edge, '로그인 없음 → 안내만 · 저장 실패 → E-MH-13 · uid 없으면 온라인');
}

(async () => {
  const R = await behave(MOD);
  report(R);

  say('── 2-2. 접속 고정은 계정 확인의 me 로 — 지난 사본 · 따로 기다리는 길이 없다');
  {
    const AP = SRC[A + 'parts/app.js'], LF = fs.readFileSync(find(A + 'parts/account/login-flow.js'), 'utf8');
    chk(!/loadPref/.test(AP) && !/firstConfirm/.test(AP) && !/firstConfirm/.test(LF), '★ 접속 고정을 따로 읽거나(loadPref) 첫 확인을 기다리는(firstConfirm) 길이 없다');
    chk(/mhInit: \(code, me, session\)=>\{[^\n]*mhInitMod\.initMyHome\(code, me, session\);/.test(AP), '  app-boot 차례가 마이홈 시작에 코드 · 확인의 me 를 넘긴다');
    const old = AP.replace('return mhInitMod.initMyHome(code, me, session); }', 'return mhInitMod.initMyHome(); }');
    chk(!/mhInit: \(code, me, session\)=>\{[^\n]*mhInitMod\.initMyHome\(code, me, session\);/.test(old), '깨 보기 — me 를 안 넘기는 모양이면 빨강');
  }

  say('── 4. 배선');
  {
    const H = SRC[A + 'desk-companion-prototype.html'], AP = SRC[A + 'parts/app.js'], INIT = SRC[A + 'parts/myhome/myhome-init.js'], UI = SRC[A + 'parts/myhome/myhome-ui.js'];
    chk(/<span class="mh-pres-row"><span id="mhPresenceToggle">[\s\S]*?<\/span><button id="mhPresenceLock" type="button" aria-pressed="false"[^>]*>🔓<\/button><\/span>/.test(H), 'html — 온라인 토글 바로 옆 🔒 버튼(처음엔 🔓)');
    const iL = H.indexOf('<script src="parts/myhome/presence-lock.js"></script>'), iA = H.indexOf('<script src="parts/app.js"></script>');
    chk(iL > 0 && iA > iL, 'html — presence-lock.js 가 app.js 보다 먼저');
    chk((AP.match(/const presenceLockMod = TwPresenceLock\.createPresenceLock\(\{/g) || []).length === 1 && AP.indexOf('const presenceLockMod') < AP.indexOf('const mhInitMod')
      && /savePref: \(uid, p\)=>loginFlowMod\.patchMe\(\{ presencePref: \{ locked: p\.lock, online: p\.online \} \}\)\.then\(\(r\)=>\{ if\(!r\.ok\) throw r\.err; \}\),/.test(AP)
      && /  setVisible: \(v\)=>presenceSelfMod\.setVisible\(v\),\n  startVisible: \(v\)=>presenceSelfMod\.start\(v\),/.test(AP) && AP.indexOf('const presenceSelfMod') < AP.indexOf('const presenceLockMod') && /  presenceLock: presenceLockMod,\n/.test(AP), 'app.js — 마이홈 처음 준비보다 먼저 만들고 deps 로 넘긴다');
    chk(/presenceLock\.startOnlineFor\(myId, me\);/.test(INIT) && !/createMyPresence/.test(INIT), 'myhome-init — 온라인 고정을 계정 확인의 me 로 앉히고 첫 표시를 켠다(Firebase 접속 표시는 만들지 않는다)');
    chk(!/mhPresenceToggle/.test(UI) && !/setMyPresenceState/.test(UI), 'myhome-ui — 옛 토글 연결을 걷었다(두 벌이면 한 번 누름에 두 번 바뀐다)');
    let R = null; try{ R = JSON.parse(SRC['firebase/firebase-database-rules.json']).rules.presencePref.$userId; }catch(_){}
    const own = /^auth != null && root\.child\('userAuth\/'\+\$userId\)\.val\(\) === auth\.uid && /;
    chk(!!R && own.test(R['.read']) && own.test(R['.write']) && !/!root\.child\('userAuth/.test(R['.read'] + R['.write'])
      && /hasChildren\(\['lock','online','ts'\]\)/.test(R['.validate']) && R.$other['.validate'] === false && /isBoolean/.test(R.lock['.validate']) && /isBoolean/.test(R.online['.validate']),
      '규칙 — 로그인한 본인만 읽기 · 쓰기(친구가 «숨긴 오프라인» 을 못 알아보게) · 세 칸 · 다른 칸 거부');
    chk(/'E-MH-13': \{ msg: '[^']+', where: 'myhome\/presence-lock\.js/.test(SRC[A + 'parts/shared/error-codes.js']), '오류 번호 E-MH-13 가 표에 있다');
    chk(SRC['checks/smoke.js'].indexOf("PRELOAD.push('presence-lock.js');") > 0, 'smoke PRELOAD 에 presence-lock.js');
  }

  say('── 4-2. Firebase 접속 표시가 없다 — 앱은 접속 표시를 realtime 으로만 보낸다');
  {
    const AP = SRC[A + 'parts/app.js'], AC = SRC[A + 'parts/account/account.js'];
    const code = (x) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/mg, '');
    chk(!/createMyPresence|_createMyPresence|\.info\/connected/.test(code(FBI)), '★ firebase-init 에 접속 표시 쓰기 · onDisconnect · .info/connected 구독이 없다');
    chk(!/setMyPresenceState|setMyPresenceRoom|myPresence\b|setPresence/.test(code(AP)) && !/_presenceOff|getPresence/.test(code(AC)), '★ app.js · account.js 에 Firebase 접속 표시 객체를 쓰는 길이 없다(토글 · 방 표시 · 로그아웃 «꺼짐»)');
  }

  say('── 5. 깨 보기');
  {
    const br = async (from, to) => MOD.includes(from) ? behave(MOD.replace(from, to)) : null;
    const b1 = await br("function startOnline(p){ return !(p && p.lock === true && p.online === false); }", "function startOnline(p){ return true; }");
    chk(b1 && !b1.bootLocked, '고정값을 무시하고 늘 온라인으로 시작하면 2절이 빨강');
    const b2 = await br("if(uid && pref.lock){ pref = { lock: true, online }; save(uid); }", "if(uid){ pref = { lock: pref.lock, online }; save(uid); }");
    chk(b2 && !b2.toggleUnlocked, '고정 안 했는데 토글마다 저장하면 2절이 빨강');
    const b3 = await br("    if(touched){\n      // 받기 전에 눌렀다", "    if(false){\n      // 받기 전에 눌렀다");
    chk(b3 && !b3.touched, '받기 전 누름을 받은 값으로 덮으면 2절이 빨강');
    const b4 = await br("      pref = { lock: p.lock, online };", "      pref = { lock: false, online };");
    chk(b4 && !b4.touched, '읽기 전 누름 뒤 서버 고정을 잊으면(🔓 로 보이고 다음 실행은 숨은 고정값) 2절이 빨강');
    const b6 = await br("if(p.lock && p.online !== online) save(uid);", "if(p.lock) save(uid);");
    chk(b6 && !b6.sameLock, '같은 고정값을 또 쓰면 2절이 빨강');
    const b8 = await br("    deps.startVisible(online);", "");
    chk(b8 && !b8.visible, '처음 접속 표시를 realtime 에 안 알리면 2절이 빨강');
    const b9 = await br("    deps.setVisible(online);", "");
    chk(b9 && !b9.visible, '토글을 realtime 에 안 알리면 2절이 빨강');
    const b7 = await br("adopt(uid, normalize(pp ? { lock: pp.locked, online: pp.online } : null));", "adopt(uid, normalize(null));");
    chk(b7 && !b7.bootLocked, 'me 의 고정값을 안 읽으면 2절이 빨강');
  }

  say('');
  say('결과 ' + pass + ' · ' + fail);
  done = true;
  process.exit(fail ? 1 : 0);
})();
