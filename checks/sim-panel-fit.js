/* sim-panel-fit.js — 📐 ⚙ 설정창이 화면 위로 잘리지 않는가(shared/panel-fit.js · settings-panel.js 끌기 · status-chip.js 자동 배치)
   실행:  node sim-panel-fit.js   (panel-fit.js · settings-panel.js · status-chip.js · desk-companion-prototype.html · smoke.js 가 있는 폴더에서)
   ★ 왜 — 설정창은 아래 가운데가 기준점이라 긴 탭에서 위로 자란다. 높이를 묶지 않거나 끈 자리를 화면 안으로 맞추지 않으면
     제목줄이 화면 위로 나가 끌 수도 닫을 수도 없다(앱 안 화면이라 ALT+SPACE 도 안 먹는다).
   ・1절: fitBottomCenter 를 실제로 — 안에 있으면 그대로 · 위 · 아래 · 좌우 · 화면보다 큰 창 · 경계
   ・2절: settings-panel.js 의 끌기 · 다시 맞추기 글을 꺼내 가짜 창에서 — 위로 끌어도 제목줄이 화면 안 · 탭이 길어지면 다시 맞춤 · 끌지 않았으면 손대지 않음
   ・3절: 배선(높이 상한 css · 안쪽 스크롤 · 자동 배치가 같은 함수 · 싣는 순서 · smoke) · 4절: 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('panel-fit.js') || read('shared/panel-fit.js'), SP = read('settings-panel.js') || read('launcher/settings-panel.js'),
  SC = read('status-chip.js') || read('status/status-chip.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !SP || !SC || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — panel-fit.js · settings-panel.js · status-chip.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwPanelFit; };

function fitCheck(P){
  const r = {}, f = P.fitBottomCenter, eq = (a, x, y) => a.x === x && a.y === y;
  r.inside = eq(f(500, 600, 300, 400, 1920, 1080, 8), 500, 600);
  r.top = eq(f(500, 100, 300, 400, 1920, 1080, 8), 500, 408);           // 위로 나가면 제목줄(위 끝)이 8px 안으로
  r.bottom = eq(f(500, 2000, 300, 400, 1920, 1080, 8), 500, 1072);
  r.sides = eq(f(-50, 600, 300, 400, 1920, 1080, 8), 158, 600) && eq(f(5000, 600, 300, 400, 1920, 1080, 8), 1762, 600);
  r.tall = eq(f(500, 600, 300, 1200, 1920, 1080, 8), 500, 1208);        // 화면보다 크면 위(제목줄)를 살린다
  r.wide = f(500, 600, 2000, 400, 1920, 1080, 8).x === 960;
  r.edge = eq(f(158, 408, 300, 400, 1920, 1080, 8), 158, 408) && eq(f(500, 600, 300, 400, 1920, 1080, 0), 500, 600);
  return r;
}

/* settings-panel.js 의 끌기 묶음(bindFsPanelDrag)을 꺼내 가짜 창 · 문서에서 돌린다 */
function dragCheck(spSrc, P){
  const r = {};
  const a = spSrc.indexOf('(function bindFsPanelDrag(){'), b = spSrc.indexOf('\n  })();', a);
  if (a < 0 || b < 0) return r;
  const body = spSrc.slice(a, b + '\n  })();'.length);
  const L = {}, docL = {}, winL = {}, obs = [];
  const panel = { offsetWidth: 300, offsetHeight: 400, style: { left: '960px', top: '700px' }, _on: true,
    classList: { contains: (c) => c === 'on' && panel._on },
    querySelector: () => bar };
  const bar = { style: {}, addEventListener: (t, fn) => { L[t] = fn; } };
  const document = { addEventListener: (t, fn) => { docL[t] = fn; } };
  const window = { _fsPanelDragged: false, addEventListener: (t, fn) => { winL[t] = fn; } };
  function ResizeObserver(fn){ return { observe(){ obs.push(fn); } }; }
  new Function('panel', 'document', 'window', 'innerWidth', 'innerHeight', 'ResizeObserver', 'TwPanelFit', body)(panel, document, window, 1920, 1080, ResizeObserver, P);
  const ev = (x, y) => ({ clientX: x, clientY: y, target: { closest: () => null }, preventDefault(){} });
  const pos = () => [parseFloat(panel.style.left), parseFloat(panel.style.top)];
  // 끌기 전 — 크기가 바뀌어도 손대지 않는다(자동 배치가 맡는다)
  panel.style.top = '100px'; obs.forEach(fn => fn());
  r.untouched = pos()[1] === 100;
  panel.style.top = '700px';
  L.pointerdown(ev(960, 320)); docL.pointermove(ev(960, -200)); docL.pointerup();   // 제목줄을 잡고 화면 위로 끌어 올림
  r.dragTop = window._fsPanelDragged === true && pos()[1] - panel.offsetHeight >= 8;
  docL.pointermove(ev(960, 900));
  r.afterUp = pos()[1] === 408;                                                      // 놓은 뒤엔 안 따라온다
  panel.offsetHeight = 900; obs.forEach(fn => fn());                                // 긴 탭으로 바꿈 — 위로 자람
  r.refit = pos()[1] - 900 >= 8 && pos()[1] <= 1080 - 8;
  panel.offsetHeight = 400; panel.style.top = '200px'; panel._on = false; obs.forEach(fn => fn());
  r.closedSkip = pos()[1] === 200;                                                   // 닫힌 창은 안 맞춘다
  panel._on = true; winL.resize && winL.resize();
  r.resize = pos()[1] === 408;
  return r;
}

