/* sim-typeof-guards.js — 🪝 «있으면 부르기» typeof 가드가 **늘지 않는가**
   실행:  node sim-typeof-guards.js   (러너 스테이징 또는 저장소 루트에서)
   [기준선 다시 쓰기] 저장소 루트에서 `node checks/sim-typeof-guards.js --write-baseline` → checks/typeof-guards-baseline.json
   ★ 왜 이 검사가 있는가 — `if(typeof window.X==='function') window.X()` · `typeof X !== 'undefined'` 같은 가드는 X 를 거는
     모듈이 안 실리거나 이름이 바뀌어도 조용히 아무 일도 안 하게 만든다(오류 없이 기능만 빠진다). 지금 있는 것은
     기준선(파일별 개수)으로 두고 **새로 생기는 가드만** 막는다. 걷어서 줄었으면 같은 PR 에서 --write-baseline 으로 내린다.
     sim-hook-guards.js(정해진 window 고리는 가드 0)와 따로 돈다 — 그쪽은 표의 고리, 이쪽은 전체 개수.
   ・세는 것: app/parts/**\/*.js(vendor/ 빼고) 의 `typeof 이름 (===|!==|==|!=) 'function'|'undefined'` (이름은 a.b.c 꼴 포함 · 앞뒤 바뀐 꼴도).
     안 세는 것: 값 모양 검사('string' · 'number' · 'object' · 'boolean') · 환경 검사(ENV 표 — `typeof window` 그 자체 등) · 주석 안 · EXEMPT 표.
   ・기준선은 파일별 개수(줄 번호는 흔들려서 안 씀). 구역을 옮겨 파일만 바뀌고 합계가 같으면 --write-baseline 으로 다시 쓴다
     — 합계가 기준선보다 많으면 쓰기를 거절한다(늘린 가드를 기준선에 넣지 말 것).
   ・1절: 파일을 읽었다 · 예외가 실제로 있다 · 2절: 파일마다 기준선 이하 · 줄었으면 내린다 · 3절: 가짜 입력으로 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

const BASE = ['.', 'app', path.join('apps', 'desktop', 'app')].map(d => path.resolve(d)).find(d => fs.existsSync(path.join(d, 'desk-companion-prototype.html')) && fs.existsSync(path.join(d, 'parts')));
if (!BASE) { say('  ? 원본 못 찾음 — desk-companion-prototype.html 과 parts/ 폴더'); process.exit(2); }
const BASE_FILE = path.join(__dirname, 'typeof-guards-baseline.json');

/* 환경 검사 — 앱 코드가 아니라 실행 환경(브라우저 · node · 모듈 체계)을 보는 typeof. 이름 전체가 같을 때만 뺀다(`typeof window.X` 는 센다) */
const ENV = new Set([
  'window', 'module', 'require', 'exports', 'globalThis', 'self', 'process', 'define', 'document', 'navigator',
  'performance', 'requestAnimationFrame', 'setInterval', 'indexedDB', 'WeakMap', 'Audio', 'WebSocket', 'fetch', 'window.fetch',
]);

