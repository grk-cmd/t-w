/* sim-global-names.js — 🧭 렌더러가 부르는 이름이 **어딘가에 정말 있는가** (전역 이름 실종 검사)
   실행:  node sim-global-names.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — app.js 를 모듈로 옮기면(앱 FSD) 예전엔 전역이던 이름이 createX(deps) 안으로 들어간다.
     다른 파일이 그 이름을 그냥 부르거나 `typeof 이름` · `window.이름` 으로 읽고 있으면, 가드 덕에 오류 없이
     «조용히 안 되는» 고장이 된다(2026-10-15 전수조사: DEMOJI_BY_CMD → /명령어 이모티콘 변환 꺼짐 ·
     window.myExpCells → 하트비트 경험치 빠짐). 화면으로 눌러 봐서는 안 누른 곳을 못 찾으므로 코드 전체를 본다.
   ・판정: parts/ 아래 모든 .js(+ HTML 안 <script>)를 typescript 파서로 읽어 범위(scope)대로 이름을 따라간다.
     그 자리 · 바깥 함수 어디에도 선언이 없는 이름은 전역이어야 한다 — 전역 = 일반 script 의 맨 위 선언 ·
     `window.이름 =` 대입 · HTML id · 브라우저 내장(typescript lib.dom). 셋 다 아니면 빨강.
   ・1절: 파일을 다 읽었다 · 2절: 없는 이름 0 (원래부터 없던 것은 KNOWN 에 이유와 함께) · 3절: 일부러 깨 보기 */
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
  /* CI 에서 파서가 없으면 «원본없음» 으로 넘기지 않고 빨강 — 조용히 안 도는 검사가 되지 않게(checks.yml 이 깐다) */
  if (process.env.CI) { say('  ✗ typescript 를 못 찾음 — checks.yml 의 설치 줄을 확인'); process.exit(1); }
  say('  ? 원본 못 찾음 — typescript(npm install 로 깔린다)'); process.exit(2);
}

const BASE = ['.', 'app'].map(d => path.resolve(d)).find(d => fs.existsSync(path.join(d, 'desk-companion-prototype.html')) && fs.existsSync(path.join(d, 'parts')));
if (!BASE) { say('  ? 원본 못 찾음 — desk-companion-prototype.html 과 parts/ 폴더'); process.exit(2); }
const HTML = fs.readFileSync(path.join(BASE, 'desk-companion-prototype.html'), 'utf8');

/* 원래부터 없던 이름 — 고장이 아니라 «있으면 쓰고 없으면 넘어가는» 자리이거나 이미 죽은 가드. 이유 없이 늘리지 말 것 */
const KNOWN = {
  advToast: 'myhome-desktop.js 안 함수 — 옮기기 전부터 같은 파일 안 다른 범위에서 typeof 로 본다',
  renderSizeBar: 'settings-panel 안쪽 함수 — 옮기기 전(app.js 안쪽 함수)부터 바깥에서는 늘 없음',
  __noClickSnd: '콘솔에서 __noClickSnd=true 로 잠시 끄는 시험 스위치 — 코드는 읽기만 한다',
  closeBell: '원래 있던 버그(할 일 tmv290c7b8ytt1t — 🔔 [📪 수령함 확인] 뒤 알림창이 안 닫힘). 고치면 여기서 지운다',
  _cvEl: '원래 있던 버그 — layoutSeats › clampDeskPan › _myPanHalfFrac 가 다른 함수의 지역 이름을 읽어 늘 던지고 try 로 빠진다. 고치면 여기서 지운다',
};

