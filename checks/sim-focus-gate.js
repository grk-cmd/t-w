/* sim-focus-gate.js — 😴 «투게더워킹 창이 앞이면 안 잠듦» 규칙(focus-gate.js — 게이트 다음 값 · 닫혔을 때 자세)
   실행:  node sim-focus-gate.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 활성 창 처리(_applyActiveAppState)와 자세 판정(seatState)이 같은 판단을 쓴다. 두 곳에 따로 쓰면 한쪽만 고쳐 어긋난다.
     함수를 실제로 돌려 보는 것은 sim-focus-gate-self(활성 창 처리) · sim-figure-mode 4절(자세)도 한다 — 여기는 규칙 자체와 연결.
   ・1절: 순수 함수 입력 → 출력 · 경계값(isSelf 없음 · null · 딱 sleepMs) · 옛 두 식과 모든 경우가 같다 · 받은 값을 고치지 않는다
   ・2절: 연결 — html 이 app.js 보다 먼저 싣는다 · app.js 두 자리가 이 규칙을 부르고 같은 판단을 다시 쓰지 않는다
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, path.join('apps', 'desktop', 'app', 'parts', f), path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('focus/focus-gate.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html') || read(path.join('..', 'desk-companion-prototype.html'));
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — focus-gate.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const load = (src) => { const win = {}; new Function('window', 'module', src)(win, undefined); return win; };

/* 옛 두 식 — 합치기 전 app.js 그대로(동작을 바꾸지 않았는지 대 보는 기준) */
function oldGate(prev, st, figureMode, mobOn){
  const keepGate = st.isSelf === true && !st.isFocusedAppRegistered && !figureMode && !mobOn;
  return keepGate ? prev : (figureMode ? false : (mobOn ? false : (st.hasAnyRegistered ? !st.isFocusedAppRegistered : true)));
}
function oldPose(selfActive, idle, sleepMs){ return selfActive ? (idle > sleepMs ? 'sleep' : 'idle') : 'sleep'; }

function judge(mod){
  const r = {};
  try {
    const win = load(mod), G = win.TwFocusGate;
    r.only = Object.keys(win).join() === 'TwFocusGate' && Object.isFrozen(G);
    const SELF = { hasAnyRegistered: true, isFocusedAppRegistered: false, isSelf: true };
    r.self = G.selfFront(SELF) === true && G.selfFront({ ...SELF, isSelf: false }) === false
      && G.selfFront({ hasAnyRegistered: true, isFocusedAppRegistered: false }) === false            // 옛 main(isSelf 없음)
      && G.selfFront({ ...SELF, isFocusedAppRegistered: true }) === false                             // 자기를 등록함
      && G.selfFront(null) === false && G.selfFront({ ...SELF, isSelf: 1 }) === false;
    r.next = G.nextGateSleep(SELF, {}) === null
      && G.nextGateSleep(SELF, { figureMode: true }) === false && G.nextGateSleep(SELF, { mobOn: true }) === false
      && G.nextGateSleep({ hasAnyRegistered: false, isFocusedAppRegistered: false }, {}) === true
      && G.nextGateSleep({ hasAnyRegistered: true, isFocusedAppRegistered: true }, {}) === false
      && G.nextGateSleep({ hasAnyRegistered: true, isFocusedAppRegistered: false }, {}) === true;
    r.pose = G.gatedPose(true, 0, 8000) === 'idle' && G.gatedPose(true, 8000, 8000) === 'idle' && G.gatedPose(true, 8001, 8000) === 'sleep'
      && G.gatedPose(false, 0, 8000) === 'sleep';
    /* 옛 두 식과 모든 경우가 같다 — main.js 는 등록 앱이 앞이면 hasAnyRegistered 도 참이라 그 경우만 돈다 */
    let same = true, n = 0;
    for (const isSelf of [true, false, undefined]) for (const reg of [true, false]) for (const any of [true, false]) {
      if (reg && !any) continue;
      const st = { hasAnyRegistered: any, isFocusedAppRegistered: reg }; if (isSelf !== undefined) st.isSelf = isSelf;
      for (const fig of [true, false]) for (const mob of [true, false]) for (const prev of [true, false]) {
        const nx = G.nextGateSleep(st, { figureMode: fig, mobOn: mob });
        const gate = nx === null ? prev : nx;
        if (gate !== oldGate(prev, st, fig, mob)) same = false;
        if (gate) for (const idle of [0, 7999, 8000, 8001, 1e9]) {
          n++;
          if (G.gatedPose(G.selfFront(st), idle, 8000) !== oldPose(!!st.isSelf, idle, 8000)) same = false;
        }
      }
    }
    r.same = same && n > 0;
    const st = Object.freeze({ hasAnyRegistered: true, isFocusedAppRegistered: false, isSelf: true }), o = Object.freeze({ figureMode: false, mobOn: false });
    G.selfFront(st); G.nextGateSleep(st, o);
    r.pure = true;
  } catch (e) { r.err = e && e.message; }
  return r;
}

