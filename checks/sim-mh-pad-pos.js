/* ═══ 🎨 sim-mh-pad-pos.js — 스티커 여백이 있어도 마이홈 창이 제자리에 있는가 (myhome/mh-pad-pos.js · main.js) ═══
   [무엇을 지키나] 스티커를 창 밖에 두면 마이홈 창이 양쪽으로 넓어진다(여백). 예전엔 창 좌상단을 기억하고 «여백이 바뀐 만큼» 만 옮겨,
     Windows 처럼 setBounds 뒤 'moved' 가 안 오면 같은 여백으로 다시 불릴 때(메뉴 누름) 옛 자리로 돌아가 마이홈이 움직였다.
   ・1절: rememberOf · placeOf 를 불러 본다 — 기억 없음 · 이상한 값 · 0 여백
   ・2절: main.js 의 _rememberPos 를 떼어 와 «창을 놓는 흐름» 을 돌린다 — 여백이 0 → 120 → 120 → 0 → 120 → 40 으로 바뀌어도
          마이홈(창 좌상단 + 여백)이 사용자가 둔 자리에 있다. 'moved' 가 오는 OS · 안 오는 OS 둘 다
          + 여백 120 · 줌 1 → 1.25 → 메뉴 누름에서 창이 튀지 않는다(_refitConfigForZoom 을 떼어 와 돌림)
   ・3절: 일부러 깨 보기 — 예전 «바뀐 만큼» 공식 · 여백 안 빼고 기억하기 · 줌 맞춤에서 여백 안 맞추기는 빨강
   [실행] node checks/run.js sim-mh-pad-pos */
