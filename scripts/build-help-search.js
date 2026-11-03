#!/usr/bin/env node
/* ═══ scripts/build-help-search.js — 도움말 검색표(hosting/help/search.json) 만들기 ═══
   도움말 편(toc.json 순서)을 소제목(h2 · h3) 단위 조각으로 나누고, 연관어 거미줄(docs/help-search/words.json) ·
   FAQ(docs/help-search/faq.json)를 함께 묶어 한 파일로 낸다. 페이지의 search.js 가 이것 하나만 받아 브라우저 안에서 찾는다.
   소제목에는 id(s1 · s2 …)를 붙여 다시 쓴다 — 검색 결과가 그 자리로 바로 가게. 편 안 순서가 바뀌면 번호도 바뀌니
   글을 고친 뒤에는 늘 다시 돌린다(sim-help-search.js 가 커밋된 것과 다시 만든 것을 비교한다).
   함께 만드는 것: 모든 편 · 목차의 위 띠(헤더 — [도움말] [FAQ] 탭 · 검색창 자리)를 한 모양으로 · FAQ 페이지(faq.html).
   같은 입력이면 늘 같은 출력 — 시각 · 난수를 넣지 않는다.

   실행(저장소 루트):
     node scripts/build-help-search.js          ← 다시 쓴다 (npm run help:build)
     node scripts/build-help-search.js --check  ← 쓰지 않고, 지금 파일이 최신인지만 본다(다르면 종료 코드 1) */
'use strict';
const fs = require('fs');
const path = require('path');

const HELP = 'hosting/help';
const OUT = HELP + '/search.json';
const FAQ_PAGE = HELP + '/faq.html';
const WORDS = 'docs/help-search/words.json';
const FAQ = 'docs/help-search/faq.json';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, k) => ENT[k]);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html) => decode(html.replace(/<br\s*\/?>/g, ' ').replace(/<\/(p|li|td|th|tr|div|figcaption|h\d)>/g, ' ').replace(/<[^>]+>/g, ''))
  .replace(/\s+/g, ' ').trim();
// 소제목 앞 «▶ » 같은 표시는 이름이 아니다 — FAQ 가 소제목을 이름으로 찾는다
const cleanHead = (s) => s.replace(/^[▶+]\s*/, '').trim();

/* 위 띠 — 지금 탭(help | faq)에 aria-current. 검색창은 search.js 가 이 띠 끝에 붙인다 */
function header(cur){
  const tab = (href, name, id) => '<a href="' + href + '"' + (cur === id ? ' aria-current="page"' : '') + '>' + name + '</a>';
  return '<header class="bar"><a href="/">📘 투게더워킹 도움말</a><nav class="tabs">' + tab('/', '도움말', 'help') + tab('/faq', 'FAQ', 'faq') + '</nav></header>';
}
const withHeader = (html, cur) => html.replace(/<header class="bar">[\s\S]*?<\/header>/, header(cur));

/* FAQ 페이지 — 질문 하나에 소제목 하나 · 답 · 그 내용이 있는 자리 링크 */
function faqPage(faq, pages, chunks){
  const items = faq.map((f, i) => {
    const head = '<h2 id="f' + (i + 1) + '">' + esc(f.q[0]) + '</h2>\n<p>' + esc(f.t) + '</p>';
    if (f.p === 'faq') return head;
    const pg = pages.find(p => p.s === f.p);
    const c = f.a ? chunks.find(c => c.p === f.p && c.a === f.a) : null;
    const where = f.p + '. ' + pg.t + (c ? ' › ' + c.h : '');
    return head + '\n<p><a class="xref" href="/' + f.p + (f.a ? '#' + f.a : '') + '">🔗 ' + esc(where) + '</a></p>';
  }).join('\n\n');
  return ['<!doctype html>', '<html lang="ko">', '<head>', '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="referrer" content="no-referrer">',
    '<title>자주 묻는 질문 — 투게더워킹 도움말</title>',
    '<link rel="stylesheet" href="/tokens.css">', '<link rel="stylesheet" href="/fonts/nanum-gothic.css">', '<link rel="stylesheet" href="/help.css">',
    '<script src="/theme.js"></script>', '<script src="/embed.js" defer></script>', '<script src="/search.js" defer></script>',
    '</head>', '<body>', header('faq'), '<main>', '<h1>자주 묻는 질문</h1>',
    '<p class="lead">많이 물어보는 것을 모았어요. 더 자세한 설명은 아래 링크에서 볼 수 있어요.</p>', '',
    items, '',
    '<p class="foot">찾는 내용이 없으면 위 검색창에 물어보거나 마이홈 › 버그제보에 남겨 주세요.</p>',
    '</main>', '</body>', '</html>', ''].join('\n');
}

