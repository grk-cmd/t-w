/* ═══ 🛞 sim-wheel-kick.js — 휠은 고착 회복 사다리를 안 탄다 (제보 3-1 · C · 2026-09-17) ═══════════════
   [무엇을 지키나] 전역 휠 이벤트가 클릭과 같은 채널(companion:globalClick)·같은 모양으로 렌더러에 갔다.
     스크롤은 마우스를 안 움직이므로 mousemove 가 3초 없는 것이 정상인데, 사다리(__mouseKick)가 그걸
     «통로가 죽었다» 로 읽고 1.5초마다 3단계(0.8초 클릭받기)를 반복했다 → 그때마다 투명 전체화면 창이 휠·클릭을
     먹는다 = «여백에 커서를 두면 뒤의 크롬이 스크롤·클릭이 안 된다». 제보자 로그: kick3 212건 중 206건이
     다른 모니터에서 크롬 스크롤 중, 나머지는 캐릭터 옆 여백에 커서 고정(1327,782)·3초 간격 셋.
   ・1절: main.js — 휠 페이로드에 wheel:true + offOverlay 가 실린다(클릭과 같은 offOverlay 계산). 실제로 돌려 본다.
   ・2절: app.js — onGlobalClick 이 wheel:true 면 __mouseKick 을 안 부른다. 활동 기록(anyInput·activity)은 그대로.
          구버전 main(필드 없음)에서는 예전처럼 탄다. 실제로 돌려 본다.
   [실행] main.js · app.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const MAIN = fs.readFileSync('main.js', 'utf8');
const SRC  = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };
/* `const name = (e) => {…};` 화살표 본문을 중괄호 짝으로 뗀다 */
function grabArrow(src, name){
  const i = src.indexOf('const ' + name + ' = (');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}' && --d === 0) return src.slice(i, k + 2);   // ';' 까지
  }
  return null;
}

