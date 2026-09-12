#!/usr/bin/env node
/* sim-sysinput.js — ⌨️ 전역 입력·활성 창 축(sysinput)이 쪼개져도 그대로인가
 *
 *   [왜 이 파일이 먼저 생기는가 — handoff-platform-split.md §4]
 *     ① 오버레이 분리는 `sim-overlay-gap` · `sim-overlay-layered` 둘이 이미 지키고 있었고,
 *       대상이 순수 함수라 배율 1~4 를 넣어 **숫자로** 분리 전후를 맞댈 수 있었다.
 *     ③ sysinput 은 그 셋이 다 없다. OS 호출이라 숫자 대조가 안 되고, 코드가 main.js
 *       전체에 흩어져 있으며, 전용 검사가 **하나도 없다**(이 파일을 쓰기 전 기준으로
 *       sim-*.js 55개 중 uIOhook·windowManager 를 언급하는 파일이 0개였다).
 *   ⇒ 그래서 이 파일은 **쪼개기 전에** 만들어져야 한다. 분리 후에 만들면 "분리된 코드"를
 *     보고 검사를 쓰게 되므로, 그 검사가 초록이어도 아무것도 증명하지 못한다.
 *
 *   [무엇을 지키는가 — 이 파일이 할 수 있는 것과 없는 것]
 *     ✓ 네이티브에 **직접 닿는 자리의 개수**가 이사 전후로 보존되는가 (1절)
 *     ✓ 과거 사고가 남긴 불변식이 살아 있는가 (2절) ← 회귀를 실제로 막는 곳은 여기다
 *     ✓ 이름 정규화·창 목록 필터가 같은 입력에 같은 답을 내는가 (3절, 모델)
 *     ✓ 훅 핸들러 **본문**이 따라 이사하지 않았는가 (4절) ← ③ 범위의 경계
 *     ✓ 왜 이렇게 됐는지가 남아 있는가 (5절)
 *     ✗ uIOhook 이 실제로 키를 잡는가 · 권한 대화상자가 뜨는가 — 정적으로는 못 본다.
 *       그건 실기기 몫이다. 이 파일은 "거기까지 가는 배선이 끊겼는가"만 본다.
 *
 *   [단계 자동 판정]
 *     `sysinput-win.js` 가 없으면 **분리 전**으로 보고 main.js 에서 전부 찾는다.
 *     있으면 **분리 후**로 보고 main.js 에는 0곳, 모듈에 같은 수가 있기를 요구한다.
 *     같은 파일이 양쪽 단계에서 초록이어야 "동작 변경 0" 을 말할 수 있다.
 *
 *   실행: node sim-sysinput.js      (main.js 와 같은 폴더에서)
 *   종료 코드: 0=통과 · 1=실패 · 2=검사못함(심볼 개명·이동)
 */
'use strict';
const fs = require('fs');
const path = require('path');

let fail = 0, unknown = 0, pass = 0;
const say = console.log;
const ok  = (m) => { pass++;    say('  ✓ ' + m); };
const bad = (m) => { fail++;    say('  ✗ ' + m); };
const huh = (m) => { unknown++; say('  ? ' + m); };
/* chk 는 참/거짓만 가른다. **대상을 못 찾은 경우는 chk 가 아니라 huh 를 부를 것.**
   못 찾은 것을 거짓으로 세면 "개명했더니 검사가 실패했다"와 "규칙이 깨졌다"가 뒤섞인다. */
const chk = (cond, m) => (cond ? ok(m) : bad(m));

const HERE = __dirname;
function read(f){
  const p = path.join(HERE, f);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}
/* ★ sim-overlay-gap.js 가 헛돌던 원인이 이 구분이었다(핸드오프 §3).
     주석에 코드 조각이 그대로 인용돼 있어서, 원문(src)에서 심볼을 찾으면 **주석 안의 인용**이
     먼저 걸린다. 실제 호출부는 거기서 10만 자 떨어져 있을 수 있다.
   ⇒ "살아 있는가 / 몇 곳인가" 는 **반드시 주석을 걷어낸 code** 에서 본다.
     반대로 "근거가 남아 있는가"(5절)는 주석이 대상이므로 src 를 본다. 섞지 말 것. */
