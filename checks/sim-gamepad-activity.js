/* sim-gamepad-activity.js — 🎮 게임패드 활동 (gamepad-activity.js · app.js 배선 · html 순서)
   실행:  node sim-gamepad-activity.js   (gamepad-activity.js · app.js · desk-companion-prototype.html 이 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 패드 신호를 너무 쉽게 세면 OS 유휴시간 때처럼 «아무것도 안 하는데 기록이 쌓인다»(스틱 떨림),
     너무 어렵게 세면 제보 그대로 «패드로 게임하면 잠든다». 그 경계(버튼 · 축 문턱 · 처음 본 패드)를 가짜 패드로 굴린다.
   ・1절: 판정 — 처음 본 패드는 기준만 · 버튼 · 트리거 · 스틱 · 떨림 무시 · 뺐다 꽂기 · getGamepads 가 던져도 안 죽음
   ・2절: app.js 배선 — 펜 활동과 같은 처리(anyInput · 포커싱 앱일 때만 activity) · 모듈 없으면 건너뜀 · html 순서
   ・3절: 게임이 앞일 때(10-16 제보 7) — Windows 는 XInput 을 직접 읽는다. 읽기 규칙(pad-xinput.js)을 가짜 koffi 로 돌려 Gamepad API 모양 ·
     빈 자리를 덜 묻는지 · 못 불러오면 빈 목록인지, 일꾼(pad-worker.js) · sysinput-win.js readPads 를 가짜 Worker 로 돌려 main 이 기다리지 않는지 ·
     일꾼이 죽으면 빈 목록 · 기록 한 번인지, 진짜 worker_threads 로 띄워 앱 종료를 붙잡지 않는지, main 이 같은 판정 · 같은 통로로 보내는지 · 설치본 목록 · 깨 보기 */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('gamepad-activity.js'), APP = _joinRenderer(read('app.js')), HTML = read('desk-companion-prototype.html');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — gamepad-activity.js · app.js · desk-companion-prototype.html'); process.exit(2); }

