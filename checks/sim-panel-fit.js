/* sim-panel-fit.js — 📐 ⚙ 설정창이 화면 위로 잘리지 않는가(shared/panel-fit.js · settings-panel.js 끌기 · status-chip.js 자동 배치)
   실행:  node sim-panel-fit.js   (panel-fit.js · settings-panel.js · status-chip.js · desk-companion-prototype.html · smoke.js 가 있는 폴더에서)
   ★ 왜 — 설정창은 위 가운데가 기준점이라 긴 탭에서 아래로 자란다(위 끝 고정). 높이를 묶지 않거나 끈 자리를 화면 안으로 맞추지 않으면
     창이 화면 밖으로 나가 제목줄을 끌 수도 닫을 수도 없다(앱 안 화면이라 ALT+SPACE 도 안 먹는다).
   ・1절: fitTopCenter 를 실제로 — 안에 있으면 그대로 · 위 · 아래 · 좌우 · 화면보다 큰 창 · 경계 · 길어져도 위 끝 그대로
   ・2절: settings-panel.js 의 끌기 · 다시 맞추기 글을 꺼내 가짜 창에서 — 위로 끌어도 제목줄이 화면 안 · 탭이 길어지면 다시 맞춤 · 끌지 않았으면 손대지 않음
   ・3절: 배선(높이 상한 css · 안쪽 스크롤 · 자동 배치가 같은 함수 · 싣는 순서 · smoke) · 4절: mutation test */
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
  const r = {}, f = P.fitTopCenter, eq = (a, x, y) => a.x === x && a.y === y;
  r.inside = eq(f(500, 200, 300, 400, 1920, 1080, 8), 500, 200);
  r.top = eq(f(500, -100, 300, 400, 1920, 1080, 8), 500, 8);             // 위로 나가면 위 끝(제목줄)이 8px 안으로
  r.bottom = eq(f(500, 900, 300, 400, 1920, 1080, 8), 500, 672);         // 아래로 나가면 아래 끝이 8px 안으로(위로 그만큼만 올림)
  r.sides = eq(f(-50, 200, 300, 400, 1920, 1080, 8), 158, 200) && eq(f(5000, 200, 300, 400, 1920, 1080, 8), 1762, 200);
  r.tall = eq(f(500, 300, 300, 1200, 1920, 1080, 8), 500, 8);           // 화면보다 크면 위(제목줄)를 살린다
  r.wide = f(500, 200, 2000, 400, 1920, 1080, 8).x === 960;
  r.edge = eq(f(158, 672, 300, 400, 1920, 1080, 8), 158, 672) && eq(f(500, 200, 300, 400, 1920, 1080, 0), 500, 200);
  r.grow = eq(f(500, 200, 300, 400, 1920, 1080, 8), 500, 200) && eq(f(500, 200, 300, 800, 1920, 1080, 8), 500, 200);   // 길어져도 위는 그대로
  return r;
}

