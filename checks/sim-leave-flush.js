/* sim-leave-flush.js — 🚪 떠나기 전 저장 기다리기(shared/leave-flush.js) · 끄기 붙잡기(quit-hold.js) · 앱 끄기가 캐릭터 저장을 기다린다
   ・1절: flushWithin — 일이 없으면 바로(타이머 없음) · 던지는 일도 끝난 것 · 안 끝나면 8초에 timedOut
   ・2절: createQuitHold(main) — 붙잡기 · 답이 오면 다시 끄기 · 한 번 끝나면 다시 안 붙잡음 · 창이 없거나 죽었거나 «답할 수 있다» 전이면 안 붙잡음 · 9초 상한 · 창 닫기 · 업데이트 설치
   ・3절: 끝까지 — 진짜 옷장(closet.js) + 진짜 끄기 붙잡기(quit-hold.js) + 진짜 렌더러 답(leave-flush.js)을 가짜 IPC 로 이어 돌린다:
          캐릭터를 만들자마자 끄면 만들기 요청(POST)이 끝난 뒤에 꺼진다 · 못 올린 것이 없으면 바로 꺼진다(요청 0) · 요청이 안 끝나면 8초 · 렌더러가 멈췄으면 9초 ·
          app.js 가 켜다 죽은 화면 · leave-flush.js 가 아직 안 실린 화면은 바로
   ・4절: 배선 — main.js(before-quit 맨 앞 · 창 닫기 · 업데이트 설치 · 새 화면 · 렌더러 죽음 · session-end 는 그대로) · preload 채널 · app.js 일 · html 순서 · 로그아웃이 같은 한 벌
   ・5절: mutation test — 끄기를 안 붙잡는 옛 길(main 이 바로 app.quit)은 3절 첫 판정이 빨강 · 렌더러가 옷장 일을 안 넘기면 빨강 · «답할 수 있다» 를 안 보면 9초
   [실행] 저장소 루트에서 node checks/run.js sim-leave-flush */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = fs.existsSync(path.join(__dirname, 'app')) ? __dirname : path.join(__dirname, '..');
/* 스테이징은 원본을 한 층으로 펼친다 — 그쪽이면 이름만으로 찾는다 */
const find = (rel) => fs.existsSync(path.join(ROOT, rel)) ? path.join(ROOT, rel) : path.join(__dirname, path.basename(rel));
const need = ['app/parts/shared/leave-flush.js', 'quit-hold.js', 'package.json', 'app/parts/character/closet.js', 'app/parts/account/account.js', 'app/parts/app.js', 'app/desk-companion-prototype.html', 'main.js', 'preload.js'];
const SRC = {};
for(const r of need){ const f = find(r); if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); } SRC[r] = fs.readFileSync(f, 'utf8'); }
const LF = SRC['app/parts/shared/leave-flush.js'], QH = SRC['quit-hold.js'], CLOSET = SRC['app/parts/character/closet.js'];

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if(ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };
const tick = () => new Promise(r => setImmediate(r));

/* 가짜 시계 — 타이머는 손으로 돌린다(advance 가 시각 순서대로 부르고 사이사이 비동기를 비운다) */
function mkClock(){
  const c = { now: 0, list: [], seq: 0 };
  c.setTimeout = (fn, ms) => { const id = ++c.seq; c.list.push({ id, at: c.now + (ms || 0), fn }); return id; };
  c.clearTimeout = (id) => { c.list = c.list.filter(t => t.id !== id); };
  c.pending = () => c.list.length;
  c.advance = async (ms) => {
    const end = c.now + ms;
    for(;;){
      for(let k = 0; k < 5; k++) await tick();
      c.list.sort((a, b) => a.at - b.at);
      const t = c.list[0];
      if(!t || t.at > end) break;
      c.list.shift(); c.now = t.at; t.fn();
    }
    c.now = end;
    for(let k = 0; k < 5; k++) await tick();
  };
  return c;
}
/* quit-hold.js(main)를 싣는다 — module.exports */
function loadQH(qhSrc){
  const mod = { exports: {} };
  new Function('module', 'exports', qhSrc || QH)(mod, mod.exports);
  return Object.assign({}, mod.exports, { QUIT_GUARD_MS: mod.exports.GUARD_MS });
}
/* leave-flush.js(렌더러)를 그 시계 위에 싣는다 — companion 이 있으면 실리면서 끄기 물음 듣기를 건다(진짜 html 과 같다) */
function loadLF(src, clock, companion){
  const ctx = { window: companion ? { companion } : {}, Promise, Object, Error, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout };
  vm.createContext(ctx); vm.runInContext(src || LF, ctx);
  return ctx.window.TwLeaveFlush;
}

