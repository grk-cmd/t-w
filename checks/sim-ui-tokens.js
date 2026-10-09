/* ═══ 🧩 sim-ui-tokens.js — 디자인 토큰(--tw-*) 다리 · 직접 적은 글꼴 · 손 회색이 늘지 않는가 ═══════════════
   [왜] 디자인 시스템(docs/design-system) 이행 1단계. 색 · 글꼴을 규칙에 직접 박으면 테마(버블 · 클래식 · 앞으로 밤)가
     그 자리에 닿지 못한다. 옛 자리는 한꺼번에 못 고치니 «지금 남은 수» 를 기준선(ui-tokens-baseline.json)으로 두고
     **늘어나는 것만** 막는다. 줄이는 것은 언제든 된다 — 줄였으면 기준선도 내린다(아래 [기준선 다시 쓰기]).
   ・1절: :root 에 --tw-* 토큰 블록이 있고, 쓰는 곳(var(--tw-…))이 모두 정의된 이름이다(오타 = 무효값 = 화면 깨짐).
   ・2절: 글꼴 토큰마다 한글 폰트가 있다(sim-font-hangul 과 같은 이유 — Tahoma 에는 한글이 없다).
   ・3절: 파일마다 «직접 적은 font-family / font 목록» 수가 기준선 이하.
   ・4절: 파일마다 «손 회색»(#999 · #888 · #ccc 처럼 세 칸이 같은 hex · 흰 #fff 와 검정 #000 은 뺀다) 수가 기준선 이하.
     토큰 정의(--이름:값)와 주석은 세지 않는다. var(--x, #999) 의 폴백은 센다(값이 박혀 있는 것은 같다).
   [기준선 다시 쓰기] 저장소 루트에서 `node checks/sim-ui-tokens.js --write-baseline` — 줄었을 때만 쓴다.
   [실행] desk-companion-prototype.html · parts/ 가 있는 폴더(러너 스테이징) 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

/* 러너 스테이징(평평한 폴더 + parts/)과 저장소 루트(app/ · app/parts/) 둘 다에서 돈다 */
const DIRS = ['.', 'parts', 'app', path.join('app', 'parts')];
const find = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return p; } return null; };
const htmlPath = find('desk-companion-prototype.html');
const partsDir = ['parts', path.join('app', 'parts')].find(d => fs.existsSync(path.join(d, 'app.js')));
if(!htmlPath || !partsDir){ say('  ? 원본 없음 — ' + (!htmlPath ? 'desk-companion-prototype.html ' : '') + (!partsDir ? 'parts/app.js' : '')); process.exit(2); }
const BASE_FILE = path.join(__dirname, 'ui-tokens-baseline.json');

