#!/usr/bin/env node
/* sim-overlay-layered.js — 🎬 레이어드 알파: 오버레이를 '가리는 창' 판정에서 영구히 빼는 통로
 *
 *   · 크로미움 `IsWindowVisibleAndFullyOpaque` 는 WS_EX_LAYERED 창의 알파가 255 미만이면
 *     그 창을 '가리는 창'으로 세지 않는다. ⇒ 알파를 252 로 한 번 걸어 두면 우리 창은
 *     뒤 창의 완전 차폐를 성립시키지 않는다.
 *   · Electron `SetIgnoreMouseEvents(false)` 는 LAYERED 비트까지 벗긴다. 그걸 다시 붙여
 *     주는 것이 `layered_` 플래그이고, 그 플래그를 켜는 통로는 **setOpacity() 하나뿐**이다.
 *   · ⚠️ 이 갈래는 **실기기 미검증**이다. 그래서 기본은 꺼짐이고 토글로만 켠다.
 *     이 파일이 지키는 것은 "효과가 있는가"가 아니라 **"실험 조건이 무너지지 않았는가"** 다:
 *       기본이 조용히 켜짐으로 돌아가지 않았는가 · 끄는 길이 살아 있는가 ·
 *       토글 통로 4단이 다 이어져 있는가 · 알파가 갭을 건드리지 않는가 ·
 *       성공했을 때 걷어낼 자리 목록이 남아 있는가.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * [이 파일은 두 번째 판이다]
 *   1판은 핸드오프6 §7 이 30항목으로 적어 뒀으나 프로젝트에 저장되지 않아 유실됐다.
 *   sim-overlay-gap.js 가 같은 이유로 두 번 죽었다(그 파일 머리말 참조). 그래서 2판은
 *   그 파일의 3판 관례를 그대로 따른다:
 *     ① 심볼 이름 **후보를 여러 개** 받는다 — 개명돼도 안 죽는다. 새 이름은 맨 앞에 추가할 것.
 *     ② ✗(깨짐) / ?(검사 못함) / ·(환경상 건너뜀) 을 화면에서 구분한다.
 *        `?` 만 남아도 **종료 코드 2** — 0 으로 끝내면 이 파일도 조용히 죽는다.
 *     ③ 주석에 코드 조각이 그대로 들어 있으므로(원문 인용) "되살아났다" 검사는
 *        **주석을 걷어낸 본문**을 봐야 한다. 반대로 근거·경고 보존 검사는 원문을 본다.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ 성공해서 기본 동작으로 올릴 때는 이 파일도 **같이** 고칠 것. 3절(기본 꺼짐)이
 *    통째로 뜻이 바뀌고, 6절(걷어낼 자리)이 실제 작업 목록이 된다.
 *
 *   실행: node sim-overlay-layered.js     (main.js 와 같은 폴더에서)
 */
'use strict';
const fs = require('fs');
const path = require('path');

let fail = 0, unknown = 0, pass = 0, skipped = 0;
const say = console.log;
const ok   = (m) => { pass++;    say('  ✓ ' + m); };
const bad  = (m) => { fail++;    say('  ✗ ' + m); };
const huh  = (m) => { unknown++; say('  ? ' + m); };
const skip = (m) => { skipped++; say('  · ' + m); };
/* chk 는 참/거짓만 가른다. **대상을 못 찾은 경우는 chk 를 부르지 말고 huh 를 부를 것.** */
const chk = (cond, m) => (cond ? ok(m) : bad(m));

const HERE = __dirname;
const readIf = (n) => { try { return fs.readFileSync(path.join(HERE, n), 'utf8'); } catch (_) { return null; } };

const src = readIf('main.js');
if (src == null) { say('? main.js 를 못 찾음 — main.js 가 있는 폴더에서 실행할 것'); process.exit(2); }

/* main.js 에는 크로미움·Electron 원문이 주석에 그대로 인용돼 있다(WS_EX_LAYERED, setOpacity 등).
   원문을 훑으면 "코드에 있다"고 오탐하므로, 존재/부재 검사는 반드시 code 를 본다. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = stripComments(src);

/* ── 심볼 이름 후보 — 개명하면 **맨 앞에** 추가할 것 ───────────────────────── */
const ALPHA_NAMES = ['OVERLAY_LAYERED_ALPHA'];
const ON_NAMES    = ['OVERLAY_LAYERED_ALPHA_ON'];
const APPLY_FNS   = ['_applyOverlayLayered'];
const STATE_NAMES = ['_layeredState'];
const FILE_KEY    = 'overlayLayeredAlpha';   // 설정 파일에 적히는 키
const IPC_GET     = 'companion:getLabVideo';
const IPC_SET     = 'companion:setLabVideo';
const UI_ROW      = 'progLabVideoRow';
const UI_BTN      = 'progLabVideoToggle';

