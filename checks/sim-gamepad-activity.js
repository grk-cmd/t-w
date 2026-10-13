/* sim-gamepad-activity.js — 🎮 게임패드 활동 (gamepad-activity.js · app.js 배선 · html 순서)
   실행:  node sim-gamepad-activity.js   (gamepad-activity.js · app.js · desk-companion-prototype.html 이 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 패드 신호를 너무 쉽게 세면 OS 유휴시간 때처럼 «아무것도 안 하는데 기록이 쌓인다»(스틱 떨림),
     너무 어렵게 세면 제보 그대로 «패드로 게임하면 잠든다». 그 경계(버튼 · 축 문턱 · 처음 본 패드)를 가짜 패드로 굴린다.
   ・1절: 판정 — 처음 본 패드는 기준만 · 버튼 · 트리거 · 스틱 · 떨림 무시 · 뺐다 꽂기 · getGamepads 가 던져도 안 죽음
   ・2절: app.js 배선 — 펜 활동과 같은 처리(anyInput · 포커싱 앱일 때만 activity) · 모듈 없으면 건너뜀 · html 순서 */
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
const iM = HTML.indexOf('<script src="parts/gamepad-activity.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
chk(iM > 0 && iM < iA, 'html — gamepad-activity.js 는 app.js 보다 먼저');
chk(!/USE_OS_IDLE_FOR_FOCUS = true/.test(APP), '  OS 유휴시간 보정은 여전히 꺼져 있다(되살리지 않는다)');

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 패드는 실제로 움직인 것만 활동'));
process.exit(fail ? 1 : 0);