/* settings-panel.js 의 끌기 묶음(bindFsPanelDrag)을 꺼내 가짜 창 · 문서에서 돌린다 */
function dragCheck(spSrc, P){
  const r = {};
  const a = spSrc.indexOf('  function fitPanel('), b = spSrc.indexOf('\n  })();', spSrc.indexOf('(function bindFsPanelDrag(){'));
  if (a < 0 || b < 0) return r;
  const body = spSrc.slice(a, b + '\n  })();'.length);
  const L = {}, docL = {}, winL = {}, obs = [];
  const panel = { offsetWidth: 300, offsetHeight: 400, style: { left: '960px', top: '300px' }, _on: true, _launcher: false,
    classList: { contains: (c) => (c === 'on' && panel._on) || (c === 'fs-in-launcher' && panel._launcher) },
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
  panel.style.top = '300px';
  L.pointerdown(ev(960, 310)); docL.pointermove(ev(960, -200)); docL.pointerup();   // 제목줄을 잡고 화면 위로 끌어 올림
  r.dragTop = window._fsPanelDragged === true && pos()[1] >= 8;
  docL.pointermove(ev(960, 900));
  r.afterUp = pos()[1] === 8;                                                        // 놓은 뒤엔 안 따라온다
  panel.style.top = '200px'; panel.offsetHeight = 600; obs.forEach(fn => fn());      // 긴 탭으로 바꿈 — 아래로 자람
  r.grow = pos()[1] === 200;                                                         // ★ 위 끝은 그대로
  panel.offsetHeight = 1000; obs.forEach(fn => fn());
  r.refit = pos()[1] + 1000 <= 1080 - 8 && pos()[1] >= 8;                            // 아래가 화면 밖이면 그만큼만 올림
  panel.offsetHeight = 400; panel.style.top = '200px'; panel._on = false; obs.forEach(fn => fn());
  r.closedSkip = pos()[1] === 200;                                                   // 닫힌 창은 안 맞춘다
  panel._on = true; panel.style.top = '900px'; winL.resize && winL.resize();
  r.resize = pos()[1] === 672;
  // 런처 — 가운데 고정(끌기 없음)이지만 탭을 바꿔도 위 끝은 그대로 · 화면 밖이면 안으로
  window._fsPanelDragged = false; panel._launcher = true; panel.style.top = '340px'; panel.offsetHeight = 700; obs.forEach(fn => fn());
  r.launcherGrow = pos()[1] === 340 && pos()[0] === 960;
  panel.offsetHeight = 900; obs.forEach(fn => fn());
  r.launcherFit = pos()[1] === 172;
  return r;
}

const P = load(MOD);
say('\n── 1절: fitTopCenter(위 가운데 기준 — ⚙ 설정창)');
const f1 = fitCheck(P);
chk(f1.inside, '화면 안이면 그대로');
chk(f1.top, '위로 나가면 창 위 끝(제목줄)이 가장자리 8px 안으로');
chk(f1.bottom, '아래로 나가면 아래 끝이 8px 안으로');
chk(f1.sides, '왼쪽 · 오른쪽도 안으로');
chk(f1.tall, '화면보다 큰 창은 위(제목줄)를 살린다');
chk(f1.wide, '화면보다 넓은 창은 가운데');
chk(f1.edge, '경계 — 딱 맞으면 그대로 · 여유 0');
chk(f1.grow, '★ 창이 길어져도 화면 안이면 위 끝은 그대로(아래로 자란다)');
chk(Object.isFrozen(P) && Object.keys(P).join() === 'fitTopCenter,fitTopLeft', '내놓는 것은 fitTopCenter · fitTopLeft(얼린 객체)');
say('\n── 1-2절: fitTopLeft(왼쪽 위 기준 창 — 크리스마스 창 끌기)');
function topLeftRows(P){
  const r = [], t = (ok, m) => r.push([!!ok, m]), f = P.fitTopLeft, eq = (a, x, y) => a && a.x === x && a.y === y;
  t(eq(f(100, 100, 640, 560, 1130, 920, 0), 100, 100), '화면 안이면 그대로');
  t(eq(f(100, 900, 640, 560, 1130, 920, 0), 100, 360), '★ 아래로 끌면 아래 끝이 화면 끝에서 멈춘다(창 아래가 잘리지 않음)');
  t(eq(f(900, 100, 640, 560, 1130, 920, 0), 490, 100) && eq(f(-300, -50, 640, 560, 1130, 920, 0), 0, 0), '  오른쪽 · 왼쪽 · 위도 화면 안');
  t(eq(f(100, 100, 640, 560, 600, 500, 0), 0, 0), '화면보다 큰 창은 왼쪽 위(제목줄)를 살린다');
  t(eq(f(490, 360, 640, 560, 1130, 920, 0), 490, 360) && eq(f(500, 400, 640, 560, 1130, 920, 8), 482, 352), '경계 · 여유(edge)');
  return r;
}
topLeftRows(P).forEach(([ok, m]) => chk(ok, m));
for (const [name, m] of [
  ['아래로 막지 않음', MOD.replace('y: Math.max(e, Math.min(maxY, y))', 'y: Math.max(e, y)')],
  ['큰 창에서 제목줄을 안 살림(min 이 나중)', MOD.replace('y: Math.max(e, Math.min(maxY, y))', 'y: Math.min(maxY, Math.max(e, y))')],
]) { let red = 99; try { red = topLeftRows(load(m)).filter(([ok]) => !ok).length; } catch (_) {} chk(m !== MOD && red > 0, '  mutation test — ' + name + ' → 빨강'); }

say('\n── 2절: settings-panel.js 끌기 · 다시 맞추기');
const d1 = dragCheck(SP, P);
chk(d1.untouched, '끌기 전엔 크기가 바뀌어도 손대지 않는다(머리 위 자동 배치가 맡는다)');
chk(d1.dragTop, '제목줄을 화면 위로 끌어도 창 위 끝이 화면 안');
chk(d1.afterUp, '  놓은 뒤에는 따라오지 않는다');
chk(d1.grow, '★ 끈 뒤 긴 탭으로 바꾸면 위 끝은 그대로 · 아래로 자란다');
chk(d1.refit, '  아래가 화면 밖이면 그만큼만 올린다');
chk(d1.closedSkip, '  닫힌 창은 맞추지 않는다');
chk(d1.resize, '  화면 크기가 바뀌어도 다시 맞춘다');
chk(d1.launcherGrow && d1.launcherFit, '★ 런처(가운데) — 탭을 바꿔도 위 끝은 그대로 · 화면 밖이면 안으로');

say('\n── 3절: 배선');
chk(/#focusSettingsPanel\{[^}]*max-height:calc\(100vh - 16px\);/.test(HTML) && /#focusSettingsPanel\.on\{display:flex;flex-direction:column;\}/.test(HTML),
  'css — 설정창 높이는 화면 안(100vh - 16px) · 열리면 세로 묶음');
chk(/#focusSettingsPanel \.fs-titlebar\{flex:none;\}/.test(HTML) && /#focusSettingsPanel \.fs-body\{[^}]*min-height:0;overflow-y:auto;/.test(HTML),
  '  제목줄은 줄지 않고 넘치는 내용은 .fs-body 안에서 스크롤');
chk(/TwPanelFit\.fitTopCenter\(cx, cy - openH,/.test(SC) && /const openH = parseFloat\(panel\.dataset\.openH\)/.test(SC) && !/Math\.max\(panelH \+ EDGE/.test(SC), 'status-chip.js 머리 위 자동 배치도 같은 함수 · 위 끝 = 머리 - 연 때 높이(탭을 바꿔도 위는 그대로)');
chk(/panel\.dataset\.openH = String\(panel\.offsetHeight\);\s*if\(inLauncher\) fitPanel\(innerWidth\/2, \(innerHeight - panel\.offsetHeight\) \/ 2\);/.test(SP), 'settings-panel.js — 열 때 높이를 적고 · 런처면 가운데로');
chk(/#focusSettingsPanel\{position:fixed;z-index:var\(--z-win-settings\);transform:translate\(-50%,0\);/.test(HTML) && /#focusSettingsPanel\.fs-in-launcher\{left:50% !important;transform:translate\(-50%,0\) !important;\}/.test(HTML), 'css — 설정창 기준점은 위 가운데(실행 화면 · 런처 모두)');
const iF = HTML.indexOf('<script src="parts/shared/panel-fit.js"></script>'), iS = HTML.indexOf('<script src="parts/launcher/settings-panel.js"></script>'),
  iC = HTML.indexOf('<script src="parts/status/status-chip.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
chk(iF > 0 && iF < iS && iF < iC && iF < iA, '싣는 순서 — panel-fit.js 가 settings-panel.js · status-chip.js · app.js 보다 먼저');
chk(SMOKE.indexOf("PRELOAD.push('panel-fit.js');") > 0 && SMOKE.indexOf("PRELOAD.push('panel-fit.js');") < SMOKE.indexOf("PRELOAD.push('settings-panel.js');"), 'smoke PRELOAD 에 panel-fit.js(settings-panel.js 앞)');

say('\n── 4절: mutation test');
const b1 = fitCheck(load(MOD.replace('const fy = Math.max(e, Math.min(vh - h - e, y));', 'const fy = Math.max(e, Math.min(vh - e, y));')));
chk(!b1.bottom, '창 높이를 안 빼면(위 끝만 화면 안) 1절 «아래로 나가면» 이 빨강');
const b1b = fitCheck(load(MOD.replace('const fy = Math.max(e, Math.min(vh - h - e, y));', 'const fy = Math.min(vh - h - e, Math.max(e, y));')));
chk(!b1b.tall, '  min 이 나중이면(큰 창에서 제목줄을 안 살림) «화면보다 크면» 이 빨강');
const b2 = dragCheck(SP.replace('fitTo(e.clientX-offX, e.clientY-offY);', "panel.style.left=(e.clientX-offX)+'px'; panel.style.top=(e.clientY-offY)+'px';"), P);
chk(b2.dragTop === false, '끈 자리를 그대로 두면(옛 동작) 2절 «화면 위로 끌어도» 가 빨강');
const b3 = dragCheck(SP.replace('new ResizeObserver(refit).observe(panel);', ''), P);
chk(b3.refit === false, '크기 바뀜을 안 보면 2절 «아래가 화면 밖이면» 이 빨강');
const b4 = dragCheck(SP.replace("if(!inLauncher && !window._fsPanelDragged) return;", "if(!window._fsPanelDragged) return;"), P);
chk(b4.launcherFit === false, '  런처를 빼면 «런처 — 화면 밖이면 안으로» 가 빨강');

say(`\n결과: ${pass}·${fail}`);
process.exit(fail ? 1 : 0);
