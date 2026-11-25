/* sim-update-recheck.js — 🔄 켜 둔 동안 다시 확인(update-recheck.js) · 끌 때 조용히 설치(main.js autoInstallOnAppQuit) — 윈도우 · 맥
   ・1절: createUpdateRecheck — 4시간 + 0~1시간마다 check · 사람마다 늦춤이 다름 · 확인 · 받는 중이면 그 차례 건너뜀(멈춘 받기는 2차례 뒤 다시) · 다 받으면 멈춤 · start 한 번 · stop · fromTick
          installDirWritable — 사용자 설치 true · 모든 사용자(Program Files) false · 시험 파일 안 남김
   ・2절: 끌 때 설치 — main.js 의 설정 줄(_updatePlatform · autoInstallOnAppQuit · _skipInstallOnQuit · _relaunchOrInstall)을 진짜 update-platform.js 로 돌리고, 진짜 끄기 붙잡기(quit-hold.js) ·
          electron-updater 의 끌 때 설치 규칙(BaseUpdater.addQuitHandler — 설치돼 있으면 진짜를, 없으면 같은 규칙의 사본)을 가짜 app 위에 잇는다:
          받아 둔 판은 사용자가 끌 때 저장을 끝낸 뒤 조용히(/S · 다시 켜지 않음) 설치 · 켜 둔 동안은 설치 안 함 · 안 받았으면 없음 ·
          윈도우 세션 종료(메인 창 query-session-end · session-end) · 중복 실행 정리(_exitNow) · 계정 재시작은 설치 안 함 · 모든 사용자 설치는 끌 때 설치 안 함 ·
          [재시작] 은 한 번만 설치 · 맥(Squirrel.Mac — 받을 때 끌 때 설치가 켜져 있으면 준비가 끝나 어떻게 꺼지든 설치)은 끌 때 설치 ·
          받아 둔 판이 있는 재시작은 «설치하고 다시 켜기» 한 번(relaunch 없음) · 앱 폴더에 못 쓰면 끌 때 설치 없음 · 리눅스는 둘 다 없음
   ・3절: 배선 — main.js(require · 설치 목록 · 상태를 넘김 · 플랫폼 판단으로 start · 입구는 startUpdateCheck · _exitNow · relaunchApp · _relaunchFresh · before-quit) · 옛 주석 없음
   ・4절: mutation test
   [실행] 저장소 루트에서 node checks/run.js sim-update-recheck */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, 'app')) ? __dirname : path.join(__dirname, '..');
const find = (rel) => fs.existsSync(path.join(ROOT, rel)) ? path.join(ROOT, rel) : path.join(__dirname, path.basename(rel));
const SRC = {};
for(const r of ['update-recheck.js', 'update-platform.js', 'quit-hold.js', 'main.js', 'package.json']){
  const f = find(r);
  if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); }
  SRC[r] = fs.readFileSync(f, 'utf8');
}
const UR = SRC['update-recheck.js'], UP = SRC['update-platform.js'], QH = SRC['quit-hold.js'], MAIN = SRC['main.js'];

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

