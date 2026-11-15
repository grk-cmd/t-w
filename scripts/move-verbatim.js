#!/usr/bin/env node
/* scripts/move-verbatim.js — «그대로 옮겼다» 를 줄 단위로 증명한다(app.js 분리 PR 용).
   쓰기:  node scripts/move-verbatim.js <base-ref> <head-ref>
   base 와 head 의 공통 조상에서 head 까지 diff 를 떠서
     · 지운 줄 — app.js · app/parts 아래 .js
     · 더한 줄 — app/parts 아래 .js (새 모듈 · 늘어난 모듈 · app.js)
   를 공백만 정규화해(앞뒤 · 연속 공백) 다중집합으로 맞댄다(짝이 있는 줄 = 그대로 옮긴 줄).
   짝이 없는 줄은 «허용 종류» 로 가르고, 어디에도 안 들면 «허용 밖» 으로 찍는다.
   허용 밖이 있으면 종료 코드 1 — 그 줄이 진짜 고침인지 사람이 한 줄씩 본다.

   허용 종류(M1~M11 에서 실제로 쓴 고침만):
     comment     주석 줄(머리 설명 · 옮긴 자리 안내 포함)
     scaffold    모듈 머리 · 꼬리(IIFE · window.TwXxx · createXxx(deps) · const X = deps.X · attach 고리 · return { 내놓는 이름 })
     wiring      app.js 쪽 연결 줄(createXxx({…}) 와 deps 줄 · attach({…}) · const x = xMod.x · window.x = x)
     guard-drop  typeof 가드 걷기(typeof x === 'undefined' || … → …)
     read-fn     다시 대입되는 let 을 읽는 함수로 바꾼 줄(foo → foo())
     setter      쓰는 함수로 바꾼 줄(foo = v → setFoo(v))
     call-rename 부르는 곳의 이름 바꿈(fn( → xMod.fn( · 알림 고리 hooks.fn()
     script-tag  html · checks/smoke.js 의 script 한 줄 · PRELOAD 한 줄
   README(*.md)와 checks/sim-* · CHECKS.md · docs 는 줄을 보지 않고 바뀐 파일 이름만 알린다. */
'use strict';
const { execFileSync } = require('child_process');

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const IDENT = '[A-Za-z_$][\\w$]*';

/* ── 줄 모양 판정 ─────────────────────────────────────────────────────────── */
const isComment = (t) => /^(\/\*|\*\/|\*|\/\/)/.test(t) || /^[^'"`]*\*\/$/.test(t);
const SCAFFOLD_LINE = [
  /^\(function\(\)\{$/, /^\}\)\(\);?$/, /^'use strict';$/, /^"use strict";$/,
  new RegExp('^window\\.Tw\\w+ = '),
  new RegExp('^function create\\w+\\(deps\\)\\{$'),
  new RegExp('^const ' + IDENT + ' = deps\\.' + IDENT + ';'),
  /^let \w*[Hh]ooks = null;$/,
  /^function attach\w*\(h\)\{ \w+ = h; \}$/,
  /^module\.exports = /, /^if ?\(typeof module/, /^\}\)\(\);?$/,
];
const WIRING_LINE = [
  new RegExp('^const ' + IDENT + ' = ' + IDENT + '(?:Mod|Hooks)\\.' + IDENT + ';'),
  new RegExp('^(?:const|let|var) ' + IDENT + ' = Tw\\w+\\.create\\w+\\('),
  new RegExp('^window\\.' + IDENT + ' = [\\w$.]+;'),
];

/* app.js 에서 «만드는 줄 · 알림 거는 줄» 블록(Tw….createXxx({ … }); · xMod.attachXxx({ … });)의 줄 번호 범위 */
function wiringRanges(text){
  const lines = text.split('\n'), out = [];
  for (let i = 0; i < lines.length; i++){
    if (!/\bTw\w+\.create\w+\(|\b\w+Mod\.attach\w*\(/.test(lines[i])) continue;
    let j = i;
    while (j < lines.length && !/^\s*\}\)[;,]?\s*(\/\/.*)?$/.test(lines[j]) && !(j === i && /\)\s*;/.test(lines[j]) && /\(\{?.*\}\)/.test(lines[j]))) j++;
    out.push([i + 1, Math.min(j, lines.length - 1) + 1]);
    i = j;
  }
  return out;
}

/* 모듈 꼬리 — 마지막 `return {` 줄부터 끝까지(내놓는 이름들) */
function tailStart(text){
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) if (/^\s*return\s*\{/.test(lines[i])) return i + 1;
  return Infinity;
}

/* 블록 주석 안쪽 줄(여러 줄 설명의 이어지는 줄) 번호 집합 — 줄 시작이 `*` 가 아니어도 주석으로 본다 */
function commentLineSet(text){
  const set = new Set(), lines = text ? text.split('\n') : [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++){
    const t = lines[i].trim();
    if (inBlock){ set.add(i + 1); if (t.includes('*/')) inBlock = false; continue; }
    if (t.startsWith('/*')){ set.add(i + 1); if (!t.includes('*/', 2)) inBlock = true; continue; }
    if (t.startsWith('//')) set.add(i + 1);
  }
  return set;
}
const PUNCT_ONLY = /^[})\];,]+$/;