/* 브라우저 · Electron 내장 이름 — typescript 의 lib.dom · lib.es 선언에서 모은다 */
function libGlobals() {
  const out = new Set(['require', 'module', 'exports', '__dirname', '__filename', 'process', 'Buffer', 'global', 'globalThis', 'arguments', 'undefined', 'NaN', 'Infinity', 'webkitAudioContext', 'companion', 'firebaseAPI', 'THREE', 'JSZip', 'XLSX', 'QRCode', 'gifshot', 'GIF', 'Hls', 'YT']);
  const dir = path.dirname(ts.sys.getExecutingFilePath());
  for (const f of fs.readdirSync(dir).filter(f => /^lib\..*\.d\.ts$/.test(f))) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of t.matchAll(/^declare (?:var|let|const|function|class|namespace) ([A-Za-z_$][\w$]*)/gm)) out.add(m[1]);
    for (const m of t.matchAll(/^interface (?:Window|WindowOrWorkerGlobalScope|GlobalEventHandlers|WindowEventHandlers|WindowLocalStorage|WindowSessionStorage|AnimationFrameProvider)\b[^{]*\{([\s\S]*?)^\}/gm))
      for (const p of m[1].matchAll(/^\s+(?:readonly\s+)?([A-Za-z_$][\w$]*)\??[:(]/gm)) out.add(p[1]);
  }
  return out;
}

