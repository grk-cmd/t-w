#!/usr/bin/env node
/* sim-keysof-twin.js — 🔑 판정 키 통로가 **두 벌인데 한 벌처럼 구는가**
 *
 *   [왜 이 파일이 따로 생겼는가]
 *     handoff-platform-split.md §4-b 마지막 경고가 이렇게 적혀 있다 —
 *       «`keysOf` 는 두 벌이다. main.js 와 app.js. 한쪽만 고치면 안 된다.
 *         sim-sysinput.js 6절이 두 벌의 우선순위가 같은지 대조한다.»
 *     ★ **앞 문장은 맞고 뒷 문장은 틀렸다.** sim-sysinput.js 에는 `app.js` 라는 문자열이
 *       한 건도 없다. app.js 를 옆에 두든 치우든 결과가 60·0 으로 똑같다 — 6절은 main.js
 *       쪽 통로만 본다. 즉 §4-b 가 "제일 부서지기 쉽다"고 지목한 바로 그 자리를
 *       **지키는 것이 하나도 없었다.** (2026-09-14 실측)
 *     ⇒ sim-sysinput.js 6절에 끼워 넣지 않고 이름을 따로 뗀 이유: 그 파일은 지금 같은
 *       이름으로 65·0 / 58·1 / 60·0 세 숫자가 돌아다니는 상태다. 판본을 하나 더 만들면
 *       "어느 초록이 진짜인가"를 또 못 가린다. 이름이 다르면 그 문제가 안 생긴다.
 *
 *   [무엇을 지키는가 — 할 수 있는 것과 없는 것]
 *     ✓ 두 함수 본문이 서로 어긋나지 않았는가 (2절)
 *     ✓ 우선순위 4단이 `keys → key → exe → name` 인가 (3절)  ← 둘이 **같이** 틀릴 수 있다
 *     ✓ 승격 접두사가 'win:' **리터럴 고정**인가 (4절)        ← §4-b 가 못 박은 자리
 *     ✓ 같은 입력에 같은 답을 내는가 (5절, 실제로 돌려서 대조) ← 문자열 대조보다 강하다
 *     ✓ 저장은 언제나 하나인가 — `keys` 를 쓰는 자리가 없는가 (6절)
 *     ✓ 판정이 통로를 지나는가 · 옛 직접 비교가 안 되살아났는가 (7절)
 *     ✓ 왜 이렇게 됐는지가 두 파일 **양쪽에** 남아 있는가 (8절)
 *     ✗ 렌더러가 실제로 어떤 cfg 를 들고 오는지 — 정적으로는 못 본다. 실기기 몫이다.
 *
 *   [왜 문자열 대조(2절)와 동작 대조(5절)를 둘 다 두는가]
 *     2절만 두면 한쪽에 지역 변수 이름만 바꿔도 빨개진다(실제로는 멀쩡한데).
 *     5절만 두면 입력표에 없는 갈래가 어긋난 걸 못 본다.
 *     ⇒ 2절이 울리고 5절이 초록이면 **겉모양만 갈린 것**이고, 둘 다 울리면 **진짜 어긋난 것**이다.
 *       그 구분이 되라고 둘을 나눠 뒀다. 2절 실패 메시지가 5절을 같이 보라고 말한다.
 *
 *   실행: node sim-keysof-twin.js            (main.js · app.js 와 같은 폴더에서)
 *        node sim-keysof-twin.js --selftest  (검사가 헛도는지 스스로 확인 — 아래 참고)
 *   종료 코드: 0=통과 · 1=실패 · 2=검사못함(심볼 개명·이동)
 *
 *   ⚠️ **--selftest 를 반드시 한 번은 돌릴 것.** handoff-platform-split.md §3 에
 *     «주석과 정의가 우연히 붙어 있어서 맞았을 뿐, 호출부는 한 번도 본 적이 없다» 는
 *     기록이 있다. 이 파일도 같은 방식으로 헛돌 수 있다. selftest 는 변이 9종을 주입해
 *     **전부 실패로 잡히는지** 확인한다.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

/* 개명되면 여기 맨 앞에 추가할 것 — 못 찾는 것은 실패가 아니라 '검사못함'이다. */
const MAIN_FN_NAMES = ['keysOf'];
const APP_FN_NAMES  = ['_chalKeysOf'];

