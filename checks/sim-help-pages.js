/* sim-help-pages.js — 📘 도움말 웹 페이지(hosting/help/)가 깨지지 않았는가
   앱 📘 도움말 칸이 이 페이지를 그대로 보여 주므로, 링크 하나 · 그림 하나가 비어도 사용자가 빈 칸을 본다.
   ・1절: 목차 · 편마다 — /help/ 링크가 가리키는 편 · 그림 파일이 실제로 있다 · 이전 / 다음이 목차 순서와 같다
   ・2절: 바깥 것 — 스크립트는 /help/theme.js 하나 · 시안용 글(원본 그림 · 점선 · data: 그림)이 안 남았다
   ・3절: theme.js — ?theme= 를 따르고, 모르는 값이면 기기 밝음 · 어두움
   ・4절: 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, 'hosting', 'help')) ? __dirname : path.join(__dirname, '..');
const DIR = path.join(ROOT, 'hosting', 'help');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if (ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };
if (!fs.existsSync(path.join(DIR, 'index.html'))){ say('  ? 원본 못 찾음 — hosting/help/index.html'); process.exit(2); }

function load(){
  const pages = {};
  for (const f of fs.readdirSync(DIR)) if (f.endsWith('.html')) pages[f] = fs.readFileSync(path.join(DIR, f), 'utf8');
  const files = new Set();
  const walk = (d, rel) => { for (const f of fs.readdirSync(d)){ const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, rel + f + '/') : files.add(rel + f); } };
  walk(DIR, '');
  return { pages, files };
}

/* 판정 — 오류 글 목록을 돌려준다(빈 목록이면 통과) */
function judge({ pages, files }){
  const errs = [];
  const idx = pages['index.html'] || '';
  const order = [...idx.matchAll(/<li><a href="\/help\/([\w-]+)">/g)].map(m => m[1]);
  if (order.length < 10) errs.push('목차에 편이 너무 적다(' + order.length + ')');
  for (const slug of order) if (!pages[slug + '.html']) errs.push('목차의 ' + slug + ' 편 파일이 없다');
  for (const [f, s] of Object.entries(pages)){
    for (const m of s.matchAll(/href="\/help\/([^"#?]*)"/g)){
      const t = m[1].replace(/\.html$/, '');
      if (t === '' ? !pages['index.html'] : !pages[t + '.html'] && !files.has(t)) errs.push(f + ' → /help/' + m[1] + ' 가 없다');
    }
    for (const m of s.matchAll(/src="\/help\/([^"]+)"/g)) if (!files.has(m[1])) errs.push(f + ' 그림 · 파일 /help/' + m[1] + ' 가 없다');
    const scripts = [...s.matchAll(/<script\b([^>]*)>/g)].map(m => m[1]);
    if (scripts.some(a => !/^\s*src="\/help\/theme\.js"\s*$/.test(a))) errs.push(f + ' — /help/theme.js 말고 다른 스크립트가 있다');
    if (/data:image|원본 그림|점선 테두리|\[원본/.test(s)) errs.push(f + ' — 시안용 글 · 박아 넣은 그림이 남았다');
    if (!/<link rel="stylesheet" href="\/design\/tokens\.css">/.test(s)) errs.push(f + ' — 디자인 토큰을 안 싣는다');
  }
  order.forEach((slug, i) => {
    const s = pages[slug + '.html'] || '';
    const prev = (s.match(/<a class="prev" href="\/help\/([\w-]+)"/) || [])[1] || null;
    const next = (s.match(/<a class="next" href="\/help\/([\w-]+)"/) || [])[1] || null;
    if (prev !== (order[i - 1] || null)) errs.push(slug + ' 이전 글이 목차 순서와 다르다(' + prev + ')');
    if (next !== (order[i + 1] || null)) errs.push(slug + ' 다음 글이 목차 순서와 다르다(' + next + ')');
  });
  return errs;
}

say('── 1 · 2. 목차 · 편 · 링크 · 그림 · 바깥 것');
const real = load();
const errs = judge(real);
chk(errs.length === 0, '도움말 페이지 ' + Object.keys(real.pages).length + '개 — 링크 · 그림 · 이전/다음 · 스크립트 · 시안 글 모두 맞다' + (errs.length ? '\n      ' + errs.slice(0, 8).join('\n      ') : ''));

say('── 3. theme.js');
const THEME = fs.readFileSync(path.join(DIR, 'theme.js'), 'utf8');
const theme = (src, search, dark) => {
  let set = null;
  const doc = { documentElement: { setAttribute: (k, v) => { if (k === 'data-theme') set = v; } } };
  new Function('window', 'document', 'location', 'matchMedia', 'URLSearchParams', src)(
    { matchMedia: () => ({ matches: dark }) }, doc, { search }, () => ({ matches: dark }), URLSearchParams);
  return set;
};
chk(theme(THEME, '?theme=classic', true) === 'classic' && theme(THEME, '?theme=light', true) === 'light', '?theme= 를 따른다(앱 테마를 실어 연다)');
chk(theme(THEME, '?theme=evil', true) === 'dark' && theme(THEME, '', false) === 'light', '  모르는 값 · 없음 — 기기 밝음 · 어두움');

say('── 4. 깨 보기 — 하나라도 못 잡으면 빨강');
const clone = () => ({ pages: Object.assign({}, real.pages), files: new Set(real.files) });
const breaks = [
  ['그림 파일 하나가 빠짐', (w) => { const f = [...w.files].find(x => x.startsWith('img/')); w.files.delete(f); }],
  ['편 하나가 빠짐', (w) => { delete w.pages['3.html']; }],
  ['다음 글이 엉뚱한 편', (w) => { w.pages['2.html'] = w.pages['2.html'].replace(/<a class="next" href="\/help\/[\w-]+"/, '<a class="next" href="/help/7"'); }],
  ['바깥 스크립트가 끼어듦', (w) => { w.pages['1.html'] = w.pages['1.html'].replace('</head>', '<script src="https://x.example/a.js"></script></head>'); }],
  ['시안 글이 남음', (w) => { w.pages['5.html'] += '<figcaption>원본 그림 3</figcaption>'; }],
  ['박아 넣은 그림', (w) => { w.pages['4.html'] += '<img src="data:image/png;base64,AA">'; }],
];
for (const [name, f] of breaks){ const w = clone(); f(w); chk(judge(w).length > 0, name); }
const T2 = THEME.replace("t !== 'light' && t !== 'dark' && t !== 'classic'", 'false');
chk(theme(T2, '?theme=evil', true) !== 'dark', '  theme.js 가 모르는 값을 그대로 씀');

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 도움말 페이지는 빈 칸 없이 이어진다'));
process.exit(fail ? 1 : 0);