function walkFiles(d, out) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor' && e.name !== 'node_modules') walkFiles(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/* 한 파일을 읽어 ① 맨 위 선언(일반 script 면 전역) ② window.이름 = 대입 ③ 범위로 풀리지 않는 이름 사용을 돌려준다 */
function analyze(name, text) {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const isModule = sf.statements.some(s => ts.isImportDeclaration(s) || ts.isExportDeclaration(s) || ts.isExportAssignment(s) || (s.modifiers || []).some(m => m.kind === ts.SyntaxKind.ExportKeyword));
  const top = new Set(), winSet = new Set(), unresolved = [];
  const bindNames = (n, add) => {
    if (!n) return;
    if (ts.isIdentifier(n)) add(n.text);
    else if (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) n.elements.forEach(e => { if (!ts.isOmittedExpression(e)) bindNames(e.name, add); });
  };
  /* 범위: 함수 · 블록마다 선언 모음. var · function 은 함수 범위로 끌어올린다 */
  const scopeOf = new Map();
  const isFnLike = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n);
  const isScope = (n) => n === sf || isFnLike(n) || ts.isBlock(n) || ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n) || ts.isCatchClause(n) || ts.isClassLike(n) || ts.isCaseBlock(n);
  const decls = (n) => { if (!scopeOf.has(n)) scopeOf.set(n, new Set()); return scopeOf.get(n); };
  const fnScope = (n) => { let p = n.parent; while (p && !(p === sf || isFnLike(p))) p = p.parent; return p || sf; };
  const blockScope = (n) => { let p = n.parent; while (p && !isScope(p)) p = p.parent; return p || sf; };
  (function collect(n) {
    if (ts.isVariableDeclaration(n)) {
      const list = n.parent; const isVar = list && ts.isVariableDeclarationList(list) && !(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const));
      const sc = isVar ? fnScope(list) : blockScope(list);
      bindNames(n.name, x => decls(sc).add(x));
    } else if (ts.isFunctionDeclaration(n) && n.name) {
      decls(fnScope(n)).add(n.name.text);   // 함수 선언은 감싼 함수 범위로 끌어올림(블록 안 함수도 느슨하게 같이)
      decls(blockScope(n)).add(n.name.text);
    } else if (ts.isClassDeclaration(n) && n.name) decls(blockScope(n)).add(n.name.text);
    else if ((ts.isFunctionExpression(n) || ts.isClassExpression(n)) && n.name) decls(n).add(n.name.text);
    else if (ts.isParameter(n)) bindNames(n.name, x => decls(n.parent).add(x));
    else if (ts.isCatchClause(n) && n.variableDeclaration) bindNames(n.variableDeclaration.name, x => decls(n).add(x));
    else if (ts.isImportDeclaration(n) && n.importClause) {
      const c = n.importClause; if (c.name) decls(sf).add(c.name.text);
      const nb = c.namedBindings; if (nb) { if (ts.isNamespaceImport(nb)) decls(sf).add(nb.name.text); else nb.elements.forEach(e => decls(sf).add(e.name.text)); }
    }
    ts.forEachChild(n, collect);
  })(sf);
  if (!isModule) for (const x of (scopeOf.get(sf) || [])) top.add(x);
  const resolves = (id) => { let p = id.parent; while (p) { if (scopeOf.has(p) && scopeOf.get(p).has(id.text)) return true; p = p.parent; } return false; };
  const isRef = (id) => {
    const p = id.parent;
    if (!p) return false;
    if ((ts.isPropertyAccessExpression(p) || ts.isPropertyAccessChain && ts.isPropertyAccessChain(p)) && p.name === id) return false;
    if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p) || ts.isPropertySignature && ts.isPropertySignature(p)) && p.name === id) return false;
    if (ts.isBindingElement(p) && (p.propertyName === id || p.name === id)) return false;
    if ((ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isClassDeclaration(p) || ts.isClassExpression(p) || ts.isParameter(p)) && p.name === id) return false;
    if (ts.isLabeledStatement(p) || ts.isBreakStatement(p) || ts.isContinueStatement(p)) return false;
    if (ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p) || ts.isExportSpecifier(p)) return false;
    if (ts.isMetaProperty(p)) return false;
    return true;
  };
  /* (function(root){ … root.이름 = api })(window) · const w = window — window 의 다른 이름 */
  const isWindowAlias = (id) => {
    let p = id.parent;
    while (p) {
      if (isFnLike(p) && p.parameters) {
        const i = p.parameters.findIndex(q => ts.isIdentifier(q.name) && q.name.text === id.text);
        if (i >= 0) {
          let c = p.parent; while (c && ts.isParenthesizedExpression(c)) c = c.parent;
          const arg = c && ts.isCallExpression(c) && c.arguments[i];
          return !!arg && /\bwindow\b|\bglobalThis\b|^this$/.test(arg.getText(sf));
        }
      }
      if (scopeOf.has(p) && scopeOf.get(p).has(id.text)) {
        let hit = false;
        (function find(n) { if (hit) return; if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === id.text && n.initializer && n.initializer.getText(sf).length < 120 && /^\(?\s*(?:typeof\s+window[^?]*\?\s*)?(window|globalThis)\b/.test(n.initializer.getText(sf))) hit = true; ts.forEachChild(n, find); })(p);
        return hit;
      }
      p = p.parent;
    }
    return false;
  };
  (function use(n) {
    /* window.이름 = … · window['이름'] = … · Object.assign(window, {이름}) — 실행 중에 거는 전역 */
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const l = n.left;
      if (ts.isPropertyAccessExpression(l) && ts.isIdentifier(l.expression) && (/^(window|globalThis|self)$/.test(l.expression.text) || isWindowAlias(l.expression))) winSet.add(l.name.text);
      if (ts.isElementAccessExpression(l) && ts.isIdentifier(l.expression) && l.expression.text === 'window' && ts.isStringLiteral(l.argumentExpression)) winSet.add(l.argumentExpression.text);
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.getText(sf) === 'Object.assign' && n.arguments[0] && n.arguments[0].getText(sf) === 'window')
      n.arguments.slice(1).forEach(a => { if (ts.isObjectLiteralExpression(a)) a.properties.forEach(p => { if (p.name && ts.isIdentifier(p.name)) winSet.add(p.name.text); }); });
    /* 읽기: window.이름 (대입 왼쪽 · typeof 안 포함) */
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'window' && !resolves(n.expression)) {
      const isAssignTarget = ts.isBinaryExpression(n.parent) && n.parent.left === n && n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
      const isDelete = ts.isDeleteExpression(n.parent);
      if (!isAssignTarget && !isDelete) unresolved.push({ name: n.name.text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, how: 'window.' });
    }
    if (ts.isIdentifier(n) && isRef(n) && !resolves(n)) {
      const how = ts.isTypeOfExpression(n.parent) ? 'typeof' : 'bare';
      unresolved.push({ name: n.text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, how });
    }
    ts.forEachChild(n, use);
  })(sf);
  return { top, winSet, unresolved, isModule };
}