/* §4-b 가 못 박은 우선순위. 순서가 뜻을 가진다. */
const ORDER = ['keys', 'key', 'exe', 'name'];

let fail = 0, unknown = 0, pass = 0;
let QUIET = false;
const say = (m) => { if(!QUIET) console.log(m); };
const ok  = (m) => { pass++;    say('  ✓ ' + m); };
const bad = (m) => { fail++;    say('  ✗ ' + m); };
/* 못 찾은 것을 거짓으로 세면 "개명했더니 검사가 실패했다"와 "규칙이 깨졌다"가 뒤섞인다. */
const huh = (m) => { unknown++; say('  ? ' + m); };
const chk = (cond, m) => (cond ? ok(m) : bad(m));

const HERE = __dirname;
function read(f){
  try{ return fs.readFileSync(path.join(HERE, f), 'utf8'); }catch(_){ return null; }
}

/* ── 함수 본문 뽑기 ────────────────────────────────────────────────────────
   ⚠️ 단순 중괄호 세기는 문자열·주석 안의 `{` 에 걸린다. 지금 두 함수에는 그런 게 없지만
     나중에 생겼을 때 조용히 엉뚱한 데서 끊기면 이 파일 전체가 거짓 초록이 된다.
     그래서 처음부터 주석과 따옴표를 건너뛰며 센다. */
function extractFn(src, names){
  for(const name of names){
    const re = new RegExp('function\\s+' + name.replace(/[$]/g,'\\$') + '\\s*\\(', 'g');
    const m = re.exec(src);
    if(!m) continue;
    let i = src.indexOf('{', m.index);
    if(i < 0) continue;
    let depth = 0, j = i;
    for(; j < src.length; j++){
      const c = src[j], c2 = src[j+1];
      if(c === '/' && c2 === '/'){ j = src.indexOf('\n', j); if(j < 0) j = src.length; continue; }
      if(c === '/' && c2 === '*'){ j = src.indexOf('*/', j + 2); if(j < 0) j = src.length; else j += 1; continue; }
      if(c === '"' || c === "'" || c === '`'){
        const q = c;
        for(j++; j < src.length; j++){ if(src[j] === '\\'){ j++; continue; } if(src[j] === q) break; }
        continue;
      }
      if(c === '{') depth++;
      else if(c === '}'){ depth--; if(depth === 0) break; }
    }
    if(depth !== 0) continue;
    return { name, text: src.slice(m.index, j + 1) };
  }
  return null;
}

/* ── 주석 걷기 ─────────────────────────────────────────────────────────────
   ★ **이게 왜 필요한가.** handoff-platform-split.md §3 이 적어 둔 사고와 같은 종류다 —
     sim-overlay-gap.js 가 «주석 포함 원문»에서 찾는 바람에 호출부를 한 번도 못 보고 있었다.
     여기서도 똑같이 걸렸다: main.js 787행 주석에 «여기서 `f.name === exeName` 로 되돌리면
     mac 에서 조용히 전부 미등록이 된다» 는 **경고문**이 있어서, 7절의 우회로 검사가
     그 경고문을 우회로로 세고 빨개졌다(2026-09-14 실측).
   ⇒ 코드를 보는 절(6·7)은 `code`(주석 제거), 근거가 남아 있는지 보는 절(8)은 `src`(원문).
     **어느 절이 어느 쪽을 보는지 헷갈리면 이 파일이 헛돌기 시작한다.**
   ⚠️ 정규식으로 지우면 문자열 안의 `https://` 가 주석으로 잘린다. 그래서 따옴표를 추적한다.
     정규식 리터럴 안의 `//` 까지는 안 본다 — 지금 두 파일에는 없고, 생기면 이 줄을 고칠 것. */
function stripComments(src){
  let out = '', i = 0;
  while(i < src.length){
    const c = src[i], c2 = src[i+1];
    if(c === '/' && c2 === '/'){ const n = src.indexOf('\n', i); i = n < 0 ? src.length : n; continue; }
    if(c === '/' && c2 === '*'){ const n = src.indexOf('*/', i + 2); i = n < 0 ? src.length : n + 2; out += ' '; continue; }
    if(c === '"' || c === "'" || c === '`'){
      const q = c; out += c; i++;
      while(i < src.length){ if(src[i] === '\\'){ out += src.slice(i, i+2); i += 2; continue; } out += src[i]; if(src[i] === q){ i++; break; } i++; }
      continue;
    }
    out += c; i++;
  }
  return out;
}

