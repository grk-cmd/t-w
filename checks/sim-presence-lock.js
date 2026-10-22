/* sim-presence-lock.js — 🔒 친구 탭 온라인 고정(myhome/presence-lock.js) · 첫 쓰기 미루기(firebase-init setMyPresenceOnline) · 규칙(presencePref)
   ・1절: normalize · startOnline — 고정했을 때만 고른 값 · 틀린 모양은 «고정 없음 · 온라인»
   ・2절: 모듈을 가짜 DOM 으로 실제로 돌린다 — 켤 때 고정값 · 못 읽으면 이 PC 값(계정과 묶음) · 읽기 전 누름은 덮지 않음 ·
          고정 중 토글만 저장 · 🔒 누르면 지금 값으로 저장 · 로그인 없음 · 저장 실패는 E-MH-02
   ・3절: setMyPresenceOnline 을 실제로 돌린다 — 처음 값이 풀리기 전엔 쓰지 않음(재접속 신호가 먼저 와도) · 오프라인 고정이면 첫 쓰기부터 false ·
          처음 값이 없으면(밀려난 뒤 다시 걸기) 지금 값 · 등록(_myPresenceRef)은 바로
   ・4절: 배선 — html 버튼 · 싣는 순서 · app.js · myhome-init · myhome-ui 옛 토글 걷음 · 규칙 · 오류 번호 · smoke
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
  A + 'parts/myhome/myhome-init.js', A + 'parts/myhome/myhome-ui.js', A + 'parts/shared/error-codes.js', 'firebase/firebase-database-rules.json', 'checks/smoke.js'];
const SRC = {};
for(const r of need){ const f = find(r); if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); } SRC[r] = fs.readFileSync(f, 'utf8'); }
const MOD = SRC[A + 'parts/myhome/presence-lock.js'], FBI = SRC[A + 'parts/firebase-init.js'];

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if(ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };
const tick = async (n = 6) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

function el(){
  const h = {}; const cls = new Set(); const attr = {};
  return { innerHTML: '', textContent: '', title: '', h, attr,
    classList: { toggle: (c, on) => { if(on) cls.add(c); else cls.delete(c); }, contains: (c) => cls.has(c) },
    setAttribute: (k, v) => { attr[k] = v; },
    addEventListener: (ev, fn) => { h[ev] = fn; }, click(){ this.h.click(); } };
}
/* 모듈 하나를 가짜 세상에서 만든다 */
function world(src, o){
  const w = Object.assign({ uid: 'u1', load: async () => ({}), saveFail: false }, o || {});
  const tog = el(), lock = el(), store = Object.assign({}, w.store || {});
  const out = { tog, lock, store, saves: [], sets: [], toasts: [], errs: [], timers: [] };
  const doc = { getElementById: (id) => id === 'mhPresenceToggle' ? tog : id === 'mhPresenceLock' ? lock : null };
  const win = {};
  new Function('window', 'document', src)(win, doc);
  out.T = win.TwPresenceLock;
  out.m = out.T.createPresenceLock({
    getMyUserId: () => w.uid,
    toast: (m) => out.toasts.push(m),
    notifyError: (c, e) => out.errs.push(c),
    loadPref: (uid) => w.load(uid),
    savePref: async (uid, p) => { out.saves.push([uid, p.lock, p.online]); if(w.saveFail) throw new Error('거절'); },
    setPresence: (uid, on) => out.sets.push([uid, on]),
    storage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    setTimer: (fn, ms) => { out.timers.push([fn, ms]); return out.timers.length; },
  });
  return out;
}
const isOff = (w) => /mh-fdot off/.test(w.tog.innerHTML) && /오프라인/.test(w.tog.innerHTML);
const isOn = (w) => /mh-fdot on/.test(w.tog.innerHTML) && /> 온라인/.test(w.tog.innerHTML);