/* 주석을 같은 길이의 공백으로 — 줄 번호를 지키려고 */
const blank = (m) => m.replace(/[^\n]/g, ' ');
const stripCss = (s) => s.replace(/<!--[\s\S]*?-->/g, blank).replace(/\/\*[\s\S]*?\*\//g, blank);
const stripJs = (s) => stripCss(s).replace(/(^|[^:\\'"])(\/\/[^\n]*)/g, (m, a, b) => a + blank(b));

const files = [['desk-companion-prototype.html', stripCss(fs.readFileSync(htmlPath, 'utf8'))]];
for(const f of fs.readdirSync(partsDir).filter(f => f.endsWith('.js')).sort())
  files.push([f, stripJs(fs.readFileSync(path.join(partsDir, f), 'utf8'))]);
const HTML = files[0][1];
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

/* 직접 적은 글꼴: font-family: / font: 값에 실제 글꼴 이름이 있는 것. --이름: 정의 · var(--…) 만 쓴 것 · inherit 은 아니다 */
const FAMILY = /Tahoma|Malgun|맑은 고딕|Dotum|돋움|Gulim|굴림|Consolas|Courier|Menlo|monospace|sans-serif|serif|Fredoka|Nunito|Segoe|Apple SD|Arial|Verdana|Helvetica|system-ui|Gothic/;
function fontHits(code){
  const out = [];
  for(const m of code.matchAll(/(?<![\w-])font(?:-family)?\s*:\s*([^;}\n`]*)/g))
    if(FAMILY.test(m[1])) out.push({ i: m.index, s: m[0].slice(0, 80) });
  return out;
}
/* 손 회색: 세 칸이 같은 hex(#rgb · #rrggbb). 흰 · 검정 · 토큰 정의(--이름: 의 값) · HTML 엔티티(&#333;)는 뺀다 */
const GREY = /(?<![&\w])#(?:([0-9a-fA-F])\1\1|([0-9a-fA-F]{2})\2\2)(?![0-9a-fA-F])/g;
function greyHits(code){
  const out = [];
  for(const m of code.matchAll(GREY)){
    const v = m[0].toLowerCase();
    if(v === '#fff' || v === '#ffffff' || v === '#000' || v === '#000000') continue;
    const head = code.slice(Math.max(0, m.index - 200), m.index);
    const k = Math.max(head.lastIndexOf(';'), head.lastIndexOf('{'), head.lastIndexOf('\n'));
    if(/^\s*--[\w-]+\s*:/.test(head.slice(k + 1))) continue;
    out.push({ i: m.index, s: v });
  }
  return out;
}

const now = { fonts: {}, greys: {} }, where = { fonts: {}, greys: {} };
for(const [name, code] of files){
  const f = fontHits(code), g = greyHits(code);
  if(f.length){ now.fonts[name] = f.length; where.fonts[name] = f.map(h => lineOf(code, h.i) + ': ' + h.s); }
  if(g.length){ now.greys[name] = g.length; where.greys[name] = g.map(h => lineOf(code, h.i) + ': ' + h.s); }
}

if(process.argv.includes('--write-baseline')){
  let old = { fonts: {}, greys: {} };
  try{ old = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')); }catch(_){}
  const up = [];
  for(const k of ['fonts', 'greys']) for(const [f, n] of Object.entries(now[k])) if(n > (old[k][f] || 0)) up.push(k + ' ' + f + ' ' + (old[k][f] || 0) + ' → ' + n);
  if(up.length && !process.argv.includes('--allow-increase')){
    say('  ✗ 기준선보다 늘었다 — 늘린 자리를 토큰으로 바꾸거나, 꼭 필요하면 --allow-increase\n    ' + up.join('\n    '));
    process.exit(1);
  }
  fs.writeFileSync(BASE_FILE, JSON.stringify({
    note: 'sim-ui-tokens.js 기준선 — 아직 토큰으로 못 바꾼 자리 수. 늘리지 않는다. 줄였으면 --write-baseline 으로 내린다.',
    fonts: now.fonts, greys: now.greys,
  }, null, 2) + '\n');
  say('  ✓ 기준선을 썼다 — ' + BASE_FILE);
  process.exit(0);
}

say('── 1. 토큰 블록 · 쓰는 이름');
const defs = new Set([...HTML.matchAll(/(^|[\s;{])(--tw-[\w-]+)\s*:/g)].map(m => m[2]));
chk(defs.size >= 40, ':root 에 --tw-* 토큰이 정의돼 있다 [' + defs.size + '개]');
chk(/:root\{\s*\/\*[^*]*\*\/\s*--tw-bg-face:var\(--win-face\);/.test(fs.readFileSync(htmlPath, 'utf8')), '토큰 블록은 :root — 옛 변수를 가리키는 별칭부터');
for(const t of ['--tw-ink', '--tw-ink-soft', '--tw-bg-face', '--tw-line', '--tw-title-grad', '--tw-font-ui', '--tw-font-classic', '--tw-font-num', '--tw-font-legacy'])
  if(!defs.has(t)) chk(false, t + ' 정의 없음');
const undef = [];
for(const [name, code] of files) for(const m of code.matchAll(/var\(\s*(--tw-[\w-]+)/g)) if(!defs.has(m[1])) undef.push(name + ':' + lineOf(code, m.index) + ' ' + m[1]);
chk(undef.length === 0, '쓰는 --tw-* 가 모두 정의된 이름' + (undef.length ? ' — ' + undef.slice(0, 5).join(' · ') : ''));

say('── 2. 글꼴 토큰의 한글');
const KOR = /Malgun Gothic|맑은 고딕|Dotum|돋움/;
const fontDef = (n) => (HTML.match(new RegExp('--tw-font-' + n + '\\s*:\\s*([^;]*);')) || [])[1] || '';
chk(fontDef('ui') === 'var(--win-font)', '--tw-font-ui = 테마 본문 글꼴(--win-font) — 두 테마 모두 한글 폰트가 있다(sim-font-hangul 2절)');
for(const n of ['classic', 'legacy']) chk(/^Tahoma,/.test(fontDef(n)) && KOR.test(fontDef(n)), '--tw-font-' + n + ' — Tahoma 다음에 한글 폰트 [' + fontDef(n) + ']');

let base = null;
try{ base = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')); }catch(e){ chk(false, '기준선 파일을 못 읽었다 — ' + BASE_FILE); }
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
function compare(kind, label){
  if(!base) return;
  const over = [], under = [];
  for(const [name, n] of Object.entries(now[kind])){
    const b = base[kind][name] || 0;
    if(n > b) over.push(name + ' ' + b + ' → ' + n + '\n      ' + where[kind][name].slice(-Math.min(6, n - b + 3)).join('\n      '));
  }
  for(const [name, b] of Object.entries(base[kind])) if((now[kind][name] || 0) < b) under.push(name + ' ' + b + ' → ' + (now[kind][name] || 0));
  chk(over.length === 0, '★ ' + label + ' — 기준선보다 늘지 않았다 (지금 ' + total(now[kind]) + ' · 기준선 ' + total(base[kind]) + ')'
    + (over.length ? '\n    늘어난 파일(새 자리는 var(--tw-…) 로):\n    ' + over.join('\n    ') : ''));
  if(under.length) say('    ↓ 줄었다 — 기준선을 내려 둘 것(--write-baseline): ' + under.join(' · '));
}
say('── 3. 직접 적은 글꼴 목록');
compare('fonts', '직접 적은 font-family / font');
say('── 4. 손 회색');
compare('greys', '손 회색 hex');

say(`\n통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
