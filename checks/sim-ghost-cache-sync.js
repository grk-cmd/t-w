#!/usr/bin/env node
/* sim-ghost-cache-sync.js — 👻 "캐릭터 위 2초 얹기"가 유령을 푸는 통로를 지킨다
 *
 *   [제보 2026-08-31] "고스트 현상(프로그램이 전혀 안 눌리고 클릭이 뒤로 투과)에서
 *     캐릭터 위에 2초 커서를 얹는 방법으로 빠져나오곤 했는데, 오늘은 그것도 안 듣는다.
 *     껐다 켜지 않는 한 선택이 안 된다."
 *
 *   [그 2초가 듣는 원리 — 세 조각이 다 이어져야 한다]
 *     ① main  _guardGhostPassthrough : 커서가 우리 UI 위에 GHOST_MS 머물렀는데도 통과면 찌른다
 *     ② main→렌더러 penHitTest       : 그 좌표로 정밀 재판정을 시킨다
 *     ③ 렌더러 _sendIgnore(false)    : "우리 UI 위다" → 클릭받기로 복귀
 *   ③ 이 **침묵하면** ①②가 아무리 돌아도 유령이 안 풀린다. 그리고 ③ 은 중복 방지를 위해
 *   `_ignoreSent === v` 면 IPC 를 보내지 않는다 — 즉 **렌더러 캐시가 틀려 있으면 통로가 죽는다.**
 *
 *   [캐시를 틀리게 만드는 자리] main 의 안전장치 ⓔ·ⓕ·ⓖ 는 렌더러에게 묻지 않고 혼자
 *     `_lastIgnoreRequested = true` 로 통과로 되돌린다. 그 순간 렌더러 캐시는 `false` 로 남는다.
 *     예전에는 penHitTest(null) 로 맞추려 했지만 그 경로는 렌더러의 150ms 디바운스를 타므로
 *     그 사이 mousemove 한 번에 취소된다 — 그래서 **가끔만** 살아났다.
 *   ⇒ 고침(2026-08-31): 찌를 때 main 이 자기 상태 `ig` 를 같이 싣고, 렌더러는 자기 캐시가
 *     그것과 다르면 캐시를 버리고 다시 판정한다. 판단 자체는 여전히 렌더러가 한다.
 *
 *   ⚠️ 이 파일이 지키는 것은 "유령이 안 난다"가 아니라 **"유령에서 빠져나오는 길이 살아 있는가"** 다.
 *     · 통로가 하나로 모여 있는가(_sendHitTest)
 *     · 혼자 통과로 되돌리는 자리마다 그 신호가 붙어 있는가
 *     · 렌더러가 main 의 상태를 자기 캐시보다 위에 두는가
 *     · 그 정정이 재판정 **앞**에서 일어나는가 (뒤면 그 판정이 또 침묵한다)
 *
 *   실행: node sim-ghost-cache-sync.js     (main.js · app.js 와 같은 폴더에서)
 */
'use strict';
const fs = require('fs');
const path = require('path');

let fail = 0, unknown = 0, pass = 0;
const say = console.log;
const ok  = (m) => { pass++;    say('  ✓ ' + m); };
const bad = (m) => { fail++;    say('  ✗ ' + m); };
const huh = (m) => { unknown++; say('  ? ' + m); };
/* chk 는 참/거짓만 가른다. **대상을 못 찾은 경우는 chk 가 아니라 huh 를 부를 것.** */
const chk = (cond, m) => (cond ? ok(m) : bad(m));

const HERE = __dirname;
function read(f){
  const p = path.join(HERE, f);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}
/* 주석에 코드 조각이 그대로 인용돼 있으므로, "살아 있는가" 검사는 **주석을 걷어낸 본문**을 본다.
   반대로 근거·경고 보존 검사는 원문을 봐야 한다(sim-overlay-layered.js 의 관례). */