const findName = (cands, re) => cands.find(n => re(n).test(code)) || null;
const alphaName = findName(ALPHA_NAMES, n => new RegExp('(?:const|let|var)\\s+' + n + '\\s*='));
const onName    = findName(ON_NAMES,    n => new RegExp('(?:const|let|var)\\s+' + n + '\\s*='));
/* ⚠️ `code.includes('function ' + n)` 로 찾으면 `_applyOverlayLayeredV2` 같은 **접두어 개명**에
   그대로 걸려서, 드리프트가 `?`(검사 못함) 가 아니라 `✗`(깨짐) 으로 잘못 보고된다.
   그러면 main.js 를 멀쩡히 고친 사람이 "내가 뭘 깼나" 하고 헛수고한다. 경계를 붙일 것. */
const applyFn   = APPLY_FNS.find(n => new RegExp('function\\s+' + n + '\\s*\\(').test(code)) || null;
const stateName = findName(STATE_NAMES, n => new RegExp('(?:const|let|var)\\s+' + n + '\\s*='));

/* 선언에서 초기값만 뽑는다 — 함수 슬라이스를 vm 으로 돌리면 electron 의존이 섞여 죽는다. */
const initOf = (name) => {
  if (!name) return null;
  const m = code.match(new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*([^;\\n]+)'));
  if (!m) return null;
  const v = Number(String(m[1]).trim());
  return isFinite(v) ? v : null;
};
const alphaInit = initOf(alphaName);
const onValue   = initOf(onName);
const applyBody = applyFn ? (code.match(new RegExp('function\\s+' + applyFn + '[\\s\\S]*?\\n\\}')) || [null])[0] : null;

/* ══ 1. 알파 값 — 이 갈래가 성립하는 조건 자체 ════════════════════════════ */
say('── 1. 알파 값이 판정 조건을 만족하는가 (0 < alpha < 255)');
{
  if (onName == null) huh('켬 값 상수를 못 찾음 — 후보: ' + ON_NAMES.join(' / ') + ' (개명했다면 ON_NAMES 맨 앞에 추가)');
  else if (onValue == null) huh('  ' + onName + ' 의 초기값을 숫자로 못 읽음');
  else {
    /* 255 면 `alpha < 255` 에 안 걸려 통로가 통째로 무효가 된다. 0 이면 켜도 꺼진 것과 같다. */
    chk(onValue > 0 && onValue < 255, '★ 켬 값이 0 초과 255 미만이다 — 현재 ' + onValue + ' (255 면 예외에 안 걸려 무효)');
    /* 값을 낮춰도 판정은 똑같이 걸리고 캐릭터만 흐려진다. 문턱이 아니라 표식이다. */
    chk(onValue >= 240, '켬 값이 240 이상이다 — 현재 ' + onValue + ' (더 낮춰도 효과는 같고 캐릭터만 흐려진다)');
  }
  chk(/255/.test(src) && /alpha\s*<\s*255|alpha < 255/.test(src),
    '판정 원문(alpha < 255)이 주석에 남아 있다 — 이게 없으면 252 가 "왜 이 숫자냐"가 된다');
}

/* ══ 2. 기본은 꺼짐 — 실기기 검증 전이라는 사실이 코드에 남아 있는가 ══════ */
say('\n── 2. ★ 기본이 꺼짐인가 (미검증 갈래를 전원에게 걸지 않는다)');
{
  if (alphaName == null) huh('알파 변수를 못 찾음 — 후보: ' + ALPHA_NAMES.join(' / '));
  else if (alphaInit == null) huh('  ' + alphaName + ' 의 초기값을 숫자로 못 읽음');
  else {
    /* ⚠️ 실기기에서 효과가 확인돼 기본으로 올리는 날, 이 검사는 **의도적으로** ✗ 를 낸다.
       그때 이 파일을 같이 고치라는 뜻이다 — 조용히 뒤집히는 것을 막는 것이 목적이다. */
    chk(alphaInit === 0, '★ 기본값이 0(꺼짐)이다 — 현재 ' + alphaInit
      + ' (기본으로 올리기로 했다면 이 검사도 같이 고칠 것)');
  }
  chk(/실기기/.test(src) && /미검증|검증 전/.test(src),
    '"실기기 미검증"이 주석에 남아 있다 — 이 한 줄이 기본값을 지킨다');
  chk(/electron#40515/.test(src),
    '★ 반대 위험(우리 창이 검어짐) 이슈 번호가 남아 있다 — 제보가 오면 여기부터 본다');
  chk(/let\s+' + '/.test('') || new RegExp('let\\s+' + (alphaName || 'OVERLAY_LAYERED_ALPHA')).test(code),
    '알파가 const 가 아니라 let 이다 — 토글이 런타임에 바꿔야 한다');
}

/* ══ 3. 거는 함수 — 안전장치와 끄는 길 ═══════════════════════════════════ */
say('\n── 3. 알파를 거는 함수');
{
  if (!applyBody) huh('적용 함수를 못 찾음 — 후보: ' + APPLY_FNS.join(' / '));
  else {
    chk(/isDestroyed\(\)/.test(applyBody), '창이 없거나 파괴됐으면 빠져나간다 — 부팅·종료 경계에서 죽지 않는다');
    chk(/win32/.test(applyBody), '★ win32 한정이다 — 이 판정은 Windows 크로미움의 것이다');
    chk(/setOpacity/.test(applyBody) || /_setOpacitySafe/.test(applyBody),
      '★ setOpacity 를 거친다 — Electron 의 layered_ 를 켜는 통로는 이것 하나뿐이다');
    /* 끄기: 알파를 1.0(=255)으로 되돌리면 `alpha < 255` 에 안 걸린다. 이 길이 없으면
       토글을 꺼도 안 꺼져서 A/B 자체가 성립하지 않는다. */
    chk(/else\s*\{[\s\S]*?(1\)|1\.0\))/.test(applyBody) || /_setOpacitySafe\(1\)/.test(applyBody),
      '★ 끄기 경로가 알파를 1.0 으로 되돌린다 — 없으면 토글을 꺼도 안 꺼진다');
    if (stateName == null) huh('  상태 변수를 못 찾음 — 후보: ' + STATE_NAMES.join(' / '));
    else chk(new RegExp(stateName).test(applyBody) && /_diagLog/.test(applyBody),
      '실제로 걸렸는지를 진단 로그에 남긴다 — 옛 빌드/꺼진 빌드를 로그로 가른다');
    chk(/try\s*\{[\s\S]*?catch/.test(code.match(/function\s+_setOpacitySafe[\s\S]*?\n\}/)?.[0] || applyBody),
      'setOpacity 실패를 삼키지 않고 상태로 돌려준다 — 조용한 실패는 진단을 막는다');
  }
}