async function behave(src){
  const r = {};
  const T = world(src).T;
  r.pure = T.startOnline({ lock: true, online: false }) === false && T.startOnline({ lock: false, online: false }) === true && T.startOnline(null) === true
    && T.startOnline({ lock: true, online: true }) === true && T.startOnline({ lock: 'yes', online: false }) === true
    && JSON.stringify(T.normalize(null)) === '{"lock":false,"online":true}' && JSON.stringify(T.normalize({ lock: true, online: false, x: 1 })) === '{"lock":true,"online":false}'
    && JSON.stringify(T.normalize({ lock: 1, online: 0 })) === '{"lock":false,"online":true}' && T.CACHE_KEY === 'tw.presencePref';

  // 켤 때 — 서버 고정값(오프라인)
  let w = world(src, { load: async () => ({ lock: true, online: false, ts: 5 }) });
  let v = await w.m.startOnlineFor('u1');
  r.bootLocked = v === false && isOff(w) && w.lock.textContent === '🔒' && w.lock.attr['aria-pressed'] === 'true'
    && JSON.parse(w.store['tw.presencePref']).u === 'u1' && JSON.parse(w.store['tw.presencePref']).online === false && w.saves.length === 0 && w.sets.length === 0;
  // 고정 안 함이면 오프라인이 남아 있어도 온라인
  w = world(src, { load: async () => ({ lock: false, online: false }) });
  r.bootUnlocked = (await w.m.startOnlineFor('u1')) === true && isOn(w) && w.lock.textContent === '🔓';
  // 비어 있음({}) → 온라인 · 이 PC 값 갱신
  w = world(src, { load: async () => ({}), store: { 'tw.presencePref': JSON.stringify({ u: 'u1', lock: true, online: false }) } });
  r.bootEmpty = (await w.m.startOnlineFor('u1')) === true && JSON.parse(w.store['tw.presencePref']).lock === false;
  // 못 읽음 → 이 PC 값(같은 계정만) · 없으면 온라인
  w = world(src, { load: async () => null, store: { 'tw.presencePref': JSON.stringify({ u: 'u1', lock: true, online: false }) } });
  const c1 = await w.m.startOnlineFor('u1');
  const w2 = world(src, { load: async () => { throw new Error('x'); }, store: { 'tw.presencePref': JSON.stringify({ u: 'u2', lock: true, online: false }) } });
  const c2 = await w2.m.startOnlineFor('u1');
  const w3 = world(src, { load: async () => null, store: { 'tw.presencePref': '{깨짐' } });
  const c3 = await w3.m.startOnlineFor('u1');
  r.bootFallback = c1 === false && isOff(w) && c2 === true && c3 === true;
  // 읽기 전에 누름 — 읽은 값으로 덮지 않는다
  let res; w = world(src, { load: () => new Promise(a => { res = a; }) });
  const pr = w.m.startOnlineFor('u1');
  w.tog.click();
  res({ lock: true, online: true });
  const t1 = (await pr) === false && isOff(w) && w.sets.length === 1 && w.sets[0][1] === false && w.lock.textContent === '🔒';
  await tick();
  const t2 = JSON.stringify(w.saves) === '[["u1",true,false]]' && JSON.parse(w.store['tw.presencePref']).lock === true && JSON.parse(w.store['tw.presencePref']).online === false;
  // 읽기 전 누름 · 서버는 고정 안 함 → 🔓 · 저장 없음
  w = world(src, { load: () => new Promise(a => { res = a; }) });
  const pr2 = w.m.startOnlineFor('u1'); w.tog.click(); res({ lock: false, online: true }); await pr2; await tick();
  r.touched = t1 && t2 && w.lock.textContent === '🔓' && w.saves.length === 0 && isOff(w);
  // 읽기가 멈추면 시한 뒤 이 PC 값
  w = world(src, { load: () => new Promise(() => {}), store: { 'tw.presencePref': JSON.stringify({ u: 'u1', lock: true, online: false }) } });
  const pr3 = w.m.startOnlineFor('u1'); await tick();
  const tm = w.timers.find(t => t[1] === w.T.LOAD_WAIT_MS);
  if(tm) tm[0]();
  r.slow = !!tm && w.T.LOAD_WAIT_MS === 5000 && (await pr3) === false && isOff(w);
  // 고정 안 함 · 토글 → 접속 표시만(저장 없음)
  w = world(src); await w.m.startOnlineFor('u1');
  w.tog.click(); await tick();
  r.toggleUnlocked = w.saves.length === 0 && w.sets.length === 1 && w.sets[0][1] === false && isOff(w) && /오프라인으로 보여요/.test(w.toasts[0]);
  // 🔒 → 지금 값(오프라인)으로 저장 · 고정 중 토글 → 저장 · 🔓 → 풀림 저장
  w.lock.click(); await tick();
  const s1 = w.saves[0];
  w.tog.click(); await tick();
  const s2 = w.saves[1];
  w.lock.click(); await tick();
  const s3 = w.saves[2];
  r.lockFlow = JSON.stringify(s1) === '["u1",true,false]' && JSON.stringify(s2) === '["u1",true,true]' && JSON.stringify(s3) === '["u1",false,true]'
    && w.lock.textContent === '🔓' && /«오프라인» 으로 시작/.test(w.toasts[1]) && /고정을 풀었어요/.test(w.toasts[3])
    && JSON.parse(w.store['tw.presencePref']).lock === false;
  // 로그인 없음 · 저장 실패
  w = world(src, { uid: '' }); w.lock.click(); await tick();
  const noUid = w.saves.length === 0 && /로그인/.test(w.toasts[0]) && w.lock.textContent === '🔓';
  w = world(src, { saveFail: true }); await w.m.startOnlineFor('u1'); w.lock.click(); await tick();
  r.edge = noUid && w.errs.join() === 'E-MH-02' && w.lock.textContent === '🔒' && JSON.parse(w.store['tw.presencePref']).lock === true
    && (await world(src).m.startOnlineFor('')) === true;
  return r;
}
function report(r){
  say('── 1. normalize · startOnline');
  chk(r.pure, '고정했을 때만 고른 값으로 시작 · 틀린 모양은 «고정 없음 · 온라인» · 저장 키 tw.presencePref');
  say('── 2. 모듈을 실제로 돌린다');
  chk(r.bootLocked, '켤 때 — 서버에 «🔒 오프라인» 이면 오프라인으로 시작 · 🔒 표시 · 이 PC 에도 남김 · 저장 · 접속 쓰기 0(첫 쓰기는 firebase-init)');
  chk(r.bootUnlocked, '  고정을 안 했으면 마지막이 오프라인이어도 온라인으로 시작(예전과 같다)');
  chk(r.bootEmpty, '  서버가 비어 있으면 온라인 · 이 PC 값도 «고정 없음» 으로 맞춘다');
  chk(r.bootFallback, '  서버를 못 읽으면 이 PC 값(같은 계정만 · 깨진 값은 무시) · 없으면 온라인');
  chk(r.touched, '  고정값을 읽기 전에 누르면 누른 값을 지키고 고정 여부는 읽은 값 — 고정이면 누른 값이 새 고정값(🔒 · 저장 · 이 PC 값)');
  chk(r.slow, '  서버 읽기가 멈추면 5초 뒤 이 PC 값으로(첫 쓰기 · 재접속 복구가 무한정 기다리지 않게)');
  chk(r.toggleUnlocked, '고정 안 함 — 토글은 접속 표시만 바꾸고 저장하지 않는다(예전과 같다)');
  chk(r.lockFlow, '🔒 누르면 지금 값으로 저장 · 고정 중 토글은 저장 · 🔓 누르면 풀림 저장 · 안내 문구');
  chk(r.edge, '로그인 없음 → 안내만 · 저장 실패 → E-MH-02(이 PC 에는 남김) · uid 없으면 온라인');
}

