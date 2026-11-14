/* sim-dep-cycles.js — 🔁 렌더러 모듈끼리 서로 부르는 순환이 **늘지 않는가** · 만드는 줄 순서가 맞는가
   실행:  node sim-dep-cycles.js   (러너 스테이징 또는 저장소 루트에서)
   [기준선 다시 쓰기] 저장소 루트에서 `node checks/sim-dep-cycles.js --write-baseline` → checks/dep-cycles-baseline.json
   ★ 왜 이 검사가 있는가 — A 가 B 를 부르고 B 도 A 를 부르면(순환) 어느 쪽을 먼저 만들어도 한쪽은 «아직 없는» 상대를 본다.
     지금은 typeof 가드와 «부를 때 찾는» 화살표가 가려 돌아가지만, 실행을 INIT 한 곳으로 모으거나 import 로 바꾸는
     순간 터진다(4단계). 2026-10-15 main 에서 모듈 58개가 한 덩어리 순환이었다 — 지금 것은 기준선으로 두고
     **새로 생기는 순환 간선만** 막는다. 끊어서 줄었으면 같은 PR 에서 --write-baseline 으로 내린다(늘리지 말 것).
   ・간선(A → B): A 파일이 B 파일이 거는 전역 · window 이름을 부른다, 또는 app.js 가 A 를 만들며 넘기는 deps 의
     값이 B 모듈(xMod · 옛 전역 이름 다리)을 가리킨다. app.js 자체는 모두를 만들고 부르는 자리라 그래프에서 뺀다.
   ・순환 간선 = 양 끝이 같은 강하게 연결된 묶음(SCC)에 든 간선.
   ・1절: 파일 · 모듈을 다 읽었다 · 2절: 기준선에 없는 순환 간선 0 · 기준선에서 사라진 간선 0(줄었으면 내린다)
   ・2-2절: 모듈을 만드는 도중(create 본문 맨 위)에 부르는 deps 가 만드는 줄과 같거나 뒤에 선언되는 let/const 를 읽지 않는다.
     deps 가 부르는 app.js 함수 안으로 4단계까지 따라간다(부르면 바로 도는 줄만 · 값으로 넘기기만 한 함수는 안 따라감).
     10-15 에 실제로 난 둘을 고치기 전 코드에서 잡는다 — commissionMod(개정 235) · statusChipMod(개정 240, 상태를 저장해 둔 사람만 app.js 가 멈춤).
     조건문은 안 본다 — «그 길을 탈 수도 있으면» 빨강. 진짜 안 타는 길이면 부팅 줄을 만드는 줄 뒤로 옮겨 없앤다
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

/* 러너는 저장소 밖 임시 폴더에서 돌린다 — 저장소의 node_modules 를 찾아간다(npm 은 INIT_CWD, 셸은 PWD 가 저장소) */
let ts;
for (const d of [__dirname, path.join(__dirname, '..'), process.env.INIT_CWD, process.env.PWD, process.cwd()].filter(Boolean)) {
  try { ts = require(require.resolve('typescript', { paths: [d] })); break; } catch (_) {}
}
if (!ts) {
  if (process.env.CI) { say('  ✗ typescript 를 못 찾음 — checks.yml 의 설치 줄을 확인'); process.exit(1); }
  say('  ? 원본 못 찾음 — typescript(npm install 로 깔린다)'); process.exit(2);
}
const BASE = ['.', 'app'].map(d => path.resolve(d)).find(d => fs.existsSync(path.join(d, 'desk-companion-prototype.html')) && fs.existsSync(path.join(d, 'parts')));
if (!BASE) { say('  ? 원본 못 찾음 — desk-companion-prototype.html 과 parts/ 폴더'); process.exit(2); }
const BASE_FILE = path.join(__dirname, 'dep-cycles-baseline.json');
const HTML = fs.readFileSync(path.join(BASE, 'desk-companion-prototype.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const ORDER = [...HTML.matchAll(/<script\b[^>]*\bsrc="(parts\/[^"]+\.js)"/g)].map(m => m[1].slice('parts/'.length)).filter(r => fs.existsSync(path.join(BASE, 'parts', r)));

const isFnLike = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n);
const isIIFE = (fn) => { let c = fn.parent; while (c && ts.isParenthesizedExpression(c)) c = c.parent; return !!c && ts.isCallExpression(c) && (c.expression === fn || (ts.isParenthesizedExpression(c.expression) && c.expression.expression === fn)); };
/* 모듈 공장 = createX(deps) — 이름이 create 로 시작하는 보통 함수(createWardrobeAdjPanel 등)와 가르려고 매개변수 deps 하나를 본다 */
const isFactory = (fn) => ts.isFunctionDeclaration(fn) && !!fn.name && /^create[A-Z]/.test(fn.name.text) && fn.parameters.length === 1 && ts.isIdentifier(fn.parameters[0].name) && fn.parameters[0].name.text === 'deps';

function analyze(rel, text) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const scopeOf = new Map();
  const isScope = (n) => n === sf || isFnLike(n) || ts.isBlock(n) || ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n) || ts.isCatchClause(n) || ts.isClassLike(n) || ts.isCaseBlock(n);
  const decls = (n) => { if (!scopeOf.has(n)) scopeOf.set(n, new Set()); return scopeOf.get(n); };
  const fnScope = (n) => { let p = n.parent; while (p && !(p === sf || isFnLike(p))) p = p.parent; return p || sf; };
  const blockScope = (n) => { let p = n.parent; while (p && !isScope(p)) p = p.parent; return p || sf; };
  const bindNames = (n, add) => { if (!n) return; if (ts.isIdentifier(n)) add(n.text); else if (n.elements) n.elements.forEach(e => { if (!ts.isOmittedExpression(e)) bindNames(e.name, add); }); };
  const topDecl = new Map();
  (function collect(n) {
    if (ts.isVariableDeclaration(n)) {
      const list = n.parent; const isVar = !(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const));
      const sc = isVar ? fnScope(list) : blockScope(list);
      bindNames(n.name, x => { decls(sc).add(x); if (sc === sf) topDecl.set(x, n); });
    } else if (ts.isFunctionDeclaration(n) && n.name) { decls(fnScope(n)).add(n.name.text); decls(blockScope(n)).add(n.name.text); if (fnScope(n) === sf) topDecl.set(n.name.text, n); }
    else if (ts.isClassDeclaration(n) && n.name) { decls(blockScope(n)).add(n.name.text); if (blockScope(n) === sf) topDecl.set(n.name.text, n); }
    else if ((ts.isFunctionExpression(n) || ts.isClassExpression(n)) && n.name) decls(n).add(n.name.text);
    else if (ts.isParameter(n)) bindNames(n.name, x => decls(n.parent).add(x));
    else if (ts.isCatchClause(n) && n.variableDeclaration) bindNames(n.variableDeclaration.name, x => decls(n).add(x));
    ts.forEachChild(n, collect);
  })(sf);
  const resolvesLocal = (id) => { for (let p = id.parent; p; p = p.parent) if (p !== sf && scopeOf.has(p) && scopeOf.get(p).has(id.text)) return true; return false; };
  const isRef = (id) => {
    const p = id.parent; if (!p) return false;
    if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
    if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p)) && p.name === id) return false;
    if (ts.isBindingElement(p) && (p.propertyName === id || p.name === id)) return false;
    if ((ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isClassDeclaration(p) || ts.isClassExpression(p) || ts.isParameter(p)) && p.name === id) return false;
    if (ts.isLabeledStatement(p) || ts.isBreakStatement(p) || ts.isContinueStatement(p) || ts.isMetaProperty(p)) return false;
    return true;
  };
  /* 'call' = 함수 안(부를 때), 'create' = 공장 본문 맨 위(만들 때), 'load' = 실릴 때 */
  const when = (n) => {
    let w = 'load';
    for (let p = n.parent; p; p = p.parent) {
      if (!isFnLike(p) || isIIFE(p)) continue;
      if (isFactory(p)) { w = 'create'; continue; }
      return 'call';
    }
    return w;
  };
  const winSet = new Set(), refs = [];
  (function use(n) {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(n.left) && ts.isIdentifier(n.left.expression) && /^(window|globalThis|self|root)$/.test(n.left.expression.text)) winSet.add(n.left.name.text);
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'window' && !resolvesLocal(n.expression)) {
      const tgt = ts.isBinaryExpression(n.parent) && n.parent.left === n && n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
      if (!tgt) refs.push({ name: n.name.text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    if (ts.isIdentifier(n) && isRef(n) && !resolvesLocal(n)) refs.push({ name: n.text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    ts.forEachChild(n, use);
  })(sf);
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  return { rel, sf, topDecl, winSet, refs, when, lineOf, resolvesLocal };
}

function build(srcs) {   // srcs: [[rel, text]] — HTML 순서
  const A = srcs.map(([r, t]) => analyze(r, t));
  const APP = A.find(a => a.rel === 'app.js');
  if (!APP) return null;
  const owner = new Map();
  for (const a of A) { for (const n of a.topDecl.keys()) if (!owner.has(n)) owner.set(n, a); for (const n of a.winSet) if (!owner.has(n)) owner.set(n, a); }
  /* app.js: 모듈 인스턴스(xMod = … TwX.createX({...})) · 만드는 줄 · deps */
  const instOf = new Map(), depsOf = new Map(), createLine = new Map();
  for (const [n, d] of APP.topDecl) {
    if (!ts.isVariableDeclaration(d) || !d.initializer) continue;
    let call = null;
    (function f(x) { if (call) return; if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && /^create[A-Z]/.test(x.expression.name.text) && ts.isIdentifier(x.expression.expression)) call = x; else ts.forEachChild(x, f); })(d.initializer);
    if (!call) continue;
    const mod = owner.get(call.expression.expression.text);
    if (!mod || mod === APP) continue;
    instOf.set(n, mod); createLine.set(mod, APP.lineOf(d));
    const arg = call.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) depsOf.set(mod, arg.properties.map(p => ({ prop: p.name ? p.name.getText(APP.sf) : '', node: p })));
  }
  /* 옛 전역 이름 다리 — app.js 의 짧은 함수가 모듈 하나를 그대로 부르면 그 모듈로 본다 */
  const bridge = new Map();
  for (const [n, d] of APP.topDecl) {
    const body = ts.isFunctionDeclaration(d) ? d.body : (ts.isVariableDeclaration(d) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) ? d.initializer.body : null);
    if (!body) continue;
    const t = body.getText(APP.sf); const m = t.length <= 160 && t.match(/\b(\w+)\.\w+\(/);
    if (m && instOf.has(m[1])) bridge.set(n, instOf.get(m[1]));
  }
  const target = (n) => instOf.get(n) || bridge.get(n) || owner.get(n) || null;
  const edges = new Map();   // 'a > b' → 첫 근거
  const add = (from, to, why) => { if (from === APP || to === APP || from === to) return; const k = from.rel + ' > ' + to.rel; if (!edges.has(k)) edges.set(k, why); };
  for (const a of A) if (a !== APP) for (const r of a.refs) { const t = target(r.name); if (t) add(a, t, r.name + ' (' + a.rel + ':' + r.line + ')'); }
  const viol = [];
  for (const [mod, props] of depsOf) {
    for (const { prop, node } of props) {
      (function f(x) {
        if (ts.isIdentifier(x) && !(ts.isPropertyAccessExpression(x.parent) && x.parent.name === x) && !(ts.isPropertyAssignment(x.parent) && x.parent.name === x)) { const t = target(x.text); if (t) add(mod, t, 'deps.' + prop + ' ← ' + x.text + ' (app.js:' + APP.lineOf(x) + ')'); }
        ts.forEachChild(x, f);
      })(node);
    }
    /* 2-2: 만들 때 부르는 deps · 바로 값으로 넘기는 deps 가 만드는 줄과 같거나 뒤에 선언된 let/const 를 읽나 */
    const L = createLine.get(mod);
    const local = new Map();
    (function f(x) {
      if (ts.isVariableDeclaration(x) && ts.isIdentifier(x.name) && x.initializer && /^deps\.[\w$]+$/.test(x.initializer.getText(mod.sf))) local.set(x.name.text, x.initializer.getText(mod.sf).slice(5));
      if (ts.isVariableDeclaration(x) && ts.isObjectBindingPattern(x.name) && x.initializer && x.initializer.getText(mod.sf) === 'deps') x.name.elements.forEach(e => { if (ts.isIdentifier(e.name)) local.set(e.name.text, e.propertyName ? e.propertyName.getText(mod.sf) : e.name.text); });   // const { a, b } = deps
      ts.forEachChild(x, f);
    })(mod.sf);
    const calledAtCreate = new Set();
    (function f(x) {
      let prop = null;
      if (ts.isIdentifier(x) && local.has(x.text)) prop = local.get(x.text);
      if (ts.isPropertyAccessExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === 'deps') prop = x.name.text;
      if (prop && ts.isCallExpression(x.parent) && x.parent.expression === x && mod.when(x) !== 'call') calledAtCreate.add(prop);
      ts.forEachChild(x, f);
    })(mod.sf);
    for (const { prop, node } of props) {
      const val = ts.isPropertyAssignment(node) ? node.initializer : node;
      const lazy = val && (ts.isArrowFunction(val) || ts.isFunctionExpression(val));
      if (lazy && !calledAtCreate.has(prop)) continue;
      /* 그 값이 부르는 app.js 함수 안으로도 따라간다(부르면 바로 도는 줄만 — 안쪽 함수는 그때 안 돈다).
         10-15 commissionMod: 만들 때 deps.loadSavedItemsIntoSession() → app.js 함수가 아직 없는 commissionMod 를 읽었다 */
      const seen = new Set();
      const scan = (root, via, depth) => (function f(x) {
        if (x !== root && isFnLike(x) && !isIIFE(x)) return;
        if (ts.isIdentifier(x) && !(ts.isPropertyAccessExpression(x.parent) && x.parent.name === x) && !(ts.isPropertyAssignment(x.parent) && x.parent.name === x)) {
          const d = (x.getSourceFile() === APP.sf && !APP.resolvesLocal(x)) ? APP.topDecl.get(x.text) : null;
          if (d && !ts.isFunctionDeclaration(d) && APP.lineOf(d) >= L) viol.push(mod.rel + ' — app.js:' + L + ' 에서 만들 때 deps.' + prop + via + ' 가 ' + x.text + '(app.js:' + APP.lineOf(d) + ' 선언)를 읽는다');
          const runs = (ts.isCallExpression(x.parent) && x.parent.expression === x) || (x === val && calledAtCreate.has(prop));   // 값으로 넘기기만 한 함수는 따라가지 않는다
          if (d && ts.isFunctionDeclaration(d) && d.body && runs && depth < 4 && !seen.has(x.text)) { seen.add(x.text); scan(d, via + ' › ' + x.text, depth + 1); }
        }
        ts.forEachChild(x, f);
      })(root);
      scan(val || node, '', 0);
    }
  }
  /* SCC(Tarjan) — 순환 간선 = 양 끝이 같은 묶음 */
  const adj = new Map(); for (const k of edges.keys()) { const [a, b] = k.split(' > '); if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); }
  let i = 0; const idx = new Map(), low = new Map(), on = new Set(), st = [], comp = new Map();
  const visit = (v) => { idx.set(v, i); low.set(v, i); i++; st.push(v); on.add(v);
    for (const w of adj.get(v) || []) { if (!idx.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); } else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w))); }
    if (low.get(v) === idx.get(v)) { let w; do { w = st.pop(); on.delete(w); comp.set(w, v); } while (w !== v); } };
  for (const a of A) if (!idx.has(a.rel)) visit(a.rel);
  const cyc = [...edges.keys()].filter(k => { const [a, b] = k.split(' > '); return comp.get(a) === comp.get(b); }).sort();
  const sizes = {}; for (const r of new Set(cyc.flatMap(k => k.split(' > ')))) sizes[comp.get(r)] = (sizes[comp.get(r)] || 0) + 1;
  return { files: A.length, modules: instOf.size, edges, cyc, why: (k) => edges.get(k), viol, groups: Object.values(sizes).sort((a, b) => b - a), instOf, depsOf };
}

