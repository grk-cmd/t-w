#!/usr/bin/env node
/* mac-bundleid-probe.js — 🏷️ 판정 키(번들 id)가 **진짜 맥에서 도는가**
 *
 *   [왜 이 파일이 생겼나 — handoff-mac-runtime.md §7-①]
 *     ⑥ 에서 mac 판정 키를 **번들 id** 로 정했다(C안). 그 결정은 경로 문자열만 보고 내렸고,
 *     실제로 `Info.plist` 를 읽는 코드는 **실측 0건**인 채로 저장소에 들어갔다.
 *     ⚠️ 그런데 §7-5 의 실기기 항목 여덟 개 중 이것 **하나만** 사람이 필요 없다.
 *       나머지(클릭 통과·권한 대화상자·Spaces)는 TCC 와 사람 눈이 있어야 한다.
 *   ⇒ 그 하나를 GitHub Actions `macos-latest` 러너에서 닫는다. 러너는 진짜 macOS 이고
 *     `/Applications` 에 실제 앱이 수십 개 깔려 있다 — 그게 이 도구의 표본이다.
 *
 *   [이 도구가 할 수 있는 것과 없는 것]
 *     ✓ procNameOf 가 내놓는 값이 **OS 가 아는 번들 id 와 같은가** (독립 오라클로 대조)
 *     ✓ **바이너리 plist 갈래가 실제로 돌았는가** ← 이게 제일 중요하다. 아래 2절 참고
 *     ✓ 중첩 `.app` 에서 가장 안쪽을 고르는가
 *     ✓ A안(실행파일 basename)이 실제로 충돌하는가 — 탈락 근거의 실증
 *     ✓ 캐시가 듣는가 (2회차가 빨라지는가)
 *     ✓ 두 모듈이 같은 이름을 내보내는가 (정적 · OS 무관)
 *     ✗ 접근성·화면 기록 권한, 클릭 통과, 창 목록, Spaces — **전부 사람이 필요하다.**
 *       이 도구가 초록이어도 ⑥ 은 안 닫힌다. §7-5 의 경고를 그대로 옮겨 둔다.
 *
 *   [왜 `checks/tools/` 인가] `checks/` 바로 밑에 두면 `listChecks` 가 집어서 **검사가 된다.**
 *     macOS 밖에서는 종료 코드 2 라 빨강이 영구히 박힌다 — `trapscan.js` 와 똑같은 사정이다
 *     (`CHECKS.md` §「trapscan.js 는 checks/tools/ 에 둔다」). 해시는 §3 표 아래 **도구 칸**에.
 *
 *   실행:  node checks/tools/mac-bundleid-probe.js [저장소루트]
 *   종료:  0=통과 · 1=실패 · 2=검사못함(맥이 아니거나 모듈을 못 찾음)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let pass = 0, fail = 0, unknown = 0;
const say = console.log;
const ok  = (m) => { pass++;    say('  ✓ ' + m); };
const bad = (m) => { fail++;    say('  ✗ ' + m); };
/* ⚠️ 못 찾은 것은 **거짓이 아니라 ?** 다. 거짓으로 세면 "환경이 달라서 못 봤다" 와
   "규칙이 깨졌다" 가 뒤섞인다 — 이 저장소의 검사들이 지키는 관례 그대로다. */
const huh = (m) => { unknown++; say('  ? ' + m); };
const chk = (c, m) => (c ? ok(m) : bad(m));

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const IS_MAC = process.platform === 'darwin';

say('── 대상 저장소: ' + ROOT);
say('── 실행 환경: ' + process.platform + (IS_MAC ? '' : '  (맥이 아니다 — 1~5절은 건너뛴다)'));
say('');

/* ── 모듈 로드 ─────────────────────────────────────────────────────────────
   ★ `sysinput-mac.js` 는 electron 을 require 하지 않는다. 그래서 **맨 node 로 불러올 수 있다** —
     네이티브 둘은 모듈 안에서 try/catch 라 없어도 평가가 안 끊긴다(§7-⑤ 의 그 감싸기가
     여기서 한 번 더 값을 한다). 로드 자체가 안 되면 아래 전부가 무의미하므로 즉시 2로 끝낸다. */
