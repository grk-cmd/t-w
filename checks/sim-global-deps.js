/* ═══ 🧩 sim-global-deps.js — app.js 전역을 deps 로 받는 화면 모듈 넷(앱 FSD · M23) ═══════════════
   [왜] animal.js · myhome-desktop.js · bug-board-ui.js · noise.js 는 app.js 다음 <script> 로 실려 app.js 맨 위 이름(toast · isAdmin · seats …)을 그냥 불렀다.
        app.js 에서 그 이름을 옮기면 «조용히 안 됨» 이 된다(R7). 지금은 createXxx(deps) 로 받는다.
        sim-global-names 는 «이름이 어딘가 있나» 만 봐서 deps 를 빼먹고도 app.js 전역이 있으면 통과한다 — 이 검사가 그 구멍을 막는다.
   ・1절: 모듈 안에서 app.js 맨 위 이름을 deps 없이 부르는 곳 0(파서로 범위를 따라간다) · 깨 보기
   ・2절: deps 짝 — 모듈이 받는 이름(const X = deps.X) = app.js 가 넘기는 이름 · 모양(함수는 화살표 · 읽는 함수 · 쓰는 함수)
   ・3절: 연결 — html 에서 app.js 보다 먼저 · 자료 파일 순서 · 만드는 줄은 app.js 끝에서 옛 차례대로
   [실행] 러너 스테이징 또는 저장소 루트에서(typescript 필요 — sim-global-names 와 같다). */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
let ts;
for (const d of [__dirname, path.join(__dirname, '..'), process.env.INIT_CWD, process.env.PWD, process.cwd()].filter(Boolean)) {
  try { ts = require(require.resolve('typescript', { paths: [d] })); break; } catch (_) {}
}
if(!ts){ if(process.env.CI){ say('  ✗ typescript 를 못 찾음'); process.exit(1); } say('  ? typescript 없음 — 건너뜀'); process.exit(2); }

const APP = read('app.js'), HTML = read('desk-companion-prototype.html');
const MODS = [
  { file: 'myhome/myhome-desktop.js', glob: 'TwMyHomeDesktop', create: 'createMyHomeDesktop' },
  { file: 'support/bug-board-ui.js', glob: 'TwBugBoardUi', create: 'createBugBoardUi' },
  { file: 'status/noise.js', glob: 'TwNoise', create: 'createNoise' },
  { file: 'character/animal.js', glob: 'TwAnimal', create: 'createAnimal' },
];
const SRC = {}; MODS.forEach(m => { SRC[m.file] = read(m.file); });
if(!APP || !HTML || MODS.some(m => !SRC[m.file])){ say('  ? 원본 못 찾음'); process.exit(2); }

