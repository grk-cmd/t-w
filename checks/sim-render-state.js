/* sim-render-state.js — 🎚️ 실행 화면 그리기 상태(launcher/render-state.js — 화질 · «자동» 낮춤 · 도트 렌더)
   실행:  node sim-render-state.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 셋은 app.js 맨 위 let 이었다(app.js 분리 F6 에서 옮김). 좌석 카메라 · 프레임 한 장 · 1분 진단 줄이 읽고,
     프로그램 설정 · 프레임 상한 · 설정 패널이 바꾼다. 처음 값이 옛 let 과 같아야 화면이 그대로고(화질은 antialias 까지 정한다),
     app.js 가 다시 let 을 두거나 읽는 함수 대신 값을 넘기면(만들 때 한 번 읽은 값에 굳음) 바꿔도 안 먹는다.
   ・1절: 처음 값 — 저장된 화질(없으면 FrameBudget 기본) · 낮춤 false · 도트는 저장값 '1' 일 때만 켬 · 읽는 · 쓰는 함수 짝
   ・2절: 배선 — html · smoke 에서 frame-budget.js 뒤 · 읽는 모듈 · app.js 앞 · app.js 는 무대보다 먼저 만들고 let 이 없으며
          읽는 쪽에는 ()=>renderStateMod.이름() · 쓰는 쪽에는 (v)=>{ renderStateMod.set이름(v); } 를 넘긴다
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('launcher/render-state.js'), FB = read('shared/frame-budget.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !FB || !APP || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — render-state.js · frame-budget.js · app.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const fbWin = {}; new Function('window', 'module', FB)(fbWin, undefined);
const FrameBudget = fbWin.FrameBudget;

/* 저장값(store)을 깐 localStorage 로 모듈을 싣고 만든다 */
function build(mod, store) {
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const win = {};
  new Function('window', 'localStorage', 'FrameBudget', 'module', mod)(win, ls, FrameBudget, undefined);
  return win.TwRenderState.createRenderState();
}
/* 읽는 쪽 · 쓰는 쪽에 넘기는 모양 — 키 → 넘기는 글 */
const READS = { dotRenderEnabled: 'dotRenderEnabled', renderQuality: 'renderQuality', _renderQuality: 'renderQuality', runLowered: 'runLowered', _runLowered: 'runLowered' };
const WRITES = { setDotRenderEnabled: 'setDotRenderEnabled', setRenderQuality: 'setRenderQuality', setRunLowered: 'setRunLowered' };
function judge(mod, app, html, smoke) {
  const r = {};
  try {
    const Q = FrameBudget.QUALITY;
    const a = build(mod, {});
    r.def = a.renderQuality() === FrameBudget.qualityFrom(null) && a.runLowered() === false && a.dotRenderEnabled() === false;
    const saved = Object.values(Q).find((q) => q !== FrameBudget.qualityFrom(null));
    const b = build(mod, { [FrameBudget.QUALITY_KEY]: saved, 'tw.dotRender': '1' });
    r.saved = b.renderQuality() === saved && b.dotRenderEnabled() === true;
    r.dotOther = build(mod, { 'tw.dotRender': 'true' }).dotRenderEnabled() === false && build(mod, { 'tw.dotRender': '0' }).dotRenderEnabled() === false;
    r.junkQ = build(mod, { [FrameBudget.QUALITY_KEY]: 'zzz' }).renderQuality() === FrameBudget.qualityFrom('zzz');
    b.setRenderQuality(Q.AUTO); b.setRunLowered(true); b.setDotRenderEnabled(false);
    r.set = b.renderQuality() === Q.AUTO && b.runLowered() === true && b.dotRenderEnabled() === false;
    const c = build(mod, {}); r.own = c.runLowered() === false;   // 만들 때마다 따로(한 벌을 같이 쓰지 않는다)
    r.keys = Object.keys(b).sort().join() === ['dotRenderEnabled', 'renderQuality', 'runLowered', 'setDotRenderEnabled', 'setRenderQuality', 'setRunLowered'].join();
  } catch (e) { r.err = String(e && e.message || e); }
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((m) => m[1]);
  const at = order.indexOf('launcher/render-state.js');
  r.html = at > order.indexOf('shared/frame-budget.js') && order.indexOf('shared/frame-budget.js') >= 0
    && ['room/seat-camera.js', 'launcher/frame-loop.js', 'launcher/run-diag-minute.js', 'launcher/frame-pace.js', 'launcher/program-settings.js', 'launcher/settings-panel.js', 'app.js'].every((f) => order.indexOf(f) > at);
  r.smoke = /PRELOAD\.push\('render-state\.js'\);/.test(smoke);
  const A = strip(app);
  const made = A.indexOf('const renderStateMod = TwRenderState.createRenderState();');
  r.made = made >= 0 && made < A.indexOf('const _renderAA = FrameBudget.antialiasFor(renderStateMod.renderQuality());') && made < A.indexOf('const stageMod = ');
  r.noLet = !/^let (_renderQuality|_runLowered|dotRenderEnabled)\b/m.test(A) && !/[^.\w$](_renderQuality|_runLowered|dotRenderEnabled)\s*=[^=>]/.test(A);
  const bad = [];
  for (const m of A.matchAll(/^  ([\w$]+): (.*renderStateMod.*),$/gm)) {
    const [, k, v] = m;
    if (READS[k] && v === '()=>renderStateMod.' + READS[k] + '()') continue;
    if (WRITES[k] && v === '(v)=>{ renderStateMod.' + WRITES[k] + '(v); }') continue;
    bad.push(k + '=' + v);
  }
  r.shape = bad;
  r.uses = (A.match(/renderStateMod\./g) || []).length;
  return r;
}

