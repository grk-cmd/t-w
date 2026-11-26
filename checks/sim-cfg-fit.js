/* ═══ 📐 sim-cfg-fit.js — 런처 창이 작업영역에 맞는가 (제보 1·2 · 2026-09-15) ═══════════
   [무엇을 지키나] 런처(380×680)가 작업영역보다 클 때 잘린 채 뜨던 것.
     main.js `_fitConfigRect` 가 크기를 작업영역에 맞추고 위치를 클램프한다.
     ・1절: 그 함수를 **본문 그대로** 떼어 와 모델로 돌린다 (배율 150% 1080p · 위 작업표시줄 · 다른 모니터에 둔 기억).
     ・2절: 크기를 정하는 자리 셋(createWindow · setConfigMode · display-metrics-changed)이 전부 그 함수를 지나는가.
     ・3절: 창 모드는 받은 값 하나(_curMode)다 — main 이 크기로 모드를 되짚는 길이 없다(F2). 다시 불러오기 뒤 모드는 런처.
     ・4절: 런처 HTML 이 카드가 창보다 길 때 스크롤되는가 — 예전 align-items:center 가 위아래를 동시에 잘랐다.
     ・5절: 런처 자리를 설정 파일에 — 거르기 · 몰아 저장 · 읽기 · 첫 창.
     ・6절: 'moved' 가 어느 모드 자리로 적나 — 받은 창 모드(_configModeNow) 그대로라 배율이 다른 모니터(액정타블렛 등)로 끌어 크기가 어긋나도 런처 자리를 적는다 ·
            실행 화면이면 안 적는다 · 끌 때 창 자리를 다시 재지 않는다 · 켤 때 진단 한 줄 · mutation test.
   [실행] 원본(main.js · desk-companion-prototype.html)이 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const read = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');
const MAIN = read('main.js');
const HTML = read('desk-companion-prototype.html');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };

/* ── 함수 본문을 떼어 온다 ── */
function grabFn(src, name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return null;
}
const fitSrc  = grabFn(MAIN, '_fitConfigRect');
if(!fitSrc){
  huh('_fitConfigRect 를 못 찾음 — 개명됐다면 이 파일도 같이 고칠 것');
  say('통과 ' + pass + ' · 실패 ' + (fail + 1) + ' · 검사못함 ' + huhs);
  process.exit(1);
}

/* ── 1. 모델 ── */
say('── 1. _fitConfigRect — 작업영역보다 큰 창은 줄이고, 밖으로 나간 위치는 안으로 민다');
const MODE_SIZE = { launcher:{ w:380, h:680 }, creator:{ w:740, h:620 }, animal:{ w:860, h:440 }, myhome:{ w:800, h:580 } };
let displays = [];
const screen = {
  getDisplayMatching(r){
    // 실제 API 와 같은 뜻: 겹침이 가장 큰 디스플레이, 없으면 첫 번째
    let best = displays[0], bestA = -1;
    for(const d of displays){
      const b = d.bounds;
      const ax = Math.max(0, Math.min(r.x + r.width,  b.x + b.width)  - Math.max(r.x, b.x));
      const ay = Math.max(0, Math.min(r.y + r.height, b.y + b.height) - Math.max(r.y, b.y));
      if(ax * ay > bestA){ bestA = ax * ay; best = d; }
    }
    return best;
  },
};
const _fitConfigRect = new Function('screen', 'MODE_SIZE', fitSrc + '; return _fitConfigRect;')(screen, MODE_SIZE);
const mk = (x, y, w, h, tb) => ({ bounds:{ x, y, width:w, height:h }, workArea:{ x, y: y + (tb||0), width:w, height:h - (tb||0) } });
const inside = (r, wa) => r.x >= wa.x && r.y >= wa.y && r.x + r.width <= wa.x + wa.width && r.y + r.height <= wa.y + wa.height;

// ① 1080p 배율 150% (=1280×720 DIP) + 작업표시줄 40 → 작업영역 680. 정확히 경계.
displays = [mk(0, 0, 1280, 720, 40)]; displays[0].workArea = { x:0, y:0, width:1280, height:680 };
let r = _fitConfigRect('launcher', MODE_SIZE.launcher, displays[0], null);
chk(r.height === 680 && r.y === 0 && inside(r, displays[0].workArea), '작업영역 높이 = 창 높이 — 안 줄이고 y 는 0 (기존 동작 그대로)');

// ② 작업영역이 660 — 제보 상황. 줄여야 한다.
displays = [mk(0, 0, 1280, 720)]; displays[0].workArea = { x:0, y:0, width:1280, height:660 };
r = _fitConfigRect('launcher', MODE_SIZE.launcher, displays[0], null);
chk(r.height === 660 && r.width === 380, '★ 작업영역 660 → 높이 660 (제보 1 — 예전엔 680 그대로라 잘렸다)');
chk(r.y === 0 && inside(r, displays[0].workArea), '★ 줄인 창은 작업영역 안에 딱 들어간다 (예전엔 y = −10)');

// ③ 작업표시줄이 위에 있다 — 작업영역 원점이 (0,40). 예전 createWindow 는 (0,0) 기준이었다.
displays = [mk(0, 0, 1920, 1080, 40)];
r = _fitConfigRect('launcher', MODE_SIZE.launcher, displays[0], null);
chk(r.y >= 40 && inside(r, displays[0].workArea), '작업표시줄이 위에 있으면 그 아래에서 중앙을 잡는다');