/* app.js 맨 위에 선언된 이름 */
function topNames(src){
  const sf = ts.createSourceFile('app.js', src, ts.ScriptTarget.Latest, true), top = new Set();
  const bind = (x) => { if(ts.isIdentifier(x)) top.add(x.text); else if(x.elements) x.elements.forEach(e => e.name && bind(e.name)); };
  sf.statements.forEach(s => {
    if((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name) top.add(s.name.text);
    if(ts.isVariableStatement(s)) s.declarationList.declarations.forEach(d => bind(d.name));
  });
  return top;
}
/* 파일 안에 선언이 없는 이름(= 바깥에서 부르는 이름) 중 app.js 맨 위 이름 */
function freeTop(src, top){
  const sf = ts.createSourceFile('m.js', src, ts.ScriptTarget.Latest, true), declared = new Set(), used = {};
  const bind = (x) => { if(ts.isIdentifier(x)) declared.add(x.text); else if(x.elements) x.elements.forEach(e => e.name && bind(e.name)); };
  (function walk(n){
    if((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) declared.add(n.name.text);
    if(ts.isVariableDeclaration(n) || ts.isParameter(n)) bind(n.name);
    if(ts.isCatchClause(n) && n.variableDeclaration) bind(n.variableDeclaration.name);
    ts.forEachChild(n, walk);
  })(sf);
  (function walk(n){
    if(ts.isIdentifier(n)){
      const p = n.parent;
      const prop = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isMethodDeclaration(p) && p.name === n) || ts.isPropertySignature(p) || (ts.isBindingElement(p) && p.propertyName === n);
      if(!prop && top.has(n.text) && !declared.has(n.text)) used[n.text] = (used[n.text] || 0) + 1;
    }
    ts.forEachChild(n, walk);
  })(sf);
  return Object.keys(used);
}
const TOP = topNames(APP);

console.log('§1 app.js 맨 위 이름을 deps 없이 부르는 곳');
for(const m of MODS){
  const bare = freeTop(SRC[m.file], TOP);
  chk(!bare.length, m.file + ' — deps 없이 부르는 app.js 이름 0' + (bare.length ? ' (' + bare.join(' · ') + ')' : ''));
}
{
  const m = MODS[1], broke = SRC[m.file].replace('const toast = deps.toast;', '');
  chk(broke !== SRC[m.file] && freeTop(broke, TOP).includes('toast'), '깨 보기: deps 로 받는 줄을 빼면 빨강');
}

console.log('§2 deps 짝');
const block = (m) => { const i = APP.indexOf(m.glob + '.' + m.create + '({'); if(i < 0) return null; const j = APP.indexOf('\n});', i); return APP.slice(i + (m.glob + '.' + m.create + '({').length, j).split('\n').map(s => s.trim()).filter(Boolean); };
for(const m of MODS){
  const deps = block(m) || [];
  const got = new Map(deps.map(l => { const mm = /^(\w+): (.*),$/.exec(l); return mm ? [mm[1], mm[2]] : [l, '?']; }));
  const recv = [...SRC[m.file].matchAll(/^const (\w+) = deps\.(\w+);/gm)].map(x => [x[1], x[2]]);
  const same = recv.length === got.size && recv.every(([a, b]) => a === b && got.has(a));
  chk(!!block(m) && same, m.file + ' — 받는 이름 ' + recv.length + '개 = 넘기는 이름 ' + got.size + '개' + (same ? '' : ' (어긋남)'));
  const shapeOk = recv.every(([n]) => {
    const v = got.get(n) || '';
    if(/^set[A-Z]/.test(n)){ const t = n[3].toLowerCase() + n.slice(4); return v === '(v)=>{ ' + t + ' = v; }'; }
    return v === n || v === '(...a)=>' + n + '(...a)' || v === '()=>' + n;
  });
  chk(shapeOk, '  모양 — 값 · 함수는 (...a)=> · 읽는 함수 ()=> · 쓰는 함수 (v)=>{ x = v; }');
  chk(new RegExp('window\\.' + m.glob + ' = \\{ ' + m.create + ' \\};').test(SRC[m.file]), '  window.' + m.glob + ' 로 내놓는다');
  const rd = recv.filter(([n]) => got.get(n) === '()=>' + n).map(([n]) => n);
  /* 읽는 함수로 받은 이름은 모듈 안에서 늘 n() 으로 쓴다 — 값처럼 쓰면 늘 «함수» 라 참이 된다 */
  const stripped = SRC[m.file].replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  const valueUse = rd.filter(n => new RegExp('(^|[^.\\w$])' + n + '(?!\\s*[(:])(?![\\w$])').test(stripped.replace(new RegExp('const ' + n + ' = deps\\.' + n + ';', 'g'), '')));
  chk(!valueUse.length, '  읽는 함수(' + rd.join(' · ') + ')는 값처럼 쓰지 않는다' + (valueUse.length ? ' — ' + valueUse.join(' · ') : ''));
}
{
  const m = MODS[3], head = m.glob + '.' + m.create + '({', i = APP.indexOf(head), j = APP.indexOf('\n});', i);
  const broke = APP.slice(0, i) + APP.slice(i, j).replace('\n  creatorMode: ()=>creatorMode,', '') + APP.slice(j);
  const names = [...SRC[m.file].matchAll(/^const (\w+) = deps\.(\w+);/gm)].map(x => x[1]);
  const given = new Set(broke.slice(i, broke.indexOf('\n});', i)).split('\n').map(l => (/^\s*(\w+):/.exec(l) || [])[1]).filter(Boolean));
  chk(broke !== APP && names.some(n => !given.has(n)), '깨 보기: 넘기는 줄 하나를 빼면 위 짝 검사가 어긋난다(빨강)');
}

console.log('§3 연결');
{
  const at = (f) => HTML.indexOf('<script src="parts/' + f + '"></script>'), iApp = at('app.js');
  chk(MODS.every(m => at(m.file) > 0 && at(m.file) < iApp), 'html — 네 모듈 모두 app.js 보다 먼저');
  chk(at('status/noise-sounds.js') > 0 && at('status/noise-sounds.js') < at('status/noise.js') && at('animal-glb.js') < at('character/animal.js') && at('ears-glb.js') < at('character/animal.js') && at('myhome/folder-free.js') < at('myhome/myhome-desktop.js'), 'html — 자료(noise-sounds · animal-glb · ears-glb · folder-free)가 쓰는 모듈보다 먼저');
  chk(at('myhome/mallang.js') > iApp && at('myhome/bookmark.js') > iApp, 'html — 말랑이 · 북마크는 그대로 app.js 뒤(MYHOME_DESKTOP 이 만들어진 뒤)');
  const pos = MODS.map(m => APP.lastIndexOf(m.glob + '.' + m.create + '({')), iBoot = APP.indexOf('runBoot.begin();');
  chk(pos.every(p => p > iBoot) && pos.every((p, i) => i === 0 || p > pos[i - 1]), 'app.js — 만드는 줄 넷은 INIT(runBoot.begin) 뒤 · 옛 차례(바탕화면 → 버그제보 → 소음 → 동물)');
  chk(pos[3] > APP.length - 2500, '  파일 끝 쪽에서 만든다(옛 «app.js 다음 script» 와 같은 때)');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
