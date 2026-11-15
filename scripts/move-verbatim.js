#!/usr/bin/env node
/* scripts/move-verbatim.js — «그대로 옮겼다» 를 줄 단위로 증명한다(app.js 분리 PR 용).
   쓰기:  node scripts/move-verbatim.js <base-ref> <head-ref>
   base 와 head 의 공통 조상에서 head 까지 diff 를 떠서
     · 지운 줄 — app.js · app/parts 아래 .js
     · 더한 줄 — app/parts 아래 .js (새 모듈 · 늘어난 모듈 · app.js)
   를 공백만 정규화해(앞뒤 · 연속 공백) 다중집합으로 맞댄다(짝이 있는 줄 = 그대로 옮긴 줄).
   짝이 없는 줄은 «허용 종류» 로 가르고, 어디에도 안 들면 «허용 밖» 으로 찍는다.
   허용 밖이 있으면 종료 코드 1 — 그 줄이 진짜 고침인지 사람이 한 줄씩 본다.

   허용 종류:
     comment     주석 줄(머리 설명 · 옮긴 자리 안내 포함)
     scaffold    모듈 머리 · 꼬리(IIFE · window.TwXxx · createXxx(deps) · const X = deps.X · attach 고리 · return { 내놓는 이름 })
     wiring      app.js 쪽 연결 줄(createXxx({…}) 와 deps 줄 · attach({…}) · const x = xMod.x · window.x = x)
     guard-drop  typeof 가드 걷기(typeof x === 'undefined' || … → …)
     read-fn     다시 대입되는 let 을 읽는 함수로 바꾼 줄(foo → foo())
     setter      쓰는 함수로 바꾼 줄(foo = v → setFoo(v))
     call-rename 부르는 곳의 이름 바꿈(fn( → xMod.fn( · 알림 고리 hooks.fn()
     script-tag  html · checks/smoke.js 의 script 한 줄 · PRELOAD 한 줄
   README(*.md) · checks/ · docs/ 는 줄을 보지 않는다. 그 밖 파일(main.js · functions/ 등)이 바뀌면 파일 이름을 찍고 허용 밖으로 친다.
   한계: 줄 순서가 바뀐 것과 `})` 같은 문장부호만 있는 줄은 못 잡는다 — 블록 경계가 옮겨진 곳은 사람이 본다. */
'use strict';
const { execFileSync } = require('child_process');

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const IDENT = '[A-Za-z_$][\\w$]*';
const TRAIL = '\\s*(?:\\/\\/.*)?$';

/* ── 줄 모양 판정 ───────────────────────────────────────────────────────────
   «코드 뒤에 주석이 붙은 줄» 은 주석이 아니다 — 블록 주석을 닫은 뒤에 코드가 있으면 코드 줄이다. */
