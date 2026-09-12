#!/usr/bin/env node
/* sim-overlay-gap.js — ★ 동영상 검어짐 해법: 실행 오버레이를 작업영역보다 **물리 N px** 짧게
 *
 *   · 크로미움은 자기 창이 **완전히** 덮이면 그리기를 멈추고 JS 까지 스로틀한다.
 *     우리 창이 작업영역과 정확히 같은 크기라 최대화된 창과 딱 맞아떨어져 그게 성립했다.
 *   · 몇 px 짧게 만들면 성립이 깨진다. 이 파일이 지키는 것은 **그 몇 px 이 실제로 살아 있는가** 뿐이다.
 *   · ⚠️ 검어짐 자체는 눈으로만 확인된다. 여기서 통과했다고 증상이 안 난다는 뜻이 아니다 —
 *     여기서 실패하면 증상이 **반드시** 돌아온다는 뜻이다.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * [이 파일은 세 번째 판이다 — 왜 두 번이나 조용히 죽었나]
 *   1판: 상수 이름이 `OVERLAY_BOTTOM_GAP` 이던 시절에 쓰였다.
 *   2판: 핸드오프4 §7 이 되살렸으나 프로젝트에 저장되지 않아 유실됐다.
 *   그래서 프로젝트에는 계속 1판이 남았고, 상수가 `OVERLAY_GAP_PHYSICAL_PX` 로 개명된 뒤로는
 *   **첫 줄에서 exit(1)** 하고 있었다. 아무도 몰랐다.
 *
 *   ⇒ 3판에서 고친 것 셋 (핸드오프5 §7 이 적어 둔 그대로):
 *     ① 상수 이름 **후보를 여러 개** 받는다 — 또 개명돼도 안 죽는다.
 *     ② ★ **"검사 실패"와 "검사를 못 함"을 화면에서 구분한다.** 이게 이 파일이 두 번이나
 *        조용히 죽은 이유다 — 둘 다 `✗` 한 줄로만 보였다.
 *          ✗ = 지켜야 할 것이 깨졌다 (main.js 를 고쳐라)
 *          ? = 검사가 대상을 못 찾았다 (개명·이동됐다 — **이 파일을** 같이 고쳐라)
 *        그리고 `?` 만 남아도 **종료 코드 2** 로 끝낸다. 0 으로 끝나면 또 묻힌다.
 *     ③ 배율 1 / 1.25 / 1.5 / 1.75 / 2 / 2.5 에서 **물리 픽셀이 목표치 이상인가**.
 *        "어떤 PC 는 되고 어떤 PC 는 안 된다"의 답이 배율이었다(4K·150% 정상, QHD 재발).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   실행: node sim-overlay-gap.js        (main.js 와 같은 폴더에서)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let fail = 0, unknown = 0, pass = 0;
const say = console.log;
const ok  = (m) => { pass++;    say('  ✓ ' + m); };
const bad = (m) => { fail++;    say('  ✗ ' + m); };
const huh = (m) => { unknown++; say('  ? ' + m); };
/* 건너뜀 — **환경 때문에 못 본 것**이지 심볼이 드리프트한 게 아니다. 종료 코드에 안 넣는다.
   (?(=검사못함)와 섞으면 "app.js 가 옆에 없다"만으로 매번 exit 2 가 되어 신호가 죽는다) */
let skipped = 0;
const skip = (m) => { skipped++; say('  · ' + m); };
/* chk 는 참/거짓만 가른다. **대상을 못 찾은 경우는 chk 를 부르지 말고 huh 를 직접 부를 것** —
   그 둘을 섞는 순간 이 파일은 네 번째로 조용히 죽는다. */
const chk = (cond, m) => (cond ? ok(m) : bad(m));

const SRC = path.join(__dirname, 'main.js');
if (!fs.existsSync(SRC)) {
  say('? main.js 를 못 찾음 — main.js 가 있는 폴더에서 실행할 것');
  process.exit(2);
}
const src = fs.readFileSync(SRC, 'utf8');

/* ── 상수·헬퍼만 떼어 평가한다 (electron 을 안 부르는 순수 구간) ─────────────
   ★ 이름 후보를 여러 개 받는다. 새 이름은 **앞에** 붙일 것. */
const GAP_NAMES = ['OVERLAY_GAP_PHYSICAL_PX', 'OVERLAY_BOTTOM_GAP', 'OVERLAY_GAP_PX'];
const MAX_NAMES = ['OVERLAY_GAP_MAX'];
const HEIGHT_FN = 'runOverlayHeight';
const GAPFOR_FN = 'overlayGapFor';

