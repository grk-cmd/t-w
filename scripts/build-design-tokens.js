#!/usr/bin/env node
/* ═══ scripts/build-design-tokens.js — 디자인 시스템 토큰(docs/design-system/project/tokens.json)을 css 로 ═══
   만드는 것: hosting/help/tokens.css — 도움말 사이트(help.together-working.com) 페이지가 싣는 색 · 간격.
   ⚠️ 디자인 시스템 웹 페이지는 만들지 않는다 — hosting/ 아래에 두면 관리자 사이트(main)로 배포된다. 원본 docs/design-system/ 은 화면 규칙 문서로만 쓴다.
   같은 입력이면 늘 같은 출력 — 시각 · 난수를 넣지 않는다(sim-design-tokens.js 가 커밋된 파일과 비교한다).

   실행(저장소 루트):
     node scripts/build-design-tokens.js          ← 다시 쓴다 (npm run design:build)
     node scripts/build-design-tokens.js --check  ← 쓰지 않고, 지금 파일이 최신인지만 본다(다르면 종료 코드 1) */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = 'hosting/help/tokens.css';
const SRC = 'docs/design-system/project/tokens.json';
const THEMES = [
  { id: 'light', label: '낮' },
  { id: 'dark', label: '밤' },
  { id: 'classic', label: '클래식' },
];

/* ── tokens.json → tokens.css ─────────────────────────────────────────────
   :root(= 낮) · 시스템이 어두우면(테마를 고르지 않았을 때만) 밤 · [data-theme] 셋.
   `{line}` 같은 참조는 var(--line) 으로 — 테마가 바뀌면 같이 따라간다. */
const ref = (v) => String(v).replace(/^\{([a-z0-9-]+)\}$/, 'var(--$1)');

function tokensCss(T){
  const themed = {}; // theme → [name, value]
  for (const th of THEMES) themed[th.id] = [];
  for (const t of T.color.tokens) for (const th of THEMES) themed[th.id].push([t.name, ref(t.value[th.id])]);
  for (const t of T.shadow.tokens) for (const th of THEMES) themed[th.id].push([t.name, t.value[th.id]]);
  const fixed = [];
  for (const [k, v] of Object.entries(T.type.families)) fixed.push([`font-${k}`, v]);
  for (const g of ['spacing', 'radius', 'size', 'layer']) for (const t of T[g].tokens) fixed.push([t.name, t.value]);
  const block = (sel, pairs, pad = '  ') => `${sel}{\n` + pairs.map(([k, v]) => `${pad}--${k}:${v};`).join('\n') + `\n${pad.slice(2)}}`;
  return [
    `/* ${T.name} 디자인 토큰 — scripts/build-design-tokens.js 가 docs/design-system/project/tokens.json 에서 만든다. 손으로 고치지 말 것. */`,
    block(':root', fixed),
    block(':root,[data-theme="light"]', themed.light),
    '@media (prefers-color-scheme: dark){\n' + block('  :root:not([data-theme])', themed.dark, '    ') + '\n}',
    block('[data-theme="dark"]', themed.dark),
    block('[data-theme="classic"]', themed.classic),
    '',
  ].join('\n');
}

function build(root = process.cwd()){
  const T = JSON.parse(fs.readFileSync(path.join(root, SRC), 'utf8'));
  return { [OUT]: tokensCss(T) };
}

module.exports = { build, tokensCss, OUT };

if (require.main === module){
  const root = path.resolve(__dirname, '..');
  const files = build(root);
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [rel, content] of Object.entries(files)){
    const p = path.join(root, rel);
    const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (cur === content) continue;
    stale++;
    if (check){ console.log(`✗ ${rel} — 최신이 아니다 (npm run design:build)`); continue; }
    fs.writeFileSync(p, content);
    console.log(`  써 넣음: ${rel} (${Buffer.byteLength(content)} 바이트)`);
  }
  if (check){ console.log(stale ? `✗ ${stale}개가 낡았다` : '✓ 토큰 최신'); process.exit(stale ? 1 : 0); }
  if (!stale) console.log('  바뀐 것 없음');
}