function strip(src){
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const mainSrc = read('main.js');
const appSrc  = read('app.js');
if (!mainSrc || !appSrc){
  say('✗ main.js / app.js 를 같은 폴더에서 못 찾음');
  process.exit(2);
}
const mainCode = strip(mainSrc);
const appCode  = strip(appSrc);

/* ══ 1. 재판정 통로가 한 군데로 모여 있는가 ══════════════════════════════ */
say('── 1. 재판정 신호는 한 함수로만 나간다');
{
  const raw = (mainCode.match(/webContents\s*\.\s*send\(\s*'companion:penHitTest'/g) || []).length;
  chk(raw === 1, '★ 직접 send 하는 자리가 1곳뿐이다(_sendHitTest 안) — 실제 ' + raw
    + '곳. 늘었다면 ig 를 안 실은 신호가 생긴 것이다');

  const fn = mainCode.match(/function\s+_sendHitTest\s*\([\s\S]*?\n\}/);
  if (!fn) huh('_sendHitTest 를 못 찾음 — 개명됐다면 이 파일도 같이 고칠 것');
  else {
    chk(/\.ig\s*=\s*!!\s*_lastIgnoreRequested/.test(fn[0]),
      '★ main 의 **실제** 통과 상태를 싣는다 — 이 한 줄이 이 고침의 전부다');
    chk(/webContents\s*\.\s*send\(\s*'companion:penHitTest'/.test(fn[0]),
      '  실제로 그 채널로 보낸다');
    chk(/\{\s*left\s*:\s*true\s*\}/.test(fn[0]),
      '  payload 가 없으면 {left:true} 로 바꾼다 — null 로 보내면 ig 를 실을 자리가 없다');
    chk(/pen\s*===\s*undefined/.test(fn[0]),
      '  pen 표식은 그대로 유지한다 — 사다리의 헛구조 방지가 이 값을 본다(app.js _notePoke)');
  }
  chk(!/companion:penHitTest'\s*,\s*null/.test(mainCode),
    '★ null 로 보내는 자리가 남아 있지 않다 — null 은 ig 를 못 싣는 옛 통로다');
}

/* ══ 2. 혼자 통과로 되돌리는 자리마다 그 신호가 붙어 있는가 ═════════════ */
say('\n── 2. main 이 혼자 통과로 되돌리면 반드시 렌더러에 알린다');
{
  /* ⓔ 렌더러 무응답 · ⓕ 굳은 클릭받기 · ⓖ 다른 앱 입력 — 셋 다 렌더러에게 묻지 않고 뒤집는다.
     뒤집기만 하고 안 알리면 그 순간부터 렌더러 캐시가 틀어지고, 그게 이번 제보의 씨앗이다. */
  const sites = [];
  const re = /_lastIgnoreRequested\s*=\s*true\s*;/g;
  let m;
  while ((m = re.exec(mainCode))) sites.push(m.index);
  if (!sites.length) huh('혼자 되돌리는 자리를 못 찾음 — 안전장치가 통째로 사라졌는지 확인할 것');
  else {
    chk(sites.length >= 3, '  뒤집는 자리가 ' + sites.length + '곳 (ⓔ·ⓕ·ⓖ = 3곳이 기준)');
    const naked = sites.filter(i => !/_sendHitTest\s*\(/.test(mainCode.slice(i, i + 500)));
    chk(naked.length === 0, '★ 뒤집은 뒤 500자 안에서 전부 _sendHitTest 를 부른다 — 안 부르는 자리 '
      + naked.length + '곳. 하나라도 빠지면 그 경로로 든 유령은 2초 얹기로 안 풀린다');
  }
}

/* ══ 3. 렌더러 — main 의 상태가 내 캐시를 이기는가 ═══════════════════════ */
say('\n── 3. 렌더러는 main 이 알려준 상태를 자기 캐시보다 위에 둔다');
{
  const rx = appCode.match(/companion\.onPenHitTest\s*\(\s*pt\s*=>[\s\S]{0,2000}?\n\s{6}\}\);/);
  if (!rx) huh('onPenHitTest 수신부를 못 찾음 — 모양이 바뀌었다면 이 파일도 같이 고칠 것');
  else {
    const body = rx[0];
    chk(/pt\.ig/.test(body), '★ 수신부가 pt.ig 를 본다');
    chk(/typeof\s+pt\.ig\s*===\s*'boolean'/.test(body),
      '  구버전 main(ig 없음)에서는 아무것도 안 한다 — undefined 를 불일치로 세면 매번 캐시를 버린다');
    chk(/_ignoreSent\s*=\s*null/.test(body) && /_ignoring\s*=\s*null/.test(body),
      '★ 불일치면 두 캐시를 다 버린다 — _ignoring 만 남기면 miss 쪽 분기가 또 침묵한다');
    chk(/clearTimeout\s*\(\s*_ignoreDebounce\s*\)/.test(body),
      '  대기 중인 통과 예약도 같이 지운다 — 살아남으면 방금 되살린 판정을 덮는다');

    /* 순서가 뜻을 가진다. 정정이 재판정 **뒤**에 오면 그 재판정은 옛 캐시로 판단해 또 침묵하고,
       다음 찌르기까지 최소 GHOST_REPOKE_MS(3초)를 더 기다린다 — 포기 한도(3회) 안에서 낭비가 크다. */
    const iFix  = body.search(/_ignoreSent\s*=\s*null/);
    const iJudge = body.search(/_updateIgnore\s*\(/);
    if (iFix < 0 || iJudge < 0) huh('정정/재판정 자리를 못 찾아 순서를 볼 수 없음');
    else chk(iFix < iJudge, '★ 캐시 정정이 재판정 **앞**에 온다 — 뒤면 그 판정이 또 침묵한다');
  }
}

/* ══ 4. 없애서 고치지 않았는가 (중복 방지·사다리 게이트는 그대로) ═══════ */
say('\n── 4. 원래 있던 방어를 걷어내는 방식으로 고치지 않았다');
{
  const snd = appCode.match(/function\s+_sendIgnore\s*\([\s\S]*?\n\s{4}\}/);
  if (!snd) huh('_sendIgnore 를 못 찾음');
  else chk(/_ignoreSent\s*===\s*v\s*\)\s*return/.test(snd[0]),
    '★ 중복 방지가 살아 있다 — 이걸 빼면 통과 중 초당 100회 IPC 가 나가 깜빡임 쪽 사안을 건드린다');

  chk(/_ignoreSent\s*!==\s*true\s*\)\s*return/.test(appCode),
    '  사다리(__mouseKick)의 첫 게이트도 그대로다 — 이 고침은 게이트를 푸는 게 아니라 캐시를 맞추는 것이다');
  chk(/GHOST_MAX_POKES\s*=\s*3/.test(mainCode),
    '  포기 한도 3회도 그대로다 — 계속 찌르면 렌더러 사다리가 못 돈다(main.js GHOST_MAX_POKES 주석)');
}

/* ══ 5. 진단 — 다음 제보 때 갈래를 가를 수 있는가 ════════════════════════ */
say('\n── 5. 다음 제보에서 "그 통로가 들었는지"를 로그로 가른다');
{
  chk(/유령 해제/.test(mainSrc),
    '★ 재판정이 **들은** 경우의 기록이 있다 — 지금까지 로그엔 의심·포기만 있어 그 사이가 안 보였다');
  chk(/유령 회복 포기/.test(mainSrc), '  포기 기록은 그대로 남아 있다');
  chk(/_ghostPokes\s*>\s*0/.test(mainCode), '  찌른 뒤에 풀린 경우만 남긴다(평범한 전환까지 남기면 로그가 찬다)');
}

/* ══ 6. 근거 보존 — 왜 이렇게 됐는지가 남아 있는가 ═══════════════════════ */
say('\n── 6. 다음 사람이 되돌리지 않도록 근거가 남아 있다');
{
  chk(/새 IPC 채널을 파지 않았다|preload 를 고쳐야/.test(mainSrc),
    '  preload 무수정 규칙의 이유가 남아 있다');
  chk(/150ms|디바운스/.test(appSrc.slice(appSrc.indexOf('onPenHitTest'), appSrc.indexOf('onPenHitTest') + 3000)) ||
      /디바운스/.test(mainSrc),
    '  옛 동기화(penHitTest(null))가 왜 가끔만 들었는지가 남아 있다');
  chk(/워치독/.test(appSrc),
    '★ "통과를 임의로 풀지 않는다"는 원칙(예전 워치독 사고)이 남아 있다 — 이 고침도 그 선을 안 넘는다');
}

/* ══ 7. 캐릭터 좌표를 못 믿을 때 — 모른다고 말하는가, 확신으로 바꾸는가 ═══
   [제보 로그 2026-09-01] 이 값이 실제 캐릭터 자리와 45,000px 어긋난 구간이 세 번 있었고,
     그 구간은 **전부 앱 재시작으로만** 끝났다. 그 동안 유령 감시는 한 번도 발동하지 않았다
     (커서가 캐릭터 위여도 main 이 그린 원은 화면 밖이었으니까) — 즉 "캐릭터 위 2초 얹기"가
     아무 일도 일으키지 않는 상태였다. 제보 문구: "그 방법을 써도 벗어날 수가 없다." */
say('\n── 7. 못 믿을 캐릭터 좌표를 확신으로 바꾸지 않는다');
{
  chk(/_charProjSane/.test(appCode), '★ 렌더러에 투영 문지기가 있다');
  const g = appCode.match(/function\s+_charProjSane[\s\S]*?\n\}/);
  if (!g) huh('_charProjSane 을 못 찾음');
  else {
    chk(/isFinite/.test(g[0]), '  NaN·Infinity 를 거른다');
    chk(/innerWidth/.test(g[0]) && /innerHeight/.test(g[0]),
      '  화면 크기를 기준으로 본다 — 고정 픽셀 상수는 해상도가 바뀌면 틀린다');
  }
  const asg = appCode.match(/_charProjSane\s*\([\s\S]{0,400}?_charBoundsLatest\s*=\s*null/);
  chk(!!asg, '★ 문지기에 걸리면 좌표를 **안 보낸다**(null) — 틀린 값을 보내면 원이 화면 밖에 그려진다');
  chk(/charBad/.test(appCode) && /charBad/.test(mainCode),
    '  왜 못 믿는지가 하트비트를 타고 main 진단 기록까지 간다(다음 조사에서 범인을 지목한다)');

  chk(/bounds\.x\s*<=\s*-99999[\s\S]{0,80}null/.test(mainCode),
    '★ main 은 화면 밖 자리표를 좌표로 받지 않는다 — 예전엔 그걸 "저 멀리 있다"로 읽어 ⓖ 가 회수했다');
  chk(/!_lastCharBounds\s*&&\s*!_lastRegions\.length/.test(mainCode),
    '★ 좌표가 없어도 창 사각형만으로 계속 감시한다 — 여기서 통째로 물러나면 2초 얹기가 사라진다');
  {
    /* ⓖ 의 좌표 분기는 반대로 **물러나야** 한다. 좌표를 모르는데 "우리 UI 밖 클릭"이라고
       단정하면 그게 곧 유령을 만드는 자리다(회수 → 렌더러 캐시 어긋남 → 통로 사망). */
    const fgn = mainCode.match(/function\s+_guardForeignInput[\s\S]*?\n\}/);
    if (!fgn) huh('_guardForeignInput 을 못 찾음');
    else chk(/if\(!_lastCharBounds\s*\|\|\s*!_mainWinScreenBounds\)\s*return/.test(fgn[0]),
      '★ ⓖ 의 좌표 분기는 좌표가 없으면 판단을 보류한다');
  }
  chk(/캐릭터거리=보류|좌표보류/.test(mainSrc),
    '  로그에서 "거리 칸이 사라진 것"과 "보류 중"이 구분된다');
}

/* ══ 8. 재현 — 옛 동작은 갇히고, 새 동작은 빠져나온다 ════════════════════
   ⚠️ 아래는 두 파일의 **흉내**다(모델). 실제 코드를 부르는 게 아니므로, main.js/app.js 의
     상태 전이를 고치면 **여기도 같이 고칠 것.** 안 그러면 이 절이 거짓말을 하게 된다.
     그래도 1~6절은 원문을 직접 보므로, 이 절이 낡아도 나머지는 계속 진실을 말한다. */
say('\n── 8. 갇히는 순서를 그대로 재현한다 (모델)');
{
  function run(useIg, inject){
    const M = { ig: false, pokes: 0 };
    const R = { ing: false, sent: false, pending: null };

    const sendIgnore = (v) => {                 // app.js _sendIgnore
      R.pending = null;
      if (R.sent === v) return;                 // ← 중복 방지: 여기서 침묵하면 통로가 죽는다
      R.sent = v; M.ig = v;
    };
    const updateIgnore = (hit) => {             // app.js _updateIgnore
      if (hit){ R.ing = false; sendIgnore(false); return; }
      if (R.ing !== true){ R.ing = true; R.pending = true; }   // 150ms 예약
    };
    const flush = () => { if (R.pending){ R.pending = null; sendIgnore(true); } };
    const recall = () => {                      // main ⓕ/ⓖ — 렌더러에 묻지 않고 뒤집는다
      M.ig = true;
      onPoke({ left: true, ig: M.ig });
    };
    const onPoke = (pt) => {                    // app.js onPenHitTest
      if (useIg && typeof pt.ig === 'boolean' && R.sent !== null && pt.ig !== R.sent){
        R.pending = null; R.ing = null; R.sent = null;
      }
      updateIgnore(!pt.left);
    };

    if (inject){
      /* 어떤 경로로든 이미 어긋나 있는 상태에서 시작한다 — "2초 얹기" 그물만 따로 본다. */
      M.ig = true; R.sent = false; R.ing = false;
    } else {
      updateIgnore(true);                       // 커서가 캐릭터 위 → 클릭받기 (둘 다 false)
      recall();                                 // main 이 혼자 통과로 되돌린다
      updateIgnore(true);                       // 150ms 안에 mousemove 한 번 → 예약이 취소된다
      flush();                                  // (예약은 이미 죽었다)
    }
    const ghost = (M.ig === true && R.sent === false);

    for (let i = 0; i < 3 && M.ig; i++){         // 사용자가 캐릭터 위에 2초씩 얹는다(포기 한도 3회)
      M.pokes++;
      onPoke({ x: 10, y: 10, ig: M.ig });
      flush();
    }
    return { ghost, escaped: M.ig === false, pokes: M.pokes };
  }

  /* ㄱ) 어긋남이 만들어지는 그 순서 — 고침은 **생기기 전에** 끊는다 */
  const before = run(false, false);
  const after  = run(true,  false);
  chk(before.ghost, '  옛 동작: 그 순서에서 실제로 어긋남이 생긴다(유령)');
  chk(before.escaped === false,
    '★ 옛 동작: 3번을 얹어도 못 빠져나온다 — 제보 문구("껐다 켜야만 된다") 그대로');
  chk(after.ghost === false && after.escaped,
    '★ 새 동작: 회수 신호에 ig 가 실려 있어 어긋남이 **아예 안 생긴다**');

  /* ㄴ) 그래도 어딘가에서 어긋났다면 — 사용자가 아는 그 방법(2초 얹기)이 들어야 한다 */
  const stuckOld = run(false, true);
  const stuckNew = run(true,  true);
  chk(stuckOld.escaped === false,
    '★ 옛 동작: 이미 어긋난 뒤엔 몇 번을 얹어도 침묵한다 — 복구 통로가 죽어 있다');
  chk(stuckNew.escaped && stuckNew.pokes === 1,
    '★ 새 동작: 첫 재판정 한 번에 풀린다 (재판정 ' + stuckNew.pokes + '회)');
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + unknown);
if (unknown) say('  ? 는 심볼이 개명·이동됐다는 뜻이다. main.js/app.js 를 고쳤다면 **이 파일도 같이 고칠 것.**');
if (fail)    say('  ✗ 는 유령에서 빠져나오는 길이 끊겼다는 뜻이다.');
if (!fail && !unknown) say('  ✓ 전부 통과');
/* 종료 코드: 1=실패, 2=검사못함. 2 를 0 으로 만들면 이 파일도 조용히 죽는다. */
process.exit(fail ? 1 : (unknown ? 2 : 0));