/* ══ 4. ★ 호출 자리 — 주기 호출이 §2-1(setBounds 폭풍)을 재현한다 ════════ */
say('\n── 4. ★ 부르는 자리가 둘뿐인가 (스타일 변경 자체가 재계산 훅이다)');
{
  if (!applyFn) huh('적용 함수를 못 찾아 호출 자리를 셀 수 없음');
  else {
    const calls = (code.match(new RegExp(applyFn + '\\s*\\(', 'g')) || []).length;
    /* 정의 1 + 호출 2(부팅 · 토글 조작). 셋 다 사람이 부르는 자리다. */
    chk(calls === 3, '★ 호출 자리가 2곳이다(정의 1 + 호출 2) — 실제 ' + (calls - 1)
      + '곳. 늘었다면 주기 호출이 아닌지 확인할 것');
    chk(new RegExp(applyFn + "\\s*\\(\\s*'부팅'").test(code), '  부팅 때 한 번 건다');
    chk(new RegExp('setLabVideo[\\s\\S]{0,400}?' + applyFn).test(code), '  토글 조작 때 다시 건다');
    /* 타이머 안에서 부르면 핸드오프4 §4-2(906회/30분)·§2-1(417회/9분) 을 우리 손으로 재현한다. */
    const inTimer = new RegExp('set(?:Interval|Timeout)\\([\\s\\S]{0,300}?' + applyFn).test(code);
    chk(!inTimer, '★ 타이머 안에서 부르지 않는다 — 주기 호출은 고치려던 깜빡임을 만든다');
    chk(!new RegExp('setIgnoreMouseEvents[\\s\\S]{0,300}?' + applyFn).test(code),
      '★ setIgnoreMouseEvents 왕복마다 다시 부르지 않는다 — 한 번이면 layered_ 가 유지한다');
  }
}

