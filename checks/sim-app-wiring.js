/* sim-app-wiring.js — 🧩 app.js 가 «조립만» 으로 가는가 — 로직 표지 다섯이 늘지 않는가
   실행:  node sim-app-wiring.js   (러너 스테이징 또는 저장소 루트에서)
   [기준선 다시 쓰기] 저장소 루트에서 `node checks/sim-app-wiring.js --write-baseline` → checks/app-wiring-baseline.json
   ★ 왜 이 검사가 있는가 — sim-app-size 는 줄 수만 막아서, 로직(함수 · 공유 let · 이벤트 듣기 · 저장 · try)이 app.js 에 남거나 새로 들어와도 초록이다.
     app.js 의 끝 모양은 «모듈을 만들고 deps 를 잇는 글만» 이다(설계 tw-docs docs/design/app/app-js-split.md 2-1 · 2-3).
     그래서 로직 표지 다섯을 세어 기준선으로 두고 **늘면 빨강** · 줄면 같은 PR 에서 기준선을 내리게 한다(sim-typeof-guards 와 같은 톱니).
   ・세는 것(typescript 파서 — 주석 · 문자열 · 템플릿 안은 안 센다):
       함수 — 맨 위(파일 꼭대기)의 function 선언 · let — 맨 위 let 이름 수(한 줄에 여럿이면 여럿) ·
       듣기 — 어디서든 `.addEventListener(` 부름 · 저장 — 어디서든 `localStorage` 이름(window.localStorage 포함) · try — 어디서든 try 문
   ・다섯이 모두 0 이 되면 기준선을 걷고 «0 이 아니면 빨강» 으로 바꾼다(설계 2-3).
   ・1절: 읽었다 · 기준선 · 2절: 늘지 않았다 · 줄었으면 내린다 · 3절: 가짜 입력으로 깨 보기(진짜 app.js 에 한 줄씩 더해 본다 포함) */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

/* 러너는 저장소 밖 임시 폴더에서 돌린다 — 저장소의 node_modules 를 찾아간다(sim-global-names 와 같다) */
let ts;
for (const d of [__dirname, path.join(__dirname, '..'), process.env.INIT_CWD, process.env.PWD, process.cwd()].filter(Boolean)) {
  try { ts = require(require.resolve('typescript', { paths: [d] })); break; } catch (_) {}
}
if (!ts) {
  if (process.env.CI) { say('  ✗ typescript 를 못 찾음 — checks.yml 의 설치 줄을 확인'); process.exit(1); }
  say('  ? 원본 못 찾음 — typescript(npm install 로 깔린다)'); process.exit(2);
}
const BASE = ['.', 'app'].map(d => path.resolve(d)).find(d => fs.existsSync(path.join(d, 'desk-companion-prototype.html')) && fs.existsSync(path.join(d, 'parts', 'app.js')));
if (!BASE) { say('  ? 원본 못 찾음 — desk-companion-prototype.html 과 parts/app.js'); process.exit(2); }
const BASE_FILE = path.join(__dirname, 'app-wiring-baseline.json');
const APP = fs.readFileSync(path.join(BASE, 'parts', 'app.js'), 'utf8');

const KEYS = ['functions', 'lets', 'listeners', 'storage', 'tries'];
const LABEL = { functions: '맨 위 함수', lets: '맨 위 let', listeners: 'addEventListener', storage: 'localStorage', tries: 'try' };

/* 글 → { functions, lets, listeners, storage, tries } (파싱이 깨지면 던진다 — 조용히 0 으로 세지 않게) */
function count(src) {
  const sf = ts.createSourceFile('app.js', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (sf.parseDiagnostics && sf.parseDiagnostics.length) throw new Error('app.js 파싱 실패 — ' + ts.flattenDiagnosticMessageText(sf.parseDiagnostics[0].messageText, ' '));
  const n = { functions: 0, lets: 0, listeners: 0, storage: 0, tries: 0 };
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st)) n.functions++;
    else if (ts.isVariableStatement(st) && (st.declarationList.flags & ts.NodeFlags.Let)) n.lets += st.declarationList.declarations.length;
  }
  (function walk(node) {
    if (ts.isTryStatement(node)) n.tries++;
    else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'addEventListener') n.listeners++;
    else if (ts.isIdentifier(node) && node.text === 'localStorage') n.storage++;
    ts.forEachChild(node, walk);
  })(sf);
  return n;
}
/* 지금 · 기준선 → { up: [늘어난 표지], down: [준 표지] } */
function compare(now, base) {
  const up = [], down = [];
  for (const k of KEYS) {
    const a = now[k], b = base[k];
    if (a > b) up.push(LABEL[k] + ' ' + b + '→' + a); else if (a < b) down.push(LABEL[k] + ' ' + b + '→' + a);
  }
  return { up, down };
}