const isComment = (t) => t.startsWith('//') || ((t.startsWith('/*') || t.startsWith('*')) && !/\*\/\s*\S/.test(t));
const SCAFFOLD_LINE = [
  /^\(function\(\)\{$/, /^\}\)\(\);?$/, /^'use strict';$/, /^"use strict";$/,
  new RegExp('^window\\.Tw\\w+ = \\{[^;]*\\};?' + TRAIL),
  new RegExp('^function create\\w+\\(deps\\)\\{$'),
  new RegExp('^const ' + IDENT + ' = \\{ create\\w+ \\};?$'),
  /^if\(typeof window !== 'undefined'\) window\.Tw\w+ = api;$/,
  /^if\(typeof module !== 'undefined' && module\.exports\) module\.exports = api;$/,
  new RegExp('^module\\.exports = \\{[^;]*\\};?' + TRAIL),
  /^let \w*[Hh]ooks = null;$/,
  /^function attach\w*\(h\)\{ \w+ = h; \}$/,
];
/* const X = deps.X; — 같은 이름으로 받을 때만 머리 줄이다 */
const depsLine = (t) => { const m = t.match(new RegExp('^const (' + IDENT + ') = deps\\.(' + IDENT + ');' + TRAIL)); return m && m[1] === m[2] ? m[1] : null; };
/* 연결 한 줄: const x = xMod.x; · window.x = x; (양쪽 이름이 같을 때만) */
const WIRING_LINE = [
  new RegExp('^const (' + IDENT + ') = ' + IDENT + '(?:Mod|Hooks)\\.\\1;' + TRAIL),
  new RegExp('^(?:const|let|var) ' + IDENT + ' = Tw\\w+\\.create\\w+\\([^;]*\\);' + TRAIL),
  new RegExp('^window\\.(' + IDENT + ') = (?:' + IDENT + 'Mod\\.)?\\1;' + TRAIL),
];
/* 연결 블록 안 한 줄: 이름, · 이름: 값, (문장 `;` 은 연결이 아니다) */
const ENTRY_SRC = '^(?:(?:\\.\\.\\.)?' + IDENT + '(?:\\s*,\\s*' + IDENT + ')*,?|' + IDENT + '\\s*:\\s*\\(?[\\w$, ]*\\)?\\s*=>\\s*(?:\\{ ?[\\w$.]+(?:\\([\\w$, ]*\\)| = [\\w$]+); ?\\}|[\\w$.!]+(?:\\([\\w$, ]*\\))?),?|' + IDENT + '\\s*:\\s*[^;]*,?)' + TRAIL;
const BLOCK_ENTRY = new RegExp(ENTRY_SRC);
const BLOCK_OPEN = new RegExp('^(?:(?:const|let|var) ' + IDENT + ' = )?(?:Tw\\w+\\.create\\w+|' + IDENT + 'Mod\\.attach\\w*)\\(\\{' + TRAIL);
const BLOCK_CLOSE = /^\}\)[;,]?\s*(?:\/\/.*)?$/;

/* app.js 의 «만드는 줄 · 알림 거는 줄» 블록(`… createXxx({` 부터 `});` 까지) 줄 번호 범위 */
function wiringRanges(text){
  const lines = text.split('\n'), out = [];
  for (let i = 0; i < lines.length; i++){
    if (!BLOCK_OPEN.test(norm(lines[i]))) continue;
    let j = i + 1;
    while (j < lines.length && !BLOCK_CLOSE.test(norm(lines[j]))) j++;
    if (j >= lines.length) break;
    out.push([i + 1, j + 1]);
    i = j;
  }
  return out;
}

/* 모듈 꼬리 — 마지막 `return {` 줄부터 짝 맞는 `};` 까지(내놓는 이름들) */
function tailRange(text){
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--){
    if (!/^\s*return\s*\{/.test(lines[i])) continue;
    if (/\}\s*;?\s*$/.test(lines[i])) return [i + 1, i + 1];
    let j = i + 1;
    while (j < lines.length && !/^\s*\};?\s*$/.test(lines[j])) j++;
    return [i + 1, Math.min(j, lines.length - 1) + 1];
  }
  return null;
}
const TAIL_ENTRY = BLOCK_ENTRY;

/* 블록 주석 안쪽 줄 번호 집합 — 주석을 닫은 뒤에 코드가 있는 줄은 뺀다 */
function commentLineSet(text){
  const set = new Set(), lines = text ? text.split('\n') : [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++){
    const t = lines[i].trim();
    if (inBlock){
      if (t.includes('*/')){ inBlock = false; if (!/\*\/\s*\S/.test(t)) set.add(i + 1); } else set.add(i + 1);
      continue;
    }
    if (t.startsWith('/*')){
      if (t.includes('*/', 2)){ if (!/\*\/\s*\S/.test(t)) set.add(i + 1); } else { inBlock = true; set.add(i + 1); }
      continue;
    }
    if (t.startsWith('//')) set.add(i + 1);
  }
  return set;
}
const PUNCT_ONLY = /^[})\];,]+$/;

/* ── 맞대기(순수 함수) ────────────────────────────────────────────────────────
   removed / added: [{ file, no, text }] (text 는 원문 줄)
   ctx: { headText(file) → head 파일 전문 | null, baseText(file) → base 파일 전문 | null } */
