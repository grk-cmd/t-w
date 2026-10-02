/* ═══ 📐 sim-zoom-window.js — 프로그램 크기(줌)를 바꾸면 런처·생성기·마이홈 창도 같이 커진다 (개정 80 신설) ═══════════
   [제보] «프로그램 크기를 키우면 마이홈 크기는 그대로고 화면만 커진다.» 설정 창 크기(MODE_SIZE)가 DIP 고정값이라
     렌더러 줌이 안쪽 내용만 키우고 창은 그대로였다(마이홈 760px × 120% = 912 DIP > 창 800).
   ・1절: 크기를 정하는 네 자리가 _modeSize(MODE_SIZE × 줌)를 지난다 · 하한 20%
   ・2절: main.js 함수 원문(_clampZoom · _zoomStep · applyUiZoom · _modeSize · _cfgModeForZoom · _refitConfigForZoom ·
          _fitConfigRect · sizeToMode)을 가짜 창·화면 위에서 돌린다 — 줌 120% → 마이홈 창 960×696 · 다시 100% → 800×580 ·
          작업영역보다 커지면 줄인다 · 실행 화면(run)이면 창을 안 건드린다 · 줄어든 창도 같은 모드로 알아본다
   [실행] main.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
let MAIN = null; for(const p of ['main.js', path.join(__dirname, 'main.js')]){ try{ MAIN = fs.readFileSync(p, 'utf8'); break; }catch(_){} }
if(!MAIN){ say('  ? 원본 못 찾음 — main.js'); process.exit(2); }
const grab = (name) => { const i = MAIN.indexOf('function ' + name + '('); if(i < 0) return ''; let k = MAIN.indexOf('{', i), d = 0;
  for(; k < MAIN.length; k++){ if(MAIN[k] === '{') d++; else if(MAIN[k] === '}' && --d === 0) return MAIN.slice(i, k + 1); } return ''; };

say('── 1. 크기를 정하는 자리');
chk(/const UI_ZOOM_MIN = 0\.2, UI_ZOOM_MAX = 2\.0, UI_ZOOM_STEP = 0\.1;/.test(MAIN), '하한 20% · 상한 200% · 10% 단계');
chk(/const initRect = _fitConfigRect\('launcher', _modeSize\('launcher'\)/.test(MAIN), '첫 창(createWindow)');
chk(/const sz = _modeSize\(mode\);/.test(MAIN), 'setConfigMode');
chk(/const rect = _fitConfigRect\(m, _modeSize\(m\), screen\.getDisplayMatching\(b\)/.test(MAIN), '표시 설정 변경(display-metrics-changed)');
chk(/const mvc = _fitConfigRect\(curMode, _modeSize\(curMode\), target, null\);/.test(MAIN), '모니터 옮기기(moveToDisplay)');
chk(!/_fitConfigRect\([^,()]+,\s*MODE_SIZE[.\[]/.test(MAIN), 'MODE_SIZE 를 줌 없이 크기로 바로 넘기는 자리가 없다(둘째 인자)');

say('── 2. 실제로 돌려 본다');
const names = ['_clampZoom', '_zoomStep', 'applyUiZoom', '_modeSize', '_cfgModeForZoom', '_refitConfigForZoom', '_fitConfigRect', 'sizeToMode', '_sameRect'];
const src = names.map(grab);
chk(src.every(Boolean), '함수 ' + names.length + '개를 찾았다');
if(!src.every(Boolean)){ say('  · 못 찾은 함수: ' + names.filter((n, i) => !src[i]).join(', ') + ' — 2절을 건너뛴다'); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); }
const consts = (MAIN.match(/const UI_ZOOM_MIN = [\d.]+, UI_ZOOM_MAX = [\d.]+, UI_ZOOM_STEP = [\d.]+;/) || [''])[0];
const mk = (cfg, wa) => {
  const E = { bounds: Object.assign({}, cfg.bounds), sets: 0, cfg: cfg.config };
  const WA = wa || { x: 0, y: 0, width: 1920, height: 1040 };
  const win = { isDestroyed: () => false, getBounds: () => Object.assign({}, E.bounds),
    setBounds: (r) => { E.bounds = Object.assign({}, r); E.sets++; }, setResizable(){},
    webContents: { setZoomFactor(){}, send(){} } };
  const scr = { getDisplayMatching: () => ({ workArea: WA }) };
  const f = new Function('mainWindow', 'screen', 'E',
    'let uiZoom = 1; let _isConfigMode = E.cfg; const savedPos = {}; const _fittedSize = {}; const SIZE_MATCH_TOL = 3;\n'
    + 'const MODE_SIZE = { launcher:{ w:380, h:680 }, creator:{ w:740, h:620 }, animal:{ w:860, h:440 }, myhome:{ w:800, h:580 } };\n'
    + consts + '\nconst saveSettings=()=>{}; const _diagLog=()=>{}; const _noteApplied=()=>{}; let _onUiZoomChanged=null;\n'
    + src.join('\n') + '\nreturn { zoom: (op) => applyUiZoom(op, "t"), fit: _fitConfigRect, ms: _modeSize, mode: () => _cfgModeForZoom() };');
  return { api: f(win, scr, E), E };
};
let t = mk({ config: true, bounds: { x: 100, y: 50, width: 800, height: 580 } });
t.api.zoom('in'); t.api.zoom('in');
chk(t.E.bounds.width === 960 && t.E.bounds.height === 696, '마이홈 + 줌 120% → 창 960×696 (지금 ' + t.E.bounds.width + '×' + t.E.bounds.height + ')');
chk(t.E.bounds.x === 100 && t.E.bounds.y === 50, '  좌상단은 그대로');
chk(t.api.mode() === 'myhome', '  커진 창도 마이홈으로 알아본다(_fittedSize)');
t.api.zoom('reset');
chk(t.E.bounds.width === 800 && t.E.bounds.height === 580, '  초기화 → 800×580');
for(let i = 0; i < 20; i++) t.api.zoom('out');
chk(t.E.bounds.width === 160 && t.E.bounds.height === 116, '  하한 20% → 160×116');
t = mk({ config: true, bounds: { x: 0, y: 0, width: 380, height: 680 } }, { x: 0, y: 0, width: 1280, height: 680 });
t.api.zoom(1.5);
chk(t.E.bounds.width === 570 && t.E.bounds.height === 680, '런처 + 150% · 작업영역 높이 680 → 570×680 으로 줄여 맞춤');
chk(t.api.mode() === 'launcher', '  줄인 창도 런처로 알아본다');
t = mk({ config: false, bounds: { x: 0, y: 0, width: 1920, height: 1028 } });
t.api.zoom('in');
chk(t.E.sets === 0, '실행 화면(전체화면)에서는 창을 안 건드린다');
t = mk({ config: true, bounds: { x: 0, y: 0, width: 1234, height: 567 } });
t.api.zoom('in');
chk(t.E.sets === 0, '어느 모드 크기도 아닌 창이면 안 건드린다');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