say('── 1. 판정');
const win = {};
new Function('window', 'module', MOD)(win, undefined);
const G = win.TwGamepadActivity;
chk(!!G && typeof G.createGamepadActivity === 'function' && G.AXIS_EPS >= 0.15 && G.POLL_MS >= 250, '싣기만 하면 window.TwGamepadActivity · 문턱(축 ' + (G && G.AXIS_EPS) + ') · 주기(' + (G && G.POLL_MS) + 'ms)');
const pad = (o) => Object.assign({ index: 0, id: 'Xbox', connected: true, buttons: Array.from({ length: 4 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }, o || {});
let pads = [], hits = 0, ticks = [];
const g = G.createGamepadActivity({ getPads: () => pads, onActivity: () => { hits++; }, setInterval: (f, ms) => { ticks.push(ms); return 1; }, clearInterval: () => {} });
pads = [pad()];
chk(g.poll() === false && hits === 0, '★ 처음 본 패드는 기준만 잡는다(꽂는 순간을 활동으로 안 센다)');
chk(g.poll() === false, '  그대로면 신호 없음');
pads = [pad({ axes: [0.04, -0.05, 0.03, 0] })];
chk(g.poll() === false && hits === 0, '★ 스틱 미세 떨림(±0.05)은 안 센다 — OS 유휴시간 때의 «안 해도 쌓임» 을 막는다');
pads = [pad({ axes: [0.6, 0, 0, 0] })];
chk(g.poll() === true && hits === 1, '★ 스틱을 기울이면 활동');
pads = [pad({ axes: [0.6, 0, 0, 0] })];
chk(g.poll() === false && hits === 1, '  기울인 채 가만히 있으면 더 안 센다(바뀐 것만)');
const b = pad({ axes: [0.6, 0, 0, 0] }); b.buttons[1] = { pressed: true, value: 1 }; pads = [b];
chk(g.poll() === true && hits === 2, '★ 버튼을 누르면 활동');
const t = pad({ axes: [0.6, 0, 0, 0] }); t.buttons[1] = { pressed: true, value: 1 }; t.buttons[3] = { pressed: false, value: 0.5 }; pads = [t];
chk(g.poll() === true && hits === 3, '  트리거(아날로그 버튼) 를 반쯤 당겨도 활동');
pads = [];
g.poll(); pads = [pad({ axes: [0.9, 0, 0, 0] })];
chk(g.poll() === false && hits === 3, '  뺐다 다시 꽂으면 기준부터(다시 꽂은 순간은 안 센다)');
pads = [null, pad({ index: 1, id: 'DS4' })];
g.poll(); pads = [null, pad({ index: 1, id: 'DS4', axes: [0, 0.8, 0, 0] })];
chk(g.poll() === true && hits === 4, '  빈 자리(null) 가 섞여도 · 두 번째 패드도 본다');
const g2 = G.createGamepadActivity({ getPads: () => { throw new Error('no'); }, onActivity: () => { hits++; }, setInterval: () => 1, clearInterval: () => {} });
chk(g2.poll() === false, '  getGamepads 가 던져도 안 죽는다');
g.start(); g.start();
chk(ticks.length === 1 && ticks[0] === G.POLL_MS, '  start 를 두 번 불러도 타이머는 하나');

say('── 2. app.js 배선 · html');
const blk = (APP.match(/if\(window\.TwGamepadActivity && navigator\.getGamepads\)\{[\s\S]*?\n  \}/) || [''])[0];
chk(!!blk && /getPads: \(\)=>navigator\.getGamepads\(\)/.test(blk) && /\.start\(\);/.test(blk), '만들고 시작한다 — 모듈 · getGamepads 가 없으면 건너뜀(구버전 · 브라우저 미리보기)');
chk(/onActivity: \(\)=>\{ anyInput\(\); if\(!focusGateSleep\) activity\(\); \}/.test(blk), '★ 처리는 펜 활동과 같다 — 자리비움 판정은 늘 · 기록은 등록한 포커싱 앱일 때만');
const pen = APP.indexOf('companion.onPenActivity(()=>{'), gp = APP.indexOf('if(window.TwGamepadActivity && navigator.getGamepads){');
chk(pen > 0 && gp > pen, '  펜 활동 수신 바로 뒤(같은 데스크탑 입력 묶음)');
const iM = HTML.indexOf('<script src="parts/focus/gamepad-activity.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
chk(iM > 0 && iM < iA, 'html — gamepad-activity.js 는 app.js 보다 먼저');
chk(!/USE_OS_IDLE_FOR_FOCUS = true/.test(APP), '  OS 유휴시간 보정은 여전히 꺼져 있다(되살리지 않는다)');

say('── 3. 게임이 앞일 때 — main 이 XInput 직접 읽기 (pad-xinput.js · pad-worker.js · sysinput-win.js · main.js)');
const WIN = read('sysinput-win.js'), MAC = read('sysinput-mac.js'), MAIN = read('main.js'), XIN = read('pad-xinput.js'), PW = read('pad-worker.js'), PKG = read('package.json');
if (!WIN || !MAC || !MAIN || !XIN || !PW || !PKG || !read('native-peek.js')) { say('  ? 원본 못 찾음 — sysinput-win.js · sysinput-mac.js · main.js · pad-xinput.js · pad-worker.js · package.json'); process.exit(2); }
const loadXin = (src) => { const m = { exports: {} }; new Function('require', 'module', 'exports', 'Buffer', src)(require, m, m.exports, Buffer); return m.exports; };
const X = loadXin(XIN);
const st = {};         // 자리 → { buttons, lt, rt, lx, ly, rx, ry }
let calls = [], protos = [];
const fakeKoffi = { load: (dll) => ({ func: (proto) => { protos.push(dll + ' ' + proto); return (slot, buf) => {
  calls.push(slot);
  const v = st[slot]; if (!v) return 1167;   // ERROR_DEVICE_NOT_CONNECTED
  buf.fill(0); buf.writeUInt16LE(v.buttons || 0, 4); buf[6] = v.lt || 0; buf[7] = v.rt || 0;
  [v.lx, v.ly, v.rx, v.ry].forEach((a, i) => buf.writeInt16LE(a || 0, 8 + i * 2));
  return 0;
}; } }) };
const logs = [];
const R = X.createXInputReader({ requireKoffi: () => fakeKoffi, log: (m) => logs.push(m) });
st[0] = { buttons: 0x1000, lt: 200, lx: 16384 };
let ps = R.read();
chk(protos.length === 1 && /^xinput1_4\.dll /.test(protos[0]) && /XInputGetState\(uint32_t dwUserIndex, void \*pState\)/.test(protos[0]),
  '★ xinput1_4.dll 의 XInputGetState 를 한 번만 묶는다 (' + (protos[0] || '없음') + ')');
const p0 = ps[0] || { buttons: [], axes: [] };
chk(ps.length === 1 && p0.index === 0 && p0.connected === true && p0.buttons.length === 18 && p0.axes.length === 4,
  '★ Gamepad API 모양으로 돌려준다 — 버튼 16 + 트리거 2 · 축 4 · 연결된 자리만');
chk(p0.buttons[12].pressed === true && p0.buttons[0].pressed === false, '  A 버튼(0x1000) → buttons[12]');
chk(p0.buttons[16].pressed === true && Math.abs(p0.buttons[16].value - 200 / 255) < 1e-9 && p0.buttons[17].pressed === false, '  왼 트리거 200 → 눌림 · 값 0~1');
chk(Math.abs(p0.axes[0] - 0.5) < 0.001 && p0.axes[1] === 0, '  스틱 16384 → 0.5');
calls = []; R.read();
chk(calls.join(',') === '0', '★ 빈 자리(1~3)는 다음 번엔 안 묻는다 — 연결 안 된 자리는 부르는 것만으로 느리다');
for (let i = 0; i < 4; i++) { calls = []; R.read(); }
chk(calls.join(',') === '0', '  …몇 번 쉬는 동안도 연결된 자리만');
calls = []; R.read();
chk(calls.join(',') === '0,1,2,3', '  쉬는 몫이 끝나면 빈 자리도 다시 묻는다(새로 꽂은 패드를 찾게)');
const logs2 = [];
const R2 = X.createXInputReader({ requireKoffi: () => { throw new Error('no koffi'); }, log: (m) => logs2.push(m) });
chk(R2.usable() === false && R2.read().length === 0 && R2.read().length === 0 && logs2.length === 1 && /koffi 로드 실패/.test(logs2[0]),
  '★ koffi 를 못 불러오면 빈 목록 · 못 씀 · 기록은 한 번만(앱은 그대로)');
const logs3 = [];
const R3 = X.createXInputReader({ requireKoffi: () => ({ load: () => { throw new Error('no dll'); } }), log: (m) => logs3.push(m) });
chk(R3.read().length === 0 && logs3.some(m => /XInput DLL/.test(m)), '  DLL 이 없어도 빈 목록');

/* 일꾼 — 가짜 parentPort 위에서 pad-worker.js 를 돌린다 */
const runWorker = (koffi) => {
  const posts = [], timers = [];
  const req = (n) => {
    if (n === 'worker_threads') return { parentPort: { postMessage: (m) => posts.push(m) } };
    if (n === './pad-xinput') return X;
    if (n === 'koffi') { if (!koffi) throw new Error('no koffi'); return koffi; }
    throw new Error('no ' + n);
  };
  new Function('require', 'setInterval', PW)(req, (f, ms) => { timers.push({ f, ms }); return 1; });
  return { posts, timers };
};
for (const k of Object.keys(st)) delete st[k];
st[1] = { buttons: 0x2000 };
const w1 = runWorker(fakeKoffi);
w1.timers.forEach(t => t.f());
chk(w1.timers.length === 1 && w1.timers[0].ms === 500 && w1.posts.length === 1 && w1.posts[0].pads.length === 1 && w1.posts[0].pads[0].index === 1,
  '★ 일꾼 — 500ms 마다 읽은 패드를 보낸다(main 활성 창 폴링과 같은 박자)');
const w2 = runWorker(null);
chk(w2.timers.length === 0 && w2.posts.length === 2 && /koffi 로드 실패/.test(w2.posts[0].log) && w2.posts[1].off === true,
  '  못 쓰는 PC — 까닭 기록 · «끝남» 을 보내고 폴링하지 않는다');

/* sysinput-win.js — 가짜 Worker 위에서 readPads 를 돌린다(네이티브 uiohook · window-manager 는 없는 셈) */
const loadWin = (WorkerCls, logs, src) => {
  const mod = { exports: {} };
  const req = (n) => {
    if (n === 'path') return require('path').win32;
    if (n === 'child_process') return { execFile() {} };
    if (n === 'worker_threads') { if (!WorkerCls) throw new Error('no worker_threads'); return { Worker: WorkerCls }; }
    if (n === 'koffi') throw new Error('main 은 koffi 를 직접 부르지 않는다');
    if (n === './native-peek') return { peekUnpacked: () => '(검사)' };
    throw new Error('no ' + n);
  };
  new Function('require', 'module', 'exports', 'Buffer', 'process', '__dirname', src || WIN)(req, mod, mod.exports, Buffer, process, 'C:\\tw\\resources\\app.asar');
  mod.exports.init({ log: (m) => logs.push(m) });
  return mod.exports;
};
const spawned = [];
class FakeWorker {
  constructor(file){ this.file = file; this.L = {}; this.unrefd = false; spawned.push(this); }
  on(t, f){ (this.L[t] = this.L[t] || []).push(f); return this; }
  unref(){ this.unrefd = true; }
  emit(t, v){ (this.L[t] || []).forEach(f => f(v)); }
}
const wlogs = [];
const W = loadWin(FakeWorker, wlogs);
const wlog0 = wlogs.length;   // 네이티브 로드 실패 줄(검사 환경엔 uiohook 이 없다)은 빼고 센다
chk(typeof W.readPads === 'function', 'sysinput-win.js 가 readPads 를 내보낸다');
const t0 = Date.now(); const first = W.readPads(); const dt = Date.now() - t0;
const wk = spawned[0];
chk(spawned.length === 1 && Array.isArray(first) && first.length === 0 && dt < 50,
  '★ 처음 부르면 일꾼을 띄우고 기다리지 않고 바로 돌아온다(아직 값 없음 → 빈 목록)');
chk(!!wk && wk.file === 'C:\\tw\\resources\\app.asar.unpacked\\pad-worker.js' && wk.unrefd,
  '  일꾼 파일은 asar 밖(app.asar.unpacked) · 앱 종료를 붙잡지 않게 unref (' + (wk && wk.file) + ')');
wk.emit('message', { pads: [{ index: 2, buttons: [], axes: [] }] });
const got = W.readPads();
chk(got.length === 1 && got[0].index === 2 && spawned.length === 1, '★ readPads 는 일꾼이 마지막으로 보낸 값 · 일꾼은 하나만');
wk.emit('message', { log: '테스트 기록' });
chk(wlogs.includes('테스트 기록'), '  일꾼 기록은 진단 기록으로 넘긴다');
/* 일꾼이 늘어져도(값을 안 보내도) readPads 는 즉시 · 같은 값 */
const t1 = Date.now(); for (let i = 0; i < 1000; i++) W.readPads(); const dt1 = Date.now() - t1;
chk(dt1 < 50 && W.readPads()[0].index === 2, '★ 일꾼이 아무리 늦어도 main 은 기다리지 않는다(1000번 ' + dt1 + 'ms)');
const nLog = wlogs.length;
wk.emit('error', new Error('죽음'));
wk.emit('exit', 1);
chk(W.readPads().length === 0 && spawned.length === 1 && wlogs.length === nLog + 1 && /게임패드 일꾼 멈춤/.test(wlogs[wlogs.length - 1]),
  '★ 일꾼이 죽으면 빈 목록 · 기록 한 번 · 다시 띄우지 않는다');
const ologs = [];
const WO = loadWin(FakeWorker, ologs);
const olog0 = ologs.length;
const spawned0 = spawned.length;
WO.readPads(); const wo = spawned[spawned0];
wo.emit('message', { log: 'koffi 로드 실패 — 게임패드 읽기 없음: x' }); wo.emit('message', { off: true }); wo.emit('exit', 0);
chk(ologs.length === olog0 + 1 && /koffi 로드 실패/.test(ologs[ologs.length - 1]) && WO.readPads().length === 0, '  패드를 못 쓰는 PC — 까닭 한 줄만(뒤따르는 종료를 «멈춤» 으로 또 적지 않는다)');
const flogs = [];
const WF = loadWin(class { constructor(){ throw new Error('못 띄움'); } }, flogs);
const flog0 = flogs.length;
chk(WF.readPads().length === 0 && WF.readPads().length === 0 && flogs.length === flog0 + 1 && /게임패드 일꾼을 못 띄움/.test(flogs[flogs.length - 1]), '  일꾼을 못 띄우면 빈 목록 · 기록 한 번');
void wlog0;
/* 판정까지 한 줄로 — main 과 같은 조립 */
let padHits = 0;
const W5 = loadWin(FakeWorker, []); W5.readPads(); const w5 = spawned[spawned.length - 1];
const gm = G.createGamepadActivity({ getPads: () => W5.readPads(), onActivity: () => { padHits++; } });
const padV = (b) => ({ index: 0, id: 'xinput', connected: true, buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: !!(b & (1 << i)), value: (b & (1 << i)) ? 1 : 0 })), axes: [0, 0, 0, 0] });
w5.emit('message', { pads: [padV(0)] }); gm.poll(); gm.poll();
chk(padHits === 0, '  가만히 둔 패드는 신호 없음');
w5.emit('message', { pads: [padV(1 << 13)] }); gm.poll();
chk(padHits === 1, '★ 게임이 앞이어도 B 를 누르면 활동 — 일꾼 값으로 같은 판정');
let pk = {}; try { pk = JSON.parse(PKG).build || {}; } catch (_) {}
chk(['pad-worker.js', 'pad-xinput.js'].every(f => (pk.files || []).includes(f) && (pk.asarUnpack || []).includes(f)) && (pk.asarUnpack || []).includes('node_modules/koffi/**/*'),
  '★ 설치본 — 일꾼 두 파일은 build.files · asarUnpack 에 (풀린 node_modules/koffi 를 찾게)');