// ④ 작업영역이 다시 커졌다 — 원래 크기로 돌아온다 (복구 코드 없이 min 만으로)
displays = [mk(0, 0, 1920, 1080, 40)];
r = _fitConfigRect('launcher', MODE_SIZE.launcher, displays[0], { x: 100, y: 100 });
chk(r.height === 680, '작업영역이 넉넉해지면 680 으로 돌아온다');

// ⑤ 기억한 자리가 작업영역 밖 — 주모니터가 바뀌어 옛 좌표가 남은 상황 (제보 2)
displays = [mk(0, 0, 1280, 720, 40)];
r = _fitConfigRect('launcher', MODE_SIZE.launcher, displays[0], { x: 1500, y: 900 });
chk(inside(r, displays[0].workArea), '★ 화면 밖 좌표(1500,900)는 작업영역 안으로 밀린다 (제보 2)');
chk(r.x === 1280 - 380 && r.y === 40, '  밀린 자리는 오른쪽·아래 끝에 맞닿는다 (중앙으로 튀지 않는다)');

// ⑥ 두 모니터 — 기억한 자리가 2번 모니터에 있으면 2번 모니터 기준으로 클램프한다 (원래 모니터로 끌어오지 않는다)
displays = [mk(0, 0, 1920, 1080, 40), mk(1920, 0, 1280, 720, 40)];
r = _fitConfigRect('launcher', MODE_SIZE.launcher, displays[0], { x: 2400, y: 500 });
chk(r.x === 2400 && inside(r, displays[1].workArea), '★ 2번 모니터에 둔 자리는 2번 모니터 안에서 맞춘다 — x 그대로 2400');
chk(r.y === 720 - 680, '  2번 모니터 작업영역(680)에 맞춰 y 만 밀린다');
chk(r.height === 680, '  2번 모니터 작업영역이 680 이면 높이는 안 줄인다');

// ⑦ 폭도 같은 규칙 — 아주 좁은 화면
displays = [mk(0, 0, 360, 800)];
r = _fitConfigRect('creator', MODE_SIZE.creator, displays[0], null);
chk(r.width === 360 && r.x === 0, '폭도 작업영역에 맞춘다 (creator 740 → 360)');

