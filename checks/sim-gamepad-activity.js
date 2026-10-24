/* sim-gamepad-activity.js — 🎮 게임패드 활동 (gamepad-activity.js · app.js 배선 · html 순서)
   실행:  node sim-gamepad-activity.js   (gamepad-activity.js · app.js · desk-companion-prototype.html 이 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 패드 신호를 너무 쉽게 세면 OS 유휴시간 때처럼 «아무것도 안 하는데 기록이 쌓인다»(스틱 떨림),
     너무 어렵게 세면 제보 그대로 «패드로 게임하면 잠든다». 그 경계(버튼 · 축 문턱 · 처음 본 패드)를 가짜 패드로 굴린다.
   ・1절: 판정 — 처음 본 패드는 기준만 · 버튼 · 트리거 · 스틱 · 떨림 무시 · 뺐다 꽂기 · getGamepads 가 던져도 안 죽음
   ・2절: app.js 배선 — 펜 활동과 같은 처리(anyInput · 포커싱 앱일 때만 activity) · 모듈 없으면 건너뜀 · html 순서
   ・3절: 게임이 앞일 때(10-16 제보 7) — Windows 는 main 이 XInput 을 직접 읽는다. sysinput-win.js readPads 를 가짜 koffi 로
     돌려 Gamepad API 모양으로 바뀌는지 · 빈 자리를 덜 묻는지 · 못 불러오면 빈 목록인지, main 이 같은 판정 · 같은 통로로 보내는지 */
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

say('── 3. 게임이 앞일 때 — main 이 XInput 직접 읽기 (sysinput-win.js · main.js)');
const WIN = read('sysinput-win.js'), MAC = read('sysinput-mac.js'), MAIN = read('main.js');
if (!WIN || !MAC || !MAIN) { say('  ? 원본 못 찾음 — sysinput-win.js · sysinput-mac.js · main.js'); process.exit(2); }
/* sysinput-win.js 를 가짜 require 로 싣는다 — 네이티브(uiohook · window-manager)는 없는 셈, koffi 는 가짜 */
const loadWin = (koffi, logs) => {
  const mod = { exports: {} };
  const req = (n) => {
    if (n === 'path') return require('path');
    if (n === 'child_process') return { execFile() {} };
    if (n === 'koffi') { if (!koffi) throw new Error('no koffi'); return koffi; }
    if (n === './native-peek') return { peekUnpacked: () => '(검사)' };   // 네이티브가 없는 셈이라 로드 실패 한 줄에 붙는다
    throw new Error('no ' + n);
  };
  new Function('require', 'module', 'exports', 'Buffer', 'process', WIN)(req, mod, mod.exports, Buffer, process);
  mod.exports.init({ log: (m) => logs.push(m) });
  return mod.exports;
};
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
const W = loadWin(fakeKoffi, logs);
chk(typeof W.readPads === 'function', 'sysinput-win.js 가 readPads 를 내보낸다');
st[0] = { buttons: 0x1000, lt: 200, lx: 16384 };
let ps = W.readPads();
chk(protos.length === 1 && /^xinput1_4\.dll /.test(protos[0]) && /XInputGetState\(uint32_t dwUserIndex, void \*pState\)/.test(protos[0]),
  '★ xinput1_4.dll 의 XInputGetState 를 한 번만 묶는다 (' + (protos[0] || '없음') + ')');
const p0 = ps[0] || { buttons: [], axes: [] };
chk(ps.length === 1 && p0.index === 0 && p0.connected === true && p0.buttons.length === 18 && p0.axes.length === 4,
  '★ Gamepad API 모양으로 돌려준다 — 버튼 16 + 트리거 2 · 축 4 · 연결된 자리만');
chk(p0.buttons[12].pressed === true && p0.buttons[0].pressed === false, '  A 버튼(0x1000) → buttons[12]');
chk(p0.buttons[16].pressed === true && Math.abs(p0.buttons[16].value - 200 / 255) < 1e-9 && p0.buttons[17].pressed === false, '  왼 트리거 200 → 눌림 · 값 0~1');
chk(Math.abs(p0.axes[0] - 0.5) < 0.001 && p0.axes[1] === 0, '  스틱 16384 → 0.5');
calls = []; W.readPads();
chk(calls.join(',') === '0', '★ 빈 자리(1~3)는 다음 번엔 안 묻는다 — 연결 안 된 자리는 부르는 것만으로 느리다');
for (let i = 0; i < 4; i++) { calls = []; W.readPads(); }
chk(calls.join(',') === '0', '  …몇 번 쉬는 동안도 연결된 자리만');
calls = []; W.readPads();
chk(calls.join(',') === '0,1,2,3', '  쉬는 몫이 끝나면 빈 자리도 다시 묻는다(새로 꽂은 패드를 찾게)');
/* 판정까지 한 줄로 — main 과 같은 조립 */
let padHits = 0;
const gm = G.createGamepadActivity({ getPads: () => W.readPads(), onActivity: () => { padHits++; } });
gm.poll(); gm.poll();
chk(padHits === 0, '  가만히 둔 패드는 신호 없음');
st[0] = { buttons: 0x1000 | 0x2000, lt: 200, lx: 16384 }; gm.poll();
chk(padHits === 1, '★ 게임이 앞이어도 B 를 누르면 활동 — 렌더러 Gamepad API 를 거치지 않는다');
const logs2 = [];
const W2 = loadWin(null, logs2);
chk(Array.isArray(W2.readPads()) && W2.readPads().length === 0 && logs2.some(m => /koffi 로드 실패/.test(m)) && logs2.length === 1,
  '★ koffi 를 못 불러오면 빈 목록 · 기록은 한 번만(앱은 그대로)');
const logs3 = [];
const W3 = loadWin({ load: () => { throw new Error('no dll'); } }, logs3);
chk(W3.readPads().length === 0 && logs3.some(m => /XInput DLL/.test(m)), '  DLL 이 없어도 빈 목록');
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