let gapName = null, from = -1;
for (const n of GAP_NAMES) {
  const i = src.search(new RegExp('(?:const|let|var)\\s+' + n + '\\s*='));
  if (i >= 0) { gapName = n; from = i; break; }
}
const hIdx = src.indexOf('function ' + HEIGHT_FN);
const to = hIdx >= 0 ? src.indexOf('\n', hIdx) : -1;

let G = null;
if (from < 0) {
  huh('갭 상수를 못 찾음 — 후보: ' + GAP_NAMES.join(' / ') + '. 개명됐다면 GAP_NAMES 맨 앞에 추가할 것');
} else if (to < 0) {
  huh('function ' + HEIGHT_FN + ' 을 못 찾음 — 개명됐다면 HEIGHT_FN 을 고칠 것');
} else {
  const slice = src.slice(from, to);
  const maxName = MAX_NAMES.find(n => new RegExp('(?:const|let|var)\\s+' + n).test(slice)) || null;
  try {
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(slice + ';globalThis.__G = {' +
      ' GAP: ' + gapName + ',' +
      ' MAX: ' + (maxName || 'null') + ',' +
      ' h: typeof ' + HEIGHT_FN + ' === "function" ? ' + HEIGHT_FN + ' : null,' +
      ' gapFor: typeof ' + GAPFOR_FN + ' === "function" ? ' + GAPFOR_FN + ' : null,' +
      ' setGap: (v)=>{ ' + gapName + ' = v; }, getGap: ()=>' + gapName + ' };',
      ctx, { filename: 'main-gap-slice.js' });
    G = ctx.__G;
  } catch (e) {
    huh('상수 구간을 떼어 평가하지 못함 (' + (e && e.message) + ') — 구간에 electron 의존 코드가 섞였을 수 있다');
  }
}
const display = (sf) => ({ scaleFactor: sf });

/* 주석을 걷어낸 본문. 6절(실험 하네스 잔재)은 **반드시 이쪽**을 봐야 한다 —
   main.js 에는 폐기된 실험을 설명하는 주석이 코드 조각째로 남아 있어서(NOACTIVATE·모드 A~I),
   원문을 그대로 훑으면 "되살아났다"고 오탐한다. 반대로 7절(근거 주석 보존)은 원문을 봐야 한다. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = stripComments(src);

say('── 1. 틈이 실제로 있는가 (이게 0 이면 증상이 그대로 돌아온다)');
if (!G) huh('상수를 못 읽어 1절 전체를 건너뜀');
else {
  chk(G.GAP >= 1, '★ 목표 물리 갭이 1px 이상이다 — 현재 ' + G.GAP + 'px (0 이면 완전 차폐가 다시 성립)');
  /* ⚠️ 핸드오프5 §2-2: 12 로도 제보가 오면 **숫자를 키우지 말 것.** 창모드 상대 창에는 값과
     무관하므로 키워도 안 듣고, 캐릭터 판정이 안 되는 띠만 넓어진다. 32 는 신호선이다. */
  chk(G.GAP <= 32, '32px 를 넘지 않는다 — 넘겨야 한다면 갭 갈래가 틀렸다는 신호다 (현재 ' + G.GAP + 'px)');
  if (G.MAX == null) huh('상한 상수(' + MAX_NAMES.join('/') + ')를 못 찾음 — 설정 파일로 들어온 값을 막을 곳이 없다');
  else chk(G.MAX >= G.GAP, '상한 ' + G.MAX + ' 이 기본값 ' + G.GAP + ' 이상이다');
}