/* 가짜 main — app.quit 이 before-quit 을 돌리고, 막히지 않으면 끈다 */
function mkMain(L, clock, opt){
  const o = opt || {};
  const m = { log: [], quitCount: 0, handlers: {}, sent: [], win: null, held: 0 };
  const ipcMain = { on: (ch, fn) => { (m.handlers[ch] = m.handlers[ch] || []).push(fn); } };
  m.win = o.noWin ? null : {
    destroyed: false, crashed: !!o.crashed,
    isDestroyed(){ return this.destroyed; },
    webContents: { isDestroyed: () => false, isCrashed: () => !!o.crashed, send: (ch) => { m.sent.push(ch); if(m.onSend) m.onSend(ch); } },
  };
  m.app = {
    quit(){
      m.quitCount++;
      let prevented = false;
      const e = { preventDefault(){ prevented = true; } };
      if(!o.oldPath) m.hold.beforeQuit(e);
      if(prevented){ m.held++; return; }
      if(!m.quitAt){ m.quitAt = clock.now; m.log.push('quit'); }
    },
  };
  m.hold = L.createQuitHold({ getWindow: () => m.win, ipcMain, quit: () => m.app.quit(), setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  m.done = () => (m.handlers[L.CH.DONE] || []).forEach(fn => fn());
  m.ready = (sender) => (m.handlers[L.CH.READY] || []).forEach(fn => fn({ sender: sender || (m.win && m.win.webContents) }));
  if(!o.noReady && !o.renderer) m.ready();   // 2절 — 렌더러가 «답할 수 있다» 를 알린 뒤(3절은 진짜 leave-flush.js 가 알린다)
  return m;
}

/* 가짜 렌더러 옷장 — 진짜 closet.js · 가짜 서버(만들기 요청은 시계로 늦게 끝난다) */
function mkCloset(clock, opt){
  const o = opt || {};
  const env = { log: o.log, calls: [] };
  const slots = [null, null, null, null, null];
  let last = new Array(5).fill(null);
  const savedFns = [];
  const slotSave = {
    lastOut: () => last, onSaved: (fn) => savedFns.push(fn),
    applySlotObjs: async (arr, which) => { const nl = last.slice(); for(const i of (which || [0, 1, 2, 3, 4])){ slots[i] = arr[i] || null; nl[i] = arr[i] || null; } last = nl; },
    pullForward(){}, _relinkSeatsToSlots(){}, slotsReplaced(){},
  };
  env.edit = (i, val) => { slots[i] = val; const was = JSON.stringify(last); const nl = last.slice(); nl[i] = val; last = nl; savedFns.forEach(fn => fn(last, JSON.stringify(last) !== was)); };
  const api = {
    load: async () => ({ slots: [null, null, null, null, null], avatars: [], defs: {} }),
    create: (slot) => { env.calls.push('create:' + slot); if(o.createHang) return new Promise(() => {}); return new Promise(r => clock.setTimeout(() => { env.log.push('create-done'); r({ avatarId: 'n' + slot, version: 1 }); }, o.createMs || 400)); },
    update: async () => ({ version: 2 }), move: async () => ({}), trash: async () => [], trashPage: async () => ({ items: [], nextCursor: null }), restore: async () => ({}), legacySync: async () => ({}), fetchOne: async () => ({}), reset(){},
  };
  const codec = { SLOT_JSON_MAX: 150000, _slotGlbCacheLoad: () => ({}), _slotGlbCacheSave(){}, _slotToServerObj: async (uid, x) => Object.assign({}, x), _slotFromServerObj: async (d) => d };
  const ctx = { window: {}, JSON, Object, Array, Number, String, Error, Promise, Math, Date, Set, isFinite, console: { warn(){}, log(){} }, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout };
  vm.createContext(ctx); vm.runInContext(CLOSET, ctx);
  const C = ctx.window.TwCloset.createCloset({
    CHAR_SLOT_MAX: 5, closetApi: api, codec, roomFaceCache: { load: () => ({}), save(){} }, slots, slotSave,
    getMyUserId: () => 'u1', rtOn: () => () => {}, toast(){}, notifyError: () => {}, renderLauncher(){}, creatorOpen: () => false,
    storage: { getItem: () => null, setItem(){}, removeItem(){}, key: () => null, length: 0 },
  });
  C.useSession({ setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, on: (u) => u, onReset(){} });
  env.C = C;
  return env;
}

/* 가짜 preload — onQuitFlush 를 걸면 main 에 READY · 물음(ASK)은 걸어 둔 함수로 · quitFlushDone 은 DONE 으로(preload.js 와 같은 모양) */
function fakePreload(Q, m, opt){
  const o = opt || {};
  let cb = null;
  m.onSend = (ch) => { if(ch === Q.CH.ASK && cb && !o.rendererHung) Promise.resolve().then(cb); };
  return { onQuitFlush: (fn) => { cb = fn; m.ready(); }, quitFlushDone: () => { m.log.push('done'); m.done(); } };
}

/* 한 장면 — 캐릭터를 만들고(또는 안 만들고) 곧바로 제목줄 × 를 누른다 */
async function scene(src, opt, qhSrc){
  const o = opt || {};
  const clock = mkClock();
  const Q = loadQH(qhSrc);
  const log = [];
  const m = mkMain(Q, clock, Object.assign({ renderer: true }, o));
  m.log = log;
  const R = o.rendererNotLoaded ? null : loadLF(src, clock, fakePreload(Q, m, o));   // html 이 app.js 보다 먼저 싣는다
  const e = mkCloset(clock, Object.assign({ log }, o));
  await e.C.pullCloset(false);
  if(R && !o.appDied) (o.jobs ? o.jobs(e.C) : [e.C.flushUnsaved]).forEach(j => R.addQuitJob(j));   // app.js 가 옷장을 만든 뒤 일을 더한다
  if(o.edit !== false) e.edit(0, { skin: 'new' });   // 새 캐릭터 저장 — 3초 묶음이 예약된다
  await clock.advance(o.waitBefore || 50);
  const t0 = clock.now;
  m.app.quit();                                         // 제목줄 × → companion:quitApp → app.quit()
  await clock.advance(o.runFor || 20000);
  return { log, m, e, clock, quitAfter: m.quitAt == null ? null : m.quitAt - t0, calls: e.calls };
}

(async () => {
/* ── 1. flushWithin ── */
say('── 1. flushWithin — 일이 없으면 바로 · 던지는 일도 끝난 것 · 안 끝나면 8초');
{
  const clock = mkClock(); const L = loadLF(LF, clock);
  chk(L.LEAVE_FLUSH_MAX_MS === 8000 && loadQH().QUIT_GUARD_MS > L.LEAVE_FLUSH_MAX_MS, '상한 8초 · main 쪽 상한은 그보다 길다 (' + L.LEAVE_FLUSH_MAX_MS + ' · ' + loadQH().QUIT_GUARD_MS + ')');
  let r = null; L.flushWithin([]).then(x => { r = x; }); await tick();
  chk(r && r.timedOut === false && clock.pending() === 0, '일이 없으면 타이머 없이 바로 { timedOut:false }');
  r = null; L.flushWithin([() => { throw new Error('x'); }, () => null]).then(x => { r = x; }); await tick(); await tick();
  chk(r && r.timedOut === false && clock.pending() === 0, '던지는 일 · null 을 돌려준 일은 끝난 것 — 바로 돌아오고 타이머를 남기지 않는다');
  r = null; L.flushWithin([() => new Promise(() => {})]).then(x => { r = x; });
  await clock.advance(7999);
  chk(r === null, '  안 끝나는 일 — 7999ms 에는 아직 기다린다');
  await clock.advance(1);
  chk(r && r.timedOut === true, '  8000ms 에 { timedOut:true } 로 돌아온다');
  r = null; L.flushWithin([() => new Promise(res => clock.setTimeout(res, 300))]).then(x => { r = x; });
  await clock.advance(300);
  chk(r && r.timedOut === false && clock.pending() === 0, '  300ms 에 끝나는 일 — 그때 돌아오고 8초 타이머는 치운다');
}

/* ── 2. createQuitHold ── */
say('── 2. createQuitHold — 붙잡기 · 다시 끄기 · 상한 · 창 없음 · 창 닫기 · 업데이트 설치');
{
  let clock = mkClock(), L = loadQH(), m = mkMain(L, clock);
  m.app.quit();
  chk(m.held === 1 && m.sent.join() === L.CH.ASK && !m.log.length, '첫 app.quit — 붙잡고 렌더러에 한 번 묻는다');
  m.app.quit();
  chk(m.held === 2 && m.sent.length === 1, '  묻는 사이 또 누르면 — 붙잡기만 하고 다시 묻지 않는다');
  m.done();
  chk(m.log.join() === 'quit' && m.hold.stage() === 'done' && clock.pending() === 0, '  답이 오면 다시 끈다 · 상한 타이머를 치운다');
  m.done();
  chk(m.quitCount === 3, '  늦게 온 두 번째 답은 아무 일 없다');
  m.quitAt = null; m.log.length = 0; m.app.quit();
  chk(m.log.join() === 'quit' && m.sent.length === 1, '  한 번 끝난 뒤의 끄기는 붙잡지 않는다');

  clock = mkClock(); L = loadQH(); m = mkMain(L, clock);
  m.app.quit(); await clock.advance(L.QUIT_GUARD_MS - 1);
  chk(!m.log.length, '렌더러가 답하지 않으면 — 상한 직전까지 기다린다');
  await clock.advance(1);
  chk(m.log.join() === 'quit' && m.quitAt === L.QUIT_GUARD_MS, '  상한(' + L.QUIT_GUARD_MS + 'ms)에 끈다');

  for(const [name, o] of [['창이 없으면', { noWin: true }], ['렌더러가 죽었으면', { crashed: true }]]){
    clock = mkClock(); L = loadQH(); m = mkMain(L, clock, o);
    m.app.quit();
    chk(m.log.join() === 'quit' && m.held === 0 && m.sent.length === 0 && clock.pending() === 0, name + ' — 붙잡지 않고 바로 끈다');
  }
  clock = mkClock(); L = loadQH(); m = mkMain(L, clock, { noReady: true });
  m.app.quit();
  chk(m.log.join() === 'quit' && m.sent.length === 0, '렌더러가 «답할 수 있다» 를 알리기 전(불러오는 중) — 붙잡지 않고 바로 끈다');
  clock = mkClock(); L = loadQH(); m = mkMain(L, clock, { noReady: true });
  m.ready({ other: true }); m.app.quit();
  chk(m.log.join() === 'quit' && m.sent.length === 0, '  다른 창이 보낸 READY 는 세지 않는다');
  clock = mkClock(); L = loadQH(); m = mkMain(L, clock);
  m.hold.rendererReset(); m.app.quit();
  chk(m.log.join() === 'quit' && m.sent.length === 0, '  화면을 새로 불러오거나 렌더러가 죽은 뒤(rendererReset) — 다시 알리기 전에는 붙잡지 않는다');
  clock = mkClock(); L = loadQH(); m = mkMain(L, clock);
  m.hold.rendererReset(); m.ready(); m.app.quit();
  chk(m.held === 1 && m.sent.length === 1, '  새 화면이 다시 알리면 붙잡는다');

  clock = mkClock(); L = loadQH(); m = mkMain(L, clock);
  m.win.webContents.send = () => { throw new Error('gone'); };
  m.app.quit();
  chk(m.log.join() === 'quit' && clock.pending() === 0, '묻기가 던지면 — 붙잡지 않고 바로 끈다');

  clock = mkClock(); L = loadQH(); m = mkMain(L, clock);
  let prevented = false;
  m.hold.windowClose({ preventDefault(){ prevented = true; } });
  chk(prevented && m.held === 1 && m.sent.length === 1, '메인 창 닫기(Alt+F4) — 닫기를 막고 끄기로 모은다(묻는다)');
  m.done(); prevented = false;
  m.hold.windowClose({ preventDefault(){ prevented = true; } });
  chk(!prevented && m.log.join() === 'quit', '  끝난 뒤 끄기가 창을 닫을 때는 막지 않는다');

  clock = mkClock(); L = loadQH(); m = mkMain(L, clock);
  const up = [];
  m.hold.flushThen(() => up.push('install'));
  chk(!up.length && m.sent.length === 1, '업데이트 설치 — 먼저 묻는다');
  m.done();
  chk(up.join() === 'install' && !m.log.length, '  답이 오면 설치(app.quit 이 아니라 설치 함수)');
  clock = mkClock(); L = loadQH(); m = mkMain(L, clock);
  m.app.quit(); m.hold.flushThen(() => up.push('install2')); m.done();
  chk(up.includes('install2') && !m.log.length, '  끄기를 묻는 사이 설치를 누르면 — 답이 오면 설치로 이어 간다');
  clock = mkClock(); L = loadQH(); m = mkMain(L, clock, { noWin: true });
  m.hold.flushThen(() => up.push('install3'));
  chk(up.includes('install3'), '  창이 없으면 바로 설치');
}

/* ── 3. 끝까지 ── */
say('── 3. 끝까지 — 진짜 옷장 + 끄기 붙잡기 + 렌더러 답');
const A = await scene();
chk(A.calls.join() === 'create:0' && A.log.join(' → ') === 'create-done → done → quit',
  '★ 캐릭터를 만들자마자 끄면 — 만들기 요청(POST)이 끝난 뒤에 꺼진다 [' + A.log.join(' → ') + ']');
chk(A.quitAfter === 400 && A.e.C.unsavedCount() === 0, '  꺼진 때는 요청이 끝난 때(400ms) · 못 올린 고침 0 (' + A.quitAfter + 'ms)');
await A.clock.advance(5000);
chk(A.calls.length === 1, '  3초 묶음이 뒤늦게 돌아도 같은 캐릭터를 또 올리지 않는다');
const B = await scene(null, { edit: false });
chk(B.quitAfter === 0 && B.calls.length === 0 && B.log.join() === 'done,quit', '★ 못 올린 것이 없으면 — 요청 0 · 그 자리에서 꺼진다(' + B.quitAfter + 'ms)');
const B2 = await scene(null, { waitBefore: 3500 });
chk(B2.calls.length === 1 && B2.log.join(' → ') === 'create-done → done → quit' && B2.quitAfter === 0, '  3초 묶음이 이미 올린 뒤에 끄면 — 다시 올리지 않고 바로 꺼진다');
const Cc = await scene(null, { createHang: true });
chk(Cc.quitAfter === 8000 && !Cc.log.includes('create-done'), '★ 요청이 안 끝나면 — 8초 상한에 꺼진다(' + Cc.quitAfter + 'ms)');
const D = await scene(null, { rendererHung: true });
chk(D.quitAfter === 9000, '  렌더러가 답하지 못하면 — main 상한 9초에 꺼진다(' + D.quitAfter + 'ms)');
const F = await scene(null, { appDied: true });   /* 끈 뒤에도 시뮬레이션은 돌아 3초 묶음이 뒤에 찍힌다 — 앞 두 줄만 본다 */
chk(F.quitAfter === 0 && F.log.slice(0, 2).join() === 'done,quit', '★ app.js 가 켜다 죽은 화면(WebGL 못 만듦 등 · 일 0개) — leave-flush.js 가 이미 답하고 있어 그 자리에서 꺼진다(' + F.quitAfter + 'ms)');
const G = await scene(null, { rendererNotLoaded: true });
chk(G.quitAfter === 0 && G.log[0] === 'quit', '  leave-flush.js 가 아직 안 실린 화면(불러오는 중) — 붙잡지 않고 바로 꺼진다(' + G.quitAfter + 'ms)');
const E = await scene(null, { createMs: 3000 });
chk(E.quitAfter === 3000 && E.log.join(' → ') === 'create-done → done → quit', '  요청이 3초 걸리면 3초 기다렸다 끈다');

/* ── 4. 배선 ── */
say('── 4. 배선');
{
  const MAIN = SRC['main.js'], PRE = SRC['preload.js'], APP = SRC['app/parts/app.js'], HTML = SRC['app/desk-companion-prototype.html'], ACC = SRC['app/parts/account/account.js'];
  chk(/const \{ createQuitHold \} = require\('\.\/quit-hold'\);/.test(MAIN) && /const _quitHold = createQuitHold\(\{ getWindow: \(\) => mainWindow, ipcMain, quit: \(\) => app\.quit\(\)/.test(MAIN) && !/require\('\.\/app\/parts\/shared\/leave-flush'\)/.test(MAIN),
    'main.js — quit-hold.js 로 끄기 붙잡기를 만든다(렌더러 파일은 가져오지 않는다)');
  chk(/"quit-hold\.js"/.test(SRC['package.json']), '  설치 목록(package.json files)에 quit-hold.js — 빠지면 설치본이 켜지지 않는다');
  chk(/app\.on\('before-quit', \(e\) => \{ if\(_quitHold\.beforeQuit\(e\)\) return; try \{ sysinput\.stopGlobalHooks/.test(MAIN), '  before-quit 맨 앞 — 붙잡았으면 훅 · 타이머 정리를 건너뛴다(기다리는 동안 앱이 그대로 돈다)');
  chk(/mainWindow\.on\('close', \(e\) => \{ _quitHold\.windowClose\(e\); \}\)/.test(MAIN), '  메인 창 닫기(Alt+F4)도 끄기로 모은다');
  chk(/ipcMain\.on\('companion:installUpdate', \(\) => \{ _quitHold\.flushThen\(\(\) => autoUpdater\.quitAndInstall\(\)\); \}\)/.test(MAIN), '  업데이트 설치 앞에서 묻는다');
  chk(/ipcMain\.on\('companion:quitApp', \(\) => \{ app\.quit\(\); \}\)/.test(MAIN) && /app\.on\('session-end', \(\) => \{ _exitNow\(\); \}\)/.test(MAIN) && !/_quitHold/.test((MAIN.match(/function _exitNow\(\)\{[\s\S]*?\n\}/) || [''])[0]),
    '  제목줄 × 는 그대로 app.quit(부르는 곳마다 코드 없음) · OS 세션 종료 · _exitNow 는 붙잡지 않는다');
  const L = loadQH();
  chk(PRE.includes("ipcRenderer.on('" + L.CH.ASK + "'") && PRE.includes("ipcRenderer.send('" + L.CH.DONE + "')") && PRE.includes("ipcRenderer.send('" + L.CH.READY + "')"), 'preload — 채널 이름 셋이 quit-hold.js CH 와 같다');
  chk(/wc\.on\('did-navigate', \(\) => \{\n      _quitHold\.rendererReset\(\);/.test(MAIN) && /if\(win === mainWindow\) _quitHold\.rendererReset\(\);/.test(MAIN), 'main.js — 새 화면으로 옮겨 갈 때 · 렌더러가 죽을 때 «답할 수 있다» 를 지운다');
  chk(/TwLeaveFlush\.addQuitJob\(closetMod\.flushUnsaved\);/.test(APP) && (APP.match(/addQuitJob\(/g) || []).length === 1, 'app.js — 끄기에 옷장의 못 올린 고침만 더한다');
  const iL = HTML.indexOf('<script src="parts/shared/leave-flush.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  const iE = HTML.indexOf('<script src="parts/shared/error-report.js"></script>'), firstScript = HTML.indexOf('<script src="parts/');
  chk(iL > 0 && iA > iL && firstScript === iE && HTML.indexOf('<script src=', iE + 1) === iL, 'html — leave-flush.js 를 오류 기록 바로 뒤 · 다른 모든 스크립트보다 먼저 싣는다(뒤가 죽어도 답하게)');
  chk(/return leaveFlush\.flushWithin\(\[/.test(ACC) && !/Promise\.race/.test(ACC) && /leaveFlush: TwLeaveFlush,/.test(APP), '로그아웃 올리기도 같은 한 벌(flushWithin) — 상한 경주를 따로 두지 않는다');
}

/* ── 5. mutation test ── */
say('── 5. mutation test');
{
  const old = await scene(null, { oldPath: true });
  chk(old.log[0] === 'quit' && old.quitAfter === 0,   /* 시뮬레이션은 끈 뒤에도 돌아 3초 묶음이 뒤에 찍힌다 — 실제 앱은 이미 꺼졌다 */ '옛 길(main 이 끄기를 붙잡지 않음) — 만들기 요청이 끝나기 전에 꺼진다 → 3절 첫 판정이 빨강 [' + old.log.join(' → ') + ']');
  const noJob = await scene(null, { jobs: () => [] });
  chk(noJob.log.slice(0, 2).join(' → ') === 'done → quit' && noJob.quitAfter === 0, '렌더러가 옷장 일을 안 넘기면 — 요청 없이 바로 꺼진다 → 빨강');
  const noFilter = await scene(null, { edit: false, jobs: (C) => [() => C.waitFlush().then(() => new Promise(() => {}))] });
  chk(noFilter.quitAfter === 8000, '못 올린 것이 없어도 기다리는 일을 넘기면 — 8초를 기다린다 → 2번째 ★ 판정이 빨강');
  const noReadyGate = await scene(null, { rendererNotLoaded: true }, QH.replace('if(!w || !ready) return null;', 'if(!w) return null;'));
  chk(noReadyGate.quitAfter === 9000, '«답할 수 있다» 를 안 보고 붙잡으면 — 불러오는 중인 화면에서 9초를 기다린다 → 위 «안 실린 화면» 판정이 빨강(' + noReadyGate.quitAfter + 'ms)');
  const broken = await scene(null, {}, QH.replace('if(stage === \'idle\' && !ask(quit)) return false;', 'return false;'));
  chk(broken.log[0] === 'quit', 'beforeQuit 가 붙잡지 않으면 — 요청 전에 꺼진다 → 빨강');
}

say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ 예외 — ' + (e && e.stack || e)); process.exit(1); });