let macMod = null;
const macPath = path.join(ROOT, 'sysinput-mac.js');
try{
  macMod = require(macPath);
}catch(err){
  say('✗ sysinput-mac.js 를 못 불러왔다 — ' + macPath);
  say('  ' + (err && err.message || err));
  process.exit(2);
}
/* 대체(fallback) 로그를 잡아 둔다. **이 배열이 비어 있어야 C 가 선 것이다**(§7-①). */
const fallbackLogs = [];
if(typeof macMod.init === 'function') macMod.init({ log: (m) => fallbackLogs.push(String(m)) });

/* ══ 1. 실제 `.app` 전수 대조 — 이 도구의 본론 ═════════════════════════════
   [오라클을 왜 `defaults` 로 두는가]
     우리 코드는 XML 이면 정규식, 바이너리면 `plutil` 로 읽는다. 검증에 **또 plutil 을 쓰면**
     같은 도구로 같은 답을 확인하는 셈이라 아무것도 증명하지 못한다.
     `defaults read` 는 CoreFoundation 의 plist 파서를 탄다 — **다른 경로로 같은 답에 닿는지**를
     보는 것이 이 절의 뜻이다.
   ⚠️ 러너에 무엇이 깔려 있는지는 우리가 못 정한다. 그래서 목록을 하드코딩하지 않고 훑는다.
     표본이 너무 적으면(아래 MIN_SAMPLE) 초록을 내지 않고 ? 로 떨어뜨린다 —
     앱 세 개로 "번들 id 규칙이 선다" 고 말하면 그게 다음 사람에게 틀린 지도가 된다. */
const APP_DIRS = [
  '/Applications',
  '/Applications/Utilities',
  '/System/Applications',
  '/System/Applications/Utilities',
  '/System/Library/CoreServices',
];
const MIN_SAMPLE = 10;