say('\n── 2. ★ 배율 — "어떤 PC 는 되고 어떤 PC 는 안 된다"의 답이 여기였다');
if (!G || !G.gapFor) huh(GAPFOR_FN + ' 을 못 찾음 — 2절 전체를 건너뜀 (개명됐다면 GAPFOR_FN 을 고칠 것)');
else {
  /* setBounds 는 DIP 기준이라, 코드에 12 라고 적어도 실제 벌어지는 물리 틈은 배율마다 다르다.
     overlayGapFor 가 배율로 되돌려 주는지를 **물리 픽셀로 환산해서** 확인한다. */
  let mono = true, prev = Infinity;
  for (const sf of [1, 1.25, 1.5, 1.75, 2, 2.5]) {
    const dip = G.gapFor(display(sf));
    const phys = dip * sf;
    chk(phys >= G.GAP, '배율 ' + sf + ' → DIP ' + dip + ' = 물리 ' + phys.toFixed(2) + 'px (목표 ' + G.GAP + ' 이상)');
    if (dip > prev) mono = false;
    prev = dip;
  }
  chk(mono, '배율이 커질수록 DIP 가 줄어든다 — 같은 물리 크기를 유지한다는 뜻');
  chk(G.gapFor(display(4)) >= 1, '초고배율에서도 DIP 가 0 으로 안 내려간다 — 0 이면 틈이 통째로 사라진다');
  chk(G.gapFor(display(0)) >= 1, '배율 0(비정상 값)이 와도 1 이상을 돌려준다');
  chk(G.gapFor(undefined) >= 1, 'display 가 없어도 죽지 않는다 — 부팅 초기에 null 이 올 수 있다');

  /* ★ 갭 0 = "이 갈래를 끈다"는 뜻이다. 여기서 1 을 돌려주면 요청 높이가 작업영역-1 이 되는데,
     배율 1.5 에서 그 1 DIP 은 OS 반올림에 삼켜져 **요청과 실제가 영원히 어긋난다.**
     그러면 _winAlreadyIs 가 매번 실패해 setBounds 가 초당 여러 번 나간다(실측 417회/9분).
     ⇒ 제보용 실험 설정 하나가 조용히 다른 사고를 만드는 자리였다. 검사로 묶는다. */
  if (typeof G.setGap !== 'function') huh('갭 상수를 바꿔 볼 수 없어 "갭 0" 검사를 건너뜀');
  else {
    const keep = G.getGap();
    try {
      G.setGap(0);
      chk(G.gapFor(display(1.5)) === 0, '★ 갭 0 을 요청하면 DIP 도 0 이다 — 1 로 올리면 억제가 깨진다');
      if (G.h) chk(G.h(1392, display(1.5)) === 1392, '  갭 0 에서 창 높이가 작업영역과 같다 (OS 가 되돌릴 여지가 없다)');
    } finally { G.setGap(keep); }
  }
}

say('\n── 3. 말도 안 되는 값이 들어와도 창이 사라지지 않는다');
if (!G || !G.h) huh(HEIGHT_FN + ' 을 못 읽어 3절을 건너뜀');
else {
  const d1 = display(1);
  const gap1 = G.gapFor ? G.gapFor(d1) : G.GAP;
  chk(G.h(1040, d1) === 1040 - gap1, '작업영역 1040 → 창 ' + G.h(1040, d1) + ' (배율 1)');
  chk(G.h(2160, d1) === 2160 - gap1, '고해상도에서도 같은 크기만 뺀다 — 비율이 아니라 절대값이다');
  chk(G.h(50, d1) === 100, '★ 작업영역이 비정상적으로 작아도 최소 100px 은 지킨다 — 음수 높이는 창 생성 자체를 깬다');
  chk(G.h(100, d1) === 100, '경계에서도 같다');
  chk(G.h(1040, display(1.5)) < 1040, '배율 1.5 에서도 반드시 줄어든다 — 0 을 빼면 증상이 돌아온다');
}