function strip(src){
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
const count = (s, re) => (s.match(re) || []).length;

const mainSrc = read('main.js');
if (!mainSrc){
  say('✗ main.js 를 같은 폴더에서 못 찾음');
  process.exit(2);
}
const mainCode = strip(mainSrc);

const sysSrc  = read('sysinput-win.js');
const sysCode = sysSrc ? strip(sysSrc) : '';
const SPLIT   = !!sysSrc;
/* 분리 후에는 두 파일을 합쳐서 센다 — 이사는 "사라지는 것"이 아니라 "옮겨가는 것"이다. */
const allCode = mainCode + '\n' + sysCode;

say('── 단계: ' + (SPLIT ? '분리 후 (sysinput-win.js 있음)' : '분리 전 (main.js 단일)'));
say('');

/* ══ 1. 접촉면 — 네이티브에 직접 닿는 자리의 수 ═══════════════════════════
   [이 절이 판정 기준의 뼈대다]
     sysinput 은 순수 함수가 아니라 결과를 숫자로 맞댈 수 없다. 대신 **닿는 자리의 개수**는
     셀 수 있다. 이사 전 6+2 곳이 이사 후에도 6+2 곳이면 흘린 것도, 새로 판 것도 없다.
   ⚠️ 이 수가 **줄면** 기능이 통째로 빠진 것이고, **늘면** 이음매를 우회하는 새 호출이
     생긴 것이다. 어느 쪽이든 "동작 변경 0" 이 깨진다. 숫자를 고치기 전에 왜 변했는지 볼 것. */
say('── 1. 네이티브 접촉면이 이사 전후로 보존된다');
{
  const SITES = [
    ['uIOhook.on(...)',                 /uIOhook\s*\.\s*on\s*\(/g,                       3, '전역 훅 3종(mousedown·wheel·keydown)'],
    ['uIOhook.start()',                 /uIOhook\s*\.\s*start\s*\(/g,                    1, '훅 기동'],
    ['windowManager.getActiveWindow()', /windowManager\s*\.\s*getActiveWindow\s*\(/g,    1, 'activeWin() 어댑터 안'],
    ['windowManager.getWindows()',      /windowManager\s*\.\s*getWindows\s*\(/g,         1, 'listWindows 핸들러 안'],
    ["require('uiohook-napi')",         /require\(\s*['"]uiohook-napi['"]\s*\)/g,        1, ''],
    ["require('node-window-manager')",  /require\(\s*['"]node-window-manager['"]\s*\)/g, 1, ''],
  ];
  let total = 0;
  for (const [label, re, want, note] of SITES){
    const got = count(allCode, re);
    total += got;
    chk(got === want, '  ' + label + ' = ' + got + '곳 (기준 ' + want + ')' + (note ? ' — ' + note : ''));
  }
  chk(total === 8, '★ 접촉면 합계 ' + total + '곳 (기준 8) — 줄면 기능 누락, 늘면 이음매 우회다');

  /* ⚠️ stop() 만 개수로 세면 안 된다.
       분리 전에는 before-quit · session-end 두 자리에서 **각각** uIOhook.stop() 을 부르지만,
       분리 후에는 두 자리가 모두 stopGlobalHooks() 하나를 부르므로 네이티브 호출은 **1곳으로 합쳐진다.**
       고정 2로 세면 "제대로 쪼갠 순간" 거짓 실패가 난다 — 검사가 이사를 막게 된다.
     ⇒ 개수가 아니라 **두 생애주기에서 각각 훅이 내려가는가**를 본다(2절에서 자리별로 확인).
       이건 편의가 아니라, 이 검사가 지켜야 할 것이 "호출 횟수"가 아니라 "배선"이라는 뜻이다. */
  const stops = count(allCode, /uIOhook\s*\.\s*stop\s*\(/g);
  chk(stops >= 1, '  uIOhook.stop() = ' + stops + '곳 (분리 전 2 · 분리 후 1로 합쳐짐 — 자리별 확인은 2절)');

  if (SPLIT){
    /* 분리 후의 핵심: main.js 는 네이티브를 **한 글자도** 모르는 상태가 되어야 한다.
       한 곳이라도 남으면 mac 에서 그 줄이 그대로 죽는다(그게 분리의 목적이다). */
    const leftovers = SITES
      .map(([label, re]) => [label, count(mainCode, re)])
      .filter(([, n]) => n > 0);
    chk(leftovers.length === 0,
      '★ main.js 에 남은 네이티브 접촉이 0곳 — 남은 것: '
      + (leftovers.map(([l, n]) => l + '×' + n).join(', ') || '없음'));
    chk(/require\(\s*['"]\.\/sysinput-(win|mac)['"]\s*\)/.test(mainCode),
      '★ main.js 가 플랫폼 갈래로 sysinput 을 부른다');
    chk(/process\.platform\s*===\s*['"]darwin['"]/.test(mainCode),
      '  갈래 조건이 overlay 쪽과 같은 모양이다(핸드오프 §1-②)');
  } else {
    /* ⚠️ 여기서 huh() 를 부르면 안 된다. 분리 전은 **정상 단계**지 "못 찾은 상태"가 아니다.
       huh 는 종료 코드 2 를 만들고, 그러면 이 파일은 쪼개기 전에는 영영 초록이 못 된다 —
       바로 그 초록이 ③ 의 판정 기준이므로 기준 자체가 사라진다. */
    say('  · 아직 sysinput-win.js 가 없다 — 분리 후에는 main.js 쪽이 0곳이어야 한다는 검사가 3개 더 돈다');
  }
}

/* ══ 2. 과거 사고가 남긴 불변식 ═══════════════════════════════════════════
   여기가 이 파일에서 **회귀를 실제로 막는** 부분이다. 1절은 "빠뜨렸는가"만 보지만,
   이사 중에 조건 한 줄을 흘리는 사고는 개수로 안 잡힌다. */
say('\n── 2. 과거 사고가 남긴 조건이 그대로다');
{
  /* ⓐ mousemove 전역 훅 — 부활 금지.
     저수준 mousemove 훅이 active-win 의 활성 창 감지와 간섭해서 activeWin() 이 계속 null 을
     뱉었다(포커싱 어플 등록·감지 전체 고장). screen.getCursorScreenPoint 폴링으로 교체한 것이
     그 대응이다. 되돌리면 같은 고장이 그대로 돌아온다. */
  chk(count(allCode, /uIOhook\s*\.\s*on\s*\(\s*['"]mousemove['"]/g) === 0,
    '★ uIOhook.on(\'mousemove\') 가 0곳 — 부활하면 activeWin() 이 다시 null 만 뱉는다');
  chk(/getCursorScreenPoint/.test(allCode),
    '  그 자리를 대신하는 커서 폴링이 살아 있다');

  /* ⓑ start() 는 던진다 — 백신이 저수준 훅을 차단, VC++ 런타임 누락, asarUnpack 경로 문제.
     감싸지 않으면 뒤의 정리 코드까지 통째로 건너뛰고, 무엇보다 흔적이 안 남는다. */
  {
    const m = allCode.match(/try\s*\{[^}]{0,200}uIOhook\s*\.\s*start\s*\(\s*\)[^}]{0,200}\}\s*catch/);
    if (!m) bad('★ uIOhook.start() 가 try/catch 밖이다 — 훅이 막힌 환경에서 그 뒤가 통째로 죽는다');
    else {
      ok('★ uIOhook.start() 가 try/catch 안에 있다');
      const tail = allCode.slice(allCode.indexOf(m[0]), allCode.indexOf(m[0]) + m[0].length + 300);
      chk(/_diagLog|log\s*\(/.test(tail),
        '  실패를 삼키되 진단 기록은 남긴다 — 안 남기면 "왜 안 되는지"를 다음 제보에서 못 가른다');
    }
  }

  /* ⓒ stop() 은 두 자리 다 필요하다.
     before-quit 만 있으면 윈도우 세션 종료(로그오프·재시작)에서 네이티브 훅이 스레드째 뜯겨
     0x80000003(STATUS_BREAKPOINT)이 뜬다 — "이 앱 때문에 종료할 수 없습니다" 제보. */
  {
    /* 분리 전에는 `uIOhook.stop()`, 분리 후에는 `stopGlobalHooks()` 가 그 자리에 온다.
       둘 중 **무엇이든 하나**가 각 생애주기 안에 있으면 배선은 살아 있는 것이다. */
    const DOWN = /(?:uIOhook\s*\.\s*stop|stopGlobalHooks)\s*\(/;
    const near = (evt) => {
      const i = mainCode.indexOf("'" + evt + "'");
      return i >= 0 && DOWN.test(mainCode.slice(i, i + 400));
    };
    chk(near('before-quit'), '  before-quit 에서 훅을 내린다');
    chk(near('session-end'), '★ session-end 에서도 훅을 내린다 — 이게 빠지면 종료 시 0x80000003 이 돌아온다');
    chk(/app\.exit\(\s*0\s*\)/.test(allCode),
      '  세션 종료는 app.quit() 이 아니라 app.exit(0) 이다 — 창을 하나씩 닫는 그 시간이 곧 "종료를 막는 앱"이다');
  }

  /* ⓓ 목록·화이트리스트 — 제보가 직접 만든 값들이다. 이사 중에 조용히 비면 증상만 돌아온다. */
  {
    const skip = allCode.match(/WINLIST_SKIP\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    if (!skip) huh('WINLIST_SKIP 을 못 찾음 — 개명·이동됐다면 이 파일도 같이 고칠 것');
    else {
      chk(/explorer\.exe/.test(skip[1]),
        '★ WINLIST_SKIP 에 explorer.exe — 게임에서 빠져나올 때 끼어드는 창이다("게임만 등록이 안 된다" 제보)');
      const n = (skip[1].match(/\.exe/g) || []).length;
      chk(n >= 13, '  셸 계열 항목 ' + n + '개 (기준 13 이상) — 줄었다면 무엇을 왜 뺐는지 확인할 것');
    }
    const pen = allCode.match(/PEN_APPS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    if (!pen) huh('PEN_APPS 를 못 찾음');
    else {
      const cs = (pen[1].match(/clipstudio\w*\.exe/g) || []).length;
      chk(cs >= 3, '  Clip Studio 실행 파일 ' + cs + '종 (기준 3) — 넉넉히 넣는 쪽이 손해가 작다는 판단이었다');
      chk(/photoshop\.exe/.test(pen[1]) || (pen[1].match(/\.exe/g) || []).length >= 5,
        '  그 외 펜 앱도 남아 있다');
    }
  }

  /* ⓔ 창 열거 실패를 조용히 삼키지 않는다 — 빈 목록과 실패는 뜻이 다르다.
     mac 에서 권한을 거부하면 title 이 빈 문자열로 와서 **조용한 빈 목록**이 된다(핸드오프 §7-2).
     그 갈래를 나중에 붙이려면 실패 경로가 지금 살아 있어야 한다. */
  chk(/reason\s*:\s*['"]enum-failed['"]/.test(allCode),
    '★ 창 열거 실패를 enum-failed 로 돌려준다 — 빈 목록과 구분되지 않으면 mac 권한 거부를 진단 못 한다');
}

/* ══ 3. 순수하게 떼어낼 수 있는 조각 — 모델로 재현 ════════════════════════
   ⚠️ 아래는 main.js 의 **흉내**다(모델). 실제 코드를 부르는 게 아니므로 필터 규칙을 고치면
     **여기도 같이 고칠 것.** 그래도 1·2·4·5절은 원문을 직접 보므로 이 절이 낡아도 나머지는
     계속 진실을 말한다(sim-ghost-cache-sync.js §8 의 관례). */
say('\n── 3. 이름 정규화와 창 목록 필터가 같은 입력에 같은 답을 낸다 (모델)');
{
  const SELF = 'together working.exe';
  const SKIP = new Set(['explorer.exe', 'dwm.exe', 'textinputhost.exe']);

  /* ★ main.js 는 그냥 `path.basename` 을 쓴다 — 즉 **구분자 해석이 실행 OS를 따라간다.**
       Windows 에서는 역슬래시를 자르고, macOS 에서는 안 자른다. 그래서 이 모델이 평범한
       path.basename 을 쓰면 검사 결과가 **검사를 돌린 기계에 따라 달라진다.**
     ⇒ 모델은 구분자를 명시한다. 이건 모델의 편의가 아니라 실제 사안이다 —
       §6 에서 다루는 focus-apps 포맷 문제가 여기서 시작된다. */
  const procNameOf = (p, win) => (win ? path.win32 : path.posix).basename(p || '').toLowerCase();

  /* listWindows 의 거르는 순서 — 순서가 뜻을 가진다.
     빈 값·비가시·빈 제목 → 자기/셸 → 너무 작은 창 → 같은 exe 중복(제목 긴 쪽) */
  function listModel(wins){
    const out = [], seen = new Map();
    for (const w of wins){
      const p = w.path || '', title = (w.title || '').trim();
      const vis = w.visible !== false, b = w.bounds || null;
      if (!p || !vis || !title) continue;
      const name = procNameOf(p, true);
      if (name === SELF || SKIP.has(name)) continue;
      if (b && ((b.width | 0) < 80 || (b.height | 0) < 60)) continue;
      const prev = seen.get(p);
      if (prev && prev.title.length >= title.length) continue;
      const item = { name, path: p, title: title.slice(0, 80) };
      if (prev) Object.assign(prev, item); else { seen.set(p, item); out.push(item); }
    }
    return out;
  }

  chk(procNameOf('C:\\Program Files\\Google\\Chrome\\CHROME.EXE', true) === 'chrome.exe',
    '  경로 → 프로세스명은 basename + 소문자 하나로 정한다');
  chk(procNameOf('', true) === '' && procNameOf(null, true) === '',
    '  빈 경로는 빈 이름 — 던지지 않는다(활성 창 판정이 통째로 멎는다)');

  /* ★ 같은 규칙을 mac 경로에 대면 무엇이 나오는지 — 이게 §4-① 이 "지금이 마지막 기회"인 이유다.
       확장자가 없고, 공백이 들어가고, 대소문자 정규화가 사람이 읽는 이름을 망가뜨린다.
       저장 파일에 이미 'chrome.exe' 로 박힌 값과는 **어떤 규칙으로도 안 맞는다.** */
  const macName = procNameOf('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', false);
  chk(macName === 'google chrome',
    '★ mac 경로는 \'' + macName + '\' 이 된다 — 확장자가 없다. exe 이름 가정이 여기서 깨진다');
  chk(macName !== 'chrome.exe',
    '★ 저장된 Windows 값과 같은 키로 안 맞는다 — 포맷을 안 바꾸면 마이그레이션 사안이 된다(§6)');

  const wins = [
    { path: 'C:\\a\\chrome.exe',   title: 'Gmail',        bounds: { width: 1200, height: 800 } },
    { path: 'C:\\a\\chrome.exe',   title: 'Gmail — 받은편지함', bounds: { width: 1200, height: 800 } },
    { path: 'C:\\w\\explorer.exe', title: '바탕 화면',    bounds: { width: 1920, height: 1080 } },
    { path: 'C:\\t\\together working.exe', title: 'Together', bounds: { width: 1920, height: 1080 } },
    { path: 'C:\\x\\tray.exe',     title: '트레이',       bounds: { width: 40, height: 20 } },
    { path: 'C:\\y\\hidden.exe',   title: '숨김',         visible: false, bounds: { width: 900, height: 700 } },
    { path: 'C:\\z\\untitled.exe', title: '   ',          bounds: { width: 900, height: 700 } },
    { path: '',                    title: '경로없음',     bounds: { width: 900, height: 700 } },
  ];
  const got = listModel(wins);
  chk(got.length === 1, '  8개 창 중 1개만 남는다 — 실제 ' + got.length + '개');
  chk(got[0] && got[0].name === 'chrome.exe', '  남은 것은 chrome.exe');
  chk(got[0] && got[0].title === 'Gmail — 받은편지함',
    '★ 같은 exe 는 제목이 긴 쪽을 남긴다 — 보통 그쪽이 본 창이다');
  chk(!got.some(w => w.name === 'explorer.exe'),
    '★ explorer.exe 는 제목이 있어도 안 나온다 — 게임 등록이 여기서 깨졌었다');
  chk(!got.some(w => w.name === SELF), '  우리 앱 자신은 목록에 안 나온다');

  /* 등록 판정·펜 앱 판정 — focus-apps.json 의 name 필드에 걸려 있다(§6에서 다시 본다). */
  const focusApps = [{ name: 'chrome.exe', path: 'C:\\a\\chrome.exe' }, null, null, null];
  const isReg = (exe) => !!(exe && focusApps.some(f => f && f.name === exe));
  chk(isReg('chrome.exe') === true,  '  등록 판정은 name 필드 정확 일치다');
  chk(isReg('CHROME.EXE') === false, '★ 대문자는 안 맞는다 — 정규화를 거치지 않은 값을 넣으면 조용히 미등록이 된다');
  chk(isReg('') === false,           '  빈 이름은 등록으로 치지 않는다');
}

/* ══ 4. ③ 의 경계 — 핸들러 본문은 따라 이사하지 않는다 ════════════════════
   [왜 경계를 고정하는가]
     핸드오프 §4-② 가 가리키는 통로(_checkCursorNearChar → _reportCursorActivity →
     _applyForwardOnly → setIgnoreMouseEvents)는 uIOhook 과 클릭 통과의 **접점**이라
     어느 모듈로도 깨끗하게 안 떨어진다. sysinput 이 가져가는 것은 "훅을 걸고 푼다" 뿐이고,
     핸들러 **본문**(판정·IPC 전송)은 main.js 에 남는다.
   ⇒ 이 절이 초록이면, 듀얼 모니터 대응이 아직 움직이는 코드여도 ③ 을 진행할 수 있다. */
say('\n── 4. 훅 핸들러 본문은 main.js 에 남는다 (③ 의 경계)');
{
  chk(count(mainCode, /companion:globalClick/g) === 2,
    '  globalClick 전송이 main.js 에 2곳(mousedown·wheel) — 채널은 preload 가 아는 이름 그대로다');
  chk(count(mainCode, /companion:globalKey/g) === 1,  '  globalKey 전송이 main.js 에 1곳');
  chk(/companion:activeAppState/.test(mainCode),      '  activeAppState 전송도 main.js 에 남는다');

  chk(/_guardForeignInput\s*\(\s*['"]click['"]\s*\)/.test(allCode)
   && /_guardForeignInput\s*\(\s*['"]key['"]\s*\)/.test(allCode),
    '★ ⓖ 회수가 클릭·키 양쪽에서 불린다 — 이 통로가 끊기면 굳은 클릭받기를 되돌릴 길이 없다');
  chk(/function\s+_guardForeignInput/.test(mainCode),
    '★ _guardForeignInput 정의는 main.js 에 있다 — 클릭 통과 축이라 sysinput 이 아니다');

  /* 클릭 통과 일체는 이번 범위 밖이다(핸드오프 §2 "무엇을 안 옮겼나"). */
  for (const fn of ['_applyForwardOnly', '_reapplyIgnoreMouse', '_checkCursorNearChar']){
    chk(new RegExp('function\\s+' + fn).test(mainCode),
      '  ' + fn + ' 은 main.js 에 그대로 — 클릭 통과는 ③ 범위가 아니다');
  }
  if (SPLIT){
    chk(!/setIgnoreMouseEvents/.test(sysCode),
      '★ sysinput 모듈이 setIgnoreMouseEvents 를 모른다 — 알면 두 축이 섞인 것이다');
  }

  /* 인터페이스 이름은 핸드오프 §1-④ 표에 못 박혀 있다. mac 판이 같은 이름을 내보내야 한다. */
  if (SPLIT){
    for (const name of ['startGlobalHooks', 'stopGlobalHooks', 'getActiveWindow', 'listWindows', 'selfProcName']){
      chk(new RegExp('\\b' + name + '\\b').test(sysCode),
        '  ' + name + ' 을 내보낸다 (핸드오프 §1-④ 표)');
    }
  }
}

/* ══ 5. 근거 보존 — 다음 사람이 되돌리지 않도록 ═══════════════════════════
   ⚠️ 이 절만 주석 포함 원문(src)을 본다. 나머지 절과 대상이 다르다는 점을 섞지 말 것. */
say('\n── 5. 왜 이렇게 됐는지가 파일에 남아 있다');
{
  chk(/active-win|activeWin/.test(mainSrc) && /간섭/.test(mainSrc),
    '★ mousemove 훅을 왜 뺐는지가 남아 있다 — 없으면 "성능 때문에 뺐나" 하고 되돌린다');
  chk(/백신|VC\+\+|asarUnpack/.test(mainSrc),
    '  start() 가 던지는 환경이 무엇인지 남아 있다');
  chk(/0x80000003|STATUS_BREAKPOINT/.test(mainSrc),
    '★ 세션 종료 예외의 정체가 남아 있다 — 이 근거가 없으면 session-end 처리가 군더더기로 보인다');
  chk(/CLICKED|mousedown/.test(mainSrc) && /드래그/.test(mainSrc),
    '  click 이 아니라 mousedown 을 듣는 이유(드래그 중 누락)가 남아 있다');
  chk(/UIPI|관리자 권한/.test(mainSrc),
    '  관리자 권한 창은 목록에도 안 나온다는 한계가 적혀 있다 — mac 권한 사안과 같은 자리다');
}

/* ══ 6. focus-apps.json 저장 포맷 — ★ 지금이 마지막 기회다 ════════════════
   [핸드오프 §4-①]
     name 필드에 exe 이름이 그대로 박혀 있다. Mac 사용자가 한 명이라도 생기면 마이그레이션
     사안이 되고, 지금은 공짜다. 이 절은 **포맷을 정하라고 요구하지 않는다** — 지금 포맷이
     무엇인지 못 박아 두어, 바뀌는 순간 이 검사가 먼저 시끄러워지게 한다. */
say('\n── 6. focus-apps 저장 포맷을 못 박아 둔다 (마이그레이션 감시)');
{
  chk(/FOCUS_APP_SLOTS\s*=\s*8/.test(mainCode), '  슬롯 8칸');
  chk(/Math\.min\(\s*arr\.length\s*,\s*FOCUS_APP_SLOTS\s*\)/.test(mainCode),
    '★ 길이와 무관하게 받아 8칸으로 맞춘다 — 4칸 시절 파일을 버리면 등록이 통째로 초기화된다');
  /* ★ [§4-b 이후] 이 자리는 원래 `f.name === exeName` 을 찾았다. main.js 가 `keysOf` 한 통로로
       간 뒤부터 그 판은 **분리와 무관하게** 빨갛다 — ③ 이 만든 빨강이 아니다(핸드오프 §3-②).
     못 박는다는 이 절의 뜻은 그대로 두고, 못 박는 **대상만** name 필드에서 keysOf 통로로 옮긴다.
     ⚠️ 대조는 반드시 mainCode(주석 제거본)로 한다. main.js 785줄 주석에 옛 비교문이
       "되돌리지 말 것" 예시로 그대로 인용돼 있어서, src 로 보면 지워진 코드가 살아 있는 것처럼 걸린다. */
  chk(/function\s+keysOf\s*\(/.test(mainCode) && /keysOf\s*\([^)]*\)\s*\.includes\s*\(/.test(mainCode),
    '★ 등록 판정이 keysOf 한 통로를 지난다 — 포맷을 바꾸면 **여기가 첫 번째로 깨진다**');
  chk(!/\bf\.(name|key)\s*===/.test(mainCode),
    '★ .name / .key 직접 비교가 없다 — 우회로가 생기면 mac 에서 조용히 전부 미등록이 된다(§5)');
  chk(/JSON\.stringify\(\s*focusApps\s*\)/.test(mainCode),
    '  배열을 그대로 직렬화한다(버전 필드 없음) — 승격 장치가 생기면 이 검사를 갱신할 것');
  /* 버전 필드가 생기는 순간 위 줄이 실패한다. 그게 이 항목의 목적이다 —
     overlay 쪽 GAP_VER 승격과 같은 종류의 장치가 여기에도 필요해졌다는 신호다. */
  if (!/overlayBottomGap|GAP_VER/.test(mainCode)){
    huh('갭 승격 장치가 main.js 에 없다 — overlay-win.js 로 옮겨간 상태라면 정상이다');
  } else {
    ok('  갭 승격 장치가 아직 main.js 에 있다 — focus-apps 승격도 같은 모양으로 쓸 수 있다');
  }
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + unknown);
if (unknown) say('  ? 는 심볼이 개명·이동됐다는 뜻이다. main.js 를 고쳤다면 **이 파일도 같이 고칠 것.**');
if (fail)    say('  ✗ 는 sysinput 축의 배선이나 조건이 끊겼다는 뜻이다.');
if (!fail && !unknown) say('  ✓ 전부 통과');
/* 종료 코드: 1=실패, 2=검사못함. 2 를 0 으로 만들면 이 파일도 조용히 죽는다. */
process.exit(fail ? 1 : (unknown ? 2 : 0));