/* 읽을 파일 — 러너 스테이징은 parts/ 를 폴더째 둔다(평평한 사본과 겹치지 않게 parts/ 만) */
const files = walkFiles(path.join(BASE, 'parts'), []);
/* HTML 이 싣는 vendor 스크립트(TWQR 등)도 전역을 건다 — 이름만 모으고 판정 대상은 아니다 */
const vendorSrcs = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="(vendor\/[^"]+\.js)"/g)].map(m => path.join(BASE, m[1])).filter(f => fs.existsSync(f));
const HTML_NC = HTML.replace(/<!--[\s\S]*?-->/g, '');   // 주석 안의 <script> 글자는 코드가 아니다
const inline = [...HTML_NC.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !/type="(?!module|text\/javascript)[^"]*"/.test(m[1])).map((m, i) => ['(html script ' + (i + 1) + ')', m[2]]);
const ids = new Set([...HTML_NC.matchAll(/\bid="([A-Za-z_$][\w$]*)"/g)].map(m => m[1]));

const VENDOR = vendorSrcs.map(f => analyze(f, fs.readFileSync(f, 'utf8')));
function judge(sources) {
  const G = libGlobals(); ids.forEach(x => G.add(x));
  const res = sources.map(([n, t]) => [n, analyze(n, t)]);
  res.forEach(([, r]) => { r.top.forEach(x => G.add(x)); r.winSet.forEach(x => G.add(x)); });
  VENDOR.forEach(r => { r.top.forEach(x => G.add(x)); r.winSet.forEach(x => G.add(x)); });
  const missing = [];
  for (const [n, r] of res) for (const u of r.unresolved) if (!G.has(u.name) && !(u.name in KNOWN)) missing.push(path.basename(n) + ':' + u.line + ' ' + (u.how === 'window.' ? 'window.' : u.how === 'typeof' ? 'typeof ' : '') + u.name);
  return { missing, count: res.length };
}

const SOURCES = files.map(f => [f, fs.readFileSync(f, 'utf8')]).concat(inline);

say('── 1. 파일 읽기');
const R = judge(SOURCES);
chk(R.count >= 100, 'parts/ 아래 .js ' + files.length + '개 + HTML 안 script ' + inline.length + '개 + vendor ' + vendorSrcs.length + '개(전역 이름만)를 읽었다');

say('── 2. 부르는 이름이 다 있다 (범위로 풀리지 않으면 전역 · window 대입 · HTML id · 브라우저 내장 중 하나)');
chk(R.missing.length === 0, '없는 이름 0' + (R.missing.length ? ' — ' + R.missing.length + '건: ' + R.missing.slice(0, 12).join(' · ') : ''));
chk(Object.keys(KNOWN).every(k => SOURCES.some(([, t]) => t.includes(k))), 'KNOWN 에 적은 이름이 아직 코드에 있다(없어졌으면 KNOWN 에서 지운다)');

say('── 3. 일부러 깨 보기 — 없는 이름을 넣으면 잡는다');
{
  const add = (code) => SOURCES.concat([['(깨 봄).js', code]]);
  chk(judge(add('function f(){ if(typeof 없는전역이름X === "function") 없는전역이름X(); }')).missing.length === 2, 'typeof 가드 + 부름 — 둘 다 잡는다');
  chk(judge(add('function f(){ return window.없는전역이름Y && window.없는전역이름Y(); }')).missing.length === 2, 'window.이름 읽기를 잡는다');
  chk(judge(add('function f(a){ const b = 1; let { c } = a; try{}catch(e){ e; } return a + b + c; }')).missing.length === 0, '매개변수 · 지역 · 구조 분해 · catch 는 세지 않는다');
  chk(judge(add('window.새전역Z = 1; function f(){ return typeof 새전역Z; }')).missing.length === 0, 'window 에 거는 이름은 전역으로 친다');
  chk(judge(add('(function(){ const 안쪽W = 1; })(); function g(){ return typeof 안쪽W; }')).missing.length === 1, '다른 함수 안의 이름은 전역이 아니다(모듈 안으로 옮긴 이름)');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