async function gate(fbi){
  const grab = (src, head) => { const i = src.indexOf(head); if(i < 0) return null; let k = src.indexOf('{', i), d = 0;
    for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return null; };
  const on = grab(fbi, 'setMyPresenceOnline(userId, startOnline){'), st = grab(fbi, 'setMyPresenceState(userId, online){');
  if(!on || !st) return null;
  const mk = (preset) => {
    const w = { log: [], connected: [], ticks: [] };
    const c = {
      Date: { now: () => 1 }, Promise, db: {},
      ref: (d, p) => ({ p }),
      set: (r, v) => { w.log.push(['set', v.online]); return Promise.resolve(); }, update: (r, v) => { w.log.push(['update', v.online]); return Promise.resolve(); },
      onDisconnect: () => ({ set: (v) => { w.log.push(['od', v.online]); return Promise.resolve(); } }),
      onValue: (r, cb) => { if(r.p === '.info/connected') w.connected.push(cb); },
      setInterval: (fn) => { w.ticks.push(fn); return 1; }, _whenAuthReady: () => Promise.resolve(),
      _appVer: { ready: Promise.resolve(), withVer: (x) => x },
    };
    vm.createContext(c);
    vm.runInContext('let _myPresenceRef = null, _presenceRoom = null, _presenceOnline = ' + (preset === false ? 'false' : 'true') + ', _presenceInRoom = false, _presenceWritten = false;\n'
      + 'this.api = {' + on + ',\n' + st + ', ref: () => _myPresenceRef };', c);
    w.api = c.api; w.connect = () => w.connected.forEach(cb => cb({ val: () => true }));
    return w;
  };
  const r = {};
  let res; let w = mk();
  w.api.setMyPresenceOnline('u1', new Promise(a => { res = a; }));
  const reg = !!w.api.ref();
  w.connect(); w.ticks.forEach(f => f()); await tick();
  const before = w.log.filter(e => e[0] === 'set' || e[1] === true).length;
  res(false); await tick();
  w.ticks.forEach(f => f()); await tick();
  r.wait = reg && before === 0 && w.log.some(e => e[0] === 'set') && w.log.every(e => e[1] !== true);
  w = mk(); w.api.setMyPresenceOnline('u1', Promise.resolve(true)); await tick();
  r.onTrue = w.log.filter(e => e[0] === 'set').every(e => e[1] === true) && w.log.some(e => e[0] === 'set');
  w = mk(false); w.api.setMyPresenceOnline('u1'); await tick();
  const keepOff = w.log.some(e => e[0] === 'set') && w.log.filter(e => e[0] === 'set').every(e => e[1] === false);
  w = mk(); w.api.setMyPresenceOnline('u1', Promise.reject(new Error('x'))); await tick();
  r.noArg = keepOff && w.log.some(e => e[0] === 'set' && e[1] === true);
  return r;
}

