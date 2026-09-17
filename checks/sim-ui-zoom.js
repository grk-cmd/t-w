/* ═══ 🔍 sim-ui-zoom.js — 전체 화면 크기(렌더러 줌) 한 통로 (제보 3-2 · F-1 · 2026-09-16) ═══════════
   [무엇을 지키나] 확대/축소 통로가 둘이었다 — 캐릭터 탭 «화면 크기»(아바타존만)와, 우리 코드에 없는 일렉트론
     기본 줌 가속기(렌더러 전체). 후자는 몇 %인지 알 길도 되돌릴 기준도 없었다. 이제 main.js `applyUiZoom`
     한 곳이 값을 갖고, 단축키·Ctrl+휠·설정 버튼 셋이 전부 거기로 온다. 값은 tw-settings.json 에 남는다.
   ・1절: main.js — 한 통로(setZoomFactor 호출은 applyUiZoom 안에만) · 가속기 가로채기 · zoom-changed 막기 ·
          did-finish-load 에서 복원 · 설정 저장/복원 · IPC 핸들.
   ・2절: **좌표계** — 렌더러(CSS px)→main(DIP) 은 × z, main→렌더러는 ÷ z. 이게 빠지면 줌만 켜도 클릭 통과 판정이 z 배 어긋난다.
   ・3절: main.js 본문을 떼어 와 돌린다 — 단계·상한·하한·초기화·키 판정·좌표 환산.
   ・4절: preload · HTML · app.js 배선 — 채널 두 개 · «창 위치 초기화» 아래 행 · fs-toggle-btn 3개 + 배율 숫자 · 구버전이면 행 숨김.
   [실행] main.js · preload.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const MAIN = fs.readFileSync('main.js', 'utf8');
const PRE  = fs.readFileSync('preload.js', 'utf8');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };
function grabFn(src, name, kw){
  const i = src.indexOf((kw || 'function ') + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return null;
}
const count = (src, re) => (src.match(re) || []).length;

/* ── 1. main.js — 한 통로 ── */
say('── 1. main.js — 값은 applyUiZoom 한 곳 · 가속기·휠·버튼이 거기로 온다');
const fApply = grabFn(MAIN, 'applyUiZoom') || '';
const fStep  = grabFn(MAIN, '_zoomStep') || '';
const fClamp = grabFn(MAIN, '_clampZoom') || '';
const fKey   = grabFn(MAIN, '_zoomKeyOp') || '';
chk(!!fApply && !!fStep && !!fClamp && !!fKey, '★ applyUiZoom · _zoomStep · _clampZoom · _zoomKeyOp 가 있다');
chk(count(MAIN, /setZoomFactor\(/g) === 1 && /setZoomFactor\(uiZoom\)/.test(fApply), '★ setZoomFactor 호출은 **applyUiZoom 안 한 곳뿐** — 두 곳이 되면 숫자가 거짓말을 한다');
chk(/saveSettings\(\)/.test(fApply) && /send\('companion:uiZoom', uiZoom\)/.test(fApply), '  바뀌면 저장하고 렌더러에 알린다(숫자는 받아서 보여 주기만)');
const bie = MAIN.slice(MAIN.indexOf("webContents.on('before-input-event'"), MAIN.indexOf("webContents.on('before-input-event'") + 900);
chk(/_zoomKeyOp\(input\)/.test(bie) && /event\.preventDefault\(\);\s*applyUiZoom\(zop, 'key'\)/.test(bie), '★ before-input-event 가 가속기를 가로채 applyUiZoom 으로 보낸다(기본 줌은 막지 않고 묶는다)');
const zc = MAIN.slice(MAIN.indexOf("webContents.on('zoom-changed'"), MAIN.indexOf("webContents.on('zoom-changed'") + 300);
chk(/event\.preventDefault\(\)/.test(zc) && /applyUiZoom\(dir === 'in' \? 'in' : 'out', 'wheel'\)/.test(zc), '  Ctrl+휠(zoom-changed)도 막고 같은 통로로');
chk(/webContents\.on\('did-finish-load', \(\) => \{ try\{ applyUiZoom\(uiZoom, 'boot'\)/.test(MAIN), '  저장된 줌은 did-finish-load 뒤에 건다(먼저 걸면 로드가 되돌린다)');
const fLoad = grabFn(MAIN, 'loadSettings') || '', fSave = grabFn(MAIN, 'saveSettings') || '';
chk(/uiZoom = _clampZoom\(data\.uiZoom\)/.test(fLoad), '  loadSettings — 파일 값은 clamp 를 지나 들어온다(깨진 값이면 100%)');
chk(/uiZoom \}\)\)/.test(fSave) || /uiZoom\s*\}\)\);/.test(fSave), '  saveSettings — uiZoom 을 같이 적는다');
chk(/ipcMain\.handle\('companion:uiZoom', \(e, op\) => \{\s*if\(op === 'get'\) return uiZoom;\s*return applyUiZoom\(op, 'settings'\);/.test(MAIN), '  IPC 핸들 — get 은 읽기만, 나머지는 applyUiZoom');

/* ── 2. 좌표계 ── */
say('── 2. 좌표계 — 렌더러 CSS px ↔ main DIP');
const scb = MAIN.slice(MAIN.indexOf("ipcMain.on('companion:setCharBounds'"), MAIN.indexOf("ipcMain.on('companion:setCharBounds'") + 3000);
chk(/x: _zoomIn\(bounds\.x\), y: _zoomIn\(bounds\.y\), r: _zoomIn\(/.test(scb), '★ setCharBounds — 캐릭터 원(x·y·r)에 × z');
chk(/_lastRegions = bounds\.regions\.map\(g => \(\{ x: _zoomIn\(g\.x\), y: _zoomIn\(g\.y\), w: _zoomIn\(g\.w\), h: _zoomIn\(g\.h\) \}\)\)/.test(scb), '★ setCharBounds — 창 사각형 넷 다 × z');
const fHit = grabFn(MAIN, '_sendHitTest') || '';
chk(/p\.x = _zoomOut\(p\.x\)/.test(fHit) && /p\.y = _zoomOut\(p\.y\)/.test(fHit), '★ _sendHitTest — 렌더러로 보내는 커서 좌표에 ÷ z (elementFromPoint 는 CSS px)');
chk(/const _zoomIn\s*=\s*v => v \* uiZoom/.test(MAIN) && /const _zoomOut\s*=\s*v => v \/ uiZoom/.test(MAIN), '  환산 함수 둘 — 100% 면 항등');

/* ── 3. 실행 ── */
say('── 3. 실행 — 단계 · 상한 · 하한 · 초기화 · 키 판정 · 좌표 환산');
const consts = (MAIN.match(/const UI_ZOOM_MIN = [\d.]+, UI_ZOOM_MAX = [\d.]+, UI_ZOOM_STEP = [\d.]+;/) || [])[0];
if(!consts || !fApply){ huh('본문을 못 떼어 옴'); }
else{
  const env = { zoom: [], sent: [], saved: 0, logs: [] };
  const run = new Function('env',
    consts + '\nlet uiZoom = 1;\n' +
    "const mainWindow = { isDestroyed:()=>false, webContents:{ setZoomFactor:(z)=>env.zoom.push(z), send:(ch,z)=>env.sent.push([ch,z]) } };\n" +
    "const saveSettings=()=>{ env.saved++; }; const _diagLog=(m)=>env.logs.push(m);\n" +
    [fClamp, fStep, fApply, fKey].join('\n') +
    "\nconst _zoomIn = v => v * uiZoom; const _zoomOut = v => v / uiZoom;\n" +
    "return { apply:applyUiZoom, key:_zoomKeyOp, get:()=>uiZoom, zin:_zoomIn, zout:_zoomOut, clamp:_clampZoom };")(env);
  chk(run.apply('in', 't') === 1.1 && run.apply('in', 't') === 1.2, '① in 두 번: 1.0 → 1.1 → 1.2 (한 단계 10%)');
  chk(run.apply('reset', 't') === 1, '  reset → 1.0 (100% 가 되돌릴 기준)');
  let z; for(let i = 0; i < 30; i++) z = run.apply('in', 't');
  chk(z === 2 && run.get() === 2, '  상한 200% 에서 멈춘다');
  for(let i = 0; i < 40; i++) z = run.apply('out', 't');
  chk(z === 0.5, '  하한 50% 에서 멈춘다');
  const nZoom = env.zoom.length, nSaved = env.saved;
  run.apply('out', 't');
  chk(env.zoom.length === nZoom + 1 && env.saved === nSaved, '  값이 안 바뀌어도 setZoomFactor 는 걸고(부팅 복원용) 저장은 안 한다');
  chk(run.apply(1.37, 't') === 1.37 && run.apply(99, 't') === 2 && run.apply('garbage', 't') === 2, '  숫자면 clamp 해서 그대로 · 이상한 op 는 현재값 유지');
  chk(run.clamp(NaN) === 1 && run.clamp(-3) === 1 && run.clamp('x') === 1, '  clamp — NaN·음수·문자열은 100%');
  chk(env.sent.every(s => s[0] === 'companion:uiZoom') && env.sent.length === env.zoom.length, '  건 횟수만큼 렌더러에 알렸다');
  /* 키 판정 */
  const K = (o) => run.key(Object.assign({ type:'keyDown', control:true, meta:false, alt:false, shift:false, key:'', code:'' }, o));
  chk(K({ key:'=' }) === 'in' && K({ key:'+', shift:true }) === 'in' && K({ code:'NumpadAdd' }) === 'in', '② Ctrl+= · Ctrl+Shift+= (\'+\') · 숫자패드 + → in');
  chk(K({ key:'-' }) === 'out' && K({ key:'_', shift:true }) === 'out' && K({ code:'NumpadSubtract' }) === 'out', '  Ctrl+- · Ctrl+Shift+- (\'_\') · 숫자패드 − → out');
  chk(K({ key:'0' }) === 'reset' && K({ code:'Numpad0' }) === 'reset', '  Ctrl+0 → reset');
  chk(K({ key:'=', control:false, meta:true }) === 'in', '  Cmd+= 도 in (mac)');
  chk(K({ key:'=', control:false }) === null && K({ key:'=', alt:true }) === null && K({ key:'=', type:'keyUp' }) === null && K({ key:'a' }) === null, '  Ctrl 없음 · Alt 섞임 · keyUp · 다른 키 → 안 잡는다(다른 단축키를 안 먹는다)');
  /* 좌표 환산 */
  run.apply(1.5, 't');
  chk(run.zin(100) === 150 && run.zout(150) === 100, '③ 150%: CSS 100px ↔ DIP 150px');
  run.apply('reset', 't');
  chk(run.zin(100) === 100 && run.zout(100) === 100, '  100%: 항등 — 줌을 안 쓰는 사람은 한 픽셀도 안 바뀐다');
}

/* ── 4. 배선 ── */
say('── 4. preload · HTML · app.js');
chk(/uiZoom\(op\) \{\s*return ipcRenderer\.invoke\('companion:uiZoom', op\);/.test(PRE), '★ preload.uiZoom(op) → invoke companion:uiZoom');
chk(/onUiZoom\(callback\) \{\s*ipcRenderer\.on\('companion:uiZoom'/.test(PRE), '  preload.onUiZoom — main 이 바꾼 값을 받는다');
const iReset = HTML.indexOf('id="fsResetWinPos"'), iRow = HTML.indexOf('id="fsUiZoomRow"');
chk(iRow > iReset && iRow - iReset < 1200, '★ 행이 «창 위치 초기화» **바로 아래**에 있다 (시안)');
const row = HTML.slice(iRow, iRow + 1200);
/* [2026-09-17 시안 확정] 이름이 «프로그램 크기» 로 바뀌고 부연 문구가 빠졌다. 옛 판정(«전체 화면 크기 — 캐릭터와 창을 함께»)은 거짓 빨강. */
chk(/<span>프로그램 크기<\/span>/.test(row) && !/캐릭터와 창을 함께/.test(row), '  이름은 «프로그램 크기» · 부연 문구 없음 (캐릭터 탭의 «화면 크기»와 구분)');
chk(/id="fsUiZoomOut"[^>]*white-space:nowrap[^>]*>−</.test(row) && /id="fsUiZoomIn"[^>]*white-space:nowrap[^>]*>\+</.test(row), '  −·+ 는 한 글자 버튼 · 줄바꿈 금지 (좁은 패널에서 «화\\n면\\n−» 로 깨지던 것)');
chk(/id="fsUiZoomReset"[^>]*white-space:nowrap/.test(row) && /id="fsResetWinPos"[^>]*white-space:nowrap/.test(HTML), '  초기화·되돌리기도 줄바꿈 금지');
chk(['fsUiZoomOut','fsUiZoomIn','fsUiZoomReset'].every(id => new RegExp('class="fs-toggle-btn" id="' + id + '"').test(row)), '  버튼 셋이 fs-toggle-btn (같은 탭의 «창 위치 초기화» 행과 같은 모양)');
chk(/id="fsUiZoomPct"[^>]*>100%</.test(row), '  현재 배율 숫자(100%) — 초기화 버튼의 짝');
chk(/id="fsUiZoomRow"[^>]*display:none/.test(row), '  행은 숨긴 채 시작 — 구버전 앱에서는 그대로 숨는다');
chk(/id="fsTabSize"/.test(HTML) && /id="fsSizeBar"/.test(HTML), '  캐릭터 탭의 «화면 크기»(아바타존)는 그대로 남아 있다 — 둘 다 남긴다');
const fRow = grabFn(SRC, 'initUiZoomRow') || '';
chk(!!fRow, '★ app.js initUiZoomRow 가 있다');
chk(/typeof companion\.uiZoom === 'function'/.test(fRow) && /row\.style\.display = 'none'; return;/.test(fRow), '  preload 에 uiZoom 이 없으면 행을 숨기고 물러난다');
chk(/b\('fsUiZoomOut', 'out'\); b\('fsUiZoomIn', 'in'\); b\('fsUiZoomReset', 'reset'\);/.test(fRow), '  버튼 셋 → out · in · reset');
chk(/api\.onUiZoom\(show\)/.test(fRow) && /send\('get'\)/.test(fRow), '  숫자는 main 에서 받아서 보여 주기만(단축키로 바꿔도 맞는다) · 열 때 한 번 묻는다');
chk(!/setZoomFactor|webFrame/.test(SRC), '  app.js 는 줌을 직접 안 만진다 — 값은 main 한 곳');

say('');
say('sim-ui-zoom.js: ' + pass + ' 통과 · ' + fail + ' 실패' + (huhs ? ' · ' + huhs + ' 의문' : ''));
process.exitCode = fail ? 1 : 0;