/* ── 2. 배선 ── */
say('── 2. 크기를 정하는 자리가 전부 _fitConfigRect 를 지난다');
const calls = (MAIN.match(/_fitConfigRect\(/g) || []).length - 1;   // 정의 자신 제외
chk(calls >= 3, '_fitConfigRect 호출 ' + calls + '곳 (createWindow · setConfigMode · display-metrics-changed)');
const cw = grabFn(MAIN, 'createWindow') || '';
chk(/_fitConfigRect\('launcher'/.test(cw), 'createWindow 가 첫 창을 이 함수로 잡는다');
chk(!/Math\.round\(\(width - CONFIG_WIDTH\)/.test(cw), '★ 예전 (0,0) 기준 중앙 계산이 createWindow 에 없다');
/* 창 맞추기 본문은 _applyConfigMode — IPC(companion:setConfigMode)와 렌더러가 죽었을 때 되돌리기가 같이 부른다 */
const scmBody = grabFn(MAIN, '_applyConfigMode') || '';
chk(/const cfgRect = _fitConfigRect\(/.test(scmBody), 'setConfigMode 의 cfgRect 가 이 함수에서 나온다');
chk(/ipcMain\.on\('companion:setConfigMode', \(e, isConfig, mode, extra\) => \{ _applyConfigMode\(isConfig, mode, extra\); \}\);/.test(MAIN), '  IPC 는 _applyConfigMode 를 그대로 부른다');
chk(!/const useX = remembered/.test(scmBody), '★ 예전 «remembered ? 그대로 : 중앙» 직접 계산이 setConfigMode 에 없다');
const dm = MAIN.slice(MAIN.indexOf('const _onDisplaysChanged = () => {'));   // display-metrics-changed · added · removed 가 같이 부르는 처리기
const dmBody = dm.slice(0, dm.indexOf('}, 400);'));
chk(!/if\(_isConfigMode\) return;/.test(dmBody), '★ display-metrics-changed 가 config 모드에서 그냥 return 하지 않는다 (제보 2 — 세션 중 주모니터 변경)');
chk(/if\(_isConfigMode\)\{[\s\S]*_fitConfigRect\(m,/.test(dmBody), '  config 분기가 현재 모드를 다시 맞춘다');
chk(/if\(_isConfigMode\)\{[\s\S]*_noteApplied\(rect, false\)/.test(dmBody), '  거기서도 _noteApplied 를 부른다 (빠지면 그 경로만 억제가 죽는다 — sim-overlay-gap)');
chk(/if\(_isConfigMode\)\{[\s\S]*setResizable\(true\)[\s\S]*setBounds\(rect\)[\s\S]*setResizable\(false\)/.test(dmBody), '  고정 크기 풀었다 닫는 순서가 setConfigMode 와 같다');

/* ── 3. 창 모드 한 값 ── */
say('── 3. 창 모드는 받은 값 하나 — 크기로 되짚는 길이 0');
const code = MAIN.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
chk(!/\bsizeToMode\b|\bSIZE_MATCH_TOL\b|\b_fittedSize\b/.test(code), '★ sizeToMode · 오차 · 줄인 크기 표가 main.js 에 없다(크기로 모드를 되짚던 장치 일체)');
chk(!/getBounds\(\)[\s\S]{0,160}\b(?:b|bounds)\.width\s*[=!]==/.test(code), '  getBounds 의 너비로 모드를 정하는 글이 없다');
chk((code.match(/\blet _curMode\b/g) || []).length === 1, '_curMode 는 한 곳에서 선언한다');
chk((code.match(/_curMode\s*=[^=]/g) || []).length === 2, '  값을 적는 곳은 선언과 _applyConfigMode 맨 앞 둘뿐(다른 길로 바꾸지 않는다)');
const acBody = grabFn(MAIN, '_applyConfigMode') || '';
chk(/^function _applyConfigMode\(isConfig, mode, extra\)\{\s*const prevMode = _curMode;[^\n]*\n\s*_curMode = isConfig \?/.test(acBody), '★ _applyConfigMode 가 맨 앞에서 받은 모드를 적는다(뒤의 어느 길로 일찍 나가도 기억은 끝난 뒤)');
chk(!/_ovSkipped\+\+; return;[\s\S]{0,40}_curMode =/.test(acBody), '  일찍 나가는 줄 뒤에서 모드를 적지 않는다');
const rrBody = grabFn(MAIN, '_resetWindowToLauncher') || '';
chk(/_applyConfigMode\(true, 'launcher'\)/.test(rrBody), '★ 런처로 되돌리기(다시 불러오기 전 · mac 다시 연 창)는 같은 통로로 «런처» 를 적는다(한 줄)');
const users = (code.match(/_configModeNow\(\)/g) || []).length;
chk(users >= 5, '모드를 읽는 다섯 자리(moved · 줌 · 모니터 옮기기 · 표시설정 · 생성기 진입)가 한 읽기 함수를 쓴다(' + users + ')');

/* 모드 표 — 다섯 모드 × 줌 × 작업영역보다 큼/작음 을 진짜 _applyConfigMode 로 돌린다 */
say('── 3-b. 모드 표(다섯 모드 × 줌 × 작업영역) — 진짜 _applyConfigMode 를 돌린다');
let MhP = null; for(const f of ['./mh-pad-pos.js', '../app/parts/shared/mh-pad-pos.js', '../app/parts/launcher/mh-pad-pos.js', '../app/parts/myhome/mh-pad-pos.js']){ try{ MhP = require(f); break; }catch(_){} }
const NAMES3 = ['_applyConfigMode', '_resetWindowToLauncher', '_configModeNow', '_fitConfigRect', '_modeSize', '_mhPadDip', '_mhPadOf', '_rememberPos', '_clampZoom'];
const fnsOf = (src) => NAMES3.map((n) => grabFn(src, n));
const FN = fnsOf(MAIN);
let harness = null;
if(!MhP || FN.some((x) => !x)){ huh('모드 표를 못 돌림 — ' + (!MhP ? 'mh-pad-pos.js ' : '') + ['_applyConfigMode', '_resetWindowToLauncher', '_configModeNow', '_fitConfigRect', '_modeSize', '_mhPadDip', '_mhPadOf', '_rememberPos', '_clampZoom'].filter((n, i) => !FN[i]).join(',')); fail++; }
else{
  harness = (wa, zoom, FNx) => {
    FNx = FNx || FN;
    const W = { x: 300, y: 200, width: 380, height: 680, res: false, top: false }; const log = [];
    const D = { workArea: wa, workAreaSize: { width: wa.width, height: wa.height } };
    const f = new Function('MhPadPos', 'W', 'D', 'log', 'zoom',
      'let uiZoom = zoom, _mhPad = { x: 0, y: 0 }, _mhPadApplied = { x: 0, y: 0 }, _isConfigMode = true, _ovSkipped = 0, _curMode = "launcher", _lastIgnoreRequested = true, _sysPromptFront = false;\n'
      + 'const MH_PAD_MAX = 400; const savedPos = {}; const UI_ZOOM_MIN = 0.2, UI_ZOOM_MAX = 2.0;\n'
      + 'const _winDrag = { on: false, active(){ return this.on; }, cancel(){ this.on = false; } };   /* 수동 창 끌기(win-drag.js) 자리 — 3-c 가 켠다 */\n'
      + 'const MODE_SIZE = { launcher:{ w:380, h:680 }, creator:{ w:740, h:620 }, animal:{ w:860, h:440 }, myhome:{ w:800, h:580 } };\n'
      + 'const screen = { getDisplayMatching: () => D, getDisplayNearestPoint: () => D }; const getRunDisplay = () => D;\n'
      + 'const _runRectOf = (d) => ({ x: d.workArea.x, y: d.workArea.y, width: d.workArea.width, height: d.workArea.height });   /* 실행 사각형(run-rect.js) — 이 표는 작업영역 그대로로 본다 */\n'
      + 'const overlay = { runOverlayHeight: (h) => h, logGeometry(){} }; const _setRunTop = () => {}; const _noteApplied = () => {}; const _reapplyIgnoreMouse = () => {}; const _diagLog = (m) => log.push(m); const _saveLauncherPosSoon = () => {};\n'
      + 'const _winAlreadyIs = (r) => W.x === r.x && W.y === r.y && W.width === r.width && W.height === r.height;\n'
      + 'const mainWindow = { isDestroyed: () => false, getBounds: () => ({ x: W.x, y: W.y, width: W.width, height: W.height }), isResizable: () => W.res, setResizable(v){ W.res = v; }, setAlwaysOnTop(){}, setBounds(r){ Object.assign(W, r); } };\n'
      + FNx.join('\n') + '\nreturn { apply: (c, m, e) => _applyConfigMode(c, m, e), reset: () => _resetWindowToLauncher(\'다시 불러오기 전\'), mode: () => _curMode, now: () => _configModeNow(), size: (m) => _modeSize(m), savedPos, drag: _winDrag };')(MhP, W, D, log, zoom);
    return { W, f, log };
  };
  const MODES = ['launcher', 'creator', 'animal', 'myhome'];
  for(const zoom of [1, 1.5]){
    for(const [label, wa] of [['넉넉한 작업영역', { x: 0, y: 0, width: 3840, height: 2160 }], ['창보다 작은 작업영역', { x: 0, y: 0, width: 700, height: 560 }]]){
      const h = harness(wa, zoom); const bad = [];
      for(const m of MODES){
        h.f.apply(true, m, m === 'myhome' ? { x: 0, y: 0 } : undefined);
        const sz = h.f.size(m); const wantW = Math.min(sz.w, wa.width), wantH = Math.min(sz.h, wa.height);
        if(h.f.mode() !== m || h.f.now() !== m) bad.push(m + ' 모드 기억');
        if(h.W.width !== wantW || h.W.height !== wantH) bad.push(m + ' 크기 ' + h.W.width + '×' + h.W.height + ' ≠ ' + wantW + '×' + wantH);
        if(h.W.x < wa.x || h.W.y < wa.y || h.W.x + h.W.width > wa.x + wa.width || h.W.y + h.W.height > wa.y + wa.height) bad.push(m + ' 작업영역 밖');
      }
      h.f.apply(false, 'run');
      if(h.f.mode() !== 'run' || h.f.now() !== null) bad.push('run 모드 기억');
      if(h.W.width !== wa.width || h.W.height !== wa.height) bad.push('run 크기 ' + h.W.width + '×' + h.W.height);
      chk(bad.length === 0, '줌 ' + zoom + ' · ' + label + ' — 다섯 모드를 오가며 받은 모드가 곧 현재 모드 · 크기는 작업영역 안' + (bad.length ? ' — ' + bad.join(' / ') : ''));
    }
  }
  /* 작은 모니터: 실행 화면 크기가 런처 크기와 같아도 실행 화면은 실행 화면이다(크기로 되짚던 때의 오판) */
  { const wa = { x: 0, y: 0, width: 380, height: 680 }; const h = harness(wa, 1);
    h.f.apply(false, 'run');
    chk(h.f.mode() === 'run' && h.f.now() === null, '★ 실행 화면 크기가 런처 크기와 같은 작은 모니터 — 그래도 run(옛: 런처로 읽음)'); }
  /* 생성기로 들어올 때 — config 에서 오면 그 자리, run 에서 오면 중앙 */
  { const wa = { x: 0, y: 0, width: 3840, height: 2160 }; let h = harness(wa, 1);
    h.f.apply(true, 'launcher'); h.W.x = 111; h.W.y = 77; h.f.apply(true, 'creator');
    chk(h.W.x === 111 && h.W.y === 77, '런처 → 생성기: 창이 있던 자리를 이어받는다');
    h = harness(wa, 1); h.f.apply(false, 'run'); h.f.apply(true, 'creator');
    chk(h.W.x === Math.round((3840 - 740) / 2) && h.W.y === Math.round((2160 - 620) / 2), '실행 화면 → 생성기: 그 모니터 중앙'); }
  /* 다시 불러오기 — 실행 화면에서 화면이 다시 불러와지면 창은 런처 */
  { const wa = { x: 0, y: 0, width: 1920, height: 1040 }; const h = harness(wa, 1);
    h.f.apply(false, 'run'); h.f.reset();
    chk(h.f.mode() === 'launcher' && h.W.width === 380 && h.W.height === 680, '★ 실행 화면에서 다시 불러오기 → 모드 launcher · 창 380×680(_resetWindowToLauncher)');
    h.f.apply(true, 'myhome', { x: 0, y: 0 }); h.f.reset();
    chk(h.f.mode() === 'launcher', '  마이홈에서도 launcher'); }
  /* 같은 요청을 되풀이해도(이미 그 상태라 일찍 나가도) 모드는 적혀 있다 */
  { const wa = { x: 0, y: 0, width: 3840, height: 2160 }; const h = harness(wa, 1);
    h.f.apply(true, 'launcher'); h.f.apply(true, 'launcher');
    chk(h.f.mode() === 'launcher', '같은 요청 되풀이 뒤에도 모드 그대로'); }
  /* 🖱 수동 창 끌기(win-drag.js) 도중 — 같은 모드의 요청은 창을 건드리지 않고, 모드가 바뀌거나 런처로 되돌릴 때는 끌기를 놓고 맞춘다(B-1122-2) */
  { const wa = { x: 0, y: 0, width: 3840, height: 2160 };
    const dragCase = (FNx) => {
      const r = {};
      let h = harness(wa, 1, FNx); h.f.apply(true, 'launcher'); const home = h.W.x;
      h.W.x = 900; h.f.drag.on = true; h.f.apply(true, 'launcher');
      r.sameSkip = h.W.x === 900 && h.f.drag.on === true;
      h.f.drag.on = false; h.f.apply(true, 'launcher');
      r.afterDrag = h.W.x === home;                       // 끌기가 없으면 예전처럼 맞춘다(위 건너뛰기가 끌기 때문임을 보인다)
      h = harness(wa, 1, FNx); h.f.apply(true, 'launcher'); h.f.drag.on = true; h.f.apply(true, 'myhome', { x: 0, y: 0 });
      r.modeChange = h.f.drag.on === false && h.W.width === 800 && h.W.height === 580;
      h = harness(wa, 1, FNx); h.f.apply(true, 'launcher'); h.f.drag.on = true; h.f.apply(false, 'run');
      r.toRun = h.f.drag.on === false && h.W.width === wa.width;
      h = harness(wa, 1, FNx); h.f.apply(false, 'run'); h.f.drag.on = true; h.f.reset();
      r.resetRun = h.f.drag.on === false && h.W.width === 380 && h.W.height === 680;
      h = harness(wa, 1, FNx); h.f.apply(true, 'launcher'); h.W.x = 900; h.W.width = 2000; h.f.drag.on = true; h.f.reset();
      r.resetSame = h.f.drag.on === false && h.W.width === 380;
      return r;
    };
    const d = dragCase();
    chk(d.sameSkip && d.afterDrag, '★ 끄는 동안 같은 모드의 setConfigMode 는 창을 건드리지 않는다(끌기가 없으면 예전처럼 맞춤)');
    chk(d.modeChange && d.toRun, '★ 끄는 도중 모드가 바뀌면(마이홈 · 실행 화면) 끌기를 놓고 새 모드 창으로 맞춘다');
    chk(d.resetRun && d.resetSame, '★ 끄는 도중 렌더러가 죽어 런처로 되돌릴 때 — 끌기를 놓고 런처 크기로(같은 모드였어도)');
    const cut = (a, b) => { const m = MAIN.replace(a, b || ''); return m === MAIN ? null : dragCase(fnsOf(m)); };
    const m1 = cut('    if(_winDrag.active()) return;\n');
    chk(!!m1 && m1.sameSkip === false, '  mutation test — 건너뛰기를 빼면 끄는 동안 창을 되돌린다 → 빨강');
    const m2 = cut('  if(_curMode !== prevMode) _winDrag.cancel();\n');
    chk(!!m2 && m2.modeChange === false, '  mutation test — 모드가 바뀔 때 끌기를 안 놓으면 새 모드 창이 안 걸린다 → 빨강');
    const m3 = cut('  _winDrag.cancel();   // 렌더러가 죽으면 뗌 신호가 안 온다 — 끌기가 남으면 아래 되돌리기가 창을 못 건드린다\n');
    chk(!!m3 && m3.resetSame === false && m3.resetRun === true, '  mutation test — 되돌리기에서 끌기를 안 놓으면 같은 모드일 때 창이 그대로 남는다 → 빨강'); }
}

/* mutation test — 하나라도 못 잡으면 빨강 */
say('── 3-c. mutation test(모드 한 값)');
if(MhP && harness){
  const mutate = (from, to) => { const m = MAIN.replace(from, to); return m === MAIN ? null : m; };
  const m1 = mutate("  const prevMode = _curMode;", "  const prevMode = 'run';");
  chk(!!m1 && (() => { const h = harness({ x: 0, y: 0, width: 3840, height: 2160 }, 1, fnsOf(m1)); h.f.apply(true, 'launcher'); h.W.x = 111; h.W.y = 77; h.f.apply(true, 'creator'); return h.W.x !== 111; })(), '생성기 진입이 직전 모드를 안 보면 빨강');
  const m2 = mutate("  _isConfigMode = !!isConfig;", "  _isConfigMode = !!isConfig; _curMode = 'launcher';");
  chk(!!m2 && (() => { const h = harness({ x: 0, y: 0, width: 3840, height: 2160 }, 1, fnsOf(m2)); h.f.apply(true, 'myhome', { x: 0, y: 0 }); return h.f.mode() !== 'myhome'; })(), '받은 모드를 덮어쓰면 빨강');
  const m3 = mutate("  if(!mainWindow || mainWindow.isDestroyed()) return;\n  _applyConfigMode(true, 'launcher');\n  _lastIgnoreRequested = false;", "  if(!mainWindow || mainWindow.isDestroyed()) return;\n  _lastIgnoreRequested = false;");
  chk(!!m3 && (() => { const h = harness({ x: 0, y: 0, width: 1920, height: 1040 }, 1, fnsOf(m3)); h.f.apply(false, 'run'); h.f.reset(); return h.f.mode() !== 'launcher'; })(), '다시 불러오기가 런처로 안 되돌리면 빨강');
}

/* ── 4. 런처 HTML ── */
say('── 4. 런처 HTML — 창이 카드보다 짧으면 스크롤된다');
const lRule = /^\s*#launcher\{([^}]*)\}/m.exec(HTML);   // 앞에 셀렉터가 붙은 덮어쓰기 규칙(body.desktop #launcher)이 아니라 본 규칙
const cRule = /^\s*\.lc-card\{([^}]*)\}/m.exec(HTML);
chk(!!lRule && !/align-items\s*:\s*center/.test(lRule[1]), '★ #launcher 에 align-items:center 가 없다 (있으면 넘치는 카드를 위아래 동시에 자른다)');
chk(!!lRule && /overflow-y\s*:\s*auto/.test(lRule[1]), '#launcher 가 세로 스크롤을 허용한다');
chk(!!cRule && /margin\s*:\s*auto/.test(cRule[1]), '.lc-card 가 margin:auto 로 센터링한다 (자리가 남으면 중앙, 넘치면 위부터)');
chk(!!cRule && /flex\s*:\s*none/.test(cRule[1]), '.lc-card 가 flex:none — 카드가 창 높이에 눌려 찌그러지지 않는다');

/* ── 5. 런처 자리 기억(launcherPos) ── */
say('── 5. 런처 자리를 다음 실행에도 — 저장 · 읽기 · 첫 창');
const posSrc = grabFn(MAIN, '_launcherPosOf'), remSrc = grabFn(MAIN, '_rememberPos');
if(!posSrc || !remSrc){ huh('_launcherPosOf / _rememberPos 를 못 찾음'); }
else{
  const mkPos = (src) => new Function('LAUNCHER_POS_MAX', src + '\nreturn _launcherPosOf;')(100000);
  const P = mkPos(posSrc), eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  chk(eq(P({ x: 120, y: -40 }), { x: 120, y: -40 }) && eq(P({ x: 10.6, y: 3.2 }), { x: 11, y: 3 }), '좌표 둘이면 정수로 받는다(음수 — 왼쪽 · 위 모니터 — 포함)');
  chk([null, undefined, 5, 'a', {}, { x: 1 }, { x: '1', y: 2 }, { x: NaN, y: 0 }, { x: Infinity, y: 0 }, { x: 0, y: 100001 }].every(v => P(v) === null),
    '  모양이 틀린 값 · 숫자 아님 · NaN · 무한 · 상한(100000) 넘음은 null — 손으로 고친 설정 파일');
  chk(eq(P({ x: 100000, y: -100000 }), { x: 100000, y: -100000 }), '  경계 — 상한 그대로는 받는다');
  /* _rememberPos → 몰아서 저장 — 맥은 끄는 내내 'moved' 가 온다. 실제 함수들을 가짜 타이머 위에서 돌린다 */
  const soonSrc = grabFn(MAIN, '_saveLauncherPosSoon'), flushSrc = grabFn(MAIN, '_flushLauncherPos');
  const mkStage = (rSrc, fSrc) => {
    const st = { saved: [], timers: new Map(), id: 0, sp: { launcher: null, creator: null } };
    const env = new Function('savedPos', 'MhPadPos', '_mhPadApplied', '__save', 'setTimeout', 'clearTimeout', 'LAUNCHER_POS_SAVE_MS', '_diagLog',
      'let _launcherPosSaveT = null, _launcherPosSaved = null;\n'
      + 'const saveSettings = () => { __save(); _launcherPosSaved = savedPos.launcher ? { x: savedPos.launcher.x, y: savedPos.launcher.y } : null; return true; };\n'   // 진짜 saveSettings 처럼 성공하면 파일 자리를 맞춘다
      + soonSrc + '\n' + fSrc + '\n' + rSrc + '\nreturn { rem: _rememberPos, flush: _flushLauncherPos, save: saveSettings };')(
      st.sp, { rememberOf: (b) => ({ x: b.x, y: b.y }) }, {}, () => { st.saved.push(JSON.stringify(st.sp.launcher)); return true; },
      (fn) => { const i = ++st.id; st.timers.set(i, fn); return i; }, (i) => { st.timers.delete(i); }, 400, (m) => { (st.logs = st.logs || []).push(m); });
    st.fire = () => { const fs2 = [...st.timers.values()]; st.timers.clear(); fs2.forEach(f => f()); };
    return Object.assign(st, env);
  };
  if(!soonSrc || !flushSrc) huh('_saveLauncherPosSoon / _flushLauncherPos 를 못 찾음');
  else{
    const S = mkStage(remSrc, flushSrc);
    for(let i = 0; i < 30; i++) S.rem('launcher', { x: 100 + i, y: 200 });   // 맥 — 끄는 동안 30 번
    S.rem('creator', { x: 1, y: 2 });
    chk(S.saved.length === 0, '★ 끄는 동안(30 번 이동)은 아직 안 쓴다');
    S.fire();
    chk(S.saved.length === 1 && S.saved[0] === '{"x":129,"y":200}', '  멈추면 마지막 자리 한 번만 쓴다 · 생성기 이동은 저장하지 않는다');
    S.rem('launcher', { x: 129, y: 200 }); S.fire();
    chk(S.saved.length === 1, '  같은 자리면 다시 쓰지 않는다');
    S.rem('launcher', { x: 5, y: 6 }); S.flush();
    chk(S.saved.length === 2 && S.saved[1] === '{"x":5,"y":6}' && S.timers.size === 0, '  끌 때(flush) 몰아 두던 것을 바로 쓰고 타이머를 치운다');
    chk((S.logs || []).length === 2 && S.logs[1] === '[창] 런처 자리 저장 5,6', '  쓸 때마다 진단 한 줄(«[창] 런처 자리 저장 x,y») — 같은 자리라 안 쓴 때는 안 남긴다');
    const B = mkStage(remSrc.replace('_saveLauncherPosSoon();', 'saveSettings();'), flushSrc);
    for(let i = 0; i < 30; i++) B.rem('launcher', { x: 100 + i, y: 200 });
    chk(B.saved.length > 1, '  mutation test — 옮길 때마다 바로 쓰면 위 «아직 안 쓴다» 가 빨강(' + B.saved.length + ' 번)');
    /* 다른 저장(줌 · 모니터 고르기)이 파일에 새 자리를 먼저 쓴 뒤 런처가 옛 자리로 돌아와도 그 자리를 쓴다 */
    const C = mkStage(remSrc, flushSrc);
    C.rem('launcher', { x: 1, y: 1 }); C.fire();              // 파일 = (1,1)
    C.rem('launcher', { x: 2, y: 2 }); C.save();              // 몰아 두는 사이 줌 · 모니터 고르기가 저장 → 파일 = (2,2)
    C.rem('launcher', { x: 1, y: 1 }); C.fire();              // 런처가 (1,1) 로 돌아옴
    chk(C.saved.length === 3 && C.saved[2] === '{"x":1,"y":1}', '  파일 자리 기록은 저장마다 맞춘다 — 옛 자리로 돌아와도 건너뛰지 않는다');
    const sv = grabFn(MAIN, 'saveSettings') || '';
    chk(/_launcherPosSaved = savedPos\.launcher \?/.test(sv), '  saveSettings 가 성공하면 파일 자리 기록을 맞춘다(어느 저장이든)');
  }
  const exitSrc = grabFn(MAIN, '_exitNow') || '';
  chk(exitSrc.indexOf('_flushLauncherPos()') > exitSrc.indexOf('stopGlobalHooks') && exitSrc.indexOf('_flushLauncherPos()') < exitSrc.indexOf('_destroyAllWindows()'),
    '  _exitNow 는 훅 · 타이머를 내린 뒤 · 창을 닫기 전에 쓴다(종료 순서)');
  chk(/_flushLauncherPos\(\)/.test(exitSrc) && /app\.on\('before-quit', \(e\) => \{ if\(_quitHold\.beforeQuit\(e\)\) return; try \{ sysinput\.stopGlobalHooks\(\); \}[^\n]*try \{ _flushLauncherPos\(\); \} catch \(_\) \{\} \}\);/.test(MAIN), '끄는 두 길(_exitNow · before-quit) 모두 남은 런처 자리를 쓴다');
  const load = MAIN.slice(MAIN.indexOf('function loadSettings(){'), MAIN.indexOf('function saveSettings(){'));
  chk(/savedPos\.launcher = _launcherPosOf\(data\.launcherPos\);/.test(load), '설정 파일을 읽을 때 launcherPos 를 그 함수로 거른다');
  chk(/launcherPos: savedPos\.launcher,/.test(grabFn(MAIN, 'saveSettings') || ''), '  저장할 때 launcherPos 를 같이 적는다');
  chk(/_fitConfigRect\('launcher', _modeSize\('launcher'\), primaryDisplay, savedPos\.launcher\)/.test(grabFn(MAIN, 'createWindow') || ''), '첫 창은 기억한 자리로 — _fitConfigRect 가 그 자리의 모니터 작업영역 안으로 당긴다(1절)');
  const broke = mkPos(posSrc.replace('Math.abs(n) <= LAUNCHER_POS_MAX', 'true'));
  chk(broke({ x: 0, y: 100001 }) !== null, '  mutation test — 상한 검사를 빼면 위 «모양이 틀린 값»(상한 넘음)이 빨강');
}

/* ── 6. 'moved' 가 어느 모드 자리로 적나 ── */
say("── 6. 'moved' — 받은 창 모드(_curMode) 그대로 자리를 적는다(크기로 되짚지 않는다 — 배율이 다른 모니터로 끌어도 런처 자리)");
const cmnSrc = grabFn(MAIN, '_configModeNow');
if(!cmnSrc){ huh('_configModeNow 를 못 찾음'); fail++; }
else{
  const nowOf = (src, mode) => new Function('_curMode', src + '\nreturn _configModeNow();')(mode);
  chk(['launcher', 'creator', 'animal', 'myhome'].every(m => nowOf(cmnSrc, m) === m) && nowOf(cmnSrc, 'run') === null, '런처 · 생성기 · 동물 · 마이홈이면 그 모드 · 실행 화면이면 null(적지 않는다)');
  chk(nowOf(cmnSrc.replace("_curMode === 'run' ? null : _curMode", '_curMode'), 'run') === 'run', '  mutation test — 실행 화면을 거르지 않으면 빨강(전체화면 자리가 런처 자리로 적힌다)');
}
/* 배선 */
/* 끌 때 창 자리를 다시 재지 않는다 — 액정타블렛을 꺼 둔 채 켜면 런처가 주 모니터로 당겨져 뜨는데, 끌 때 그 자리로 덮으면
   타블렛을 다시 켜도 주 모니터에서 뜬다. 끌 때는 남은 자리만 쓴다 */
/* 끄는 두 길을 실제로 돌린다 — 부르는 함수는 main.js 에서 그 이름의 함수를 꺼내 같은 무대에서 돌린다(도움 함수를 거쳐도 잡는다) */
const runQuit = (src) => {
  const st = { reads: 0, saved: 0, err: [] };
  const win = { isDestroyed: () => false, isMinimized: () => false, destroy(){}, getBounds(){ st.reads++; return { x: 50, y: 60, width: 380, height: 680 }; } };
  const mocks = { mainWindow: win, savedPos: { launcher: { x: 1, y: 1 }, creator: null }, _isConfigMode: true, _curMode: 'launcher',
    sysinput: { stopGlobalHooks(){} }, _cursorWatchTimer: null, _resTimer: null, _pollTimer: null, _lagTimer: null, clearInterval(){}, clearTimeout(){},
    BrowserWindow: { getAllWindows: () => [win] }, app: { exit(){}, on(ev, fn){ if(ev === 'before-quit') st.bq = fn; } },
    _quitHold: { beforeQuit: () => false },   /* 끄기 전 저장 기다리기는 sim-leave-flush 가 본다 — 여기선 붙잡지 않은 끄기 */
    _launcherPosSaveT: null, _launcherPosSaved: { x: 1, y: 1 }, saveSettings(){ st.saved++; return true; }, _diagLog(){}, LAUNCHER_POS_MAX: 100000 };
  const cache = {};
  const scope = new Proxy(mocks, {
    has: (t, k) => typeof k === 'string' && (k in t || !!grabFn(src, k)),
    get: (t, k) => {
      if(k === Symbol.unscopables) return undefined;
      if(k in t) return t[k];
      if(!cache[k]) cache[k] = new Function('__s', 'with(__s){ return (' + grabFn(src, k) + '); }')(scope);
      return cache[k];
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const sp0 = JSON.stringify(mocks.savedPos.launcher);
  try{ scope._exitNow(); }catch(e){ st.err.push('exit ' + e.message); }
  const bq = src.indexOf("app.on('before-quit'");
  try{ new Function('__s', 'with(__s){ ' + src.slice(bq, src.indexOf('\n', bq)) + '\n}')(scope); st.bq({ preventDefault(){} }); }catch(e){ st.err.push('bq ' + e.message); }
  st.kept = JSON.stringify(mocks.savedPos.launcher) === sp0;
  return st;
};
const Q0 = runQuit(MAIN);
chk(!Q0.err.length && Q0.reads === 0 && Q0.kept && Q0.saved === 0, '끌 때(_exitNow · before-quit 를 실제로 돌림)는 창 자리를 다시 재지 않고 기억한 런처 자리도 그대로 — 타블렛을 꺼 둔 날 당겨진 자리로 덮지 않게' + (Q0.err.length ? ' — ' + Q0.err.join(' · ') : ''));
const helper = "function _remQ(){ const b = mainWindow.getBounds(); savedPos.launcher = { x: b.x, y: b.y }; }\n";
const QB1 = runQuit(helper + MAIN.replace('try{ _flushLauncherPos(); }catch(_){}', 'try{ _remQ(); _flushLauncherPos(); }catch(_){}'));
const QB2 = runQuit(helper + MAIN.replace("try { _flushLauncherPos(); } catch (_) {} });", "try { _remQ(); _flushLauncherPos(); } catch (_) {} });"));
chk(QB1.reads > 0 && !QB1.kept && QB2.reads > 0 && !QB2.kept, '  mutation test — 끄는 두 길 어디든 도움 함수를 거쳐 창 자리를 다시 재면 빨강(_exitNow ' + QB1.reads + ' · before-quit ' + QB2.reads + ')');
const acm = grabFn(MAIN, '_applyConfigMode') || '';
chk(acm.indexOf('_curMode = ') > 0 && acm.indexOf('_curMode = ') < acm.indexOf('_fitConfigRect(') && acm.indexOf('_curMode = ') < acm.indexOf('setBounds('),
  '_applyConfigMode 가 창을 맞추기 전에 모드를 건다(맥은 setBounds 중에도 \'moved\' 가 온다)');
const movedOn = MAIN.slice(MAIN.indexOf("mainWindow.on('moved'"), MAIN.indexOf("mainWindow.on('moved'") + 300);
chk(/const m = _configModeNow\(\);/.test(movedOn) && !/sizeToMode|getBounds\(\)[^\n]*Mode/.test(movedOn.replace(/const b = mainWindow\.getBounds\(\);/, '')), "'moved' 는 받은 모드(_configModeNow)로 정한다(크기로 짐작하지 않는다)");
chk(/_diagLog\('\[창\] 런처 자리 — '/.test(grabFn(MAIN, 'createWindow') || ''), '켤 때 진단 한 줄 — 지난 자리(또는 기억 없음) → 띄운 자리');

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
process.exit(fail ? 1 : 0);