chk(!/require\('koffi'\)/.test(WIN), '  main 쪽(sysinput-win.js)은 koffi 를 직접 싣지 않는다 — 동기 호출은 일꾼에만');
/* 진짜 worker_threads — 임시 폴더에 가짜 koffi 를 두고 sysinput-win.js · pad-worker.js 를 그대로 띄운다.
   readPads 뒤에 프로세스가 스스로 끝나야 한다(일꾼이 앱 종료를 붙잡으면 설치본이 안 꺼진다). */
const realRun = (winSrc) => {
  const os = require('os'), pth = require('path'), cp = require('child_process');
  const dir = fs.mkdtempSync(pth.join(os.tmpdir(), 'tw-pad-'));
  try {
    fs.writeFileSync(pth.join(dir, 'sysinput-win.js'), winSrc);
    fs.writeFileSync(pth.join(dir, 'pad-worker.js'), PW);
    fs.writeFileSync(pth.join(dir, 'pad-xinput.js'), XIN);
    fs.writeFileSync(pth.join(dir, 'native-peek.js'), PEEK);
    fs.mkdirSync(pth.join(dir, 'node_modules', 'koffi'), { recursive: true });
    fs.writeFileSync(pth.join(dir, 'node_modules', 'koffi', 'index.js'),
      "module.exports = { load: () => ({ func: () => (slot, buf) => { if (slot !== 0) return 1167; buf.fill(0); buf.writeUInt16LE(0x1000, 4); return 0; } }) };\n");
    fs.writeFileSync(pth.join(dir, 'c.js'),
      "const S = require('./sysinput-win.js'); S.init({ log: () => {} }); S.readPads();\n" +
      "setTimeout(() => { console.log('PADS ' + S.readPads().length); }, 800);\n");
    const r = cp.spawnSync(process.execPath, [pth.join(dir, 'c.js')], { timeout: 4000, encoding: 'utf8' });
    return { ended: r.status === 0, pads: (String(r.stdout).match(/PADS (\d+)/) || [])[1] };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const PEEK = read('native-peek.js');
const real = realRun(WIN);
chk(real.ended && real.pads === '1', '★ 진짜 일꾼 — 패드 값을 받아 오고(PADS ' + real.pads + ') readPads 뒤에도 프로세스가 스스로 끝난다(앱 종료를 붙잡지 않음)');
{
  const UNREF = "  /* 일꾼이 앱 종료를 붙잡지 않게 — ⚠️ 리스너를 다 붙인 **뒤에** 부른다('message' 리스너가 붙으면 Node 가 다시 ref 한다) */\n  _padWorker.unref();\n";
  const NEW_W = "  try{ _padWorker = new Worker(file); }\n  catch(err){ _log('게임패드 일꾼을 못 띄움: ' + (err && err.message || err)); return; }\n";
  const bad = WIN.includes(UNREF) && WIN.includes(NEW_W) ? WIN.replace(UNREF, '').replace(NEW_W, NEW_W + '  _padWorker.unref();\n') : WIN;
  const rb = bad !== WIN ? realRun(bad) : { ended: true };
  chk(bad !== WIN && rb.ended === false, '깨 보기 — unref 를 리스너 앞으로 되돌리면 프로세스가 안 끝난다 → 빨강' + (bad !== WIN ? '' : ' (바꿀 글을 못 찾음)'));
}
/* 깨 보기 — 고친 줄을 되돌리면 위 판정이 빨강인가 */
const mkSpy = (sl) => class extends FakeWorker { constructor(f){ super(f); sl.push(this); } };
const breaks = [
  ['readPads 가 일꾼을 기다림', '  return _lastPads;\n}', '  const t = Date.now(); while(Date.now() - t < 80){}\n  return _lastPads;\n}',
    (B) => { const s0 = Date.now(); B.readPads(); return Date.now() - s0 < 50; }],
  ['죽으면 다시 띄움', '  _padWorkerDone = true;\n', '',
    (B, sl) => { B.readPads(); sl[0].emit('error', new Error('x')); B.readPads(); return sl.length === 1; }],
  ['asar 안에서 실음', ".replace(/app\\.asar(?=[\\\\/])/, 'app.asar.unpacked')", '',
    (B, sl) => { B.readPads(); return /unpacked/.test(sl[0] && sl[0].file || ''); }],
];
for (const [name, a, b, ok] of breaks) {
  const src = WIN.replace(a, b);
  let r = true;
  if (src !== WIN) { try { const sl = []; r = ok(loadWin(mkSpy(sl), [], src), sl); } catch (_) { r = false; } }
  chk(src !== WIN && r === false, '깨 보기 — ' + name + ' → 빨강' + (src !== WIN ? '' : ' (바꿀 글을 못 찾음)'));
}
const expNames = (src) => ((src.match(/module\.exports\s*=\s*\{([\s\S]*?)\};/) || ['', ''])[1]).split(/[\s,]+/).filter(Boolean).sort().join(',');
chk(expNames(WIN) === expNames(MAC) && /function readPads\(\)\{ return \[\]; \}/.test(MAC), '★ sysinput-mac.js 도 같은 이름(readPads — 빈 목록) · 두 파일 export 이름이 같다');
chk(/require\('\.\/app\/parts\/focus\/gamepad-activity'\)/.test(MAIN) && /getPads: \(\) => sysinput\.readPads\(\)/.test(MAIN) && /onActivity: _reportPadActivity/.test(MAIN),
  '★ main 은 렌더러와 같은 판정 파일로 sysinput.readPads 를 본다(조건을 다시 쓰지 않음)');
const rpa = (MAIN.match(/function _reportPadActivity\(\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/_penActivitySentAt < PEN_ACTIVITY_MIN_MS/.test(rpa) && /'companion:penActivity'/.test(rpa), '  보내는 길은 커서 이동과 같은 penActivity · 간격(초당 1회)도 같이 쓴다');
const poll = (MAIN.match(/_reportCursorActivity\(screen\.getCursorScreenPoint\(\), CURSOR_MOVE_MIN_PX\);[^\n]*(\n[^\n]*){1,4}/) || [''])[0];
chk(/_padActivity\.poll\(\)/.test(poll), '  500ms 활성 창 폴링에 얹는다(새 타이머 없음)');
chk(/module\.exports = api/.test(MOD), '  gamepad-activity.js 는 main 에서도 require 된다(module.exports 유지)');

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 패드는 실제로 움직인 것만 활동'));
process.exit(fail ? 1 : 0);