/* 일부러 남긴 가드 — 이름(window. 은 떼고) → { files: 그 파일 안에서만(없으면 어디서든), why }. 세지 않는다 */
const EXEMPT = {
  buildAnimalBase: { why: 'animal.js 가 app.js 뒤에 실려 app.js 가 부를 때 아직 없을 수 있다' },
  reopenAnimalCreator: { why: 'animal.js 가 app.js 뒤에 실린다' },
  _animalUnlocked: { why: 'animal.js 가 거는 고리 — 부르는 쪽이 먼저 실린다' },
  _setAnimalUnlockLevel: { why: 'animal.js 가 거는 고리 — 부르는 쪽이 먼저 실린다' },
  _pomoShowText: { why: '포모도로 모듈을 만들기 전에 focus-share 가 먼저 불린다(pomodoro.js 머리 주석)' },
  __anpSetEarSide: { why: '동물 미리보기 창을 열 때만 걸린다' },
  __anpGoTab: { why: '동물 미리보기 창을 열 때만 걸린다' },
  closeWardrobe: { files: ['app.js'], why: '옷장을 열기 전엔 없다 — app.js 의 생성기 열기 두 곳' },
  CreatorFlatView: { why: '생성기 평면 보기 모듈 — 없으면 null 로 두고 그 기능만 끈다' },
  DeskItemOrigin: { why: '책상 아이템 원점 모듈 — 없으면 null' },
  SeatSlot: { why: '좌석 칸 모듈 — 없으면 null' },
  HumanEar: { why: '사람 귀 모듈 — 없으면 null' },
  cb: { files: ['character/catalog-source.js'], why: 'provider 입구 가드 — 넘겨받은 구독 콜백이 함수인지(값 모양 확인 · 없는 모듈을 «있으면 부르기» 가 아님)' },
};

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const NAME = '[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*';
const KIND = "['\"](?:function|undefined)['\"]";
const RE_A = new RegExp('typeof\\s*\\(?\\s*(' + NAME + ')\\s*\\)?\\s*[!=]==?\\s*' + KIND, 'g');
const RE_B = new RegExp(KIND + '\\s*[!=]==?\\s*typeof\\s*\\(?\\s*(' + NAME + ')\\b(?!\\s*\\.)', 'g');

/* files: [[상대경로, 글]] → { counts: {파일: 개수}, exempt: {이름: 개수}, total } */
function judge(files) {
  const counts = {}, exempt = {}; let total = 0;
  for (const [f, raw] of files) {
    const t = strip(raw);
    for (const re of [RE_A, RE_B]) for (const m of t.matchAll(re)) {
      const n = m[1];
      if (ENV.has(n)) continue;
      const bare = n.replace(/^window\./, '');
      const e = EXEMPT[bare];
      if (e && (!e.files || e.files.includes(f))) { exempt[bare] = (exempt[bare] || 0) + 1; continue; }
      counts[f] = (counts[f] || 0) + 1; total++;
    }
  }
  return { counts, exempt, total };
}
/* 기준선과 견주기 → { up: [파일 지금>기준], down: [파일 지금<기준] } */
function compare(counts, base) {
  const up = [], down = [];
  for (const f of new Set([...Object.keys(counts), ...Object.keys(base)])) {
    const a = counts[f] || 0, b = base[f] || 0;
    if (a > b) up.push(f + ' ' + b + '→' + a); else if (a < b) down.push(f + ' ' + b + '→' + a);
  }
  return { up: up.sort(), down: down.sort() };
}

