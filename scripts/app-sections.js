#!/usr/bin/env node
/* app-sections.js — app/parts/app.js 구역 지도의 숫자를 다시 뽑는다 (docs/APP_FSD_MAP.md)
   실행:  node scripts/app-sections.js            구역 표(마크다운)
          node scripts/app-sections.js --json     구역마다 정의 · 참조 · 관련 모듈 전체(JSON)
          node scripts/app-sections.js --file app/parts/firebase-init.js --indent 4
   구역 = 줄 맨 앞(--indent 칸까지)의 `/* ═══ … ` · `/* ══ … ` · `/* ==== … ` 머리 주석. 머리가 테두리만이면 다음 줄이 제목.
   구역 범위는 «다음 머리 전까지» 라서, 큰 구역 안에는 머리 없이 덧붙은 다른 코드가 섞여 있다.
   결합도는 근사다 — 구역마다 맨 앞 칸에서 정의한 이름(function · const · let · var · class)을 모으고,
   다른 구역 본문에 그 이름이 낱말로 나오면 «쓴다» 로 센다(주석 · 문자열 안도 센다). 숫자는 순서를 정하는 참고용. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const FILE = path.resolve(ROOT, opt('--file', 'app/parts/app.js'));
const INDENT = +opt('--indent', 0);
const PARTS = path.join(ROOT, 'app/parts');

const HEAD = new RegExp('^ {0,' + INDENT + '}(?:/\\*|//)\\s*(?:═{2,}|={3,})');
const titleOf = (lines, i) => {
  const clean = (s) => s.replace(/\/\*|\*\/|\/\/|[═=]{2,}/g, ' ').replace(/\s+/g, ' ').trim();
  const t = clean(lines[i]);
  return t || clean(lines[i + 1] || '');
};

const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');
const heads = [];
lines.forEach((l, i) => { if (HEAD.test(l)) heads.push(i); });
if (!heads.length || heads[0] !== 0) heads.unshift(0);

const DEF = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/;
const sections = heads.map((s, k) => {
  const e = (heads[k + 1] ?? lines.length) - 1;
  const body = lines.slice(s, e + 1);
  const defs = [];
  body.forEach((l) => {
    const m = l.match(DEF);
    if (m) defs.push(m[1] || m[2]);
    const d = l.match(/^(?:const|let|var)\s*\{([^}]*)\}/);
    if (d) d[1].split(',').forEach((p) => { const n = p.split(':').pop().trim(); if (/^[A-Za-z_$][\w$]*$/.test(n)) defs.push(n); });
  });
  const text = body.join('\n');
  return {
    no: k + 1, start: s + 1, end: e + 1, lines: e - s + 1, title: titleOf(lines, s),
    defs, ids: new Set(text.match(/[A-Za-z_$][\w$]*/g) || []),
    fb: (text.match(/firebaseAPI\./g) || []).length,
    dom: (text.match(/getElementById|querySelector/g) || []).length,
    ipc: (text.match(/companion\./g) || []).length,
  };
});

// 이름 → 정의한 구역 (같은 이름이 두 구역에 있으면 처음 것)
const owner = new Map();
for (const s of sections) for (const n of s.defs) if (n.length >= 3 && !owner.has(n)) owner.set(n, s.no);
for (const s of sections) {
  s.uses = new Map();
  for (const id of s.ids) {
    const o = owner.get(id);
    if (o && o !== s.no) s.uses.set(o, (s.uses.get(o) || 0) + 1);
  }
}
for (const s of sections) {
  s.usedBy = new Map();
  for (const t of sections) if (t.uses.has(s.no)) s.usedBy.set(t.no, t.uses.get(s.no));
}

// 관련 도메인 모듈 — app/parts/*.js 가 맨 앞 칸에서 정의하거나 window.X 로 내놓은 이름을 그 구역이 쓰면
const modNames = new Map();
if (fs.existsSync(PARTS)) {
  for (const f of fs.readdirSync(PARTS)) {
    if (!f.endsWith('.js') || f === path.basename(FILE) || f === 'app.js' || f === 'firebase-init.js') continue;
    const code = fs.readFileSync(path.join(PARTS, f), 'utf8');
    const names = new Set();
    for (const l of code.split('\n')) {
      // 모듈의 const · let 은 빼고 함수 이름만 — 모듈 안 지역 이름(scene · renderer …)이 app.js 낱말과 겹친다
      const m = l.match(/^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/) || l.match(/^export\s+(?:const|let|class)\s+([A-Za-z_$][\w$]*)/);
      if (m) names.add(m[1]);
    }
    for (const m of code.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) names.add(m[1]);
    // classic script 가 내놓는 전역(window.ChatTabs · window.GlRecover …) — 대문자로 시작하는 window.X 는 그 모듈 이름으로 본다
    for (const m of code.matchAll(/window\.([A-Z][\w$]*)/g)) if (!/^(?:AudioContext|URL|Image|Blob|File)/.test(m[1])) names.add(m[1]);
    for (const n of [...names]) if (n.length < 6) names.delete(n);
    if (names.size) modNames.set(f, names);
  }
}
for (const s of sections) {
  s.mods = [];
  for (const [f, names] of modNames) {
    const hit = [...names].filter((n) => s.ids.has(n));
    if (hit.length) s.mods.push(f);
  }
}

const top = (m, k = 4) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([n, c]) => '#' + n + '(' + c + ')').join(' ');

if (args.includes('--json')) {
  process.stdout.write(JSON.stringify(sections.map((s) => ({
    no: s.no, start: s.start, end: s.end, lines: s.lines, title: s.title, defs: s.defs,
    fb: s.fb, dom: s.dom, ipc: s.ipc, mods: s.mods,
    uses: Object.fromEntries(s.uses), usedBy: Object.fromEntries(s.usedBy),
  })), null, 1) + '\n');
} else {
  console.log('# ' + path.relative(ROOT, FILE) + ' — ' + lines.length + '줄 · 구역 ' + sections.length + '개\n');
  console.log('| # | 줄 | 크기 | 제목 | 정의 | 씀(구역 수) | 쓰임(구역 수) | firebaseAPI | DOM | 관련 모듈 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const s of sections) {
    console.log(`| ${s.no} | ${s.start}–${s.end} | ${s.lines} | ${s.title.slice(0, 60).replace(/\|/g, '/')} | ${s.defs.length} | ${s.uses.size} ${top(s.uses, 3)} | ${s.usedBy.size} ${top(s.usedBy, 3)} | ${s.fb} | ${s.dom} | ${s.mods.join(' ')} |`);
  }
}