say('── 1. 규칙(실제로 돌린다)');
const R = judge(MOD);
if (R.err) chk(false, '돌리다 멈춤 — ' + R.err);
chk(R.only, 'window.TwFocusGate 하나만 걸고 얼려 둔다');
chk(R.self, 'selfFront — 투게더워킹 창이 앞일 때만 참 · isSelf 없음(옛 main) · 자기를 등록함 · null 은 거짓');
chk(R.next, 'nextGateSleep — 투게더워킹 창이면 null(직전 값) · 피규어 모드 · 폰 켜짐은 연다 · 나머지는 예전 식');
chk(R.pose, 'gatedPose — 투게더워킹 창이면 딱 sleepMs 까지 idle · 넘으면 sleep · 아니면 늘 sleep');
chk(R.same, '옛 두 식(keepGate · _selfAppActive)과 모든 경우가 같다 — 동작 무변경');
chk(R.pure, '얼린 값을 받아도 멈추지 않는다(받은 값을 고치지 않는다)');

say('── 2. 연결');
{
  const H = HTML.replace(/<!--[\s\S]*?-->/g, ' ');
  const iMod = H.indexOf('<script src="parts/focus/focus-gate.js"></script>'), iApp = H.indexOf('<script src="parts/app.js"');
  chk(iMod > 0 && iApp > iMod, 'html — focus-gate.js 를 app.js 보다 먼저 싣는다');
  const A = strip(APP);
  chk(/const focusGate = TwFocusGate;/.test(A), 'app.js — focusGate 로 받는다');
  chk(/_selfAppActive = focusGate\.selfFront\(state\);/.test(A), '  활성 창 처리가 selfFront 로 «투게더워킹 창이 앞» 을 정한다');
  chk(/const nextGate = focusGate\.nextGateSleep\(state, \{ figureMode, mobOn \}\);\s*if\(nextGate !== null\) focusGateSleep = nextGate;/.test(A), '  게이트 다음 값은 nextGateSleep(null 이면 둔다)');
  chk(/if\(desktopMode && focusGateSleep\) return focusGate\.gatedPose\(_selfAppActive, now-Math\.max\(lastActivity,lastAnyInput\), SLEEP_MS\);/.test(A), '  seatState 는 gatedPose — 마지막 입력은 lastActivity · lastAnyInput 중 늦은 것');
  chk(!/state\.isSelf/.test(A) && !/keepGate/.test(A), '  app.js 는 isSelf 를 직접 보지 않는다(같은 판단을 다시 쓰지 않음)');
}

say('── 3. 깨 보기');
{
  const broke = (from, to) => { const m = MOD.replace(from, to); return m === MOD ? null : judge(m); };
  const b1 = broke('state.isSelf === true && !state.isFocusedAppRegistered', 'state.isSelf === true');
  chk(b1 && (!b1.self || !b1.same), '자기를 등록한 경우까지 «투게더워킹 창» 으로 보면 빨강');
  const b2 = broke('if(o.figureMode || o.mobOn) return false;\n  if(selfFront(state)) return null;', 'if(selfFront(state)) return null;\n  if(o.figureMode || o.mobOn) return false;');
  chk(b2 && (!b2.next || !b2.same), '투게더워킹 창이 피규어 모드 · 폰 켜짐을 이기면 빨강');
  const b3 = broke('idleMs <= sleepMs', 'idleMs < sleepMs');
  chk(b3 && (!b3.pose || !b3.same), '경계(딱 sleepMs)에서 잠들면 빨강');
  const b4 = broke("return state.hasAnyRegistered ? !state.isFocusedAppRegistered : true;", 'return state.hasAnyRegistered ? !state.isFocusedAppRegistered : false;');
  chk(b4 && (!b4.next || !b4.same), '등록 앱이 하나도 없을 때 깨우면 빨강');
}

say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