const R = judge(MOD, APP, HTML, SMOKE);
say('── 1. 처음 값 · 읽는 함수 · 쓰는 함수');
chk(!R.err && R.def, '저장값이 없으면 화질은 FrameBudget 기본 · 낮춤 false · 도트 꺼짐' + (R.err ? ' — ' + R.err : ''));
chk(R.saved && R.junkQ, '  저장된 화질 · 도트(\'1\')를 읽는다 · 모르는 화질 글자는 FrameBudget.qualityFrom 이 정한 값');
chk(R.dotOther, '  도트는 \'1\' 일 때만 켬(\'true\' · \'0\' 은 꺼짐 — 옛 let 과 같은 판정)');
chk(R.set && R.own, '  쓰는 함수로 바꾸면 읽는 함수가 새 값을 본다 · 만들 때마다 따로');
chk(R.keys, '  내놓는 이름 여섯(읽는 함수 셋 · 쓰는 함수 셋)');
say('── 2. 배선');
chk(R.html && R.smoke, 'html — frame-budget.js 뒤 · 읽는 · 바꾸는 모듈과 app.js 앞 · smoke PRELOAD 에 한 줄');
chk(R.made, 'app.js — 무대(antialias)보다 먼저 만들고 그 화질로 _renderAA 를 정한다');
chk(R.noLet, '  app.js 에 옛 let 셋이 없고 직접 대입도 없다');
chk(!R.shape.length && R.uses >= 10, '  읽는 쪽은 ()=>renderStateMod.이름() · 쓰는 쪽은 (v)=>{ renderStateMod.set이름(v); } (' + R.uses + '곳)' + (R.shape.length ? ' — 어긋남: ' + R.shape.join(' · ') : ''));

say('── 3. 일부러 깨 보기');
chk(!judge(MOD.replace("(localStorage.getItem('tw.dotRender')==='1')", "!!localStorage.getItem('tw.dotRender')"), APP, HTML, SMOKE).dotOther, '도트 판정을 «아무 값이나 켬» 으로 바꾸면 빨강');
chk(!judge(MOD.replace('let _runLowered = false;', 'let _runLowered = true;'), APP, HTML, SMOKE).def, '낮춤 처음 값이 true 면 빨강');
chk(!judge(MOD.replace('setRunLowered: (v)=>{ _runLowered = v; },', 'setRunLowered: (v)=>{ },'), APP, HTML, SMOKE).set, '쓰는 함수가 값을 안 바꾸면 빨강');
chk(judge(MOD, APP.replace('  renderQuality: ()=>renderStateMod.renderQuality(),', '  renderQuality: renderStateMod.renderQuality(),'), HTML, SMOKE).shape.length > 0, '읽는 함수를 부른 값(만들 때 굳은 값)을 넘기면 빨강');
chk(!judge(MOD, 'let dotRenderEnabled = false;\n' + APP, HTML, SMOKE).noLet, 'app.js 에 옛 let 을 되살리면 빨강');
const late = HTML.replace('<script src="parts/launcher/render-state.js"></script>', '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n<script src="parts/launcher/render-state.js"></script>');
chk(late !== HTML && !judge(MOD, APP, late, SMOKE).html, 'render-state.js 를 app.js 뒤로 옮기면 빨강');
const afterStage = APP.replace('const renderStateMod = TwRenderState.createRenderState();\n', '').replace('const stageMod = ', 'const renderStateMod = TwRenderState.createRenderState();\nconst stageMod = ');
chk(afterStage !== APP && !judge(MOD, afterStage, HTML, SMOKE).made, '무대보다 뒤에서 만들면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 그리기 상태는 render-state.js 한 곳'));
process.exit(fail ? 1 : 0);