(async () => {
  const R = await behave(MOD);
  report(R);

  say('── 3. 첫 쓰기 미루기 (setMyPresenceOnline 을 실제로 돌린다)');
  const G = await gate(FBI);
  chk(!!G, 'setMyPresenceOnline(userId, startOnline) · setMyPresenceState 를 찾았다');
  if(G){
    chk(G.wait, '처음 값이 풀리기 전엔 쓰지 않는다(재접속 신호 · 6시간 lastSeen 이 먼저 와도) · 등록은 바로 · «🔒 오프라인» 이면 어느 쓰기에도 online:true 없음');
    chk(G.onTrue, '  처음 값이 온라인이면 예전처럼 온라인');
    chk(G.noArg, '  처음 값이 없으면(밀려난 뒤 다시 걸기) 지금 값 그대로 · 처음 값이 실패해도 쓴다');
  }

  say('── 4. 배선');
  {
    const H = SRC[A + 'desk-companion-prototype.html'], AP = SRC[A + 'parts/app.js'], INIT = SRC[A + 'parts/myhome/myhome-init.js'], UI = SRC[A + 'parts/myhome/myhome-ui.js'];
    chk(/<span class="mh-pres-row"><span id="mhPresenceToggle">[\s\S]*?<\/span><button id="mhPresenceLock" type="button" aria-pressed="false"[^>]*>🔓<\/button><\/span>/.test(H), 'html — 온라인 토글 바로 옆 🔒 버튼(처음엔 🔓)');
    const iL = H.indexOf('<script src="parts/myhome/presence-lock.js"></script>'), iA = H.indexOf('<script src="parts/app.js"></script>');
    chk(iL > 0 && iA > iL, 'html — presence-lock.js 가 app.js 보다 먼저');
    chk((AP.match(/const presenceLockMod = TwPresenceLock\.createPresenceLock\(\{/g) || []).length === 1 && AP.indexOf('const presenceLockMod') < AP.indexOf('const mhInitMod')
      && /loadPref: \(\.\.\.a\)=>firebaseAPI\.loadPresencePref\(\.\.\.a\),/.test(AP) && /savePref: \(\.\.\.a\)=>firebaseAPI\.savePresencePref\(\.\.\.a\),/.test(AP)
      && /setPresence: \(\.\.\.a\)=>firebaseAPI\.setMyPresenceState\(\.\.\.a\),/.test(AP) && /  presenceLock: presenceLockMod,\n/.test(AP), 'app.js — 마이홈 처음 준비보다 먼저 만들고 deps 로 넘긴다');
    chk(/firebaseAPI\.setMyPresenceOnline\(myId, presenceLock\.startOnlineFor\(myId\)\);/.test(INIT), 'myhome-init — 처음 온라인 여부(Promise)를 접속 표시 등록에 넘긴다');
    chk(!/mhPresenceToggle/.test(UI) && !/setMyPresenceState/.test(UI), 'myhome-ui — 옛 토글 연결을 걷었다(두 벌이면 한 번 누름에 두 번 바뀐다)');
    const ld = FBI.slice(FBI.indexOf('async loadPresencePref('), FBI.indexOf('async savePresencePref('));
    const sv = FBI.slice(FBI.indexOf('async savePresencePref('), FBI.indexOf('setMyPresenceState(userId, online){'));
    chk(/get\(ref\(db, `presencePref\/\$\{userId\}`\)\)\)\.val\(\) \|\| \{\}; \}catch\(_\)\{ return null; \}/.test(ld) && /await _whenAuthReady\(\)/.test(ld)
      && /set\(ref\(db, `presencePref\/\$\{userId\}`\), \{ lock: p\.lock === true, online: p\.online !== false, ts: serverTimestamp\(\) \}\)/.test(sv), 'firebase-init — 읽기(비어 있음 {} · 못 읽음 null) · 쓰기(lock · online · ts 세 칸)');
    let R = null; try{ R = JSON.parse(SRC['firebase/firebase-database-rules.json']).rules.presencePref.$userId; }catch(_){}
    const own = /^auth != null && root\.child\('userAuth\/'\+\$userId\)\.val\(\) === auth\.uid && /;
    chk(!!R && own.test(R['.read']) && own.test(R['.write']) && !/!root\.child\('userAuth/.test(R['.read'] + R['.write'])
      && /hasChildren\(\['lock','online','ts'\]\)/.test(R['.validate']) && R.$other['.validate'] === false && /isBoolean/.test(R.lock['.validate']) && /isBoolean/.test(R.online['.validate']),
      '규칙 — 로그인한 본인만 읽기 · 쓰기(친구가 «숨긴 오프라인» 을 못 알아보게) · 세 칸 · 다른 칸 거부');
    chk(/'E-MH-02': \{ msg: '[^']+', where: 'myhome\/presence-lock\.js/.test(SRC[A + 'parts/shared/error-codes.js']), '오류 번호 E-MH-02 가 표에 있다');
    chk(SRC['checks/smoke.js'].indexOf("PRELOAD.push('presence-lock.js');") > 0, 'smoke PRELOAD 에 presence-lock.js');
  }

  say('── 5. 깨 보기');
  {
    const br = async (from, to) => MOD.includes(from) ? behave(MOD.replace(from, to)) : null;
    const b1 = await br("function startOnline(p){ return !(p && p.lock === true && p.online === false); }", "function startOnline(p){ return true; }");
    chk(b1 && !b1.bootLocked, '고정값을 무시하고 늘 온라인으로 시작하면 2절이 빨강');
    const b2 = await br("if(uid && pref.lock){ pref = { lock: true, online }; save(uid); }", "if(uid){ pref = { lock: pref.lock, online }; save(uid); }");
    chk(b2 && !b2.toggleUnlocked, '고정 안 했는데 토글마다 저장하면 2절이 빨강');
    const b3 = await br("if(p && touched){", "if(false){");
    chk(b3 && !b3.touched, '읽기 전 누름을 읽은 값으로 덮으면 2절이 빨강');
    const b4 = await br("      pref = { lock: p.lock, online };", "      pref = { lock: false, online };");
    chk(b4 && !b4.touched, '읽기 전 누름 뒤 서버 고정을 잊으면(🔓 로 보이고 다음 실행은 숨은 고정값) 2절이 빨강');
    const b5 = await br("new Promise(r => deps.setTimer(() => r(null), LOAD_WAIT_MS))", "new Promise(() => {})");
    chk(b5 && !b5.slow, '읽기 시한이 없으면 2절이 빨강');
    const g2 = FBI.includes("update(_myPresenceRef, _appVer.withVer({ lastSeen: Date.now() }))") ? await gate(FBI.replace("update(_myPresenceRef, _appVer.withVer({ lastSeen: Date.now() }))", "update(_myPresenceRef, _appVer.withVer({ lastSeen: Date.now(), online: true }))")) : null;
    chk(g2 && !g2.wait, '6시간 lastSeen 에 online:true 를 섞으면 3절이 빨강');
    const g1 = FBI.includes("const _armPresence = ()=>gate.then(()=>{") ? await gate(FBI.replace("const _armPresence = ()=>gate.then(()=>{", "const _armPresence = ()=>Promise.resolve().then(()=>{")) : null;
    chk(g1 && !g1.wait, '첫 쓰기가 처음 값을 안 기다리면 3절이 빨강');
  }

  say('');
  say('결과 ' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})();
