/* sim-update-recheck.js — 🔄 켜 둔 동안 다시 확인(update-recheck.js) · 끌 때 조용히 설치(main.js autoInstallOnAppQuit) — 윈도우만
   ・1절: createUpdateRecheck — 4시간 + 0~1시간마다 check · 사람마다 늦춤이 다름 · 확인 · 받는 중이면 그 차례 건너뜀 · 다 받으면 멈춤 · start 한 번 · stop
   ・2절: 끌 때 설치 — main.js 의 설정 줄(UPDATE_IN_BACKGROUND · autoInstallOnAppQuit · _skipInstallOnQuit)을 떼어 돌리고, 진짜 끄기 붙잡기(quit-hold.js) ·
          electron-updater 의 끌 때 설치 규칙(BaseUpdater.addQuitHandler — 설치돼 있으면 진짜를, 없으면 같은 규칙의 사본)을 가짜 app 위에 잇는다:
          받아 둔 판은 사용자가 끌 때 저장을 끝낸 뒤 조용히(/S · 다시 켜지 않음) 설치 · 켜 둔 동안은 설치 안 함 · 안 받았으면 없음 ·
          OS 세션 종료(_exitNow) · 계정 재시작은 설치 안 함 · [재시작] 은 한 번만 설치 · 맥은 설치 · 다시 확인 둘 다 없음
   ・3절: 배선 — main.js(require · 설치 목록 · 상태를 넘김 · 윈도우에서만 start · 입구는 startUpdateCheck · _exitNow · relaunchApp · before-quit) · 옛 주석 없음
   ・4절: mutation test
   [실행] 저장소 루트에서 node checks/run.js sim-update-recheck */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, 'app')) ? __dirname : path.join(__dirname, '..');
const find = (rel) => fs.existsSync(path.join(ROOT, rel)) ? path.join(ROOT, rel) : path.join(__dirname, path.basename(rel));
const SRC = {};
for(const r of ['update-recheck.js', 'quit-hold.js', 'main.js', 'package.json']){
  const f = find(r);
  if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); }
  SRC[r] = fs.readFileSync(f, 'utf8');
}
const UR = SRC['update-recheck.js'], QH = SRC['quit-hold.js'], MAIN = SRC['main.js'];

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if(ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };
const tick = () => new Promise(r => setImmediate(r));
const H = 60 * 60 * 1000;

const loadMod = (src) => { const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports); return m.exports; };

function mkClock(){
  const c = { now: 0, list: [], seq: 0 };
  c.setTimeout = (fn, ms) => { const id = ++c.seq; c.list.push({ id, at: c.now + (ms || 0), fn }); return id; };
  c.clearTimeout = (id) => { c.list = c.list.filter(t => t.id !== id); };
  c.pending = () => c.list.length;
  c.advance = async (ms) => {
    const end = c.now + ms;
    for(;;){
      for(let k = 0; k < 3; k++) await tick();
      c.list.sort((a, b) => a.at - b.at);
      const t = c.list[0];
      if(!t || t.at > end) break;
      c.list.shift(); c.now = t.at; t.fn();
    }
    c.now = end;
    for(let k = 0; k < 3; k++) await tick();
  };
  return c;
}

/* 1절 도구 — 다시 확인을 가짜 시계 위에. checks 는 check() 가 불린 시각 */
function mkRecheck(src, rnd){
  const clock = mkClock(), checks = [];
  const M = loadMod(src || UR);
  const r = M.createUpdateRecheck({ check: () => checks.push(clock.now), setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, random: rnd || (() => 0.5) });
  return { r, clock, checks, M };
}

/* electron-updater 의 끌 때 설치 규칙 — 설치돼 있으면 진짜 BaseUpdater.addQuitHandler 를 쓴다 */
function realAddQuitHandler(){
  const tries = ['electron-updater/out/BaseUpdater'];
  for(const p of String(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)){
    tries.push(path.join(p, 'electron-updater/out/BaseUpdater'));
    tries.push(path.join(p, '..', 'apps', 'desktop', 'node_modules', 'electron-updater/out/BaseUpdater'));
  }
  for(const t of tries){ try{ return require(t).BaseUpdater.prototype.addQuitHandler; }catch(_){} }
  return null;
}
/* 같은 규칙의 사본(electron-updater 6.x) — 받기가 끝날 때 autoInstallOnAppQuit 이면 'quit' 에 한 번 걸고, 'quit' 때 다시 읽는다 */
function copyAddQuitHandler(){
  if(this.quitHandlerAdded || !this.autoInstallOnAppQuit) return;
  this.quitHandlerAdded = true;
  this.app.onQuit((exitCode) => {
    if(this.quitAndInstallCalled) return;
    if(!this.autoInstallOnAppQuit) return;
    if(exitCode !== 0) return;
    this.install(true, false);
  });
}
const REAL_AQH = realAddQuitHandler();
const AQH = REAL_AQH || copyAddQuitHandler;