const P = load(MOD);
say('\n── 1절: fitBottomCenter');
const f1 = fitCheck(P);
chk(f1.inside, '화면 안이면 그대로');
chk(f1.top, '위로 나가면 창 위 끝(제목줄)이 가장자리 8px 안으로');
chk(f1.bottom, '아래로 나가면 아래 끝이 8px 안으로');
chk(f1.sides, '왼쪽 · 오른쪽도 안으로');
chk(f1.tall, '화면보다 큰 창은 위(제목줄)를 살린다');
chk(f1.wide, '화면보다 넓은 창은 가운데');
chk(f1.edge, '경계 — 딱 맞으면 그대로 · 여유 0');
chk(Object.isFrozen(P) && Object.keys(P).join() === 'fitBottomCenter', '내놓는 것은 fitBottomCenter 하나(얼린 객체)');

say('\n── 2절: settings-panel.js 끌기 · 다시 맞추기');
const d1 = dragCheck(SP, P);
chk(d1.untouched, '끌기 전엔 크기가 바뀌어도 손대지 않는다(머리 위 자동 배치가 맡는다)');
chk(d1.dragTop, '제목줄을 화면 위로 끌어도 창 위 끝이 화면 안');
chk(d1.afterUp, '  놓은 뒤에는 따라오지 않는다');
chk(d1.refit, '끈 뒤 긴 탭으로 바꿔 창이 위로 자라도 다시 화면 안으로');
chk(d1.closedSkip, '  닫힌 창은 맞추지 않는다');
chk(d1.resize, '  화면 크기가 바뀌어도 다시 맞춘다');

say('\n── 3절: 배선');
chk(/#focusSettingsPanel\{[^}]*max-height:calc\(100vh - 16px\);/.test(HTML) && /#focusSettingsPanel\.on\{display:flex;flex-direction:column;\}/.test(HTML),
  'css — 설정창 높이는 화면 안(100vh - 16px) · 열리면 세로 묶음');
chk(/#focusSettingsPanel \.fs-titlebar\{flex:none;\}/.test(HTML) && /#focusSettingsPanel \.fs-body\{[^}]*min-height:0;overflow-y:auto;/.test(HTML),
  '  제목줄은 줄지 않고 넘치는 내용은 .fs-body 안에서 스크롤');
chk(/TwPanelFit\.fitBottomCenter\(cx, cy,/.test(SC) && !/Math\.max\(panelH \+ EDGE/.test(SC), 'status-chip.js 머리 위 자동 배치도 같은 함수(옛 손 계산 없음)');
const iF = HTML.indexOf('<script src="parts/shared/panel-fit.js"></script>'), iS = HTML.indexOf('<script src="parts/launcher/settings-panel.js"></script>'),
  iC = HTML.indexOf('<script src="parts/status/status-chip.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
chk(iF > 0 && iF < iS && iF < iC && iF < iA, '싣는 순서 — panel-fit.js 가 settings-panel.js · status-chip.js · app.js 보다 먼저');
chk(SMOKE.indexOf("PRELOAD.push('panel-fit.js');") > 0 && SMOKE.indexOf("PRELOAD.push('panel-fit.js');") < SMOKE.indexOf("PRELOAD.push('settings-panel.js');"), 'smoke PRELOAD 에 panel-fit.js(settings-panel.js 앞)');

say('\n── 4절: 깨 보기');
const b1 = fitCheck(load(MOD.replace('const minY = h + e, maxY = vh - e;', 'const minY = e, maxY = vh - e;')));
chk(!b1.top && !b1.tall, '창 높이를 안 빼면(아래 끝만 화면 안) 1절 «위로 나가면» 이 빨강');
const b2 = dragCheck(SP.replace('fitTo(e.clientX-offX, e.clientY-offY);', "panel.style.left=(e.clientX-offX)+'px'; panel.style.top=(e.clientY-offY)+'px';"), P);
chk(b2.dragTop === false, '끈 자리를 그대로 두면(옛 동작) 2절 «화면 위로 끌어도» 가 빨강');
const b3 = dragCheck(SP.replace('new ResizeObserver(refit).observe(panel);', ''), P);
chk(b3.refit === false, '크기 바뀜을 안 보면 2절 «긴 탭으로 바꿔도» 가 빨강');

say(`\n결과: ${pass}·${fail}`);
process.exit(fail ? 1 : 0);
