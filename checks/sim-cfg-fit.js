/* ═══ 📐 sim-cfg-fit.js — 런처 창이 작업영역에 맞는가 (제보 1·2 · 2026-09-15) ═══════════
   [무엇을 지키나] 런처(380×680)가 작업영역보다 클 때 잘린 채 뜨던 것.
     main.js `_fitConfigRect` 가 크기를 작업영역에 맞추고 위치를 클램프한다.
     ・1절: 그 함수를 **본문 그대로** 떼어 와 모델로 돌린다 (배율 150% 1080p · 위 작업표시줄 · 다른 모니터에 둔 기억).
     ・2절: 크기를 정하는 자리 셋(createWindow · setConfigMode · display-metrics-changed)이 전부 그 함수를 지나는가.
     ・3절: sizeToMode 가 줄인 높이도 같은 모드로 인정하는가 — 안 그러면 'moved' 가 위치를 안 남긴다.
     ・4절: 런처 HTML 이 카드가 창보다 길 때 스크롤되는가 — 예전 align-items:center 가 위아래를 동시에 잘랐다.
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
const modeSrc = grabFn(MAIN, 'sizeToMode');
if(!fitSrc || !modeSrc){
  huh('_fitConfigRect / sizeToMode 를 못 찾음 — 개명됐다면 이 파일도 같이 고칠 것');
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
const SIZE_MATCH_TOL = 3;
const _fittedSize = {};
const _fitConfigRect = new Function('screen', 'MODE_SIZE', '_fittedSize', fitSrc + '; return _fitConfigRect;')(screen, MODE_SIZE, _fittedSize);
const sizeToMode    = new Function('MODE_SIZE', 'SIZE_MATCH_TOL', '_fittedSize', modeSrc + '; return sizeToMode;')(MODE_SIZE, SIZE_MATCH_TOL, _fittedSize);
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
chk(_fittedSize.launcher && _fittedSize.launcher.h === 660, '줄인 크기가 _fittedSize 에 남는다');
chk(sizeToMode(380, 660) === 'launcher', '★ sizeToMode 가 줄인 높이(660)도 launcher 로 본다');
chk(sizeToMode(380, 680) === 'launcher', '원래 높이(680)도 여전히 launcher');
chk(sizeToMode(1280, 660) === null, '전체화면 폭은 어느 모드도 아니다 (run)');

// ③ 작업표시줄이 위에 있다 — 작업영역 원점이 (0,40). 예전 createWindow 는 (0,0) 기준이었다.
displays = [mk(0, 0, 1920, 1080, 40)];
r = _fitConfigRect('launcher', MODE_SIZE.launcher, displays[0], null);
chk(r.y >= 40 && inside(r, displays[0].workArea), '작업표시줄이 위에 있으면 그 아래에서 중앙을 잡는다');

// ④ 작업영역이 다시 커졌다 — 원래 크기로 돌아온다 (복구 코드 없이 min 만으로)
displays = [mk(0, 0, 1920, 1080, 40)];
r = _fitConfigRect('launcher', MODE_SIZE.launcher, displays[0], { x: 100, y: 100 });
chk(r.height === 680 && _fittedSize.launcher.h === 680, '작업영역이 넉넉해지면 680 으로 돌아온다');

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
chk(sizeToMode(360, 620) === 'creator', '줄인 폭은 그 모드로 인정한다');

/* ── 2. 배선 ── */
say('── 2. 크기를 정하는 자리가 전부 _fitConfigRect 를 지난다');
const calls = (MAIN.match(/_fitConfigRect\(/g) || []).length - 1;   // 정의 자신 제외
chk(calls >= 3, '_fitConfigRect 호출 ' + calls + '곳 (createWindow · setConfigMode · display-metrics-changed)');
const cw = grabFn(MAIN, 'createWindow') || '';
chk(/_fitConfigRect\('launcher'/.test(cw), 'createWindow 가 첫 창을 이 함수로 잡는다');
chk(!/Math\.round\(\(width - CONFIG_WIDTH\)/.test(cw), '★ 예전 (0,0) 기준 중앙 계산이 createWindow 에 없다');
const scm = MAIN.slice(MAIN.indexOf("ipcMain.on('companion:setConfigMode'"));
const scmBody = scm.slice(0, scm.indexOf("ipcMain.on('companion:moveWindow'"));
chk(/const cfgRect = _fitConfigRect\(/.test(scmBody), 'setConfigMode 의 cfgRect 가 이 함수에서 나온다');
chk(!/const useX = remembered/.test(scmBody), '★ 예전 «remembered ? 그대로 : 중앙» 직접 계산이 setConfigMode 에 없다');
const dm = MAIN.slice(MAIN.indexOf("screen.on('display-metrics-changed'"));
const dmBody = dm.slice(0, dm.indexOf('}, 400);'));
chk(!/if\(_isConfigMode\) return;/.test(dmBody), '★ display-metrics-changed 가 config 모드에서 그냥 return 하지 않는다 (제보 2 — 세션 중 주모니터 변경)');
chk(/if\(_isConfigMode\)\{[\s\S]*_fitConfigRect\(m,/.test(dmBody), '  config 분기가 현재 모드를 다시 맞춘다');
chk(/if\(_isConfigMode\)\{[\s\S]*_noteApplied\(rect, false\)/.test(dmBody), '  거기서도 _noteApplied 를 부른다 (빠지면 그 경로만 억제가 죽는다 — sim-overlay-gap)');
chk(/if\(_isConfigMode\)\{[\s\S]*setResizable\(true\)[\s\S]*setBounds\(rect\)[\s\S]*setResizable\(false\)/.test(dmBody), '  고정 크기 풀었다 닫는 순서가 setConfigMode 와 같다');

/* ── 3. sizeToMode ── */
say('── 3. sizeToMode 가 _fittedSize 를 본다');
chk(/_fittedSize\[m\]/.test(modeSrc) || /_fittedSize\[/.test(modeSrc), 'sizeToMode 본문이 _fittedSize 를 읽는다');
chk(/const _fittedSize = \{\}/.test(MAIN), '_fittedSize 가 모듈 스코프에 하나 있다');

/* ── 4. 런처 HTML ── */
say('── 4. 런처 HTML — 창이 카드보다 짧으면 스크롤된다');
const lRule = /^\s*#launcher\{([^}]*)\}/m.exec(HTML);   // 앞에 셀렉터가 붙은 덮어쓰기 규칙(body.desktop #launcher)이 아니라 본 규칙
const cRule = /^\s*\.lc-card\{([^}]*)\}/m.exec(HTML);
chk(!!lRule && !/align-items\s*:\s*center/.test(lRule[1]), '★ #launcher 에 align-items:center 가 없다 (있으면 넘치는 카드를 위아래 동시에 자른다)');
chk(!!lRule && /overflow-y\s*:\s*auto/.test(lRule[1]), '#launcher 가 세로 스크롤을 허용한다');
chk(!!cRule && /margin\s*:\s*auto/.test(cRule[1]), '.lc-card 가 margin:auto 로 센터링한다 (자리가 남으면 중앙, 넘치면 위부터)');
chk(!!cRule && /flex\s*:\s*none/.test(cRule[1]), '.lc-card 가 flex:none — 카드가 창 높이에 눌려 찌그러지지 않는다');

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
process.exit(fail ? 1 : 0);