function oracleBundleId(appDir){
  try{
    return execFileSync('/usr/bin/defaults',
      ['read', path.join(appDir, 'Contents', 'Info'), 'CFBundleIdentifier'],
      { timeout: 4000, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim();
  }catch(_){ return ''; }
}
/* 번들 안의 실제 실행 파일 경로 — procNameOf 에 넣을 입력이다.
   ⚠️ 번들 **폴더**를 넣으면 안 된다. 판정부가 받는 것은 `w.owner.path`, 즉 실행 파일 경로다.
     폴더로 시험하면 실제와 다른 입력을 시험하는 것이 된다. */
function execOf(appDir){
  const d = path.join(appDir, 'Contents', 'MacOS');
  try{
    const ents = fs.readdirSync(d);
    for(const e of ents){
      const p = path.join(d, e);
      try{ if(fs.statSync(p).isFile()) return p; }catch(_){}
    }
  }catch(_){}
  return '';
}

const samples = [];   // { appDir, exe, oracle }
if(IS_MAC){
  for(const dir of APP_DIRS){
    let ents = [];
    try{ ents = fs.readdirSync(dir); }catch(_){ continue; }
    for(const e of ents){
      if(!e.toLowerCase().endsWith('.app')) continue;
      const appDir = path.join(dir, e);
      const exe = execOf(appDir);
      if(!exe) continue;
      const oracle = oracleBundleId(appDir);
      if(!oracle) continue;          // 번들 id 가 없는 것은 대조 대상이 아니다
      samples.push({ appDir, exe, oracle });
    }
  }
}

say('── 1. procNameOf 가 OS 가 아는 번들 id 와 같은가 (오라클: /usr/bin/defaults)');
if(!IS_MAC){
  huh('맥이 아니라 못 돈다 — 이 절이 이 도구의 본론이다');
} else if(samples.length < MIN_SAMPLE){
  huh('표본이 ' + samples.length + '개뿐이다(기준 ' + MIN_SAMPLE + ') — 이 수로는 초록을 낼 수 없다');
} else {
  const wrong = [];
  for(const s of samples){
    const got = macMod.procNameOf(s.exe);
    if(got !== s.oracle.toLowerCase()) wrong.push(path.basename(s.appDir) + ': ' + got + ' ≠ ' + s.oracle.toLowerCase());
  }
  chk(wrong.length === 0,
    '★ 앱 ' + samples.length + '개 전수 일치 — 틀린 것 ' + wrong.length + '개'
    + (wrong.length ? ': ' + wrong.slice(0, 5).join(' | ') : ''));
  /* ★ 대체로 떨어진 것이 하나라도 있으면 그 앱의 키는 C 가 아니라 B 다. 초록으로 덮지 말 것. */
  chk(fallbackLogs.length === 0,
    '★ 이름 대체(B안 낙하)가 0건 — 실제 ' + fallbackLogs.length + '건'
    + (fallbackLogs.length ? ': ' + fallbackLogs.slice(0, 3).join(' | ') : ''));
  chk(samples.every(s => macMod.displayNameOf(s.exe) === path.basename(s.appDir).replace(/\.app$/i, '')),
    '  displayNameOf 는 번들 이름을 그대로 준다 — 소문자로 뭉개지 않는다');
}

/* ══ 2. ★ 바이너리 plist 갈래가 실제로 돌았는가 ════════════════════════════
   [이 절이 없으면 1절의 초록이 거짓말이 된다]
     표본이 전부 XML plist 였다면 `plutil` 분기는 **한 번도 안 돈 채로** 1절이 초록이 된다.
     그러면 "번들 id 규칙이 실측됐다" 고 적히고, 정작 위험한 경로는 미검증으로 남는다.
     ⚠️ 요즘 `Info.plist` 는 대개 바이너리라 그럴 일은 없어야 정상인데, **없어야 정상인 것을
       확인 없이 가정하는 것**이 이 프로젝트가 여덟 번 되돌린 그 습관이다. */
say('\n── 2. 바이너리 plist 갈래가 표본에서 실제로 돌았는가');
if(!IS_MAC || samples.length < MIN_SAMPLE){
  huh('1절이 안 돌아 셀 것이 없다');
} else {
  let binCount = 0, xmlCount = 0;
  for(const s of samples){
    try{
      const head = fs.readFileSync(path.join(s.appDir, 'Contents', 'Info.plist')).slice(0, 8).toString('latin1');
      if(head === 'bplist00') binCount++; else xmlCount++;
    }catch(_){}
  }
  say('  · 바이너리 ' + binCount + '개 · XML ' + xmlCount + '개');
  chk(binCount > 0, '★ 바이너리 plist 가 표본에 있다 — plutil 분기가 실제로 돌았다');
  if(xmlCount === 0) huh('XML plist 가 표본에 0개 — 정규식 분기는 이 러너에서 미검증이다');
  else ok('  XML 분기도 표본에 있다');
  chk(fs.existsSync('/usr/bin/plutil'), '  /usr/bin/plutil 이 있다 — 없으면 전부 B안으로 떨어진다');
}

/* ══ 3. 중첩 `.app` — 가장 **안쪽**을 고르는가 ═════════════════════════════
   바깥을 고르면 Simulator 를 Xcode 로, 헬퍼를 본체로 둔갑시킨다(모듈 주석 참고). */
say('\n── 3. 중첩 .app 에서 가장 안쪽 번들을 고른다');
if(!IS_MAC){
  huh('맥이 아니라 못 돈다');
} else {
  let nested = null;
  const inner = '/Applications/Xcode.app/Contents/Developer/Applications';
  try{
    for(const e of fs.readdirSync(inner)){
      if(!e.toLowerCase().endsWith('.app')) continue;
      const appDir = path.join(inner, e);
      const exe = execOf(appDir), oracle = oracleBundleId(appDir);
      if(exe && oracle){ nested = { appDir, exe, oracle }; break; }
    }
  }catch(_){}
  if(!nested){
    huh('중첩 .app 표본을 못 찾았다(Xcode 가 없는 러너일 수 있다)');
  } else {
    const got = macMod.procNameOf(nested.exe);
    const outerOracle = (oracleBundleId('/Applications/Xcode.app') || '').toLowerCase();
    chk(got === nested.oracle.toLowerCase(),
      '★ ' + path.basename(nested.appDir) + ' → ' + got + ' (안쪽 번들의 id)');
    chk(!outerOracle || got !== outerOracle,
      '★ 바깥 번들(' + (outerOracle || '?') + ')의 id 가 아니다 — 안쪽을 고르는 것이 조건이다');
  }
}

/* ══ 4. A안 반증 — 실행파일 basename 이 **실제로** 충돌하는가 ═══════════════
   §7-① 이 A 를 실측 없이 탈락시킨 근거다. 러너에 깔린 실제 앱으로 그 근거를 세운다.

   ★★ [2026-09-15 정정 — 첫 CI 가 이 절의 조건이 틀렸다고 알려 줬다]
     처음에 이 절은 **「번들 id 충돌 0건」**을 조건으로 박았고, 첫 실행에서 빨갛게 나왔다:
       `com.apple.dt.xcode = Xcode.app / Xcode_26.0.app / … (15개)`
     러너에 Xcode 15 판본이 나란히 깔려 있었던 것이다. **코드는 정확했다** — 같은 앱의 다른
     판본이니 번들 id 가 같은 것이 맞다. 틀린 것은 조건이었다.
   ⇒ 그 조건은 **두 가지 다른 일을 한 덩어리로 묶고 있었다.**
       ・서로 다른 앱이 한 키로 뭉친다        ← 진짜 위험. C 가 막으려던 것
       ・같은 앱의 여러 판본이 한 키를 쓴다   ← **의도된 동작.** 「Xcode 에서 3시간」을 세는 것이
                                              목적이지 「Xcode 26.4 에서 3시간」이 아니다
   ⇒ 지켜야 할 명제는 「C 는 충돌이 없다」가 아니라
     **「C 가 만든 충돌은 전부 A 도 만든 충돌이다」** — 즉 C 가 A 보다 나쁜 자리가 없다.
     한 번들 id 그룹 안에 **basename 이 서로 다른 것이 섞여 있으면**, A 는 갈라 놓았을 둘을
     C 가 합친 것이라 그때가 진짜 빨강이다.
   ⚠️ **검사를 초록으로 만들려고 조건을 무르게 푼 것이 아니다.** 무르게 푸는 것이었다면
     idDup 항목을 지웠을 것이다. 지우지 않고 **더 정확한 것으로 바꿨다** — 위 진짜 위험은
     여전히 빨강으로 잡힌다. 이 구분이 흐려지면 다음 사람이 이 줄을 근거로 조건을 또 푼다. */
say('\n── 4. A안(실행파일 basename)이 실제 표본에서 충돌한다');
if(!IS_MAC || samples.length < MIN_SAMPLE){
  huh('표본이 없어 못 센다');
} else {
  const rows = samples.map(s => ({
    app:  path.basename(s.appDir),
    base: path.basename(s.exe).toLowerCase(),
    id:   s.oracle.toLowerCase(),
  }));
  const group = (key) => {
    const m = new Map();
    for(const r of rows) m.set(r[key], (m.get(r[key]) || []).concat(r));
    return [...m.entries()].filter(([, v]) => v.length > 1);
  };
  const short = (v) => v.slice(0, 3).map(r => r.app).join('/') + (v.length > 3 ? ` 외 ${v.length - 3}` : '');
  const baseDup = group('base');
  const idDup   = group('id');

  /* 한 번들 id 그룹 안에 basename 이 둘 이상이면 = A 가 갈라 놓았을 것을 C 가 합쳤다. */
  const worse = idDup.filter(([, v]) => new Set(v.map(r => r.base)).size > 1);
  chk(worse.length === 0,
    '★ C 가 A 보다 나쁜 자리가 0곳 — 실제 ' + worse.length + '곳'
    + (worse.length ? ': ' + worse.map(([k, v]) => k + '=' + short(v)).join(' | ') : ''));

  /* 나머지 번들 id 충돌은 **같은 앱의 여러 판본**이다. 빨강이 아니라 재료로 찍는다.
     ⚠️ 위 worse 에 걸린 그룹은 여기서 뺀다 — 진짜 위험을 「의도된 동작」 줄에 같이 실으면
       빨강 옆에서 그 빨강을 변명하는 줄이 된다. */
  const benign = idDup.filter(g => !worse.includes(g));
  if(benign.length){
    say('  · 같은 앱의 여러 판본이 한 키를 쓰는 그룹 ' + benign.length + '개 — '
      + benign.map(([k, v]) => k + '×' + v.length).slice(0, 3).join(' | ')
      + '  (의도된 동작이다)');
  }

  /* ★ A 가 뭉치는데 C 는 가르는 자리 — 여기가 A 탈락의 **실증**이다.
     Xcode 처럼 양쪽 다 뭉치는 것은 근거가 못 된다. C 만 가르는 것이 나와야 뜻이 있다. */
  const idOf = new Map(rows.map(r => [r.app, r.id]));
  const splitByC = baseDup.filter(([, v]) => new Set(v.map(r => idOf.get(r.app))).size > 1);
  if(baseDup.length === 0){
    huh('basename 충돌이 이 표본에는 0건 — A 가 옳다는 뜻이 아니라 표본이 그랬다는 뜻이다');
  } else if(splitByC.length === 0){
    huh('basename 충돌 ' + baseDup.length + '건이 전부 C 에서도 뭉친다 — A 탈락의 실증이 아니다');
  } else {
    ok('★ A 는 뭉치는데 C 는 가르는 자리 ' + splitByC.length + '곳 — '
      + splitByC.map(([k, v]) => k + '=' + short(v)).slice(0, 3).join(' | ')
      + '  ← A 탈락의 실증이다');
  }
}

/* ══ 5. 캐시 — 2회차가 빨라지는가 ══════════════════════════════════════════
   [왜 세는가] 이 함수는 **500ms 폴링에서 불린다.** 캐시가 없으면 초당 두 번 plutil 을 띄우고,
     그건 이 저장소가 두 번 겪은 사고와 같은 모양이다(로그 906줄 · 재적용 417회).
   ⚠️ 시간은 환경에 따라 흔들린다. 그래서 **배수가 아니라 방향**만 본다(2회차가 더 빠른가). */
say('\n── 5. .app 경로별 캐시가 듣는다');
if(!IS_MAC || samples.length < MIN_SAMPLE){
  huh('표본이 없어 못 잰다');
} else {
  const t0 = Date.now(); for(const s of samples) macMod.procNameOf(s.exe);
  const t1 = Date.now(); for(const s of samples) macMod.procNameOf(s.exe);
  const t2 = Date.now();
  const first = t1 - t0, second = t2 - t1;
  say('  · 1회차 ' + first + 'ms · 2회차 ' + second + 'ms (' + samples.length + '개)');
  /* 1절에서 이미 한 바퀴 돌았으므로 여기 1회차도 캐시가 더워진 상태다 — 둘 다 빨라야 정상이다. */
  chk(second <= Math.max(first, 5),
    '★ 2회차가 1회차보다 느리지 않다 — 느려지면 캐시가 안 걸린 것이다');
  chk(second < 200,
    '  캐시 히트 ' + samples.length + '건에 ' + second + 'ms — 폴링(500ms)이 감당할 값이다');
}

/* ══ 6. 경계 입력 — 합성 표본 (OS 무관, 어디서나 돈다) ═════════════════════
   ⚠️ 이 절은 리눅스/윈도우에서도 돈다. 그래서 **맥이 없어도 로직 회귀는 잡힌다** —
     맥을 구하기 전까지 이 파일이 할 수 있는 유일한 일이 이것이다. */
say('\n── 6. 경계 입력 (합성 · OS 무관)');
{
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bidprobe-'));
  const mk = (rel, id) => {
    const appDir = path.join(tmp, rel);
    fs.mkdirSync(path.join(appDir, 'Contents', 'MacOS'), { recursive: true });
    fs.writeFileSync(path.join(appDir, 'Contents', 'Info.plist'),
      '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict>\n'
      + '<key>CFBundleIdentifier</key><string>' + id + '</string>\n</dict></plist>\n');
    const exe = path.join(appDir, 'Contents', 'MacOS', 'Runner');
    fs.writeFileSync(exe, '');
    return exe;
  };
  const chromeExe = mk('Google Chrome.app', 'com.google.Chrome');
  chk(macMod.procNameOf(chromeExe) === 'com.google.chrome',
    '  XML plist 에서 번들 id 를 읽고 소문자로 정규화한다');
  chk(macMod.displayNameOf(chromeExe) === 'Google Chrome',
    '★ 표시명은 소문자로 뭉개지 않는다 — 사람에게 보여 줄 값이다');

  const outerExe = mk('Outer.app', 'com.test.outer');
  const innerExe = mk(path.join('Outer.app', 'Contents', 'Helpers', 'Inner.app'), 'com.test.inner');
  chk(macMod.procNameOf(innerExe) === 'com.test.inner',
    '★ 중첩에서 가장 안쪽을 고른다 (합성) — 바깥을 고르면 헬퍼가 본체로 둔갑한다');
  chk(macMod.procNameOf(outerExe) === 'com.test.outer', '  바깥 번들은 바깥 id 를 준다');

  /* plist 가 없는 번들 — B안 낙하와 그 로그. **낙하 자체보다 로그가 남는지가 중요하다.** */
  const noPlist = path.join(tmp, 'Broken.app', 'Contents', 'MacOS');
  fs.mkdirSync(noPlist, { recursive: true });
  fs.writeFileSync(path.join(noPlist, 'Runner'), '');
  const before = fallbackLogs.length;
  chk(macMod.procNameOf(path.join(noPlist, 'Runner')) === 'broken',
    '  plist 를 못 읽으면 번들 이름으로 떨어진다 (B안)');
  chk(fallbackLogs.length === before + 1,
    '★ 낙하할 때 로그를 남긴다 — 이 줄이 없으면 C 가 안 선 것을 아무도 모른다');

  chk(macMod.procNameOf('') === '' && macMod.procNameOf(null) === '',
    '  빈 경로는 빈 이름 — 던지지 않는다(활성 창 판정이 통째로 멎는다)');
  chk(macMod.procNameOf('/usr/bin/some-daemon') === 'some-daemon',
    '  .app 이 아닌 실행 파일은 basename 으로 떨어진다');

  try{ fs.rmSync(tmp, { recursive: true, force: true }); }catch(_){}
}

/* ══ 7. 두 모듈이 같은 이름을 내보내는가 (정적 · OS 무관) ═══════════════════
   ⚠️ 하나라도 어긋나면 **한쪽 OS 에서만 죽는다.** 그래서 이 절은 맥이 아니어도 돈다.
   ★ require 가 아니라 정적 파싱인 이유: overlay 쪽은 electron 을 require 하므로 맨 node 로
     못 불러온다. 스텁을 만드는 길도 있지만, 스텁이 틀리면 그 틀림이 초록으로 나온다. */
say('\n── 7. win/mac 짝이 같은 이름을 내보낸다 (정적)');
function exportNames(file){
  let src;
  try{ src = fs.readFileSync(path.join(ROOT, file), 'utf8'); }catch(_){ return null; }
  const i = src.lastIndexOf('module.exports');
  if(i < 0) return null;
  const body = src.slice(i).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const out = new Set();
  for(const line of body.split('\n').slice(1)){
    if(line.indexOf('}') >= 0 && line.trim().startsWith('}')) break;
    for(const piece of line.split(',')){
      const m = piece.match(/^\s*([A-Za-z_$][\w$]*)\s*(:|\(|$)/);
      if(m) out.add(m[1]);
    }
  }
  return out;
}
for(const [winFile, macFile] of [['sysinput-win.js', 'sysinput-mac.js'], ['overlay-win.js', 'overlay-mac.js']]){
  const a = exportNames(winFile), b = exportNames(macFile);
  if(!a || !b){ huh(winFile + ' / ' + macFile + ' 의 내보내기 블록을 못 읽었다'); continue; }
  const onlyWin = [...a].filter(k => !b.has(k));
  const onlyMac = [...b].filter(k => !a.has(k));
  chk(onlyWin.length === 0 && onlyMac.length === 0,
    '★ ' + winFile + ' ↔ ' + macFile + ' 이름 ' + a.size + '개 일치'
    + (onlyWin.length ? ' | win 에만: ' + onlyWin.join(',') : '')
    + (onlyMac.length ? ' | mac 에만: ' + onlyMac.join(',') : ''));
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + unknown);
if(unknown) say('  ? 는 이 환경에서 못 본 것이다 — 맥이 아니거나 표본이 모자란다. 빨강이 아니다.');
if(fail)    say('  ✗ 는 판정 키 규칙이 실제 맥에서 안 선다는 뜻이다. handoff-mac-runtime.md §7-① 을 볼 것.');
if(!fail && !unknown && IS_MAC){
  say('  ✓ 전부 통과 — ★ 그래도 ⑥ 은 안 닫힌다. 클릭 통과·권한·Spaces 는 사람이 필요하다(§7-5).');
}
process.exit(fail ? 1 : (unknown ? 2 : 0));