say('\n── 4. run 크기를 정하는 자리가 **전부** 이 함수를 거치는가');
{
  /* ★ 이게 이 파일의 핵심 검사다. 크기를 정하는 자리가 여럿이라, 한 곳만 고치면
     **모니터를 옮기거나 배율을 바꾸는 순간** 원래 크기로 돌아가 증상이 조용히 재발한다.
     그때 사용자에게는 "어떨 때는 되고 어떨 때는 안 된다"로 보여서 원인을 찾기가 가장 어렵다. */
  const bare = src.match(/setBounds\(\s*\{[^}]*height:\s*wa\.height\s*[,}]/g) || [];
  chk(bare.length === 0, '★ 작업영역 높이를 그대로 쓰는 run 크기 지정이 하나도 없다' +
      (bare.length ? ' — ' + bare.length + '곳 남음' : ''));
  const viaHelper = (src.match(new RegExp(HEIGHT_FN + '\\(', 'g')) || []).length;
  chk(viaHelper >= 4, HEIGHT_FN + ' 를 거치는 자리 ' + viaHelper + '곳 (정의 1 + 호출 3 이상)');

  /* 크기를 정하는 자리 셋. 하나라도 빠지면 그 경로에서만 조용히 재발한다. */
  for (const [where, label] of [
    ['setConfigMode',           'setConfigMode(런처 ↔ 실행 전환)'],
    ['moveToDisplay',           'moveToDisplay(모니터 변경)'],
    ['display-metrics-changed', 'display-metrics-changed(해상도·배율 변경)'],
  ]) {
    if (!src.includes(where)) {
      huh(label + ' 자리를 못 찾음 — 사라진 것이면 ✗ 다. 개명된 것이면 이 목록을 고칠 것');
      continue;
    }
    const seg = src.slice(src.indexOf(where), src.indexOf(where) + 2500);
    chk(new RegExp(HEIGHT_FN + '\\(').test(seg), label + ' 가 ' + HEIGHT_FN + ' 를 거친다');
  }

  /* 같은 값으로 다시 부르는 것 자체가 크로미움의 가려짐 재계산 훅이다(핸드오프4 §4-2, 906회/30분). */
  chk(/_winAlreadyIs/.test(src), '같은 상태면 창 조작을 생략하는 억제(_winAlreadyIs)가 살아 있다');
  /* 억제는 "요청값 ↔ OS 가 돌려준 값"을 짝으로 기억해야 성립한다. 크기를 정하는 자리마다
     _noteApplied 를 같이 불러야 하고, 빠뜨리면 그 경로에서만 조용히 폭주한다. */
  const notes = (code.match(/_noteApplied\(/g) || []).length - 1;   // 정의 자신 제외
  if (notes < 0) huh('_noteApplied 를 못 찾음 — 억제가 요청값을 기억하지 않는 옛 판일 수 있다');
  else chk(notes >= 4, '_noteApplied 를 부르는 자리 ' + notes + '곳 (크기를 정하는 자리 4곳 전부)');
}

say('\n── 5. 빌드 없이 조절하는 통로가 남아 있는가');
{
  chk(/data\.overlayBottomGap/.test(src), 'loadSettings 가 overlayBottomGap 을 읽는다 — 제보자에게 "이 숫자만 바꿔 보세요"가 가능해야 한다');
  chk(/overlayBottomGap\s*:/.test(src), 'saveSettings 가 overlayBottomGap 을 쓴다 — 안 쓰면 다음 저장 때 유저 설정이 사라진다');
  chk(/물리 /.test(src), '진단 로그가 DIP 가 아니라 **물리 픽셀**을 남긴다 — 의미 있는 값은 이쪽이다');
  chk(/목표 물리/.test(src), '로그에 목표치가 같이 찍힌다 — 실제값과 목표를 한 줄에서 대조할 수 있다');
  chk(/틈이 없다/.test(src), '물리 0px 일 때 경고가 붙는다 — 이 줄 하나로 "OS 가 크기를 깎았다"가 갈린다');
}

say('\n── 5-2. 📄 설정 파일이 없는 사람도 진단할 수 있는가');
{
  /* getRunDisplay 는 `if(!found) return primary` 로 먼저 빠져나가서, 모니터를 한 번도 고른 적
     없는 사용자에게는 저장 줄이 영원히 실행되지 않았다 — 그래서 파일이 아예 안 생겼다.
     파일이 없으면 "이 파일 보내주세요"도 "이 숫자 바꿔 보세요"도 성립하지 않아 진단이 막힌다. */
  if (!/_ensureSettingsFile/.test(code))
    bad('★ 설정 파일 자동 생성(_ensureSettingsFile)이 없다 — 모니터를 안 고른 사용자는 파일이 안 생겨 진단이 막힌다');
  else {
    ok('설정 파일 자동 생성이 있다');
    /* 앵커는 파일명으로 잡는다 — `SETTINGS_PATH = ` 로 잡으면 위쪽의 `let SETTINGS_PATH = null;`
       선언에 먼저 걸려서 부팅 구간을 못 본다(2026-08-26 에 실제로 그렇게 헛짚었다). */
    const iAnchor = code.indexOf("'tw-settings.json'");
    const boot = iAnchor < 0 ? '' : code.slice(iAnchor, iAnchor + 600);
    const iLoad = boot.indexOf('loadSettings()'), iEnsure = boot.indexOf('_ensureSettingsFile()');
    if (iLoad < 0 || iEnsure < 0) huh('  부팅 순서를 확인할 수 없음');
    else chk(iEnsure > iLoad, '  ★ loadSettings 뒤에 부른다 — 앞에서 부르면 파일 값을 읽기 전에 기본값으로 덮어쓴다');
  }
  /* 만들 때만 로그를 남기면 "코드가 안 돌았다(옛 빌드)"와 "이미 있어서 안 만들었다"가
     로그에서 구분되지 않는다 — 2026-08-26 에 실제로 그 자리에서 한 번 막혔다.
     ⇒ 있을 때도 한 줄 남기고, 그 줄로 빌드를 가를 수 있게 앱 버전을 함께 적는다. */
  const mEns = code.match(/function\s+_ensureSettingsFile[\s\S]*?\n\}/);
  if (!mEns) huh('_ensureSettingsFile 을 못 찾음');
  else {
    chk((mEns[0].match(/_diagLog/g) || []).length >= 2,
      '  ★ 파일이 있을 때도 로그를 남긴다 — 줄이 없어야만 옛 빌드라고 말할 수 있다');
    chk(/getVersion/.test(mEns[0]),
      '  앱 버전을 같이 적는다 — 옛 빌드 판정을 줄의 부재가 아니라 내용으로 한다');
    /* 승격은 메모리에만 걸린다. 파일에 세대 번호가 안 적히면 매 부팅 다시 승격하고,
       나중에 사람이 손으로 넣은 값까지 되돌리게 된다. 적는 자리는 createWindow 의 승격 로그 옆이다. */
    const mMig = code.match(/_gapMigratedFrom\s*!=\s*null\)\s*\{[\s\S]{0,400}?\n\s*\}/);
    if (!mMig) huh('  승격 기록 구간을 못 찾음 — _gapMigratedFrom 분기가 개명·이동됐다');
    else chk(/saveSettings\(\)/.test(mMig[0]),
      '  ★ 승격이 일어나면 파일에 적는다 — 안 적으면 매 부팅 다시 승격한다');
  }
  /* 저장 실패를 조용히 삼키면 "파일이 왜 없나"를 영원히 못 가른다(시도 실패인지 시도 안 함인지). */
  const mSave = code.match(/function\s+saveSettings[\s\S]*?\n\}/);
  if (!mSave) huh('saveSettings 를 못 찾음');
  else chk(/_diagLog/.test(mSave[0]), '저장 실패가 로그에 남는다 — 조용한 실패는 진단을 막는다');
}