const SRCS = ORDER.map(r => [r, fs.readFileSync(path.join(BASE, 'parts', r), 'utf8')]);
const R = build(SRCS);

if (process.argv.includes('--write-baseline')) {
  if (!R) { say('  ✗ app.js 를 못 찾아 기준선을 못 쓴다'); process.exit(1); }
  fs.writeFileSync(BASE_FILE, JSON.stringify({
    note: 'sim-dep-cycles.js 기준선 — 지금 있는 모듈 순환 간선. 줄기만 한다: 순환을 끊었으면 같은 PR 에서 --write-baseline 으로 내리고, 새 순환은 기준선에 넣지 말고 끊는다(콜백 · 구독 · 공용 부분을 아래 파일로).',
    groups: R.groups, edges: R.cyc,
  }, null, 1) + '\n');
  say('  ✓ 기준선을 썼다 — 순환 간선 ' + R.cyc.length + ' · 묶음 ' + R.groups.join(' / ') + ' → ' + BASE_FILE);
  process.exit(0);
}

say('── 1. 파일 · 모듈 읽기');
chk(!!R && R.files >= 100 && R.modules >= 80, 'HTML 이 싣는 parts/ 파일 ' + (R ? R.files : 0) + '개 · app.js 가 만드는 모듈 ' + (R ? R.modules : 0) + '개를 읽었다');
if (!R) { say(`\n✗ 통과 ${pass} · 실패 ${fail + 1}`); process.exit(1); }
let base = null;
try { base = new Set(JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')).edges); } catch (e) { chk(false, '기준선 파일을 못 읽었다 — ' + BASE_FILE); }

say('── 2. 순환이 늘지 않았다 (지금 순환 간선 ' + R.cyc.length + ' · 묶음 크기 ' + R.groups.join(' / ') + ')');
if (base) {
  const added = R.cyc.filter(k => !base.has(k));
  const gone = [...base].filter(k => !R.cyc.includes(k));
  chk(added.length === 0, '기준선에 없는 순환 간선 0' + (added.length ? ' — ' + added.length + '건(순환을 새로 만들지 말고 콜백 · 구독 · 공용 부분을 아래 파일로 끊는다):\n      ' + added.slice(0, 12).map(k => k + '  ← ' + R.why(k)).join('\n      ') : ''));
  chk(gone.length === 0, '기준선에서 사라진 간선 0' + (gone.length ? ' — ' + gone.length + '건 줄었어요. 같은 PR 에서 기준선을 내려 주세요: node checks/sim-dep-cycles.js --write-baseline (' + gone.slice(0, 3).join(' · ') + ')' : ''));
}
say('── 2-2. 만들 때 순서');
chk(R.viol.length === 0, '모듈을 만드는 도중 아직 선언 전인 app.js let/const 를 읽는 deps 0' + (R.viol.length ? ' — ' + R.viol.slice(0, 8).join('\n      ') : ''));

say('── 3. 일부러 깨 보기');
{
  const free = SRCS.map(([r]) => r).filter(r => r !== 'app.js' && [...R.instOf.values()].some(m => m.rel === r) && !R.cyc.some(k => k.split(' > ').includes(r)));
  const [fa, fb] = free;
  const s1 = SRCS.map(([r, t]) => [r, r === fa ? t + '\nwindow.__cycProbeA = function(){ return window.__cycProbeB(); };\n' : r === fb ? t + '\nwindow.__cycProbeB = function(){ return window.__cycProbeA(); };\n' : t]);
  const R1 = fa && fb ? build(s1) : null;
  chk(!!R1 && R1.cyc.includes(fa + ' > ' + fb) && R1.cyc.includes(fb + ' > ' + fa), '순환 없던 두 모듈(' + fa + ' · ' + fb + ')이 window 고리로 서로 부르면 새 순환 간선으로 잡는다');
  const s1b = SRCS.map(([r, t]) => [r, r === fa ? t + '\nwindow.__cycProbeA = function(){ return 1; };\n' : r === fb ? t + '\nwindow.__cycProbeB = function(){ return window.__cycProbeA(); };\n' : t]);
  const R1b = fa && fb ? build(s1b) : null;
  chk(!!R1b && R1b.edges.has(fb + ' > ' + fa) && !R1b.cyc.includes(fb + ' > ' + fa), '한쪽으로만 부르면 순환이 아니다');
  /* 만들 때 순서: 공장 맨 위에서 deps 를 부르고, 그 deps 가 자기 모듈 이름(아직 만드는 중)을 읽게 해 본다 — 10-15 commissionMod 모양 */
  const [inst, mod] = [...R.instOf].find(([, m]) => /function create[A-Z]\w*\(deps\)\s*\{/.test(SRCS.find(([r]) => r === m.rel)[1])) || [];
  const s2 = SRCS.map(([r, t]) => {
    if (mod && r === mod.rel) return [r, t.replace(/function (create[A-Z]\w*)\(deps\)\s*\{/, (m) => m + '\nconst __probe = deps.__probe; __probe();')];
    if (r === 'app.js' && inst) return [r, t.replace(new RegExp('(const ' + inst + ' = [^\\n]*create[A-Z]\\w*\\(\\{)'), '$1\n  __probe: ()=>' + inst + '.__x(),')];
    return [r, t];
  });
  const R2 = inst ? build(s2) : null;
  chk(!!R2 && R2.viol.some(v => v.includes('deps.__probe') && v.includes(inst)), '만드는 도중 아직 없는 자기 모듈 이름(' + (inst || '?') + ')을 읽는 deps 를 잡는다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