/* 주석·공백·함수 이름만 지운다. 그 밖은 한 글자도 안 건드린다 —
   더 지우면 "다르지만 통과"가 생기고, 그게 이 파일이 없애려는 상태다. */
function norm(text){
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/^function\s+\w+\s*\(/, 'function F(')
    .replace(/\s+/g, '');
}

/* 뽑은 본문을 실제로 부를 수 있게 만든다(5절). 문법이 깨졌으면 null. */
function toCallable(text){
  try{ return new Function('return (' + text + ');')(); }catch(_){ return null; }
}

/* 우선순위를 본문에서 읽어낸다 — `rec.keys` … `rec.key` … 가 나오는 순서. */
function orderOf(text){
  const t = norm(text);
  const seen = [];
  const re = /rec\.(keys|key|exe|name)/g;
  let m;
  while((m = re.exec(t))){ if(!seen.includes(m[1])) seen.push(m[1]); }
  return seen;
}

/* ── 5절 입력표 ────────────────────────────────────────────────────────────
   실제 파이프라인에서 나올 수 있는 모양 + §4-b 가 "앞으로도 계속 생긴다"고 적은 옛 모양.
   ★ 마지막 넷은 **되살리기([자동]·arcWd/arcWe)가 만드는 key 없는 cfg** 갈래다 —
     핸드오프가 "고장이 아니다"라고 못 박은 자리라 반드시 양쪽이 같은 답을 내야 한다. */
const CASES = [
  null, undefined, {},
  { keys: ['win:chrome.exe', 'mac:Google Chrome'] },
  { keys: [] },
  { keys: ['', 'win:a.exe', null] },
  { keys: ['win:a.exe'], key: 'win:b.exe', exe: 'c.exe', name: 'd.exe' },
  { key: 'win:chrome.exe' },
  { key: 'win:a.exe', exe: 'b.exe' },
  { key: '' },
  { exe: 'notepad.exe' },
  { exe: 'Notepad.EXE' },
  { exe: 'a.exe', name: 'b.exe' },
  { exe: '' },
  { exe: 123 },
  { name: 'whale.exe' },
  { name: 'WHALE.EXE' },
  { name: '' },
  { title: '제목만 있다' },
];

function sameAnswer(f, g){
  for(const c of CASES){
    let a, b;
    try{ a = JSON.stringify(f(c)); }catch(e){ a = 'THROW:' + e.message; }
    try{ b = JSON.stringify(g(c)); }catch(e){ b = 'THROW:' + e.message; }
    if(a !== b) return { same:false, input:JSON.stringify(c), a, b };
  }
  return { same:true };
}

/* ═══════════════════════════════════════════════════════════════════════════
   본 검사 — selftest 가 같은 함수를 다시 부르므로 입력을 인자로 받는다.
   ═══════════════════════════════════════════════════════════════════════════ */