/* ── 1. main.js ── */
say('── 1. main.js — 휠 페이로드에 wheel:true · offOverlay');
const fWheel = grabArrow(MAIN, '_onGlobalWheel') || '';
const fDown  = grabArrow(MAIN, '_onGlobalMouseDown') || '';
chk(!!fWheel && !!fDown, '_onGlobalWheel · _onGlobalMouseDown 을 찾았다');
chk(/wheel: true/.test(fWheel), '★ 휠 페이로드에 wheel:true 표식');
chk(/offOverlay = !_ptOnOverlayWindow\(screen\.getCursorScreenPoint\(\)\)/.test(fWheel) && /offOverlay \}/.test(fWheel), '  offOverlay 도 클릭과 같은 식으로 실린다(예전엔 휠에만 없었다 — 다른 모니터 206건의 이유)');
chk(!/wheel: true/.test(fDown), '  클릭 페이로드에는 wheel 표식이 없다(둘을 가르는 것이 이 필드다)');
chk(/send\('companion:globalClick'/.test(fWheel), '  채널은 그대로 companion:globalClick — 새 채널을 파지 않는다(구버전 preload 호환)');
if(fWheel){
  const env = { sent: [], onOverlay: true, now: 5000 };
  const run = new Function('env',
    "const mainWindow = { isDestroyed:()=>false, webContents:{ send:(ch, p)=>env.sent.push([ch, p]) } };\n" +
    "const Date = { now:()=>env.now }; const screen = { getCursorScreenPoint:()=>({x:1,y:1}) };\n" +
    "const _ptOnOverlayWindow = () => env.onOverlay; const lastActiveState = { exeName:'chrome.exe', isFocusedAppRegistered:true };\n" +
    "let _lastWheelSentAt = 0;\n" + fWheel + "\nreturn _onGlobalWheel;")(env);
  run({ x: 10, y: 20 });
  const p = env.sent[0] && env.sent[0][1];
  chk(env.sent.length === 1 && env.sent[0][0] === 'companion:globalClick' && p.wheel === true && p.offOverlay === false && p.button === 0 && p.exeName === 'chrome.exe', '① 오버레이 위 휠: {wheel:true, offOverlay:false, button:0, …활성상태}');
  env.onOverlay = false; env.now = 6000;
  run({ x: -900, y: 20 });
  chk(env.sent.length === 2 && env.sent[1][1].offOverlay === true && env.sent[1][1].wheel === true, '  다른 모니터 휠: offOverlay:true 도 같이 간다');
  env.now = 6100;
  run({ x: 1, y: 1 });
  chk(env.sent.length === 2, '  200ms 안의 연타는 예전처럼 솎아낸다(동작 변경 0)');
}

/* ── 2. app.js ── */
say('── 2. app.js — wheel:true 면 사다리를 안 부른다 · 활동 기록은 그대로 · 구버전 main 이면 예전처럼');
const a = SRC.indexOf('companion.onGlobalClick(({x,y,button,...state})=>{');
let handler = null;
if(a >= 0){
  let k = SRC.indexOf('{', SRC.indexOf('=>', a)), d = 0;
  for(; k < SRC.length; k++){ if(SRC[k] === '{') d++; else if(SRC[k] === '}' && --d === 0){ handler = SRC.slice(SRC.indexOf('(({x,y,button,...state})=>', a) + 1, k + 1); break; } }
}
chk(!!handler, 'onGlobalClick 핸들러를 뗐다');
chk(handler && /window\.__mouseKick && !\(state && state\.wheel === true\)/.test(handler), '★ wheel === true 면 __mouseKick 을 안 부른다');
chk(handler && handler.indexOf('_applyActiveAppState(state)') < handler.indexOf('if(window.__mouseKick'), '  _applyActiveAppState 가 먼저(펜 앱 게이트 순서 — 예전 결정 유지)');
chk(handler && /anyInput\(\);/.test(handler) && /activity\(\);/.test(handler), '  활동 기록(anyInput·activity)은 남아 있다 — 읽기만 하는 동안 자리비움으로 안 빠지는 원래 목적');
if(handler){
  const env = { kicks: [], any: 0, act: 0, applied: [] };
  const run = new Function('env',
    "const window = { __mouseKick:(off)=>env.kicks.push(off) }; const focusGateSleep = false;\n" +
    "const _applyActiveAppState=(s)=>env.applied.push(s); const anyInput=()=>env.any++; const activity=()=>env.act++;\n" +
    "const seats = []; const performance = { now:()=>0 };\n" +
    "return " + handler + ";")(env);
  run({ x:1, y:2, button:0, exeName:'chrome.exe', wheel:true, offOverlay:false });
  chk(env.kicks.length === 0 && env.any === 1 && env.act === 1, '① 휠(wheel:true): 사다리 0회 · 활동 1회 — 스크롤은 입력이지 고착 신호가 아니다');
  run({ x:1, y:2, button:0, exeName:'chrome.exe', wheel:true, offOverlay:true });
  chk(env.kicks.length === 0, '  다른 모니터 휠도 사다리 0회');
  run({ x:1, y:2, button:0, exeName:'chrome.exe', offOverlay:false });
  chk(env.kicks.length === 1 && env.kicks[0] === false, '② 클릭(wheel 없음): 사다리 1회 · offOverlay=false 전달 — 예전 그대로');
  run({ x:1, y:2, button:0, exeName:'chrome.exe', offOverlay:true });
  chk(env.kicks.length === 2 && env.kicks[1] === true, '  다른 모니터 클릭: 사다리는 불리되 offOverlay=true 로(사다리 안에서 건너뛴다)');
  run({ x:1, y:2, button:0, exeName:'chrome.exe' });
  chk(env.kicks.length === 3 && env.kicks[2] === undefined, '③ 구버전 main(필드 없음): 예전처럼 사다리를 부른다(undefined) — 막지 않는다');
  chk(env.applied.length === 5 && env.any === 5 && env.act === 5, '  다섯 번 다 상태 적용·활동 기록은 됐다');
}

say('');
say('sim-wheel-kick.js: ' + pass + ' 통과 · ' + fail + ' 실패' + (huhs ? ' · ' + huhs + ' 의문' : ''));
process.exitCode = fail ? 1 : 0;