/* main.js 의 설정 세 줄을 떼어 그 플랫폼으로 돌린다 */
function mainUpdaterLines(src){
  const a = (src.match(/const UPDATE_IN_BACKGROUND = [^\n]*\n/) || [''])[0];
  const b = (src.match(/autoUpdater\.autoInstallOnAppQuit = [^;\n]*;[^\n]*\n/) || [''])[0];
  const c = (src.match(/function _skipInstallOnQuit\(\)\{[^\n]*\n/) || [''])[0];
  return { ok: !!(a && b && c), body: a + b + c };
}

/* 2절 도구 — 가짜 app(before-quit → quit) + 진짜 끄기 붙잡기 + 끌 때 설치 규칙.
   o: platform · downloaded · saveMs(렌더러가 못 올린 저장을 끝내는 데 걸리는 시간) · mainSrc · qhSrc · how('quit' | 'exit' | 'relaunch' | 'install') · useFor(끄기 전 쓰는 시간) */
async function scene(o){
  o = o || {};
  const clock = mkClock(), log = [];
  const lines = mainUpdaterLines(o.mainSrc || MAIN);
  const listeners = {};
  const app = {
    on: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push({ fn, once: false }); },
    once: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push({ fn, once: true }); },
    emit: (ev, ...args) => { const l = listeners[ev] || []; listeners[ev] = l.filter(x => !x.once); l.forEach(x => x.fn(...args)); },
    quit: () => {
      const e = { prevented: false, preventDefault(){ this.prevented = true; } };
      app.emit('before-quit', e);
      if(e.prevented) return;
      log.push('quit'); app.emit('quit', {}, 0);
    },
    exit: (code) => { log.push('exit'); app.emit('quit', {}, code || 0); },   // app.exit 는 before-quit 를 건너뛴다
    relaunch: () => log.push('relaunch'),
  };
  const updater = {
    autoInstallOnAppQuit: true, quitAndInstallCalled: false, quitHandlerAdded: false,
    _logger: { info(){}, warn(){} },
    app: { onQuit: (h) => app.once('quit', (_, code) => h(code)) },
    install(isSilent, forceRun){ if(this.quitAndInstallCalled) return false; this.quitAndInstallCalled = true; log.push('install:' + (isSilent ? 'silent' : 'shown') + (forceRun ? '+run' : '')); return true; },
    quitAndInstall(){ if(this.install(false, true)) setImmediate(() => app.quit()); },
  };
  updater.addQuitHandler = AQH;
  const cfg = new Function('process', 'autoUpdater', lines.body + '\nreturn { UPDATE_IN_BACKGROUND, _skipInstallOnQuit };')({ platform: o.platform || 'win32' }, updater);
  // 진짜 끄기 붙잡기 — 렌더러는 저장을 saveMs 에 끝내고 답한다
  const ipcH = {};
  const ipcMain = { on: (ch, fn) => { ipcH[ch] = fn; } };
  const { createQuitHold, CH } = loadMod(o.qhSrc || QH);
  const wc = { isDestroyed: () => false, isCrashed: () => false, send: (ch) => { if(ch !== CH.ASK) return; log.push('save-start'); clock.setTimeout(() => { log.push('save-done'); ipcH[CH.DONE](); }, o.saveMs == null ? 2000 : o.saveMs); } };
  const win = { isDestroyed: () => false, webContents: wc, close(){} };
  const hold = createQuitHold({ getWindow: () => win, ipcMain, quit: () => app.quit(), platform: o.platform || 'win32', setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  ipcH[CH.READY]({ sender: wc });
  app.on('before-quit', (e) => { if(o.noHold ? false : hold.beforeQuit(e)) return; log.push('cleanup'); });
  if(o.downloaded !== false) updater.addQuitHandler();   // electron-updater 는 받기가 끝날 때(executeDownload done) 건다
  await clock.advance(o.useFor || 0);
  const installedBeforeQuit = log.some(x => x.startsWith('install'));
  const how = o.how || 'quit';
  if(how === 'quit') app.quit();
  else if(how === 'exit'){ if(!o.noSkip) cfg._skipInstallOnQuit(); app.exit(0); }   // _exitNow · session-end
  else if(how === 'relaunch'){ if(!o.noSkip) cfg._skipInstallOnQuit(); app.relaunch(); app.quit(); }
  else if(how === 'install') hold.flushThen(() => updater.quitAndInstall());
  await clock.advance(20000);
  return { log, installedBeforeQuit, cfg, linesOk: lines.ok, updater };
}

(async () => {
  const M = loadMod(UR);
  say('── 1. createUpdateRecheck');
  {
    chk(M.EVERY_MS === 4 * H && M.JITTER_MS === H, '주기 4시간 + 늦춤 0~1시간');
    const a = mkRecheck(null, () => 0.5);
    chk(a.clock.pending() === 0 && a.checks.length === 0, '만들기만 하면 타이머 · 확인 없음');
    a.r.start(); a.r.start();
    chk(a.clock.pending() === 1, '★ start 를 두 번 불러도 타이머는 하나');
    await a.clock.advance(4.5 * H - 1);
    chk(a.checks.length === 0, '  켜고 4.5시간 전엔 묻지 않는다(켤 때 확인과 겹치지 않음)');
    await a.clock.advance(1);
    chk(a.checks.length === 1 && a.checks[0] === 4.5 * H, '★ 4시간 + 늦춤(0.5 → 30분)에 한 번 묻는다');
    await a.clock.advance(4.5 * H * 3);
    chk(a.checks.length === 4 && a.clock.pending() === 1, '  그 뒤로도 같은 간격으로 되풀이(타이머는 늘 하나)');
    a.r.status('none'); a.r.status('error');
    await a.clock.advance(4.5 * H);
    chk(a.checks.length === 5, '  없음 · 실패 뒤에도 다음 차례에 다시 묻는다');
    const d0 = mkRecheck(null, () => 0).r.delay(), d1 = mkRecheck(null, () => 0.9999).r.delay();
    chk(d0 === 4 * H && d1 > 4.99 * H && d1 < 5 * H, '★ 늦춤은 사람마다 0~1시간 — 모두가 같은 때 GitHub 에 묻지 않는다 (' + d0 / H + 'h · ' + (d1 / H).toFixed(3) + 'h)');
    chk(mkRecheck(null, () => -3).r.delay() === 4 * H && mkRecheck(null, () => 7).r.delay() === 5 * H && mkRecheck(null, () => NaN).r.delay() >= 4 * H, '  random 이 범위 밖이어도 4~5시간 안');
    for(const st of ['checking', 'available', 'downloading']){
      const b = mkRecheck(); b.r.start(); b.r.status(st);
      await b.clock.advance(4.5 * H);
      chk(b.checks.length === 0 && b.clock.pending() === 1, '  «' + st + '» 중이면 그 차례는 건너뛰고 다음 차례를 건다');
    }
    const c = mkRecheck(); c.r.start(); c.r.status('downloading'); c.r.status('downloaded');
    chk(c.clock.pending() === 0, '★ 다 받으면(downloaded) 멈춘다 — 끌 때 설치되고 다음에 켤 때 다시 묻는다');
    await c.clock.advance(48 * H);
    chk(c.checks.length === 0, '  그 뒤로 묻지 않는다');
    c.r.start();
    chk(c.clock.pending() === 0, '  멈춘 뒤 start 는 아무것도 안 한다');
    const s = mkRecheck(); s.r.start(); s.r.stop();
    await s.clock.advance(48 * H);
    chk(s.checks.length === 0 && s.clock.pending() === 0, 'stop — 타이머를 치우고 다시 걸지 않는다(끌 때)');
    const t = loadMod(UR).createUpdateRecheck({ check: () => { throw new Error('x'); }, setTimeout: (fn) => { t._fn = fn; return 1; }, clearTimeout(){} });
    t.start(); let threw = false; try{ t._fn(); }catch(_){ threw = true; }
    chk(!threw, '  check 가 던져도 타이머 밖으로 새지 않는다');
  }

  say('── 2. 끌 때 설치 (끌 때 설치 규칙: ' + (REAL_AQH ? '설치된 electron-updater 진짜' : 'electron-updater 가 없어 같은 규칙의 사본') + ')');
  {
    const A = await scene({ useFor: 10 * H });
    chk(A.linesOk && A.cfg.UPDATE_IN_BACKGROUND === true, 'main.js 설정 줄을 떼어 돌린다 — 윈도우는 켜 둔 동안 다시 확인 · 끌 때 설치');
    chk(!A.installedBeforeQuit, '★ 받아 둔 채 10시간을 써도 쓰는 도중엔 설치하지 않는다');
    chk(A.log.join(' → ') === 'save-start → save-done → cleanup → quit → install:silent',
      '★ 사용자가 끄면 — 못 올린 저장을 끝낸 뒤 꺼지며 조용히 설치(다시 켜지 않음) [' + A.log.join(' → ') + ']');
    const N = await scene({ downloaded: false });
    chk(!N.log.some(x => x.startsWith('install')), '  받은 판이 없으면 끌 때 설치 없음');
    const Z = await scene({ saveMs: 0 });
    chk(Z.log.slice(-1)[0] === 'install:silent' && Z.log.indexOf('save-done') < Z.log.indexOf('quit'), '  못 올린 것이 없어도 같은 순서(답 → 끄기 → 설치)');
    const E = await scene({ how: 'exit' });
    chk(E.log.join() === 'exit', '★ OS 세션 종료 · 중복 실행 정리(_exitNow — app.exit) — 설치하지 않는다(받은 판은 다음에 끌 때)');
    const R = await scene({ how: 'relaunch' });
    chk(!R.log.some(x => x.startsWith('install')) && R.log.includes('relaunch') && R.log.includes('quit'), '★ 계정 재시작(relaunchApp) — 다시 켜는 앱과 부딪히지 않게 설치하지 않는다');
    const I = await scene({ how: 'install' });
    chk(I.log.filter(x => x.startsWith('install')).length === 1 && I.log.join(' → ') === 'save-start → save-done → install:shown+run → cleanup → quit',
      '★ [재시작] — 저장을 끝낸 뒤 예전처럼 설치 · 끌 때 설치가 또 돌지 않는다 [' + I.log.join(' → ') + ']');
    const Mac = await scene({ platform: 'darwin' });
    chk(Mac.cfg.UPDATE_IN_BACKGROUND === false && Mac.updater.autoInstallOnAppQuit === false && !Mac.log.some(x => x.startsWith('install')), '★ 맥 — 끌 때 설치 없음(autoInstallOnAppQuit=false · 예전 그대로)');
    const Lin = await scene({ platform: 'linux' });
    chk(Lin.cfg.UPDATE_IN_BACKGROUND === false, '  윈도우 밖(리눅스)도 켜지 않는다');
  }

  say('── 3. 배선');
  {
    const pkg = JSON.parse(SRC['package.json']);
    const files = (pkg.build && pkg.build.files) || [];
    chk(/const \{ createUpdateRecheck \} = require\('\.\/update-recheck'\);/.test(MAIN) && files.includes('update-recheck.js'), 'main.js 가 update-recheck.js 를 싣는다 · 설치 목록(package.json files)에도 — 빠지면 설치본이 켜지지 않는다');
    chk(/const _updateRecheck = createUpdateRecheck\(\{ check: \(\) => startUpdateCheck\(\), setTimeout, clearTimeout, random: Math\.random \}\);/.test(MAIN), '  다시 확인의 입구는 startUpdateCheck 하나(맥 갈래 · checkForUpdates 한 곳 그대로 — sim-mac-update)');
    chk(/function sendUpdateStatus\(status, extra\)\{\n  _updateRecheck\.status\(status\);/.test(MAIN), '  main 이 받은 모든 업데이트 상태를 넘긴다(받는 중 건너뜀 · 다 받으면 멈춤)');
    chk(/\n  if\(UPDATE_IN_BACKGROUND\) _updateRecheck\.start\(\);/.test(MAIN) && (MAIN.match(/_updateRecheck\.start\(\)/g) || []).length === 1, '★ 윈도우에서만 start · 한 곳');
    const exitNow = (MAIN.match(/function _exitNow\(\)\{[\s\S]*?\n\}/) || [''])[0];
    chk(/^function _exitNow\(\)\{\n  try\{ _skipInstallOnQuit\(\); _updateRecheck\.stop\(\); \}catch\(_\)\{\}/.test(exitNow), '★ _exitNow 맨 앞에서 끌 때 설치를 끈다(OS 세션 종료 · 중복 실행 정리)');
    chk(/ipcMain\.on\('companion:relaunchApp', \(\) => \{\n    _skipInstallOnQuit\(\);[^\n]*\n    try\{ app\.relaunch\(\); \}/.test(MAIN), '★ 계정 재시작은 relaunch 앞에서 끌 때 설치를 끈다');
    chk(/app\.on\('before-quit', \(e\) => \{ if\(_quitHold\.beforeQuit\(e\)\) return; [^\n]*try \{ _updateRecheck\.stop\(\); \} catch \(_\) \{\} try \{ _flushLauncherPos\(\); \} catch \(_\) \{\} \}\);/.test(MAIN), '  before-quit — 붙잡기가 끝난 진짜 끄기에서 다시 확인을 멈춘다');
    chk(/ipcMain\.on\('companion:installUpdate', \(\) => \{ _quitHold\.flushThen\(\(\) => autoUpdater\.quitAndInstall\(\)\); \}\)/.test(MAIN), '  [재시작] 은 그대로(저장을 기다린 뒤 quitAndInstall)');
    chk(!/autoInstallOnAppQuit = false;\s*\/\/ 사용자가 명시적으로/.test(MAIN) && (MAIN.match(/autoInstallOnAppQuit\s*=/g) || []).length === 2, '  옛 «autoInstallOnAppQuit=false» 줄 · 주석이 없다 · 바꾸는 곳은 설정 줄 · _skipInstallOnQuit 둘뿐');
  }

  say('── 4. mutation test');
  {
    const BUSY = "if(!BUSY.includes(last)){ try{ check(); }catch(_){} }";
    chk(UR.includes(BUSY), 'update-recheck.js 원문이 그대로 있다(아래 변이의 바탕)');
    const b = mkRecheck(UR.replace(BUSY, 'try{ check(); }catch(_){}')); b.r.start(); b.r.status('downloading');
    await b.clock.advance(4.5 * H);
    chk(b.checks.length === 1, '받는 중 건너뜀을 지우면 — 받는 중에 또 묻는다 → 1절 «downloading» 판정이 빨강');
    const DL = "if(s === 'downloaded') stop();";
    const c = mkRecheck(UR.replace(DL, '')); c.r.start(); c.r.status('downloaded');
    await c.clock.advance(9 * H);
    chk(c.clock.pending() === 1 && c.checks.length === 2, '다 받은 뒤 멈춤을 지우면 — 계속 묻는다 → 1절 «멈춘다» 판정이 빨강');
    const J = 'Math.floor(frac() * jitterMs)';
    chk(UR.includes(J) && mkRecheck(UR.replace(J, '0'), () => 0.9).r.delay() === 4 * H, '늦춤을 지우면 — 모두 정확히 4시간 → 1절 «사람마다» 판정이 빨강');
    const noSkip = await scene({ how: 'exit', noSkip: true });
    chk(noSkip.log.includes('install:silent'), '_exitNow 에서 끌 때 설치를 안 끄면 — OS 종료 중에 설치를 띄운다 → 2절 판정이 빨강');
    const noSkipR = await scene({ how: 'relaunch', noSkip: true });
    chk(noSkipR.log.includes('install:silent'), '계정 재시작에서 안 끄면 — 다시 켜는 앱과 설치가 부딪힌다 → 2절 판정이 빨강');
    const noHold = await scene({ noHold: true });
    chk(noHold.log.includes('install:silent') && !noHold.log.includes('save-done'), '끄기를 붙잡지 않으면 — 저장이 끝나기 전에 설치된다 → 2절 «저장을 끝낸 뒤» 가 빨강');
    const allPlat = await scene({ platform: 'darwin', mainSrc: MAIN.replace("const UPDATE_IN_BACKGROUND = process.platform === 'win32';", 'const UPDATE_IN_BACKGROUND = true;') });
    chk(allPlat.log.includes('install:silent'), '플랫폼 갈래를 지우면 — 맥에서도 끌 때 설치를 건다 → 2절 «맥» 판정이 빨강');
    const oldMain = await scene({ mainSrc: MAIN.replace('autoUpdater.autoInstallOnAppQuit = UPDATE_IN_BACKGROUND;', 'autoUpdater.autoInstallOnAppQuit = false;') });
    chk(!oldMain.log.some(x => x.startsWith('install')), '옛 설정(autoInstallOnAppQuit=false)이면 — 끌 때 설치가 없다 → 2절 ★ 판정이 빨강');
  }

  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ 예외 — ' + (e && e.stack || e)); process.exit(1); });