/* ══ 5. 설정 파일 통로 — 빌드 없이 A/B 를 돌릴 수 있는가 ═════════════════ */
say('\n── 5. 빌드 없이 껐다 켜는 통로');
{
  const mLoad = code.match(/function\s+loadSettings[\s\S]*?\n\}/);
  const mSave = code.match(/function\s+saveSettings[\s\S]*?\n\}/);
  if (!mLoad) huh('loadSettings 를 못 찾음');
  else {
    chk(mLoad[0].includes(FILE_KEY), '★ loadSettings 가 ' + FILE_KEY + ' 를 읽는다 — 제보자에게 "이 숫자만 바꿔 보세요"가 성립한다');
    chk(/Math\.max\(0[\s\S]{0,80}Math\.min\(255/.test(mLoad[0]),
      '  파일 값을 0~255 로 가둔다 — 손으로 넣은 이상한 값이 창을 못 지운다');
  }
  if (!mSave) huh('saveSettings 를 못 찾음');
  else chk(mSave[0].includes(FILE_KEY), '★ saveSettings 가 ' + FILE_KEY + ' 를 쓴다 — 안 쓰면 다음 저장 때 실험 설정이 사라진다');
}

/* ══ 6. ★ 갭 불간섭 — 토글이 최대화 방어를 뺏으면 안 된다 ════════════════ */
say('\n── 6. ★ 토글이 아래틈(갭)을 건드리지 않는가');
{
  /* 갭 0 은 "최대화 방어를 끈다"는 뜻이라 증상이 있는 사람에게 순손해다. 그 값은 설정 파일로만
     만진다(우리가 갈래를 가를 때 쓰는 조합). 토글은 **알파만** 바꾼다. */
  const mSetIpc = code.match(new RegExp("ipcMain\\.handle\\(\\s*'" + IPC_SET + "'[\\s\\S]*?\\n\\s*\\}\\);"));
  if (!mSetIpc) huh('setLabVideo 핸들러를 못 찾음 — 채널명이 바뀌었다면 IPC_SET 을 고칠 것');
  else {
    chk(!/OVERLAY_GAP|overlayBottomGap|overlayGapFor|runOverlayHeight/.test(mSetIpc[0]),
      '★ 토글 핸들러가 갭 심볼을 전혀 건드리지 않는다');
    chk(!/setBounds|setSize/.test(mSetIpc[0]),
      '★ 토글이 창 크기를 만지지 않는다 — 크기 변경은 §2-1 폭주의 입구다');
    chk(/saveSettings\(\)/.test(mSetIpc[0]), '토글 상태가 파일에 저장된다 — 재시작해도 유지돼야 A/B 가 성립한다');
  }
  chk(/알파만/.test(src), '"알파만 바꾼다"가 주석에 못박혀 있다');
}

/* ══ 7. 토글 통로 4단 — 하나만 끊겨도 "눌러도 반응 없는 버튼"이 된다 ════ */
say('\n── 7. 토글 통로 4단 (main IPC → preload → HTML → app.js)');
{
  chk(code.includes(IPC_GET) && code.includes(IPC_SET), '① main 에 IPC 두 개가 있다');

  const pre = readIf('preload.js');
  if (pre == null) skip('preload.js 가 옆에 없어 ②단은 건너뜀 (프로젝트 폴더에서 돌리면 검사된다)');
  else {
    const p = stripComments(pre);
    chk(p.includes(IPC_GET) && p.includes(IPC_SET), '② preload 가 두 채널을 모두 연다');
    chk(/getLabVideo/.test(p) && /setLabVideo/.test(p), '  이름이 렌더러 쪽과 같다');
  }

  const html = readIf('desk-companion-prototype.html');
  if (html == null) skip('HTML 이 옆에 없어 ③단은 건너뜀');
  else {
    chk(html.includes(UI_ROW) && html.includes(UI_BTN), '③ HTML 에 칸과 버튼이 있다');
    /* 통로가 없는 구버전에서는 칸 자체를 숨긴다 — 눌러도 반응 없는 버튼은 "고장났다"는 제보가 된다. */
    chk(new RegExp('id="' + UI_ROW + '"[^>]*display\\s*:\\s*none').test(html),
      '  ★ 기본이 숨김이다 — app.js 가 통로를 확인한 뒤에만 보여준다');
    /* 이름을 '실험실'로 하지 않은 것은 의도다: 뜻 모르고 켜 보는 사람을 막는다.
       ⚠️ HTML 주석에는 폐기된 🧪 칸의 경위가 그대로 남아 있다(남아 있어야 한다).
         원문을 훑으면 그 주석에 오탐하므로 **주석을 걷어낸 뒤 칸 마크업만** 본다. */
    const htmlNoCmt = html.replace(/<!--[\s\S]*?-->/g, '');
    const iRow = htmlNoCmt.indexOf(UI_ROW);
    const rowMarkup = iRow < 0 ? '' : htmlNoCmt.slice(iRow, iRow + 600);
    if (iRow < 0) huh('  주석을 걷어내니 칸을 못 찾음 — 칸 전체가 주석 처리됐는지 확인할 것');
    else chk(!/🧪/.test(rowMarkup),
      '  칸 이름에 🧪(실험실)를 쓰지 않는다 — 증상 이름을 붙여야 그 증상이 없는 사람이 안 켠다');
  }

  const app = readIf('app.js');
  if (app == null) skip('app.js 가 옆에 없어 ④단은 건너뜀');
  else {
    const a = stripComments(app);
    chk(/refreshLabVideoUI/.test(a), '④ app.js 에 갱신 함수가 있다');
    chk(/companion\.getLabVideo/.test(a) && /companion\.setLabVideo/.test(a), '  두 통로를 모두 부른다');
    chk(/if\s*\(\s*!\s*\(\s*window\.companion\s*&&\s*companion\.getLabVideo\s*\)/.test(a),
      '  ★ 구버전이면 칸을 숨긴다 — 통로 없는 버튼을 내보내지 않는다');
    chk(new RegExp('progTabBtnSystem[\\s\\S]{0,400}?refreshLabVideoUI').test(a),
      '  시스템 탭을 열 때 상태를 다시 읽는다 — 파일로 바꾼 값이 화면과 어긋나지 않는다');
  }
}

/* ══ 8. 되살아나면 안 되는 것 (핸드오프6 §8) ═════════════════════════════ */
say('\n── 8. 폐기된 갈래가 되살아나지 않았는가');
{
  chk(!/setFocusable\(\s*false\s*\)/.test(code),
    '★ NOACTIVATE(setFocusable(false))가 없다 — IME 가 원리적으로 죽는다. 폐기됨');
  chk(!/setSkipTaskbar\(\s*true\s*\)/.test(code),
    '★ setSkipTaskbar(true) 가 없다 — flashFrame(초대 알림)과 Alt+Tab 이 함께 죽는다');
  chk(!/WS_EX_TOOLWINDOW/.test(code),
    'TOOLWINDOW 를 코드에서 쓰지 않는다 — 같은 이유다(주석의 설명은 남아 있어도 된다)');
  chk(!/🧪/.test(code), '실험 표시(🧪) 잔재가 없다 — 폐기된 칸이 위험해진 이유가 그것이었다');
}

/* ══ 9. 성공했을 때 걷어낼 자리 목록 — 토글은 영구물이 아니다 ═══════════ */
say('\n── 9. 마이그레이션 재료 (성공하면 지운다)');
{
  /* 한 번 내보낸 토글은 켜 둔 사용자가 생겨 나중에 지우기 어려워진다. 폐기된 🧪 칸이
     정확히 그 이유로 위험해졌다. 그래서 "어디를 지울지"를 지금 적어 둔다. */
  chk(/성공하면 지운다|기본 동작으로 올리/.test(src),
    '★ "성공하면 지운다"가 주석에 남아 있다 — 토글을 영구물로 오해하지 않게 한다');
  chk(/preload/.test(src) && /app\.js/.test(src),
    '  걷어낼 자리(preload·app.js·IPC)가 주석에 열거돼 있다');
  chk(/setOpacity/.test(src) && /layered_/.test(src),
    '  왜 setOpacity 한 번이면 되는지(layered_)가 남아 있다 — 이게 없으면 주기 호출로 되돌아간다');
  chk(/IsWindowVisibleAndFullyOpaque/.test(src),
    '  판정 함수 이름이 남아 있다 — 다음 사람이 원문을 다시 찾을 수 있다');
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + unknown + (skipped ? ' · 건너뜀 ' + skipped : ''));
if (unknown) say('  ? 는 심볼이 개명·이동됐다는 뜻이다. main.js 를 고쳤다면 **이 파일도 같이 고칠 것.**');
if (fail)    say('  ✗ 는 지켜야 할 것이 깨진 것이다.');
if (!fail && !unknown) say('  ✓ 전부 통과');
/* 종료 코드: 1=실패, 2=검사못함. 2 를 0 으로 만들면 이 파일도 조용히 죽는다. */
process.exit(fail ? 1 : (unknown ? 2 : 0));