'use strict';
const fs = require('fs');
const P = require('./mh-pad-pos.js');
const MAIN = fs.readFileSync('main.js', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const J = JSON.stringify;
function grabFn(src, name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}

say('── 1. 함수');
chk(J(P.rememberOf({ x: 100, y: 50 }, { x: 120, y: 30 })) === '{"x":220,"y":80}', '창 좌상단 + 얹힌 여백 = 기억할 자리');
chk(J(P.placeOf({ x: 220, y: 80 }, { x: 40, y: 0 })) === '{"x":180,"y":80}', '기억한 자리 − 놓을 여백 = 창 좌상단');
chk(P.placeOf(null, { x: 40, y: 0 }) === null, '  기억 없음(첫 열기) — null 이라 가운데에 놓인다');
chk(J(P.rememberOf({ x: 5, y: 6 }, null)) === '{"x":5,"y":6}' && J(P.placeOf({ x: 5, y: 6 }, { x: 'a' })) === '{"x":5,"y":6}', '  여백 없음 · 이상한 값은 0');

/* main.js 의 _rememberPos 를 그대로 돌린다. 마이홈을 열어 둔 채 메뉴를 누를 때마다 여백이 다시 온다 — 그때 마이홈(창 x + 여백) 자리를 모은다 */
function run(rememberSrc, place, movedFires){
  const st = { saved: {} };
  const remember = new Function('MhPadPos', 'st', 'let savedPos = st.saved, _mhPadApplied;\n' + rememberSrc
    + '\nreturn (m, b, applied) => { _mhPadApplied = applied; _rememberPos(m, b); };')(P, st);
  let win = { x: 300, y: 200 }, applied = { x: 0, y: 0 };
  remember('myhome', win, applied);                       // 사용자가 마이홈을 300,200 에 끌어 둠(여백 0)
  const spots = [];
  for(const px of [0, 120, 120, 0, 120, 40]){
    const pad = { x: px, y: px / 2 };
    const at = place(st.saved.myhome, pad, applied);      // _applyConfigMode('myhome')
    applied = pad;
    win = at;                                             // setBounds
    if(movedFires) remember('myhome', win, applied);      // macOS 는 'moved' 가 온다 · Windows 는 안 온다
    spots.push((win.x + pad.x) + ',' + (win.y + pad.y));
  }
  return spots;
}
const NEW_PLACE = (rem, pad) => P.placeOf(rem, pad);
const OLD_PLACE = (rem, pad, applied) => ({ x: rem.x - (pad.x - applied.x), y: rem.y - (pad.y - applied.y) });
const REM = grabFn(MAIN, '_rememberPos');

/* 줌을 바꾼 뒤 메뉴를 누른다 — main.js 의 _refitConfigForZoom · _rememberPos · _mhPadDip · _modeSize · _fitConfigRect 를 그대로 돌린다.
   여백 120 · 줌 1 → 1.25. 줌을 바꾸는 순간 창 좌상단은 그대로 두고, 그 뒤 메뉴를 누르면 창이 그 자리에 있어야 한다. */
const ZNAMES = ['_refitConfigForZoom', '_rememberPos', '_mhPadDip', '_modeSize', '_fitConfigRect', '_sameRect'];
function zoomFlow(src, movedFires){
  const parts = ZNAMES.map(n => grabFn(src, n));
  if(parts.some(x => !x)) return null;
  const E = { win: null, moved: movedFires };
  const api = new Function('MhPadPos', 'E',
    'let uiZoom = 1, _mhPad = { x: 120, y: 60 }, _mhPadApplied = { x: 0, y: 0 }; const savedPos = {}; const _fittedSize = {};\n'
    + 'const MODE_SIZE = { launcher:{ w:380, h:680 }, myhome:{ w:800, h:580 } };\n'
    + 'const WA = { x: 0, y: 0, width: 3840, height: 2160 }; const screen = { getDisplayMatching: () => ({ workArea: WA }) };\n'
    + 'const _noteApplied = () => {}, _diagLog = () => {};\n'
    + 'const mainWindow = { isDestroyed: () => false, getBounds: () => Object.assign({}, E.win), setResizable(){},\n'
    + '  setBounds(r){ E.win = Object.assign({}, r); if(E.moved) _rememberPos("myhome", E.win); } };\n'
    + parts.join('\n')
    + '\nreturn {\n'
    + '  open(at){ _mhPadApplied = _mhPadDip(); const sz = _modeSize("myhome"); E.win = { x: at.x, y: at.y, width: sz.w, height: sz.h }; _rememberPos("myhome", E.win); },\n'
    + '  zoom(z){ uiZoom = z; _refitConfigForZoom("myhome"); },\n'
    + '  menu(){ const padDip = _mhPadDip(); const r = _fitConfigRect("myhome", _modeSize("myhome"), screen.getDisplayMatching(), MhPadPos.placeOf(savedPos.myhome, padDip)); _mhPadApplied = padDip; mainWindow.setBounds(r); },\n'
    + '};')(P, E);
  api.open({ x: 180, y: 140 });
  api.zoom(1.25);
  const afterZoom = E.win.x + ',' + E.win.y;
  api.menu();
  return { afterZoom, afterMenu: E.win.x + ',' + E.win.y };
}
const zoomSteady = (r) => !!r && r.afterZoom === '180,140' && r.afterMenu === '180,140';

say('── 2. 창을 놓는 흐름(main.js _rememberPos)');
chk(!!REM, 'main.js 에 _rememberPos 가 있다');
const steady = (s) => s.every(v => v === '300,200');
if(REM){
  const a = run(REM, NEW_PLACE, false), b = run(REM, NEW_PLACE, true);
  chk(steady(a), "★ 'moved' 가 안 오는 OS — 여백이 바뀌어도 마이홈이 제자리 (" + a.join(' ') + ')');
  chk(steady(b), "★ 'moved' 가 오는 OS — 같은 자리 (" + b.join(' ') + ')');
  const st = { saved: {} };
  new Function('MhPadPos', 'st', 'let savedPos = st.saved, _mhPadApplied = { x: 120, y: 60 };\n' + REM + '\n_rememberPos("launcher", { x: 10, y: 20 });')(P, st);
  chk(J(st.saved.launcher) === '{"x":10,"y":20}', '  런처 · 생성기는 창 좌상단 그대로(여백은 마이홈만)');
}
/* 놓는 자리 · 기억하는 자리가 모두 이 규칙을 지나는가 — 창 자리를 직접 적는 곳은 creator(지금 창 자리 이어받기)뿐 */
chk(MAIN.includes('remembered = MhPadPos.placeOf(remembered, padDip);'), "  _applyConfigMode('myhome') 가 placeOf 로 놓는다");
const direct = (MAIN.match(/savedPos\[[^\]]+\] = \{ x:/g) || []).length;
chk(direct === 0 && (MAIN.match(/_rememberPos\(/g) || []).length >= 5, "  'moved' · 줌 · 모니터 · 표시설정이 전부 _rememberPos 로 기억한다 (직접 적는 곳 " + direct + ')');

for(const mv of [false, true]){
  const r = zoomFlow(MAIN, mv);
  chk(zoomSteady(r), "★ 여백 120 · 줌 1 → 1.25 → 메뉴 누름 — 창이 튀지 않는다(" + (mv ? "'moved' 오는 OS" : "'moved' 안 오는 OS") + ' · ' + (r ? r.afterZoom + ' → ' + r.afterMenu : '함수를 못 찾음') + ')');
}

say('── 3. 일부러 깨 보기');
if(REM){
  chk(!steady(run(REM, OLD_PLACE, false)), "예전 «바뀐 만큼» 공식 — 'moved' 가 안 오면 움직인다(빨강이어야 함)");
  const noPad = REM.replace('MhPadPos.rememberOf(b, _mhPadApplied)', '{ x: b.x, y: b.y }');
  chk(noPad !== REM && !steady(run(noPad, NEW_PLACE, true)), "여백 안 빼고 기억 — 'moved' 가 오는 OS 에서 움직인다(빨강이어야 함)");
}
{
  const SYNC = "  if(m === 'myhome') _mhPadApplied = _mhPadDip();";
  const noSync = MAIN.replace(SYNC, '');
  for(const mv of [false, true]){
    const r = noSync !== MAIN ? zoomFlow(noSync, mv) : null;
    chk(noSync !== MAIN && !!r && !zoomSteady(r), "줌 맞춤에서 여백 맞추는 줄을 빼면 메뉴를 누를 때 튄다(" + (mv ? "'moved' 오는 OS" : "안 오는 OS") + (noSync !== MAIN ? '' : ' — 바꿀 글을 못 찾음') + ')');
  }
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