function analyze(removed, added, ctx){
  const rem = removed.map((r) => ({ ...r, key: norm(r.text) })).filter((r) => r.key);
  const add = added.map((a) => ({ ...a, key: norm(a.text) })).filter((a) => a.key);

  /* 1) 글자 그대로 짝(공백만 다름) */
  const pool = new Map();
  for (const a of add){ if (!pool.has(a.key)) pool.set(a.key, []); pool.get(a.key).push(a); }
  const moved = [];
  const remLeft = [];
  for (const r of rem){
    const list = pool.get(r.key);
    if (list && list.length){ list.pop(); moved.push(r); } else remLeft.push(r);
  }
  const addLeft = [];
  for (const list of pool.values()) addLeft.push(...list);

  /* 2) 고침 종류로 짝. 규칙은 한쪽에만 건다 — 더한 줄(A)에 건 규칙이 줄을 실제로 바꿀 때만 쓴다
        (규칙이 아무것도 안 바꾸면 옛 줄만 고쳐져 «다른 줄» 을 숨긴다). guard-drop 만 지운 줄(R)에 건다. */
  const getters = new Set();      // `이름: ()=>…` 로 읽는 함수를 내놓는 이름 — 다시 대입되는 let 을 읽는 자리
  const scanGetters = (text) => { for (const m of (text || '').matchAll(new RegExp('(?:^|[\\s,{(])(' + IDENT + ')\\s*:\\s*\\(\\)\\s*=>', 'gm'))) getters.add(m[1]); };
  scanGetters(ctx.headText('app/parts/app.js'));
  for (const a of add) scanGetters(a.key);
  const depNames = new Set();
  for (const a of add){ const n = depsLine(a.key); if (n) depNames.add(n); }
  const READ = new RegExp('(?<!function )\\b(?:([\\w$]*(?:Mod|Hooks|hooks))\\.)?(' + IDENT + ')\\(\\)(?!\\s*\\{)', 'g');
  const SETTER = new RegExp('\\b(?:[\\w$]*(?:Mod|Hooks|hooks)\\.)?set([A-Z][\\w$]*)\\(([^()]*)\\)', 'g');
  const RULES = {
    'guard-drop': { side: 'R', fn: (s) => s
      .replace(/(?<![\w$])\(typeof \w+ ?!==? ?'undefined' ?&& ?([^()]*)\)/g, '$1')
      .replace(/\(typeof \w+ ?!==? ?'undefined'\) ?&& ?/g, '').replace(/typeof \w+ ?!==? ?'undefined' ?&& ?/g, '')
      .replace(/\(typeof \w+ ?===? ?'undefined'\) ?\|\| ?/g, '').replace(/typeof \w+ ?===? ?'undefined' ?\|\| ?/g, '')
      .replace(/if\(typeof \w+ ?!==? ?'undefined'\) ?/g, '') },
    /* foo → foo() · foo → xMod.foo() : 읽는 함수로 내놓은 이름만. 옛 줄에 이미 그 모양이 있으면 건드리지 않는다 */
    'read-fn': { side: 'A', fn: (s, r) => s.replace(READ, (m, mod, n) => (!r.includes(m) && getters.has(n) && (mod || depNames.has(n)) ? (mod ? mod + '.' + n : n) : m)) },
    /* foo( → xMod.foo( : 옛 줄에 없던 접두사만 뗀다(aMod.f → bMod.f 같은 부르는 모듈 바꿈은 못 숨긴다) */
    'call-rename': { side: 'A', fn: (s, r) => s.replace(new RegExp('\\b([\\w$]*(?:Mod|Hooks|hooks))\\.(' + IDENT + ')', 'g'), (m, pre, n) => (r.includes(m) ? m : n)) },
    /* 알림 고리: xMod.f( → xHooks.f( — 부르는 이름은 그대로, 부르는 곳만 고리로 */
    'hook-call': { side: 'A', fn: (s, r) => s.replace(new RegExp('\\b[\\w$]*[Hh]ooks\\.(' + IDENT + ')', 'g'), (m, n) => (r.includes(m) ? m : n)) },
    'setter': { side: 'A', fn: (s) => { const x = s.replace(SETTER, (m, n, v) => n[0].toLowerCase() + n.slice(1) + '=' + v); return x === s ? s : x.replace(/\s*(=+)\s*/g, '$1'); } },
  };
  const R_SIDE = {
    'hook-call': (r, a) => r.replace(new RegExp('\\b[\\w$]*Mod\\.(' + IDENT + ')', 'g'), (m, n) => (a.includes('Hooks.' + n) || a.includes('hooks.' + n) ? n : m)),
    'setter': (r) => r.replace(/\s*(=+)\s*/g, '$1').replace(/\b_([a-z][\w$]*)(?==)/g, '$1'),      // `_x = v` ↔ setX(v)
    'read-fn': (r, a) => r.replace(/\b_([A-Za-z][\w$]*)\b/g, (m, n) => (getters.has(n) && a.includes(n + '()') && !a.includes(m) ? n : m)),    // `_x` ↔ x()
  };
  const ORDER = ['guard-drop', 'read-fn', 'call-rename', 'hook-call', 'setter'];
  const COMBOS = [];
  for (let m = 1; m < 1 << ORDER.length; m++) COMBOS.push(ORDER.filter((_, i) => m >> i & 1));
  COMBOS.sort((x, y) => x.length - y.length);
  /* 한 combo 로 R · A 를 같은 꼴로. 규칙이 자기 쪽 줄을 안 바꾸면 null(그 combo 는 못 쓴다) */
  const canon = (r, a, combo) => {
    let rs = r, as = a;
    for (const n of ORDER){
      if (!combo.includes(n)) continue;
      if (RULES[n].side === 'R'){ const x = RULES[n].fn(rs); if (x === rs) return null; rs = x; }
      else { const x = RULES[n].fn(as, rs); if (x === as) return null; if (R_SIDE[n]) rs = R_SIDE[n](rs, as); as = x; }
    }
    return [rs, as];
  };
  const kinds = {};
  const bump = (k) => { kinds[k] = (kinds[k] || 0) + 1; };
  const stillRem = [];
  const addPool = addLeft.slice();
  for (const r of remLeft){
    let hit = -1, comboUsed = null;
    for (const combo of COMBOS){
      const idx = addPool.findIndex((a) => { const c = canon(r.key, a.key, combo); return c && c[0] === c[1]; });
      if (idx >= 0){ hit = idx; comboUsed = combo; break; }
    }
    if (hit >= 0){ addPool.splice(hit, 1); comboUsed.forEach(bump); } else stillRem.push(r);
  }

  /* 3) 남은 더한 줄 — 머리 · 꼬리 · 연결 · 주석 · 스크립트 줄 */
  const violations = [];
  const headCache = {};
  const head = (f) => (f in headCache ? headCache[f] : (headCache[f] = ctx.headText(f)));
  const ranges = {}, tails = {}, cmts = {}, bcmts = {}, bwire = {};
  const inRanges = (list, no) => list.some(([s, e]) => no >= s && no <= e);
  for (const a of addPool){
    const t = a.key;
    if (a.file === 'app/desk-companion-prototype.html' || a.file === 'checks/smoke.js'){
      if (/^<script src="[^"]+"><\/script>/.test(t) || /^PRELOAD\.push\('[\w.-]+'\);?$/.test(t) || isComment(t)) bump('script-tag');
      else violations.push({ side: '+', ...a });
      continue;
    }
    const text = head(a.file);
    if (!(a.file in cmts)) cmts[a.file] = commentLineSet(text);
    if (isComment(t) || cmts[a.file].has(a.no)){ bump('comment'); continue; }
    if (PUNCT_ONLY.test(t)){ bump('scaffold'); continue; }
    if (a.file === 'app/parts/app.js'){
      if (!(a.file in ranges)) ranges[a.file] = text ? wiringRanges(text) : [];
      if ((inRanges(ranges[a.file], a.no) && (BLOCK_OPEN.test(t) || BLOCK_ENTRY.test(t))) || WIRING_LINE.some((re) => re.test(t))){ bump('wiring'); continue; }
    } else {
      if (!(a.file in tails)) tails[a.file] = text ? tailRange(text) : null;
      const tr = tails[a.file];
      if (tr && a.no >= tr[0] && a.no <= tr[1] && (/^return\s*\{/.test(t) || TAIL_ENTRY.test(t))){ bump('scaffold'); continue; }
      if (depsLine(t) || SCAFFOLD_LINE.some((re) => re.test(t))){ bump('scaffold'); continue; }
      if (WIRING_LINE.some((re) => re.test(t))){ bump('wiring'); continue; }
    }
    violations.push({ side: '+', ...a });
  }
  for (const r of stillRem){
    if (r.file === 'app/parts/app.js'){
      if (!(r.file in bwire)) bwire[r.file] = wiringRanges(ctx.baseText(r.file) || '');
      if (inRanges(bwire[r.file], r.no) && (BLOCK_OPEN.test(r.key) || BLOCK_ENTRY.test(r.key))){ bump('wiring'); continue; }
    }
    if (!(r.file in bcmts)) bcmts[r.file] = commentLineSet(ctx.baseText(r.file));
    if (isComment(r.key) || bcmts[r.file].has(r.no)){ bump('comment'); continue; }
    if (PUNCT_ONLY.test(r.key)){ bump('scaffold'); continue; }
    violations.push({ side: '-', ...r });
  }
  violations.sort((x, y) => (x.file < y.file ? -1 : x.file > y.file ? 1 : x.no - y.no));
  return { moved: moved.length, kinds, violations };
}

/* ── git 에서 줄 뽑기 ─────────────────────────────────────────────────────── */
const git = (args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const isModule = (f) => /^app\/parts\/.+\.js$/.test(f);
const isScriptFile = (f) => f === 'app/desk-companion-prototype.html' || f === 'checks/smoke.js';

function collect(base, headRef){
  const mb = git(['merge-base', base, headRef]).trim();
  /* 지운 줄은 파일 이름이 `--- a/…` 쪽에 있으니 파일별로 따로 뜬다 */
  const files = git(['diff', '--name-status', '--no-renames', mb, headRef]).split('\n').filter(Boolean).map((l) => { const [st, ...p] = l.split('\t'); return { st, path: p.join('\t') }; });
  const removed = [], added = [], others = [];
  for (const f of files){
    if (isModule(f.path) || isScriptFile(f.path)){
      const d = git(['diff', '-U0', '--no-color', '--no-renames', mb, headRef, '--', f.path]);
      let oldNo = 0, newNo = 0;
      for (const line of d.split('\n')){
        const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
        if (h){ oldNo = +h[1]; newNo = +h[2]; continue; }
        if (/^(diff |index |--- |\+\+\+ |new file|deleted file)/.test(line)) continue;
        if (line.startsWith('-')){ removed.push({ file: f.path, no: oldNo, text: line.slice(1) }); oldNo++; }
        else if (line.startsWith('+')){ added.push({ file: f.path, no: newNo, text: line.slice(1) }); newNo++; }
      }
    } else others.push(f.path);
  }
  const show = (ref) => (f) => { try { return git(['show', ref + ':' + f]); } catch (_) { return null; } };
  return { removed, added, others, headText: show(headRef), baseText: show(mb) };
}

function main(){
  const [base, headRef] = process.argv.slice(2);
  if (!base || !headRef){ console.error('쓰기: node scripts/move-verbatim.js <base-ref> <head-ref>'); process.exit(2); }
  const { removed, added, others, headText, baseText } = collect(base, headRef);
  const res = analyze(removed, added, { headText, baseText });
  const out = (s) => console.log(s);
  out(`그대로 옮긴 줄: ${res.moved}`);
  const order = ['guard-drop', 'comment', 'scaffold', 'wiring', 'read-fn', 'setter', 'call-rename', 'script-tag'];
  out('허용 종류별 줄 수: ' + (order.filter((k) => res.kinds[k]).map((k) => `${k} ${res.kinds[k]}`).join(' · ') || '없음'));
  /* 줄을 안 보는 파일 — README · 문서 · 검사(checks/)만 허용. 그 밖 파일이 바뀌면 «옮기기» 가 아니다 */
  const OK_OTHER = (f) => /\.md$/.test(f) || /^checks\//.test(f) || /^docs\//.test(f);
  const rest = others.filter((f) => !OK_OTHER(f));
  out(`줄을 안 보는 파일(README · 문서 · checks): ${others.length - rest.length}개`);
  out(`허용 밖: ${res.violations.length + rest.length}`);
  for (const v of res.violations) out(`  ${v.side} ${v.file}:${v.no}  ${v.text.trim().slice(0, 160)}`);
  for (const f of rest) out(`  ! ${f}  (옮기기 PR 에서 바뀔 수 없는 파일)`);
  process.exit(res.violations.length || rest.length ? 1 : 0);
}

module.exports = { analyze, norm, wiringRanges, tailRange };
if (require.main === module) main();