function run(mainSrc, appSrc){
  /* src = 원문(8절이 본다) · code = 주석 제거(6·7절이 본다). 위 stripComments 주석 참고. */
  const mainCode = stripComments(mainSrc);
  const appCode  = stripComments(appSrc);

  const mainFn = extractFn(mainSrc, MAIN_FN_NAMES);
  const appFn  = extractFn(appSrc,  APP_FN_NAMES);

  say('');
  say('── 1. 두 벌이 제자리에 있는가');
  if(!mainFn){ huh('main.js 에서 ' + MAIN_FN_NAMES.join(' / ') + ' 을 못 찾음 — 개명했다면 MAIN_FN_NAMES 맨 앞에 추가할 것'); }
  else ok('main.js 의 ' + mainFn.name + ' 을 찾았다');
  if(!appFn){ huh('app.js 에서 ' + APP_FN_NAMES.join(' / ') + ' 을 못 찾음 — 개명했다면 APP_FN_NAMES 맨 앞에 추가할 것'); }
  else ok('app.js 의 ' + appFn.name + ' 을 찾았다');

  if(!mainFn || !appFn){
    say('  ? 한쪽을 못 찾아 2~5절 전체를 건너뜀 — 이 상태에서는 "두 벌이 같다"를 말할 수 없다');
    unknown++;
  } else {
    say('');
    say('── 2. 본문이 서로 어긋나지 않았는가 (문자열)');
    const same = norm(mainFn.text) === norm(appFn.text);
    chk(same, '★ 두 본문이 주석·공백을 뺀 뒤 동일하다 — 어긋나면 5절(동작 대조)을 같이 볼 것: '
      + '5절이 초록이면 겉모양만 갈린 것이고, 둘 다 빨가면 진짜 갈린 것이다');

    say('');
    say('── 3. 우선순위 4단이 keys → key → exe → name 인가');
    /* ⚠️ 2절이 통과해도 이 절은 따로 필요하다 — 양쪽을 **같이** 잘못 고치면 2절은 조용하다. */
    const oM = orderOf(mainFn.text), oA = orderOf(appFn.text);
    chk(oM.join('>') === ORDER.join('>'), 'main.js 순서 = ' + (oM.join(' → ') || '(없음)') + ' (기준 ' + ORDER.join(' → ') + ')');
    chk(oA.join('>') === ORDER.join('>'), 'app.js  순서 = ' + (oA.join(' → ') || '(없음)') + ' (기준 ' + ORDER.join(' → ') + ')');
    chk(oM.includes('keys') && oA.includes('keys'),
      '★ 양쪽 다 keys **배열을 읽을 줄 안다** — 저장은 key 하나지만 읽기는 처음부터 배열이다(§4-b). '
      + '이게 빠지면 나중에 넓힐 때 판정부를 다시 열어야 한다');

    say('');
    say('── 4. 승격 접두사가 \'win:\' 리터럴 고정인가');
    /* ★ §4-b: «key 가 없는 저장물은 Windows 에서만 쓰인 적이 있다. mac 에서 읽었다고 mac: 을
         붙이면 남의 기기 기록이 이 기기 것으로 둔갑해 조용히 시간이 쌓인다.» */
    for(const [label, fn] of [['main.js', mainFn], ['app.js', appFn]]){
      const t = norm(fn.text);
      chk(/'win:'\+/.test(t) || /"win:"\+/.test(t),
        label + ' 이 \'win:\' 리터럴로 승격한다');
      chk(!/KEY_PLATFORM|process\.platform|navigator\.platform/.test(t),
        '★ ' + label + ' 이 플랫폼 변수로 접두사를 만들지 않는다 — 여기서 KEY_PLATFORM 을 쓰면 mac 에서 남의 기록을 삼킨다');
      chk(!/'mac:'|"mac:"/.test(t),
        label + ' 의 승격 갈래에 \'mac:\' 이 없다');
      chk((t.match(/\.toLowerCase\(\)/g) || []).length >= 2,
        label + ' 이 exe·name 양쪽을 소문자로 낮춘다 — 한쪽만 낮추면 대문자 입력에서 갈린다');
    }

    say('');
    say('── 5. ★ 같은 입력에 같은 답을 내는가 (실제로 돌린다)');
    const fM = toCallable(mainFn.text), fA = toCallable(appFn.text);
    if(!fM || !fA){
      huh('본문을 함수로 만들 수 없다 — 뽑기가 엉뚱한 데서 끊겼거나 문법이 깨졌다');
    } else {
      const r = sameAnswer(fM, fA);
      chk(r.same, '★ 입력 ' + CASES.length + '종 전부 일치'
        + (r.same ? '' : ' — 어긋난 입력 ' + r.input + ' : main=' + r.a + ' / app=' + r.b));
      /* 둘이 사이좋게 같이 틀린 경우를 잡는다 — 2·5절만으로는 안 걸린다. */
      chk(JSON.stringify(fM({ keys:['x'], key:'y', exe:'z', name:'w' })) === JSON.stringify(['x']),
        '  keys 가 있으면 keys 가 이긴다');
      chk(JSON.stringify(fM({ key:'y', exe:'z', name:'w' })) === JSON.stringify(['y']),
        '  keys 가 없으면 key 가 이긴다');
      chk(JSON.stringify(fM({ exe:'Z.EXE', name:'w' })) === JSON.stringify(['win:z.exe']),
        '★ 옛 달성조건(cfg.exe)이 win: 로 승격된다 — 기존 사용자 전원이 들고 있는 갈래다');
      chk(JSON.stringify(fM({ name:'W.EXE' })) === JSON.stringify(['win:w.exe']),
        '★ 옛 focus-apps.json(name)이 win: 로 승격된다');
      chk(JSON.stringify(fM(null)) === '[]' && JSON.stringify(fM({})) === '[]',
        '  빈 입력은 빈 배열 — 던지지 않는다(판정이 통째로 멎는다)');
    }
  }

  say('');
  say('── 6. 저장은 언제나 하나인가');
  /* §4-b: «key 와 keys 를 둘 다 저장하지 말 것. 진실의 출처가 둘이 되면 어긋났을 때
       누가 이기는지를 또 정해야 한다.» ⇒ keys 는 읽기만 하고 쓰지 않는다. */
  const writesKeys = (src) => {
    const lines = src.split('\n');
    return lines.filter(l => /\bkeys\s*:/.test(l) && !/keysOf/.test(l) && !/^\s*[/*]/.test(l))
                .filter(l => /\.keys\s*=|keys\s*:\s*\[/.test(l));
  };
  const wM = writesKeys(mainCode), wA = writesKeys(appCode);
  chk(wM.length === 0, '★ main.js 가 keys 배열을 저장하지 않는다' + (wM.length ? ' — ' + wM[0].trim() : ''));
  chk(wA.length === 0, '★ app.js 가 keys 배열을 저장하지 않는다' + (wA.length ? ' — ' + wA[0].trim() : ''));
  chk(/a\.key\s*=\s*'win:'|\.key\s*=\s*'win:'/.test(mainCode),
    '  focus-apps 로더 승격이 살아 있다 — 여기서 안 채우면 등록해 둔 사람 전원이 재등록 전까지 새 축을 못 받는다(§0-①과 같은 사고)');

  say('');
  say('── 7. 판정이 통로를 지나는가 (우회로 금지)');
  const callsM = (mainCode.match(/\bkeysOf\s*\(/g) || []).length;
  const callsA = (appCode.match(/\b_chalKeysOf\s*\(/g) || []).length;
  chk(callsM >= 2, 'main.js 가 keysOf 를 정의 말고도 부른다 (' + callsM + '곳)');
  chk(callsA >= 2, 'app.js 가 _chalKeysOf 를 정의 말고도 부른다 (' + callsA + '곳)');
  /* 옛 모양: `f.name === exeName`. 되살아나면 mac 에서 조용히 전부 미등록이 된다. */
  const bypass = /\.(name|key)\s*===\s*\w*[eE]xe\w*/;
  chk(!bypass.test(mainCode), '★ main.js 에 .name/.key 직접 비교가 없다 — 되돌리면 mac 에서 조용히 전부 미등록이 된다');
  chk(!bypass.test(appCode),  '★ app.js 에 .name/.key 직접 비교가 없다');

  say('');
  say('── 8. 왜 이렇게 됐는지가 양쪽에 남아 있는가');
  /* ★ 한쪽에만 있으면 다른 쪽을 고치는 사람은 이유를 못 본다. 이 파일이 생긴 이유 그 자체다. */
  chk(/'win:'\s*(고정|리터럴)|승격은 반드시 'win:'/.test(mainSrc),
    'main.js 에 \'win:\' 고정의 근거가 남아 있다');
  chk(/'win:'\s*(고정|리터럴)|승격이 'win:'/.test(appSrc),
    '★ app.js 에도 같은 근거가 남아 있다 — 두 벌이라는 사실을 여기서 처음 보는 사람이 있다');
  chk(/cfg\.exe/.test(appSrc) && /판정에 안 쓴다|파생|옛 판본/.test(appSrc),
    '★ cfg.exe 를 왜 남겼는지가 app.js 에 적혀 있다 — 없으면 "저장은 하나" 원칙 위반으로 보고 지운다');

  return { pass, fail, unknown };
}

/* ═══════════════════════════════════════════════════════════════════════════
   --selftest — 이 검사가 헛도는지 스스로 본다 (handoff-platform-split.md §3)
   변이를 주입한 사본으로 run() 을 다시 돌려 **빨개지는지** 확인한다.
   빨개지지 않는 변이가 하나라도 있으면 그 항목은 아무것도 안 지키고 있는 것이다.
   ═══════════════════════════════════════════════════════════════════════════ */
const MUTATIONS = [
  ['app 쪽 우선순위 뒤바꿈 (key 를 keys 앞으로)', 'app',
    (s) => s.replace(/if\(Array\.isArray\(rec\.keys\)\) return rec\.keys\.filter\(Boolean\);\s*\n(\s*)if\(rec\.key\)(\s*)return \[rec\.key\];/,
      'if(rec.key) return [rec.key];\n$1if(Array.isArray(rec.keys))$2return rec.keys.filter(Boolean);')],
  ['app 쪽 접두사를 KEY_PLATFORM 변수로', 'app',
    (s) => s.replace(/'win:' \+ String\(rec\.exe\)/, "KEY_PLATFORM + String(rec.exe)")],
  ['app 쪽 접두사를 mac: 으로', 'app',
    (s) => s.replace(/'win:' \+ String\(rec\.name\)/, "'mac:' + String(rec.name)")],
  ['app 쪽 toLowerCase 한 개 제거', 'app',
    (s) => s.replace(/String\(rec\.exe\)\.toLowerCase\(\)/, 'String(rec.exe)')],
  ['app 쪽 filter(Boolean) 제거', 'app',
    (s) => s.replace(/rec\.keys\.filter\(Boolean\)/, 'rec.keys')],
  ['app 쪽 name 갈래 삭제 (옛 focus-apps 승격이 죽는다)', 'app',
    (s) => s.replace(/if\(rec\.name\)\s*return \['win:' \+ String\(rec\.name\)\.toLowerCase\(\)\];/, '')],
  ['main 쪽 exe 갈래 삭제 (옛 달성조건이 죽는다)', 'main',
    (s) => s.replace(/if\(rec\.exe\)\s*return \['win:' \+ String\(rec\.exe\)\.toLowerCase\(\)\];/, '')],
  ['main 쪽 로더 승격 제거', 'main',
    (s) => s.replace(/a\.key = 'win:' \+ String\(a\.name\)\.toLowerCase\(\);/, '')],
  ['app 쪽에 옛 직접 비교 부활 (f.name === exeName)', 'app',
    (s) => s.replace(/function _chalKeysOf\(rec\)\{/, 'function _chalBypass(f, exeName){ return f.name === exeName; }\nfunction _chalKeysOf(rec){')],
];

function selftest(mainSrc, appSrc){
  console.log('── selftest: 변이 ' + MUTATIONS.length + '종을 주입해 전부 잡히는지 본다');
  let missed = 0, applied = 0;
  for(const [label, which, mut] of MUTATIONS){
    const m2 = which === 'main' ? mut(mainSrc) : mainSrc;
    const a2 = which === 'app'  ? mut(appSrc)  : appSrc;
    if(m2 === mainSrc && a2 === appSrc){
      console.log('  ? 변이가 적용되지 않았다 — 대상 문자열이 바뀐 듯: ' + label);
      missed++; continue;
    }
    applied++;
    pass = fail = unknown = 0; QUIET = true;
    run(m2, a2);
    QUIET = false;
    if(fail > 0) console.log('  ✓ 잡힘 (실패 ' + fail + ') — ' + label);
    else { console.log('  ✗ **못 잡음** — ' + label + '  ← 이 항목은 아무것도 안 지키고 있다'); missed++; }
  }
  console.log('');
  console.log('selftest: 주입 ' + applied + ' · 못 잡음 ' + missed);
  return missed === 0 ? 0 : 1;
}

/* ═══ 진입 ═══ */
const mainSrc = read('main.js');
const appSrc  = read('app.js');
if(mainSrc == null || appSrc == null){
  console.log('✗ main.js / app.js 를 같은 폴더에서 못 찾음');
  process.exit(2);
}

console.log('🔑 sim-keysof-twin — 판정 키 통로 두 벌 대조 (handoff-platform-split.md §4-b)');

if(process.argv.includes('--selftest')){
  process.exit(selftest(mainSrc, appSrc));
}

run(mainSrc, appSrc);
console.log('');
console.log('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + unknown);
if(fail) console.log('  ✗ 는 두 벌이 어긋났거나 §4-b 의 못이 빠진 것이다.');
if(unknown) console.log('  ? 는 심볼이 개명·이동됐다는 뜻이다. 고쳤다면 이 파일도 같이 고칠 것.');
if(!fail && !unknown) console.log('  ✓ 전부 통과');
process.exit(fail ? 1 : (unknown ? 2 : 0));