/* ── 맞대기(순수 함수) ────────────────────────────────────────────────────────
   removed / added: [{ file, no, text }] (text 는 원문 줄)
   ctx: { headText(file) → head 파일 전문 | null, baseText(file) → base 파일 전문 | null }                                   */
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

  /* 2) 고침 종류로 짝 — 규칙을 적용해 같아지면 그 규칙 이름이 종류 */
  const depNames = new Set();
  for (const a of add){ const m = a.key.match(new RegExp('^const (' + IDENT + ') = deps\\.' + IDENT + ';')); if (m) depNames.add(m[1]); }
  const RULES = [
    ['guard-drop', (s) => s.replace(/\(typeof \w+ ?[!=]==? ?'undefined'\) ?(?:\|\||&&) ?/g, '').replace(/typeof \w+ ?[!=]==? ?'undefined' ?(?:\|\||&&) ?/g, '').replace(/if\(typeof \w+ ?!==? ?'undefined'\) ?/g, '')],
    ['read-fn', (s) => s.replace(new RegExp('\\b(' + IDENT + ')\\(\\)', 'g'), (m, n) => (depNames.has(n) ? n : m))
      .replace(new RegExp('\\b([\\w$]*(?:Mod|Hooks|hooks))\\.(' + IDENT + ')\\(\\)', 'g'), '$1.$2')],
    ['call-rename', (s) => s.replace(new RegExp('\\b[\\w$]*(?:Mod|Hooks|hooks)\\.', 'g'), '')],
    ['setter', (s) => s.replace(new RegExp('\\b(?:[\\w$]*(?:Mod|Hooks|hooks)\\.)?set([A-Z][\\w$]*)\\(([^()]*)\\)', 'g'), (m, n, v) => n[0].toLowerCase() + n.slice(1) + '=' + v)
      .replace(/\s*(=+)\s*/g, '$1').replace(/\b_([a-z])/g, '$1')],
  ];
  const apply = (s, names) => RULES.filter((r) => names.includes(r[0])).reduce((acc, r) => r[1](acc), s);
  /* 규칙 부분집합을 작은 것부터 */
  const COMBOS = [];
  for (let m = 1; m < 1 << RULES.length; m++) COMBOS.push(RULES.filter((_, i) => m >> i & 1).map((r) => r[0]));
  COMBOS.sort((a, b) => a.length - b.length);
  const kinds = {};
  const bump = (k) => { kinds[k] = (kinds[k] || 0) + 1; };
  const stillRem = [];
  let addPool = addLeft.slice();
  for (const r of remLeft){
    let hit = -1, comboUsed = null;
    for (const combo of COMBOS){
      const rk = apply(r.key, combo);
      const idx = addPool.findIndex((a) => apply(a.key, combo) === rk && a.key !== r.key);
      if (idx >= 0){ hit = idx; comboUsed = combo; break; }
    }
    if (hit >= 0){ addPool.splice(hit, 1); comboUsed.forEach(bump); } else stillRem.push(r);
  }

  /* 3) 남은 더한 줄 — 머리 · 꼬리 · 연결 · 주석 · 스크립트 줄 */
  const violations = [];
  const headCache = {};
  const head = (f) => (f in headCache ? headCache[f] : (headCache[f] = ctx.headText(f)));
  const ranges = {}, tails = {}, cmts = {}, bcmts = {}, bwire = {};
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
      if (ranges[a.file].some(([s, e]) => a.no >= s && a.no <= e) || WIRING_LINE.some((re) => re.test(t))){ bump('wiring'); continue; }
    } else {
      if (!(a.file in tails)) tails[a.file] = text ? tailStart(text) : Infinity;
      if (a.no >= tails[a.file] || SCAFFOLD_LINE.some((re) => re.test(t))){ bump('scaffold'); continue; }
      if (WIRING_LINE.some((re) => re.test(t))){ bump('wiring'); continue; }
    }
    violations.push({ side: '+', ...a });
  }
  for (const r of stillRem){
    if (r.file === 'app/parts/app.js'){
      if (!(r.file in bwire)) bwire[r.file] = wiringRanges(ctx.baseText(r.file) || '');
      if (bwire[r.file].some(([s, e]) => r.no >= s && r.no <= e)){ bump('wiring'); continue; }
    }
    if (!(r.file in bcmts)) bcmts[r.file] = commentLineSet(ctx.baseText(r.file));
    if (isComment(r.key) || bcmts[r.file].has(r.no) || PUNCT_ONLY.test(r.key)){ bump(PUNCT_ONLY.test(r.key) ? 'scaffold' : 'comment'); continue; }
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
        if (line.startsWith('-')){ if (isModule(f.path)) removed.push({ file: f.path, no: oldNo, text: line.slice(1) }); oldNo++; }
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
  const mods = others.filter((f) => /\.md$/.test(f)), rest = others.filter((f) => !/\.md$/.test(f));
  out(`줄을 안 보는 파일: README·문서 ${mods.length}개 · 그 밖(검사 · 설정 등) ${rest.length}개`);
  out(`허용 밖: ${res.violations.length}`);
  for (const v of res.violations) out(`  ${v.side} ${v.file}:${v.no}  ${v.text.trim().slice(0, 160)}`);
  process.exit(res.violations.length ? 1 : 0);
}

module.exports = { analyze, norm, wiringRanges, tailStart };
if (require.main === module) main();