say('\n── 6. 실험 하네스가 남아 있지 않은가');
{
  /* 모드 A~I 는 원인을 가르기 위한 장치였다. 역할이 끝났으므로 한 조각도 남으면 안 된다 —
     남으면 전역 단축키가 살아 있어 사용자가 모르고 눌러 통과 고정에 걸릴 수 있다. */
  for (const [pat, name] of [
    [/globalShortcut/,                         '전역 단축키'],
    [/_ovSetMode|OV_MODES|__ovBadge/,          '모드 전환·배지'],
    [/__ovNoFloater|__ovFreeze|__ovDeadClick/, '렌더러 실험 전역'],
    [/🧪/,                                     '실험 표시(🧪)'],
  ]) chk(!pat.test(code), name + ' 흔적 없음');

  /* NOACTIVATE 는 IME 가 원리적으로 죽어서 폐기됐다. 되살아나면 한/영 전환이 통째로 사라진다. */
  chk(!/setFocusable\s*\(\s*false\s*\)/.test(code), 'NOACTIVATE 실험(setFocusable(false))이 되살아나지 않았다');

  const APP = path.join(__dirname, 'app.js');
  if (!fs.existsSync(APP)) skip('app.js 가 옆에 없어 렌더러 쪽 실험 흔적은 건너뜀 (프로젝트 폴더에서 돌리면 검사된다)');
  else {
    const a = stripComments(fs.readFileSync(APP, 'utf8'));
    chk(!/__ovNoFloater|__ovFreeze|__ovDeadClick|_ovFrozen|🧪/.test(a), 'app.js 도 원본 상태(실험 세 자리 전부 제거)');
  }
}

say('\n── 7. 되돌리는 길·근거가 주석에 남아 있는가');
{
  /* 이 절은 코드가 아니라 **다음 사람**을 지킨다. 근거가 지워지면 갭은 "쓸데없어 보이는 상수"가 되고,
     누군가 반드시 0 으로 되돌린다. 실제로 한 번 그렇게 됐다. */
  chk(/electron#49024/.test(src), '★ 근거 이슈 번호가 주석에 남아 있다');
  chk(/창모드/.test(src), '남은 구멍(창모드 상대 창에는 안 듣는다)이 주석에 적혀 있다');
  chk(new RegExp(gapName || 'OVERLAY_GAP').test(src), '값이 상수 하나로 모여 있다 — 고칠 때 여기만 본다');
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + unknown + (skipped ? ' · 건너뜀 ' + skipped : ''));
if (unknown) say('  ? 는 심볼이 개명·이동됐다는 뜻이다. main.js 를 고쳤다면 **이 파일도 같이 고칠 것.**');
if (fail)    say('  ✗ 는 지켜야 할 것이 깨진 것이다.');
if (!fail && !unknown) say('  ✓ 전부 통과');
/* 종료 코드: 1=실패, 2=검사못함. 2 를 0 으로 만들면 이 파일이 네 번째로 조용히 죽는다. */
process.exit(fail ? 1 : (unknown ? 2 : 0));