/* main.js 의 설정 줄(플랫폼 판단 · 끌 때 설치 · 끄기 · 받음 표시 · 재시작)을 떼어 그 플랫폼으로 돌린다 */
function mainUpdaterLines(src){
  const a = (src.match(/const _updatePlatform = createUpdatePlatform\(\{[\s\S]*?\n\}\);\n/) || [''])[0];
  const b = (src.match(/autoUpdater\.autoInstallOnAppQuit = [^;\n]*;[^\n]*\n/) || [''])[0];
  const c = (src.match(/function _skipInstallOnQuit\(\)\{[^\n]*\n/) || [''])[0];
  const d = (src.match(/let _updateDownloaded = false;[^\n]*\n/) || [''])[0];
  const e = (src.match(/function _relaunchOrInstall\([^)]*\)\{[\s\S]*?\n\}\n/) || [''])[0];
  return { ok: !!(a && b && c && d && e), body: a + b + c + d + e };
}
/* main.js 의 윈도우 세션 종료 배선 두 줄 · _exitNow 첫 줄(끌 때 설치 끄기) */
function mainSessionLines(src){
  const w = (src.match(/\n  mainWindow\.on\('query-session-end', [^\n]*\n  mainWindow\.on\('session-end', [^\n]*\n/) || [''])[0];
  const x = ((src.match(/function _exitNow\(\)\{\n([^\n]*)\n/) || [])[1]) || '';
  return { ok: !!w && /_skipInstallOnQuit/.test(x), wire: w, exitFirst: x };
}
/* 설치 폴더 — writable 이면 파일을 만들 수 있다(모든 사용자 설치는 EPERM) */
function fakeInstallFs(writable, files){
  return {
    writeFileSync: (f) => { if(!writable){ const e = new Error('EPERM'); e.code = 'EPERM'; throw e; } files.add(f); },
    unlinkSync: (f) => { files.delete(f); },
    accessSync: () => {},   // 윈도우의 W_OK 처럼 늘 «된다» 고 답한다
  };
}

/* 2절 도구 — 가짜 app(before-quit → quit) + 진짜 끄기 붙잡기 + 끌 때 설치 규칙.
   o: platform · downloaded · saveMs(렌더러가 못 올린 저장을 끝내는 데 걸리는 시간) · mainSrc · qhSrc · perMachine(설치 폴더에 못 씀) · useFor(끄기 전 쓰는 시간) ·
      how('quit' | 'exit' 중복 실행 정리 | 'session' 윈도우 세션 종료 | 'relaunch' 계정 재시작 | 'fresh' 망가진 창 다시 띄우기 | 'install' [재시작]) ·
      electronQuits(세션 종료를 묻는 뒤 session-end 대신 app.quit 이 온다) · upSrc(update-platform.js 바꾼 사본) */
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
  const probeFiles = new Set();
  const platform = o.platform || 'win32';
  const isMac = platform === 'darwin';
  const proc = isMac
    ? { platform, execPath: '/Applications/Together Working.app/Contents/MacOS/Together Working', pid: 4242 }
    : { platform, execPath: 'C:\\Users\\u\\AppData\\Local\\Programs\\tw\\tw.exe', pid: 4242 };
  app.isPackaged = true;
  app.isInApplicationsFolder = () => true;
  const UPm = loadMod(o.upSrc || UP);
  const cfg = new Function('process', 'autoUpdater', 'installDirWritable', 'fs', 'path', 'app', 'createUpdatePlatform', 'UPDATE_RELAUNCH', '_diagLog',
    lines.body + '\nreturn { backgroundRecheck: _updatePlatform.backgroundRecheck, _skipInstallOnQuit, _relaunchOrInstall, setDownloaded: (v) => { _updateDownloaded = v; } };')(
    proc, updater, loadMod(UR).installDirWritable, fakeInstallFs(!o.perMachine, probeFiles), isMac ? path.posix : path.win32, app, UPm.createUpdatePlatform, UPm.RELAUNCH, () => {});
  /* 맥(Squirrel.Mac): 받기가 끝날 때 끌 때 설치가 켜져 있으면 설치 준비를 끝낸다 — 그 뒤엔 어떻게 꺼지든(quit · exit) 설치된다.
     quitAndInstall 이 이미 설치했으면 꺼질 때 또 설치하지 않는다(설치는 한 번). */
  let macStaged = false;
  if(isMac) app.on('quit', () => { if(macStaged && !updater.quitAndInstallCalled) log.push('install:squirrel'); });
  const sess = mainSessionLines(o.mainSrc || MAIN);
  const _exitNow = () => { new Function('_skipInstallOnQuit', '_updateRecheck', sess.exitFirst)(cfg._skipInstallOnQuit, { stop(){} }); app.exit(0); };
  const wl = {};
  const mainWindow = { on: (ev, fn) => { wl[ev] = fn; } };
  new Function('mainWindow', '_skipInstallOnQuit', '_exitNow', sess.wire)(mainWindow, cfg._skipInstallOnQuit, _exitNow);
  // 진짜 끄기 붙잡기 — 렌더러는 저장을 saveMs 에 끝내고 답한다
  const ipcH = {};
  const ipcMain = { on: (ch, fn) => { ipcH[ch] = fn; } };
  const { createQuitHold, CH } = loadMod(o.qhSrc || QH);
  const wc = { isDestroyed: () => false, isCrashed: () => false, send: (ch) => { if(ch !== CH.ASK) return; log.push('save-start'); clock.setTimeout(() => { log.push('save-done'); ipcH[CH.DONE](); }, o.saveMs == null ? 2000 : o.saveMs); } };
  const win = { isDestroyed: () => false, webContents: wc, close(){} };
  const hold = createQuitHold({ getWindow: () => win, ipcMain, quit: () => app.quit(), platform: o.platform || 'win32', setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  ipcH[CH.READY]({ sender: wc });
  app.on('before-quit', (e) => { if(o.noHold ? false : hold.beforeQuit(e)) return; log.push('cleanup'); });
  if(o.downloaded !== false){
    cfg.setDownloaded(true);   // main.js 'update-downloaded' 처리기가 하는 일
    if(isMac) macStaged = updater.autoInstallOnAppQuit === true;   // MacUpdater.doDownloadUpdate 가 받을 때 읽는다
    else updater.addQuitHandler();   // electron-updater 는 받기가 끝날 때(executeDownload done) 건다
  }
  await clock.advance(o.useFor || 0);
  const installedBeforeQuit = log.some(x => x.startsWith('install'));
  const how = o.how || 'quit';
  if(how === 'quit') app.quit();
  else if(how === 'exit') _exitNow();   // 중복 실행 정리
  else if(how === 'session'){ if(wl['query-session-end']) wl['query-session-end']({}); if(o.electronQuits) app.quit(); else if(wl['session-end']) wl['session-end']({}); else app.exit(0); }
  else if(how === 'relaunch') cfg._relaunchOrInstall(() => app.quit(), () => hold.flushThen(() => updater.quitAndInstall()));   // main.js companion:relaunchApp 과 같은 두 손
  else if(how === 'fresh') cfg._relaunchOrInstall(_exitNow, () => updater.quitAndInstall());   // main.js _relaunchFresh 와 같은 두 손
  else if(how === 'install') hold.flushThen(() => updater.quitAndInstall());
  await clock.advance(20000);
  return { log, installedBeforeQuit, cfg, linesOk: lines.ok && sess.ok, updater, probeFiles };
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
    for(const st of ['available', 'downloading']){
      const b = mkRecheck(); b.r.start(); b.r.status(st);
      await b.clock.advance(4.5 * H * M.BUSY_MAX_SKIPS);
      const skipped = b.checks.length;
      await b.clock.advance(4.5 * H);
      chk(M.BUSY_MAX_SKIPS === 2 && skipped === 0 && b.checks.length === 1, '★ «' + st + '» 에서 멈춘 받기 — ' + M.BUSY_MAX_SKIPS + '차례 건너뛴 뒤엔 다시 묻는다(다시 확인이 영영 서지 않게)');
    }
    { const b = mkRecheck(); b.r.start(); b.r.status('downloading');
      await b.clock.advance(4.5 * H); b.r.status('downloading');   // 진행률이 와도 같은 상태 — 건너뛴 수는 그대로
      await b.clock.advance(4.5 * H); const k = b.checks.length;
      b.r.status('none'); b.r.status('downloading');   // 새 받기 — 건너뛴 수를 0 부터
      await b.clock.advance(4.5 * H);
      chk(k === 0 && b.checks.length === 0, '  상태가 바뀌면 건너뛴 수를 다시 센다(같은 상태가 이어질 때만 멈춤으로 본다)'); }
    { const f = mkRecheck(); f.r.start();
      chk(f.r.fromTick() === false, '  fromTick — 처음엔 false');
      await f.clock.advance(4.5 * H);
      const during = f.r.fromTick(); f.r.status('checking'); const still = f.r.fromTick(); f.r.status('error');
      chk(during && still && f.r.fromTick() === false, '★ fromTick — 타이머가 부른 확인의 답(error · none 등)이 올 때까지만 true (오류 파일에 한 번만 적는 데 쓴다)');
      f.r.status('checking');
      chk(f.r.fromTick() === false, '  렌더러가 부른 확인(켤 때 · [다시 시도])은 false'); }
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
    const files = new Set();
    const ok = M.installDirWritable({ fs: fakeInstallFs(true, files), path: path.win32, dir: 'C:\\Users\\u\\AppData\\Local\\Programs\\tw', pid: 7 });
    const no = M.installDirWritable({ fs: fakeInstallFs(false, files), path: path.win32, dir: 'C:\\Program Files\\tw', pid: 7 });
    chk(ok === true && no === false && files.size === 0, '★ installDirWritable — 사용자 설치는 true · 모든 사용자(Program Files · EPERM)는 false · 만든 파일은 지운다(access 는 «된다» 고 답해도 실제로 만들어 본다)');
    const os = require('os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-probe-'));
    const real = M.installDirWritable({ fs, path, dir: tmp, pid: process.pid });
    const left = fs.readdirSync(tmp).length; fs.rmdirSync(tmp);
    chk(real === true && left === 0, '  진짜 fs — 쓸 수 있는 폴더는 true · 시험 파일을 남기지 않는다');
    chk(M.installDirWritable({ fs, path, dir: path.join(os.tmpdir(), 'tw-no-such-dir-' + process.pid), pid: 1 }) === false, '  없는 폴더는 false');
  }

  say('── 2. 끌 때 설치 (끌 때 설치 규칙: ' + (REAL_AQH ? '설치된 electron-updater 진짜' : 'electron-updater 가 없어 같은 규칙의 사본') + ')');
  {
    const A = await scene({ useFor: 10 * H });
    chk(A.linesOk && A.cfg.backgroundRecheck === true, 'main.js 설정 줄을 떼어 진짜 update-platform.js 로 돌린다 — 윈도우는 켜 둔 동안 다시 확인 · 끌 때 설치');
    chk(!A.installedBeforeQuit, '★ 받아 둔 채 10시간을 써도 쓰는 도중엔 설치하지 않는다');
    chk(A.log.join(' → ') === 'save-start → save-done → cleanup → quit → install:silent',
      '★ 사용자가 끄면 — 못 올린 저장을 끝낸 뒤 꺼지며 조용히 설치(다시 켜지 않음) [' + A.log.join(' → ') + ']');
    const N = await scene({ downloaded: false });
    chk(!N.log.some(x => x.startsWith('install')), '  받은 판이 없으면 끌 때 설치 없음');
    const Z = await scene({ saveMs: 0 });
    chk(Z.log.slice(-1)[0] === 'install:silent' && Z.log.indexOf('save-done') < Z.log.indexOf('quit'), '  못 올린 것이 없어도 같은 순서(답 → 끄기 → 설치)');
    const E = await scene({ how: 'exit' });
    chk(E.log.join() === 'exit', '★ 중복 실행 정리(_exitNow — app.exit) — 설치하지 않는다(받은 판은 다음에 끌 때)');
    const S1 = await scene({ how: 'session' });
    chk(S1.linesOk && S1.log.join() === 'exit', '★ 윈도우 세션 종료 — main.js 메인 창 query-session-end · session-end 배선을 떼어 돌린다: 설치 없이 바로 끝낸다 [' + S1.log.join(' → ') + ']');
    const S2 = await scene({ how: 'session', electronQuits: true });
    chk(!S2.log.some(x => x.startsWith('install')), '  세션 종료를 묻는 단계 뒤 session-end 대신 끄기가 와도 설치하지 않는다(query-session-end 에서 이미 끔)');
    const P = await scene({ perMachine: true });
    chk(P.updater.autoInstallOnAppQuit === false && !P.log.some(x => x.startsWith('install')) && P.log.includes('quit'), '★ 모든 사용자(Program Files) 설치 — 끌 때 설치하지 않는다(UAC 창을 새로 띄우지 않게)');
    const PI = await scene({ perMachine: true, how: 'install' });
    chk(PI.log.filter(x => x.startsWith('install')).join() === 'install:shown+run', '  그 PC 도 [재시작] 은 예전처럼 설치');
    const U = await scene({});
    chk(U.probeFiles.size === 0, '  설치 폴더 시험 파일을 남기지 않는다');
    const R = await scene({ how: 'relaunch' });
    chk(!R.log.some(x => x.startsWith('install')) && R.log.includes('relaunch') && R.log.includes('quit'), '★ 윈도우 계정 재시작(relaunchApp) — 다시 켜는 앱과 부딪히지 않게 설치하지 않는다');
    const RF = await scene({ how: 'fresh' });
    chk(RF.log.join() === 'relaunch,exit', '  윈도우 망가진 창 다시 띄우기(_relaunchFresh) — relaunch 뒤 바로 끝내고 설치하지 않는다 [' + RF.log.join(' → ') + ']');
    const I = await scene({ how: 'install' });
    chk(I.log.filter(x => x.startsWith('install')).length === 1 && I.log.join(' → ') === 'save-start → save-done → install:shown+run → cleanup → quit',
      '★ [재시작] — 저장을 끝낸 뒤 예전처럼 설치 · 끌 때 설치가 또 돌지 않는다 [' + I.log.join(' → ') + ']');
    const Mac = await scene({ platform: 'darwin', useFor: 10 * H });
    chk(Mac.linesOk && Mac.cfg.backgroundRecheck === true && Mac.updater.autoInstallOnAppQuit === true && !Mac.installedBeforeQuit,
      '★ 맥 — 켜 둔 동안 다시 확인 · 끌 때 설치를 켠다 · 쓰는 도중엔 설치하지 않는다');
    chk(Mac.log.join(' → ') === 'save-start → save-done → cleanup → quit → install:squirrel', '★ 맥 — 사용자가 끄면 저장을 끝낸 뒤 꺼지며 설치 [' + Mac.log.join(' → ') + ']');
    const MacN = await scene({ platform: 'darwin', downloaded: false });
    chk(!MacN.log.some(x => x.startsWith('install')), '  맥 — 받은 판이 없으면 끌 때 설치 없음');
    const MacR = await scene({ platform: 'darwin', how: 'relaunch' });
    chk(MacR.log.filter(x => x.startsWith('install')).join() === 'install:shown+run' && !MacR.log.includes('relaunch') && MacR.log.indexOf('save-done') < MacR.log.indexOf('install:shown+run'),
      '★ 맥 계정 재시작 — 받아 둔 판이 있으면 저장 뒤 «설치하고 다시 켜기» 한 번 · relaunch 없음(설치 중인 번들과 다시 켠 앱이 부딪히지 않게) [' + MacR.log.join(' → ') + ']');
    const MacRN = await scene({ platform: 'darwin', how: 'relaunch', downloaded: false });
    chk(!MacRN.log.some(x => x.startsWith('install')) && MacRN.log.includes('relaunch') && MacRN.log.includes('quit'), '  맥 계정 재시작 — 받은 판이 없으면 예전처럼 relaunch · 설치 없음');
    const MacF = await scene({ platform: 'darwin', how: 'fresh' });
    chk(MacF.log.filter(x => x.startsWith('install')).join() === 'install:shown+run' && MacF.log.indexOf('install:shown+run') === 0 && !MacF.log.includes('relaunch'),
      '★ 맥 망가진 창 다시 띄우기 — 받아 둔 판이 있으면 먼저 «설치하고 다시 켜기» 한 번 · relaunch 없음(뒤의 끄기 붙잡기는 상한이 있다) [' + MacF.log.join(' → ') + ']');
    const MacP = await scene({ platform: 'darwin', perMachine: true });
    chk(MacP.updater.autoInstallOnAppQuit === false && !MacP.log.some(x => x.startsWith('install')) && MacP.log.includes('quit'), '★ 맥 — .app 이 든 폴더에 못 쓰면 끌 때 설치하지 않는다');
    chk([...MacP.probeFiles].length === 0 && Mac.probeFiles.size === 0, '  맥도 시험 파일을 남기지 않는다');
    const Lin = await scene({ platform: 'linux' });
    chk(Lin.cfg.backgroundRecheck === false && Lin.updater.autoInstallOnAppQuit === false, '  윈도우 · 맥 밖(리눅스)은 둘 다 켜지 않는다');
  }

  say('── 3. 배선');
  {
    const pkg = JSON.parse(SRC['package.json']);
    const files = (pkg.build && pkg.build.files) || [];
    chk(/const \{ createUpdateRecheck, installDirWritable \} = require\('\.\/update-recheck'\);/.test(MAIN) && files.includes('update-recheck.js'), 'main.js 가 update-recheck.js 를 싣는다 · 설치 목록(package.json files)에도 — 빠지면 설치본이 켜지지 않는다');
    chk(/const \{ createUpdatePlatform, RELAUNCH: UPDATE_RELAUNCH \} = require\('\.\/update-platform'\);/.test(MAIN) && files.includes('update-platform.js'), '  update-platform.js 도 싣는다 · 설치 목록에도');
    chk(/const _updateRecheck = createUpdateRecheck\(\{ check: \(\) => startUpdateCheck\(\), setTimeout, clearTimeout, random: Math\.random \}\);/.test(MAIN), '  다시 확인의 입구는 startUpdateCheck 하나');
    const suc = (MAIN.match(/function startUpdateCheck\(\)\{[\s\S]*?\n\}/) || [''])[0];
    chk(/autoUpdater\.checkForUpdates\(\)/.test(suc) && !/process\.platform|darwin/.test(suc) && (MAIN.match(/autoUpdater\.checkForUpdates\(/g) || []).length === 1, '★ startUpdateCheck 는 플랫폼을 가르지 않고 autoUpdater 를 부른다 · checkForUpdates 는 한 곳');
    chk(/function sendUpdateStatus\(status, extra\)\{\n  _updateRecheck\.status\(status\);/.test(MAIN), '  main 이 받은 모든 업데이트 상태를 넘긴다(받는 중 건너뜀 · 다 받으면 멈춤)');
    chk(/\n  if\(_updatePlatform\.backgroundRecheck\) _updateRecheck\.start\(\);/.test(MAIN) && (MAIN.match(/_updateRecheck\.start\(\)/g) || []).length === 1, '★ 플랫폼 판단(update-platform.js)으로 start · 한 곳');
    const exitNow = (MAIN.match(/function _exitNow\(\)\{[\s\S]*?\n\}/) || [''])[0];
    chk(/^function _exitNow\(\)\{\n  try\{ _skipInstallOnQuit\(\); _updateRecheck\.stop\(\); \}catch\(_\)\{\}/.test(exitNow), '★ _exitNow 맨 앞에서 끌 때 설치를 끈다(OS 세션 종료 · 중복 실행 정리)');
    chk(/ipcMain\.on\('companion:relaunchApp', \(\) => \{\n    _relaunchOrInstall\(\(\) => app\.quit\(\), \(\) => _quitHold\.flushThen\(\(\) => autoUpdater\.quitAndInstall\(\)\)\);\n  \}\);/.test(MAIN), '★ 계정 재시작은 _relaunchOrInstall — 끄기는 app.quit · 설치는 저장을 기다린 뒤');
    const fresh = (MAIN.match(/function _relaunchFresh\(s\)\{[\s\S]*?\n\}/) || [''])[0];
    chk(/_relaunchOrInstall\(_exitNow, \(\) => autoUpdater\.quitAndInstall\(\)\);/.test(fresh) && !/app\.relaunch\(/.test(fresh), '★ 망가진 창 다시 띄우기도 _relaunchOrInstall — 끄기는 _exitNow · 설치는 기다리지 않고');
    chk((MAIN.match(/app\.relaunch\(\)/g) || []).length === 1, '  app.relaunch 는 _relaunchOrInstall 한 곳에만(재시작 판단이 흩어지지 않게)');
    chk(/autoUpdater\.on\('update-downloaded', \(info\) => \{ _updateDownloaded = true; sendUpdateStatus\('downloaded'/.test(MAIN), '  받기가 끝나면 받음 표시를 세운다(재시작 판단이 읽는다)');
    chk(/app\.on\('before-quit', \(e\) => \{ if\(_quitHold\.beforeQuit\(e\)\) return; [^\n]*try \{ _updateRecheck\.stop\(\); \} catch \(_\) \{\} try \{ _flushLauncherPos\(\); \} catch \(_\) \{\} \}\);/.test(MAIN), '  before-quit — 붙잡기가 끝난 진짜 끄기에서 다시 확인을 멈춘다');
    chk(/autoUpdater\.autoInstallOnAppQuit = _updatePlatform\.installOnQuit\(\);/.test(MAIN) && /writable: \(dir\) => installDirWritable\(\{ fs, path, dir, pid: process\.pid \}\),/.test(MAIN), '★ 끌 때 설치는 플랫폼 판단 · 바꿔 끼울 폴더에 쓸 수 있을 때만(update-platform.js installOnQuit)');
    chk(/\n  mainWindow\.on\('query-session-end', \(\) => \{ _skipInstallOnQuit\(\); \}\);\n  mainWindow\.on\('session-end', \(\) => \{ _exitNow\(\); \}\);/.test(MAIN) && !/app\.on\('(?:query-)?session-end'/.test(MAIN),
      '★ 윈도우 세션 종료는 메인 창 이벤트로 듣는다 — app 에는 session-end 가 없다(Electron 44 · 들어도 오지 않는다)');
    chk(/const bg = _updateRecheck\.fromTick\(\); if\(!bg \|\| !_bgUpdateErrLogged\) _errorLog\.write\('ERROR', '업데이트', e\); if\(bg\) _bgUpdateErrLogged = true;/.test(MAIN), '  켜 둔 동안 다시 확인의 실패는 오류 파일에 한 번만(오프라인이면 4시간마다 쌓이지 않게)');
    chk(/ipcMain\.on\('companion:installUpdate', \(\) => \{ _quitHold\.flushThen\(\(\) => autoUpdater\.quitAndInstall\(\)\); \}\)/.test(MAIN), '  [재시작] 은 그대로(저장을 기다린 뒤 quitAndInstall)');
    chk(!/autoInstallOnAppQuit = false;\s*\/\/ 사용자가 명시적으로/.test(MAIN) && (MAIN.match(/autoInstallOnAppQuit\s*=/g) || []).length === 2 && !/11-25|자동업데이트는/.test(MAIN + UR), '  옛 «autoInstallOnAppQuit=false» 줄 · 주석이 없다 · 바꾸는 곳은 설정 줄 · _skipInstallOnQuit 둘뿐');
  }

  say('── 4. mutation test');
  {
    const BUSY = 'if(BUSY.includes(last) && skips < BUSY_MAX_SKIPS){ skips++; }';
    chk(UR.includes(BUSY), 'update-recheck.js 원문이 그대로 있다(아래 변이의 바탕)');
    const st = mkRecheck(UR.replace(BUSY, 'if(BUSY.includes(last)){ skips++; }')); st.r.start(); st.r.status('available');
    await st.clock.advance(4.5 * H * 4);
    chk(st.checks.length === 0, '건너뜀 상한을 지우면 — 멈춘 받기 뒤로 영영 묻지 않는다 → 1절 «멈춘 받기» 판정이 빨강');
    const b = mkRecheck(UR.replace(BUSY, 'if(false){ skips++; }')); b.r.start(); b.r.status('downloading');
    await b.clock.advance(4.5 * H);
    chk(b.checks.length === 1, '받는 중 건너뜀을 지우면 — 받는 중에 또 묻는다 → 1절 «downloading» 판정이 빨강');
    const DL = "if(s === 'downloaded') stop();";
    const c = mkRecheck(UR.replace(DL, '')); c.r.start(); c.r.status('downloaded');
    await c.clock.advance(9 * H);
    chk(c.clock.pending() === 1 && c.checks.length === 2, '다 받은 뒤 멈춤을 지우면 — 계속 묻는다 → 1절 «멈춘다» 판정이 빨강');
    const J = 'Math.floor(frac() * jitterMs)';
    chk(UR.includes(J) && mkRecheck(UR.replace(J, '0'), () => 0.9).r.delay() === 4 * H, '늦춤을 지우면 — 모두 정확히 4시간 → 1절 «사람마다» 판정이 빨강');
    const noSkip = await scene({ how: 'exit', mainSrc: MAIN.replace('try{ _skipInstallOnQuit(); _updateRecheck.stop(); }catch(_){}', 'try{ _updateRecheck.stop(); }catch(_){}') });
    chk(noSkip.log.includes('install:silent'), '_exitNow 에서 끌 때 설치를 안 끄면 — OS 종료 중에 설치를 띄운다 → 2절 판정이 빨강');
    const SKIP_R = "  _skipInstallOnQuit();   // 다시 켜는 앱과 설치가 부딪히지 않게 — 받은 판은 다음에 끌 때\n";
    chk(MAIN.includes(SKIP_R), 'main.js _relaunchOrInstall 원문이 그대로 있다(아래 변이의 바탕)');
    const noSkipR = await scene({ how: 'relaunch', mainSrc: MAIN.replace(SKIP_R, '') });
    chk(noSkipR.log.includes('install:silent'), '윈도우 재시작에서 안 끄면 — 다시 켜는 앱과 설치가 부딪힌다 → 2절 판정이 빨강');
    const INST = '  if(_updatePlatform.relaunchAction(_updateDownloaded) === UPDATE_RELAUNCH.INSTALL){';
    chk(MAIN.includes(INST), '  main.js 재시작 갈래 원문이 그대로 있다');
    const macRel = await scene({ platform: 'darwin', how: 'relaunch', mainSrc: MAIN.replace(INST, '  if(false){') });
    chk(macRel.log.includes('relaunch') && macRel.log.includes('install:squirrel'), '맥 재시작 갈래를 지우면 — relaunch 한 앱과 Squirrel 설치가 겹친다 → 2절 «맥 계정 재시작» 이 빨강');
    const macUp = await scene({ platform: 'darwin', how: 'relaunch', upSrc: UP.replace("return isMac && downloaded === true ? RELAUNCH.INSTALL : RELAUNCH.RELAUNCH;", 'return RELAUNCH.RELAUNCH;') });
    chk(macUp.log.includes('relaunch') && macUp.log.includes('install:squirrel'), 'update-platform.js relaunchAction 이 늘 relaunch 면 — 같은 겹침 → 2절 빨강');
    const appSess = await scene({ how: 'session', mainSrc: MAIN.replace(/\n  mainWindow\.on\('query-session-end'[^\n]*\n  mainWindow\.on\('session-end'[^\n]*\n/, '\n') });
    chk(appSess.log.includes('install:silent'), '세션 종료를 창에서 듣지 않으면(옛 app.on — 오지 않음) — OS 가 끄는 중 끄기에서 설치를 띄운다 → 2절 «세션 종료» 판정이 빨강');
    const onlyEnd = await scene({ how: 'session', electronQuits: true, mainSrc: MAIN.replace("  mainWindow.on('query-session-end', () => { _skipInstallOnQuit(); });", "  mainWindow.on('query-session-end', () => {});") });
    chk(onlyEnd.log.includes('install:silent'), '묻는 단계에서 설치를 안 끄면 — session-end 전에 끄기가 오면 설치 → 2절 판정이 빨강');
    const noProbe = await scene({ perMachine: true, upSrc: UP.replace('return deps.writable(installDir()) === true;', 'return true;') });
    chk(noProbe.log.includes('install:silent'), '설치 폴더 확인을 지우면 — 모든 사용자 설치에서도 끌 때 설치(UAC 창) → 2절 «모든 사용자» 판정이 빨강');
    const accessOnly = M.installDirWritable.toString().includes('writeFileSync') && !M.installDirWritable.toString().includes('access');
    chk(accessOnly, '  installDirWritable 은 access 가 아니라 실제로 파일을 만든다(윈도우 W_OK 는 ACL 을 보지 않는다)');
    const noHold = await scene({ noHold: true });
    chk(noHold.log.includes('install:silent') && !noHold.log.includes('save-done'), '끄기를 붙잡지 않으면 — 저장이 끝나기 전에 설치된다 → 2절 «저장을 끝낸 뒤» 가 빨강');
    const noMac = await scene({ platform: 'darwin', upSrc: UP.replace("const AUTO_PLATFORMS = Object.freeze(['win32', 'darwin']);", "const AUTO_PLATFORMS = Object.freeze(['win32']);") });
    chk(noMac.cfg.backgroundRecheck === false && !noMac.log.some(x => x.startsWith('install')), '맥을 플랫폼 목록에서 빼면 — 다시 확인 · 끌 때 설치가 없다 → 2절 «맥» 판정이 빨강');
    const oldMain = await scene({ mainSrc: MAIN.replace('autoUpdater.autoInstallOnAppQuit = _updatePlatform.installOnQuit();', 'autoUpdater.autoInstallOnAppQuit = false;') });
    chk(!oldMain.log.some(x => x.startsWith('install')), '옛 설정(autoInstallOnAppQuit=false)이면 — 끌 때 설치가 없다 → 2절 ★ 판정이 빨강');
  }

  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  ✗ 예외 — ' + (e && e.stack || e)); process.exit(1); });