function walk(dir, rel, out) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) { if (d.name !== 'vendor' && d.name !== 'node_modules') walk(path.join(dir, d.name), rel + d.name + '/', out); }
    else if (d.name.endsWith('.js')) out.push([rel + d.name, fs.readFileSync(path.join(dir, d.name), 'utf8')]);
  }
  return out;
}
const FILES = walk(path.join(BASE, 'parts'), '', []).sort((a, b) => a[0] < b[0] ? -1 : 1);
const R = judge(FILES);
let base = null;
try { base = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')); } catch (_) {}

if (process.argv.includes('--write-baseline')) {
  if (base && R.total > base.total) { say('  ✗ 합계가 기준선보다 많다(' + base.total + '→' + R.total + ') — 늘린 가드를 걷거나 EXEMPT 에 이유와 함께 넣는다. 기준선은 안 썼다'); process.exit(1); }
  const counts = {}; for (const f of Object.keys(R.counts).sort()) counts[f] = R.counts[f];
  fs.writeFileSync(BASE_FILE, JSON.stringify({
    note: 'sim-typeof-guards.js 기준선 — 파일별 «있으면 부르기» typeof 가드 개수(예외 빼고). 줄기만 한다: 걷었으면 같은 PR 에서 --write-baseline 으로 내리고, 새 가드는 넣지 말 것.',
    total: R.total, counts,
  }, null, 1) + '\n');
  say('  ✓ 기준선을 썼다 — 가드 ' + R.total + '개 · 파일 ' + Object.keys(counts).length + '개 → ' + BASE_FILE);
  process.exit(0);
}

say('── 1. 파일 · 예외');
chk(FILES.length >= 100 && FILES.some(([f]) => f === 'app.js'), 'app/parts 의 .js ' + FILES.length + '개를 읽었다(vendor/ 빼고)');
const stale = Object.keys(EXEMPT).filter(n => !R.exempt[n]);
chk(!stale.length, '예외 ' + Object.keys(EXEMPT).length + '개가 모두 실제 가드에 걸린다(없어진 예외는 표에서 뺀다)' + (stale.length ? ' — ' + stale.join(' · ') : ''));
chk(!!base && typeof base.total === 'number' && !!base.counts, '기준선 파일을 읽었다 — ' + path.basename(BASE_FILE));

say('── 2. 가드가 늘지 않았다 (지금 ' + R.total + '개' + (base ? ' · 기준선 ' + base.total : '') + ' · 예외 ' + Object.values(R.exempt).reduce((a, b) => a + b, 0) + ')');
if (base) {
  const c = compare(R.counts, base.counts);
  chk(!c.up.length, '파일마다 기준선 이하' + (c.up.length ? ' — ' + c.up.join(' · ') + ' (새 가드를 걷고 부르는 곳에서 바로 부른다. 꼭 필요하면 EXEMPT 에 이유와 함께. 구역을 옮겨 합계가 같으면 --write-baseline)' : ''));
  chk(!c.down.length, '기준선보다 준 파일 0' + (c.down.length ? ' — 줄었어요. 같은 PR 에서 기준선을 내려 주세요: node checks/sim-typeof-guards.js --write-baseline (' + c.down.join(' · ') + ')' : ''));
}

say('── 3. 가짜 입력으로 깨 보기');
{
  const fake = [['a.js', "if(typeof window.foo==='function') window.foo();\nif(typeof bar !== 'undefined') bar.x();\n"], ['b.js', "const s = typeof v === 'string';\n"]];
  const F = judge(fake);
  chk(F.counts['a.js'] === 2 && !F.counts['b.js'], '«있으면 부르기» 둘은 세고 값 모양 검사(\'string\')는 안 센다');
  chk(!compare(F.counts, { 'a.js': 2 }).up.length && !compare(F.counts, { 'a.js': 2 }).down.length, '기준선과 같으면 초록');
  const more = judge([...fake.slice(0, 1).map(([f, t]) => [f, t + "if('function' === typeof baz) baz();\n"]), fake[1]]);
  chk(compare(more.counts, { 'a.js': 2 }).up.length === 1, '하나 늘면(앞뒤 바뀐 꼴 포함) 빨강');
  chk(compare(judge([['c.js', "typeof qux==='function'&&qux();\n"]]).counts, { 'a.js': 2 }).up.some(x => x.startsWith('c.js')), '기준선에 없던 파일에 생겨도 빨강');
  chk(compare(judge([['a.js', "if(typeof window.foo==='function') window.foo();\n"]]).counts, { 'a.js': 2 }).down.length === 1, '줄면 기준선을 내리라고 빨강');
  const env = judge([['d.js', "if(typeof window !== 'undefined' && typeof module !== 'undefined' && typeof require === 'function'){}\n/* typeof hid==='function' */\n"]]);
  chk(!env.total, '환경 검사(window · module · require)와 주석 안은 안 센다');
  const ex = judge([['app.js', "if(typeof window.buildAnimalBase==='function'){}\nif(typeof window.closeWardrobe==='function'){}\nif(typeof HumanEar === 'undefined'){}\n"], ['x.js', "if(typeof window.closeWardrobe==='function'){}\n"]]);
  chk(!ex.counts['app.js'] && ex.exempt.buildAnimalBase === 1 && ex.exempt.HumanEar === 1, '예외 이름은 안 센다');
  chk(ex.counts['x.js'] === 1, '파일이 정해진 예외(closeWardrobe → app.js)는 다른 파일에선 센다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
