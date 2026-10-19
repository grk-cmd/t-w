/* ═══ sim-design-tokens.js — 도움말 사이트 토큰(hosting/help/tokens.css)이 원본(docs/design-system/project/tokens.json)과 맞는가 ═══
   hosting/help/tokens.css 는 scripts/build-design-tokens.js 가 만든 결과물을 커밋해 둔 것이다. 원본만 고치고
   다시 만들지 않으면 도움말 페이지 색이 낡은 채로 배포된다 — 그걸 여기서 잡는다. */
'use strict';
const fs = require('fs');
const path = require('path');

// 스테이징(checks/run.js)에선 검사와 원본이 한 폴더, 저장소에서 바로 돌리면 한 층 위가 루트다.
const ROOT = fs.existsSync(path.join(__dirname, 'scripts', 'build-design-tokens.js')) ? __dirname : path.join(__dirname, '..');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if (ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };

const GEN = path.join(ROOT, 'scripts', 'build-design-tokens.js');
if (!fs.existsSync(GEN)){ say('✗ scripts/build-design-tokens.js 가 없다'); process.exit(1); }
const { build, tokensCss } = require(GEN);

say('── 1. 커밋된 결과물이 최신');
const files = build(ROOT);
for (const [rel, content] of Object.entries(files)){
  const p = path.join(ROOT, rel);
  const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  chk(cur === content, `${rel} — 원본에서 다시 만든 것과 같다 (다르면 npm run design:build)`);
}
chk(!fs.existsSync(path.join(ROOT, 'hosting', 'design')), '디자인 시스템 웹 페이지(hosting/design/)는 걷었다 — 다시 생기면 /design/ 이 다시 배포된다');

say('── 2. 토큰');
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design-system/project/tokens.json'), 'utf8'));
const css = tokensCss(T);
const block = (sel) => { const i = css.indexOf(sel + '{'); return i < 0 ? '' : css.slice(i, css.indexOf('}', i)); };
for (const sel of [':root,[data-theme="light"]', '[data-theme="dark"]', '[data-theme="classic"]', '  :root:not([data-theme])']){
  const b = block(sel);
  chk(T.color.tokens.every((t) => b.includes(`--${t.name}:`)), `${sel.trim()} 블록에 색 토큰 ${T.color.tokens.length}개 전부`);
}
chk(/@media \(prefers-color-scheme: dark\)\{\s+:root:not\(\[data-theme\]\)/.test(css), '시스템 다크는 테마를 고르지 않았을 때만');
chk(/--bevel-hi:var\(--line\);/.test(block(':root,[data-theme="light"]')), '{line} 참조는 var(--line) 으로');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
