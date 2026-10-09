/* ═══ sim-design-site.js — 디자인 시스템 웹 페이지(hosting/design/)가 원본(docs/design-system/)과 맞는가 ═══
   hosting/design/ 은 scripts/build-design-site.js 가 만든 결과물을 커밋해 둔 것이다. 원본만 고치고
   다시 만들지 않으면 /design/ 이 낡은 채로 배포된다 — 그걸 여기서 잡는다. */
'use strict';
const fs = require('fs');
const path = require('path');

// 스테이징(checks/run.js)에선 검사와 원본이 한 폴더, 저장소에서 바로 돌리면 한 층 위가 루트다.
const ROOT = fs.existsSync(path.join(__dirname, 'scripts', 'build-design-site.js')) ? __dirname : path.join(__dirname, '..');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if (ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };

const GEN = path.join(ROOT, 'scripts', 'build-design-site.js');
if (!fs.existsSync(GEN)){ say('✗ scripts/build-design-site.js 가 없다'); process.exit(1); }
const { build, markdown, tokensCss, OUT_DIR } = require(GEN);

say('── 1. 커밋된 결과물이 최신');
const files = build(ROOT);
for (const [rel, content] of Object.entries(files)){
  const p = path.join(ROOT, rel);
  const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  chk(cur === content, `${rel} — 원본에서 다시 만든 것과 같다 (다르면 npm run design:build)`);
}

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
const bundle = files[`${OUT_DIR}/bundle.css`];
const previews = fs.readdirSync(path.join(ROOT, 'docs/design-system/project/components'), { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => path.join(ROOT, 'docs/design-system/project/components', e.name, 'preview.html'))
  .filter((p) => fs.existsSync(p)).map((p) => fs.readFileSync(p, 'utf8')).join('\n');
const defined = new Set([...(css + bundle + previews).matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const used = new Set([...(bundle + previews).matchAll(/var\(--([a-z0-9-]+)/g)].map((m) => m[1]));
const missing = [...used].filter((n) => !defined.has(n));
chk(!missing.length, `부품 · 미리보기가 쓰는 변수 ${used.size}개가 모두 정의됨` + (missing.length ? ` — 없음: ${missing.join(', ')}` : ''));

say('── 3. 페이지');
const html = files[`${OUT_DIR}/index.html`];
chk(!/\/_blob\//.test(html), '아티팩트 그림 주소(/_blob/)가 남지 않는다');
chk(!/<(script|link|img|iframe)[^>]+(src|href)="https?:/i.test(html), '바깥 스크립트 · 스타일 · 그림을 싣지 않는다');
chk(/http-equiv="Content-Security-Policy"[^>]*default-src 'none'/.test(html), 'CSP 를 페이지에 싣는다(기본 막음)');
chk((html.match(/<iframe [^>]*sandbox="allow-scripts"/g) || []).length === (html.match(/<iframe /g) || []).length, '미리보기 iframe 은 모두 sandbox(같은 출처 없음)');
chk(/postMessage\(t, '\*'\)/.test(html) && /e\.source===parent/.test(html), '테마는 postMessage 로 · 미리보기는 부모가 보낸 것만 받는다');
chk(/tw\.design\.theme/.test(html), '고른 테마는 tw. 접두사 키에 기억');

say('── 4. 마크다운 변환');
chk(markdown('<script>x</script>') === '<p>&lt;script&gt;x&lt;/script&gt;</p>', '원문 HTML 은 글자로 이스케이프');
chk(markdown('`premium-*` · *연* · **굵게**') === '<p><code>premium-*</code> · <i>연</i> · <b>굵게</b></p>', '인라인 코드 안의 * 는 기울임이 아니다');
chk(markdown('| a | b |\n|---|---|\n| `x | y` | 2 |').includes('<td><code>x | y</code></td><td>2</td>'), '표 — 코드 안의 | 는 칸 나눔이 아니다');
chk(!/href/.test(markdown('[a](javascript:alert(1))')) && !/href/.test(markdown('[a](javascript:void0)')) && /href="https:\/\/x\.y"/.test(markdown('[a](https://x.y)')), '링크는 http(s) 만');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
