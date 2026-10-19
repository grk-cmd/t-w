/* sim-help-pages.js — 📘 도움말 웹 페이지(hosting/help/)가 깨지지 않았는가
   앱 📘 도움말 칸이 이 페이지를 그대로 보여 주므로, 링크 하나 · 그림 하나가 비어도 사용자가 빈 칸을 본다.
   ・1절: 목차 · 편마다 — /help/ 링크가 가리키는 편 · 그림 파일이 실제로 있다 · 이전 / 다음이 목차 순서와 같다
   ・2절: 바깥 것 — 나눔고딕(fonts/)을 싣고 글꼴 파일이 다 있다 · 스크립트는 /help/theme.js 하나 · 시안용 글(원본 그림 · 점선 · data: 그림)이 안 남았다
   ・3절: theme.js — 앱 테마(default · bubble)를 토큰 테마(classic · light)로 바꿔 걸고, 모르는 값 · 없음은 앱 기본(classic) ·
          ?embed=1 이면 우편함 칸 모양 · 편을 옮겨도 둘이 이어진다
   ・4절: 깨 보기
   ・5절: embed.js — 칸 안에서만 지금 편 · 목차(toc.json)를 앱에 알린다 · toc.json 은 목차 페이지와 같다(1절) */
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
  const fontCss = fs.readFileSync(path.join(DIR, 'fonts', 'nanum-gothic.css'), 'utf8');
  const toc = JSON.parse(fs.readFileSync(path.join(DIR, 'toc.json'), 'utf8'));
  return { pages, files, fontCss, toc };
}