/* h2 · h3 에 차례대로 id="sN" 을 단다(이미 단 sN 은 새로 매긴다 · 다른 id 는 그대로 쓴다) */
function withIds(html){
  let n = 0;
  return html.replace(/<(h[23])((?:\s[^>]*)?)>/g, (_, tag, attrs) => {
    const rest = attrs.replace(/\s+id="s\d+"/, '');
    if (/\sid="/.test(rest)) return '<' + tag + rest + '>';
    return '<' + tag + ' id="s' + (++n) + '"' + rest + '>';
  });
}

/* 한 편 → 조각들. 첫 소제목 앞 글(머리말)은 소제목 없는 조각(a '') */
function chunksOf(slug, html){
  const main = (html.match(/<main>([\s\S]*?)<\/main>/) || [])[1] || '';
  const body = main.replace(/<nav class="pn">[\s\S]*?<\/nav>/g, '').replace(/<h1>[\s\S]*?<\/h1>/, '');
  const out = [];
  const re = /<(h[23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g;
  let last = 0, cur = { a: '', h: '' }, h2 = '';
  const push = (end) => { const t = plain(body.slice(last, end)); if (t) out.push({ p: slug, a: cur.a, h: cur.h, t }); };
  let m;
  while ((m = re.exec(body))){
    push(m.index);
    const head = cleanHead(plain(m[3]));
    if (m[1] === 'h2') h2 = head;
    cur = { a: m[2], h: m[1] === 'h3' && h2 ? h2 + ' › ' + head : head };
    last = re.lastIndex;
  }
  push(body.length);
  return out;
}

function build(root = process.cwd()){
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const toc = JSON.parse(read(HELP + '/toc.json'));
  const files = {};
  const pages = [], chunks = [];
  for (const g of toc) for (const p of g.pages){
    const rel = HELP + '/' + p.slug + '.html';
    const html = withIds(withHeader(read(rel), 'help'));
    files[rel] = html;
    pages.push({ s: p.slug, t: p.title, g: g.group });
    chunks.push(...chunksOf(p.slug, html));
  }
  const words = JSON.parse(read(WORDS));
  // 편이 없는 FAQ(맥 설치처럼 도움말 편에 없는 것)는 FAQ 페이지의 그 질문 자리로 간다
  const faq = JSON.parse(read(FAQ)).map((f, i) => {
    if (!f.page) return { q: f.q, t: f.a, p: 'faq', a: 'f' + (i + 1) };
    const page = pages.find(p => p.s === f.page);
    if (!page) throw new Error(FAQ + ' ' + (i + 1) + '번 — 없는 편 «' + f.page + '»');
    let a = '';
    if (f.section){
      const c = chunks.find(c => c.p === f.page && c.a && cleanHead(c.h.split(' › ').pop()) === f.section);
      if (!c) throw new Error(FAQ + ' ' + (i + 1) + '번 — ' + f.page + ' 편에 «' + f.section + '» 소제목이 없다');
      a = c.a;
    }
    return { q: f.q, t: f.a, p: f.page, a };
  });
  files[HELP + '/index.html'] = withHeader(read(HELP + '/index.html'), 'help');
  files[FAQ_PAGE] = faqPage(faq, pages, chunks);
  pages.push({ s: 'faq', t: '자주 묻는 질문', g: '' });
  files[OUT] = JSON.stringify({ v: 1, pages, chunks, faq, words }) + '\n';
  return files;
}

module.exports = { build, withIds, withHeader, chunksOf, OUT, FAQ_PAGE };

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
    if (check){ console.log(`✗ ${rel} — 최신이 아니다 (npm run help:build)`); continue; }
    fs.writeFileSync(p, content);
    console.log(`  써 넣음: ${rel} (${Buffer.byteLength(content)} 바이트)`);
  }
  if (check){ console.log(stale ? `✗ ${stale}개가 낡았다` : '✓ 도움말 검색표 최신'); process.exit(stale ? 1 : 0); }
  if (!stale) console.log('  바뀐 것 없음');
}