const NOW = count(APP);
let base = null;
try { base = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')); } catch (_) {}

if (process.argv.includes('--write-baseline')) {
  const c = base && base.counts ? compare(NOW, base.counts) : { up: [] };
  if (c.up.length) { say('  ✗ 기준선보다 늘었다(' + c.up.join(' · ') + ') — 늘린 로직을 모듈로 옮긴다. 기준선은 안 썼다'); process.exit(1); }
  const counts = {}; for (const k of KEYS) counts[k] = NOW[k];
  fs.writeFileSync(BASE_FILE, JSON.stringify({
    note: 'sim-app-wiring.js 기준선 — app.js 의 로직 표지(맨 위 함수 · 맨 위 let · addEventListener · localStorage · try) 개수. 줄기만 한다: 모듈로 옮겨 줄었으면 같은 PR 에서 --write-baseline 으로 내리고, 늘리지 말 것.',
    counts,
  }, null, 1) + '\n');
  say('  ✓ 기준선을 썼다 — ' + KEYS.map(k => LABEL[k] + ' ' + counts[k]).join(' · ') + ' → ' + BASE_FILE);
  process.exit(0);
}

say('── 1. 읽기 · 기준선');
chk(APP.length > 10000 && NOW.functions > 0, 'app.js 를 읽고 셌다 — ' + KEYS.map(k => LABEL[k] + ' ' + NOW[k]).join(' · '));
chk(!!base && !!base.counts && KEYS.every(k => Number.isInteger(base.counts[k])), '기준선 파일을 읽었다 — ' + path.basename(BASE_FILE));

say('── 2. 로직 표지가 늘지 않았다');
if (base && base.counts) {
  const c = compare(NOW, base.counts);
  chk(!c.up.length, '다섯 표지 모두 기준선 이하' + (c.up.length ? ' — ' + c.up.join(' · ') + ' (새 로직은 app.js 말고 도메인 모듈에 — 구조 표 · docs/APP_FSD_MAP.md)' : ''));
  chk(!c.down.length, '기준선보다 준 표지 0' + (c.down.length ? ' — 줄었어요. 같은 PR 에서 기준선을 내려 주세요: node checks/sim-app-wiring.js --write-baseline (' + c.down.join(' · ') + ')' : ''));
}

say('── 3. 깨 보기');
{
  const fake = [
    'function a(){ function inner(){} try{}catch(_){} }',
    'let x = 1, y = 2;',
    'const z = 3; var v = 4;',
    'el.addEventListener("click", ()=>{ try{ localStorage.setItem("k", "v"); }catch(_){} });',
    'window.localStorage.getItem("k");',
    '/* function hid(){} let q; el.addEventListener(); localStorage; try{}catch(_){} */',
    '// function hid2(){}',
    'const s = "function no(){} localStorage try{";',
    'const t = `addEventListener localStorage`;',
    'if(true){ let inBlock = 1; function inBlockFn(){} }',
  ].join('\n');
  const F = count(fake);
  chk(F.functions === 1, '맨 위 함수만 센다(안쪽 함수 · 블록 안 함수 · 주석 · 문자열은 안 센다) — ' + F.functions);
  chk(F.lets === 2, '맨 위 let 은 이름 수(한 줄 둘 = 2) · const · var · 블록 안 let 은 안 센다 — ' + F.lets);
  chk(F.listeners === 1, 'addEventListener 는 부른 곳만(주석 · 템플릿 글은 안 센다) — ' + F.listeners);
  chk(F.storage === 2, 'localStorage 는 이름(window.localStorage 포함 · 주석 · 문자열은 안 센다) — ' + F.storage);
  chk(F.tries === 2, 'try 는 어디서든 try 문(함수 안 포함) — ' + F.tries);
  let threw = false; try { count('function (('); } catch (_) { threw = true; }
  chk(threw, '파싱이 깨진 글은 0 으로 세지 않고 던진다');
  /* 진짜 app.js 에 한 줄씩 더해 보면 그 표지만 하나 늘어 빨강이 된다 */
  const adds = {
    functions: '\nfunction _wiringBreak(){}\n',
    lets: '\nlet _wiringBreak = 0;\n',
    listeners: '\nwindow.addEventListener("resize", ()=>{});\n',
    storage: '\nconst _wiringBreak = localStorage.getItem("tw.x");\n',
    tries: '\ntry{ void 0; }catch(_){}\n',
  };
  for (const k of KEYS) {
    const N2 = count(APP + adds[k]);
    const c = compare(N2, NOW);
    chk(c.up.length === 1 && c.up[0].startsWith(LABEL[k]) && !c.down.length, 'app.js 에 ' + LABEL[k] + ' 하나를 더하면 그 표지만 늘어 빨강');
  }
  const c2 = compare(count(APP.replace(/\nfunction ([A-Za-z_$][\w$]*)\(/, '\nconst $1 = function(')), NOW);
  chk(c2.down.length === 1 && c2.down[0].startsWith(LABEL.functions), '맨 위 함수 하나를 걷으면(옮기면) 줄었다고 빨강 — 기준선을 내리게');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