/* 판정 — 오류 글 목록을 돌려준다(빈 목록이면 통과) */
function judge({ pages, files, fontCss, toc }){
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
    if (scripts.join('|') !== ' src="/help/theme.js"| src="/help/embed.js" defer') errs.push(f + ' — 스크립트가 /help/theme.js · /help/embed.js(defer) 두 줄이 아니다');
    if (/data:image|원본 그림|점선 테두리|\[원본/.test(s)) errs.push(f + ' — 시안용 글 · 박아 넣은 그림이 남았다');
    if (!/<link rel="stylesheet" href="\/design\/tokens\.css">/.test(s)) errs.push(f + ' — 디자인 토큰을 안 싣는다');
    if (!/<link rel="stylesheet" href="\/help\/fonts\/nanum-gothic\.css">/.test(s)) errs.push(f + ' — 나눔고딕을 안 싣는다');
  }
  /* toc.json(앱 왼쪽 메뉴가 그리는 목차)이 목차 페이지와 같은 순서 · 같은 이름 */
  const idxTitles = [...idx.matchAll(/<li><a href="\/help\/([\w-]+)"><span class="no">[^<]*<\/span>([^<]*)</g)].map(m => m[1] + ' ' + m[2].replace(/&amp;/g, '&').trim());
  const idxGroups = [...idx.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1]);
  const tocTitles = (toc || []).flatMap(g => (g.pages || []).map(p => p.slug + ' ' + p.title));
  if (tocTitles.join('|') !== idxTitles.join('|')) errs.push('toc.json 편 목록이 목차 페이지와 다르다');
  if ((toc || []).map(g => g.group).join('|') !== idxGroups.join('|')) errs.push('toc.json 묶음이 목차 페이지와 다르다');
  const fontUrls = [...fontCss.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
  if (fontUrls.length < 100) errs.push('나눔고딕 글꼴 파일 목록이 너무 적다(' + fontUrls.length + ')');
  for (const u of fontUrls) if (!u.startsWith('/help/fonts/') || !files.has(u.slice('/help/'.length))) errs.push('글꼴 ' + u + ' 가 없다');
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
/* theme.js 를 가짜 문서에서 돌린다 — 건 테마 · 칸 안 표시 · 문서가 다 읽힌 뒤 /help/ 링크 주소를 돌려준다 */
const run = (src, search, hrefs = ['/help/3', '/help/']) => {
  const attrs = {}, onReady = [];
  const links = hrefs.map(h => ({ h, getAttribute: function(){ return this.h; }, setAttribute: function(k, v){ this.h = v; } }));
  const doc = {
    documentElement: { setAttribute: (k, v) => { attrs[k] = v; } },
    addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') onReady.push(fn); },
    querySelectorAll: () => links,
  };
  new Function('document', 'location', 'URLSearchParams', src)(doc, { search }, URLSearchParams);
  onReady.forEach(fn => fn());
  return { theme: attrs['data-theme'], embed: 'data-embed' in attrs, links: links.map(l => l.h) };
};
const theme = (src, search) => run(src, search).theme;
chk(theme(THEME, '?theme=default') === 'classic' && theme(THEME, '?theme=bubble') === 'light', '앱 테마를 따른다 — 기본 → classic · 버블 → light');
chk(theme(THEME, '?theme=dark') === 'classic' && theme(THEME, '?theme=constructor') === 'classic' && theme(THEME, '') === 'classic', '  모르는 값 · 없음 · 앱에 없는 dark — 앱 기본(classic)');
const emb = run(THEME, '?theme=bubble&embed=1');
chk(emb.embed && !run(THEME, '?theme=bubble').embed && !run(THEME, '?embed=yes').embed, '?embed=1 일 때만 우편함 칸 모양(data-embed)');
chk(emb.links.join() === '/help/3?theme=bubble&embed=1,/help/?theme=bubble&embed=1', '  편을 옮겨도 테마 · 칸 모양이 이어진다(/help/ 링크에 붙임)');
chk(run(THEME, '').links.join() === '/help/3,/help/' && run(THEME, '?theme=evil').links.join() === '/help/3,/help/', '  웹에서 그냥 열면 링크를 건드리지 않는다(모르는 테마도 안 실어 나름)');
const HCSS = fs.readFileSync(path.join(DIR, 'help.css'), 'utf8');
chk(/\[data-embed\] body\{background:transparent/.test(HCSS), '  우편함 칸 안에서는 바탕을 비운다(우편함 · 디자인 스튜디오 바탕이 비침)');

say('── 4. 깨 보기 — 하나라도 못 잡으면 빨강');
const clone = () => ({ pages: Object.assign({}, real.pages), files: new Set(real.files), fontCss: real.fontCss, toc: JSON.parse(JSON.stringify(real.toc)) });
const breaks = [
  ['그림 파일 하나가 빠짐', (w) => { const f = [...w.files].find(x => x.startsWith('img/')); w.files.delete(f); }],
  ['편 하나가 빠짐', (w) => { delete w.pages['3.html']; }],
  ['다음 글이 엉뚱한 편', (w) => { w.pages['2.html'] = w.pages['2.html'].replace(/<a class="next" href="\/help\/[\w-]+"/, '<a class="next" href="/help/7"'); }],
  ['바깥 스크립트가 끼어듦', (w) => { w.pages['1.html'] = w.pages['1.html'].replace('</head>', '<script src="https://x.example/a.js"></script></head>'); }],
  ['시안 글이 남음', (w) => { w.pages['5.html'] += '<figcaption>원본 그림 3</figcaption>'; }],
  ['글꼴 파일 하나가 빠짐', (w) => { const f = [...w.files].find(x => x.startsWith('fonts/') && x.endsWith('.woff2')); w.files.delete(f); }],
  ['글꼴을 안 싣는 편', (w) => { w.pages['6.html'] = w.pages['6.html'].replace('<link rel="stylesheet" href="/help/fonts/nanum-gothic.css">', ''); }],
  ['toc.json 편 이름이 목차와 다름', (w) => { w.toc[2].pages[0].title = '실행'; }],
  ['toc.json 에 편 하나가 빠짐', (w) => { w.toc[3].pages.pop(); }],
  ['embed.js 를 안 싣는 편', (w) => { w.pages['2.html'] = w.pages['2.html'].replace('<script src="/help/embed.js" defer></script>', ''); }],
  ['박아 넣은 그림', (w) => { w.pages['4.html'] += '<img src="data:image/png;base64,AA">'; }],
];
for (const [name, f] of breaks){ const w = clone(); f(w); chk(judge(w).length > 0, name); }
const T2 = THEME.replace("theme ? MAP[theme] : 'classic'", "MAP[t] || t || 'classic'");
chk(theme(T2, '?theme=dark') !== 'classic', '  theme.js 가 모르는 값을 그대로 씀');
const T3 = THEME.replace("if(embed) carry.push('embed=1');", '');
chk(run(T3, '?theme=bubble&embed=1').links[0] !== '/help/3?theme=bubble&embed=1', '  편을 옮기면 칸 모양이 풀림');

say('── 5. embed.js — 칸 안에서만 지금 편 · 목차를 앱에 알린다');
const EMBED = fs.readFileSync(path.join(DIR, 'embed.js'), 'utf8');
/* 가짜 창에서 돌려 앱(부모)에 보낸 것을 모은다 — fetch 는 실제 toc.json 을 돌려준다 */
const embedRun = async (src, { pathname = '/help/3', embedded = true, inFrame = true, fetchOk = true } = {}) => {
  const sent = [];
  const parent = { postMessage: (msg, target) => sent.push({ msg, target }) };
  const win = {}; win.parent = inFrame ? parent : win;
  const doc = { documentElement: { hasAttribute: (k) => k === 'data-embed' && embedded } };
  const fetchFn = async () => fetchOk ? { ok: true, json: async () => real.toc } : { ok: false };
  new Function('window', 'document', 'location', 'fetch', src)(win, doc, { pathname }, fetchFn);
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
  return sent;
};
(async () => {
  const one = await embedRun(EMBED);
  chk(one.length === 1 && one[0].msg.type === 'tw-help' && one[0].msg.v === 1 && one[0].msg.page === '3' && one[0].msg.toc === real.toc, '칸 안 — 지금 편(3) · 목차를 한 번 보낸다');
  const pages = [];
  for (const pn of ['/help/', '/help/index', '/help/index.html', '/help/4-1', '/help/4-1.html']) pages.push(((await embedRun(EMBED, { pathname: pn }))[0] || {}).msg?.page);
  chk(pages.join() === 'index,index,index,4-1,4-1', '  주소 모양이 달라도 편 이름은 같다(/help/ · index · .html)');
  chk((await embedRun(EMBED, { embedded: false })).length === 0 && (await embedRun(EMBED, { inFrame: false })).length === 0, '  웹에서 그냥 열면(칸 밖 · 틀 밖) 아무것도 안 보낸다');
  const nt = await embedRun(EMBED, { fetchOk: false });
  chk(nt.length === 1 && nt[0].msg.toc === null && nt[0].msg.page === '3', '  목차를 못 받아도 지금 편은 알린다(목차는 null — 앱이 «못 불러옴» 을 그린다)');
  chk((await embedRun(EMBED, { pathname: '/other/3' })).length === 0, '  /help/ 밖 주소면 보내지 않는다');
  const E2 = EMBED.replace("if(!document.documentElement.hasAttribute('data-embed') || window.parent === window) return;", '');
  chk((await embedRun(E2, { embedded: false })).length > 0, '  깨 보기 — 칸 밖에서도 보내면 위 검사가 잡는다');
  finish();
})();
function finish(){
say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 도움말 페이지는 빈 칸 없이 이어진다'));
process.exit(fail ? 1 : 0);
}
