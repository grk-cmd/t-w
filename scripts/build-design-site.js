#!/usr/bin/env node
/* ═══ scripts/build-design-site.js — 디자인 시스템 문서(docs/design-system/project)를 정적 페이지로 ═══
   만드는 것: hosting/design/index.html · tokens.css · bundle.css (Firebase Hosting 의 /design/).
   새 의존성 없이 node 만 쓴다. 같은 입력이면 늘 같은 출력이 나와야 한다(sim-design-site.js 가 비교한다) —
   시각 · 난수 같은 것을 넣지 않는다.

   실행(저장소 루트):
     node scripts/build-design-site.js          ← hosting/design/ 을 다시 쓴다 (npm run design:build)
     node scripts/build-design-site.js --check  ← 쓰지 않고, 지금 파일이 최신인지만 본다(다르면 종료 코드 1)

   index.html 은 혼자 서는 한 장이다 — 미리보기 iframe(srcdoc)마다 tokens.css · bundle.css 를 그대로 싣는다.
   /design 과 /design/ 어느 주소로 열어도, 파일로 열어도 상대 경로가 깨지지 않게 하려는 것이다.
   tokens.css · bundle.css 는 다른 곳에서 가져다 쓰라고 따로도 내놓는다. */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'hosting/design';
const SRC_DIR = 'docs/design-system/project';
const THEMES = [
  { id: 'light', label: '낮' },
  { id: 'dark', label: '밤' },
  { id: 'classic', label: '클래식' },
];
const THEME_KEY = 'tw.design.theme';
// 미리보기 안의 그림 주소(아티팩트 저장소)는 앱 마크 하나뿐이다 — 데이터 주소로 바꿔 싣는다.
const BLOB_RE = /\/_blob\/[0-9a-f]{32}/g;
const GROUP_ORDER = ['창', '동작', '입력', '탐색', '목록', '표시', '알림', '오버레이', '하두리 장식'];

/* ── 작은 마크다운 → HTML ─────────────────────────────────────────────────
   문서에 실제로 쓰인 것만: 제목 · 문단 · 목록(한 층) · 표 · 코드 블록 · 인라인 코드 · 굵게 · 기울임 · 링크.
   원문의 HTML 은 모두 글자로 이스케이프한다(문서를 고친 사람이 실수로 태그를 넣어도 페이지에 섞이지 않게). */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text){
  const codes = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<i>$2</i>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, href) => {
    const raw = href.replace(/&amp;/g, '&');
    return /^https?:\/\//.test(raw) ? `<a href="${href}" rel="noopener" target="_blank">${t}</a>` : t;
  });
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
}

// 표 한 줄을 칸으로 — 인라인 코드 안의 | 는 칸 나눔이 아니다.
function cells(line){
  const out = [];
  let cur = '', inCode = false;
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (const ch of body){
    if (ch === '`') inCode = !inCode;
    if (ch === '|' && !inCode){ out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function markdown(src, opts = {}){
  const shift = opts.shift || 0;
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  while (i < lines.length){
    const line = lines[i];
    if (!line.trim()){ i++; continue; }
    if (/^```/.test(line)){
      const buf = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) buf.push(lines[i]);
      i++;
      html.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h){
      const lv = Math.min(6, h[1].length + shift);
      html.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
      i++;
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])){
      const head = cells(line);
      const rows = [];
      for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(cells(lines[i]));
      html.push('<div class="tbl"><table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('')
        + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('')
        + '</tbody></table></div>');
      continue;
    }
    const li = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (li){
      const tag = /\d/.test(li[1]) ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length){
        const m = lines[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (m){ items.push(m[2]); i++; continue; }
        // 들여 쓴 다음 줄은 앞 항목에 잇는다.
        if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length){ items[items.length - 1] += ' ' + lines[i].trim(); i++; continue; }
        break;
      }
      html.push(`<${tag}>` + items.map((t) => `<li>${inline(t)}</li>`).join('') + `</${tag}>`);
      continue;
    }
    if (/^>\s?/.test(line)){
      const buf = [];
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) buf.push(lines[i].replace(/^>\s?/, ''));
      html.push(`<blockquote>${markdown(buf.join('\n'), opts)}</blockquote>`);
      continue;
    }
    const buf = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*\||\s*([-*]|\d+\.)\s|>)/.test(lines[i]); i++) buf.push(lines[i].trim());
    if (!buf.length){ buf.push(line.trim()); i++; }
    html.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return html.join('\n');
}

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
    `/* ${T.name} 디자인 토큰 — scripts/build-design-site.js 가 docs/design-system/project/tokens.json 에서 만든다. 손으로 고치지 말 것. */`,
    block(':root', fixed),
    block(':root,[data-theme="light"]', themed.light),
    '@media (prefers-color-scheme: dark){\n' + block('  :root:not([data-theme])', themed.dark, '    ') + '\n}',
    block('[data-theme="dark"]', themed.dark),
    block('[data-theme="classic"]', themed.classic),
    '',
  ].join('\n');
}

/* ── 미리보기 한 장 ──────────────────────────────────────────────────────── */
function parsePreview(src){
  const meta = {};
  const m = src.match(/<!--\s*@dsCard([^>]*?)-->/);
  if (m){
    for (const a of m[1].matchAll(/([a-z]+)=("([^"]*)"|\S+)/g)) meta[a[1]] = a[3] !== undefined ? a[3] : a[2];
  }
  const head = (src.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1].replace(/<meta[^>]*>/gi, '').trim();
  const body = (src.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [, src])[1].trim();
  return { meta, head, body };
}

// 미리보기는 sandbox(다른 출처)라 부모가 안을 만질 수 없다 — 테마는 postMessage 로 받는다.
// srcdoc 을 바꿔 다시 싣는 방식은 미리보기 상태(눌린 탭 등)를 날리고 깜빡여서 쓰지 않는다.
const FRAME_JS = `addEventListener('message',function(e){if(e.source===parent&&/^(light|dark|classic)$/.test(e.data))document.documentElement.setAttribute('data-theme',e.data);});`;

function srcdoc(p, css, logo){
  const doc = `<!doctype html><html lang="ko" data-theme="light"><head><meta charset="utf-8"><script>${FRAME_JS}</script><style>${css}</style>${p.head}</head><body>${p.body}</body></html>`;
  return doc.replace(BLOB_RE, logo);
}

/* ── 페이지 ─────────────────────────────────────────────────────────────── */
const PAGE_CSS = `
html{-webkit-text-size-adjust:100%;}
body{min-height:100vh;}
[data-theme="classic"] body{font-family:var(--font-classic);}
a{color:var(--ink-accent);}
a.tw-btn{text-decoration:none;display:inline-flex;align-items:center;}
.wrap{max-width:1120px;margin:0 auto;padding:0 16px 48px;}
.top{position:sticky;top:0;z-index:5;padding:8px 0;background:var(--bg-desk);}
.top .tw-win{min-width:0;}
.top .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:6px 8px;}
.top nav{display:flex;flex-wrap:wrap;gap:4px;}
.cover{position:relative;overflow:hidden;aspect-ratio:960/288;border-radius:var(--r-win);border:1px solid var(--line);
  box-shadow:var(--shadow-window);background:var(--bg-face);margin:8px 0 16px;}
.cover iframe{position:absolute;left:0;top:0;width:960px;height:288px;border:0;transform-origin:0 0;transform:scale(var(--k,1));}
section.tw-win{margin:0 0 16px;min-width:0;scroll-margin-top:96px;}
.mark{display:inline-block;flex:none;width:16px;height:15px;background:var(--mark) center/16px 15px no-repeat;image-rendering:pixelated;}
.tw-body{padding:12px;}
.lead{font-size:12px;color:var(--ink-soft);margin:0 0 12px;}
.md{max-width:820px;}
.md h2,.md h3,.md h4{font-size:14px;line-height:20px;margin:16px 0 6px;color:var(--ink);}
.md h2:first-child,.md h3:first-child{margin-top:0;}
.md p,.md ul,.md ol{margin:0 0 8px;}
.md ul,.md ol{padding-left:20px;}
.md li{margin:2px 0;}
.md b{color:var(--ink);}
code{font-family:var(--font-num);font-size:11px;background:var(--bg-field);border:1px solid var(--line);
  border-radius:4px;padding:0 3px;color:var(--ink);word-break:break-all;}
[data-theme="classic"] code{border-radius:0;}
pre{background:var(--bg-field);border:1px solid var(--line-strong);padding:8px;overflow:auto;}
pre code{border:0;padding:0;}
blockquote{margin:0 0 8px;padding:4px 10px;border-left:3px solid var(--accent);background:var(--bg-face-2);}
.tbl{overflow-x:auto;margin:0 0 10px;}
table{border-collapse:collapse;min-width:100%;background:var(--bg-field);font-size:12px;}
th,td{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top;}
th{background:var(--bg-face-2);font-weight:700;white-space:nowrap;}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));}
.card{background:var(--bg-face-2);border:1px solid var(--line);border-radius:var(--r-el);padding:8px;min-width:0;}
.card .nm{font:700 12px/18px var(--font-num);color:var(--ink);word-break:break-all;}
.card .us{font-size:11px;line-height:16px;color:var(--ink-soft);margin-top:4px;}
.sw{height:44px;border:1px solid var(--line-strong);border-radius:var(--r-el);margin:6px 0;}
.th3{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;}
.th3 div{font-size:10px;line-height:14px;color:var(--ink-soft);min-width:0;}
.th3 i{display:block;height:14px;border:1px solid rgba(0,0,0,.25);margin-bottom:2px;font-style:normal;}
.th3 span{font-family:var(--font-num);word-break:break-all;}
.tsample{border-bottom:1px dashed var(--line);padding:8px 0;display:grid;grid-template-columns:minmax(0,1fr);gap:2px;}
.tsample .s{color:var(--ink);overflow-wrap:anywhere;}
.tsample .m{font:400 11px/16px var(--font-num);color:var(--ink-accent);}
.tsample .us{font-size:11px;line-height:16px;color:var(--ink-soft);}
h3.sub{font-size:14px;line-height:20px;margin:16px 0 8px;}
h3.sub:first-child{margin-top:0;}
.sp{display:flex;align-items:center;gap:8px;margin:4px 0;}
.sp .bar{height:12px;background:var(--accent);flex:none;}
.sp .nm{font:700 11px/16px var(--font-num);width:120px;flex:none;}
.sp .us{font-size:11px;color:var(--ink-soft);}
.rbox{height:48px;background:var(--bg-select);border:1px solid var(--line-strong);margin:6px 0;}
.shbox{height:48px;background:var(--bg-face);margin:10px 6px;border:1px solid var(--line);}
.comp-group{font-size:14px;line-height:20px;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--line);}
.comp-group:first-child{margin-top:0;}
.comps{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(100%,480px),1fr));}
.comp{min-width:0;}
.comp .tw-titlebar .sub{font-weight:400;font-size:11px;opacity:.85;margin-left:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.comp iframe{display:block;width:100%;border:0;border-bottom:1px solid var(--line);background:var(--bg-desk);}
.comp .md{padding:10px 12px;font-size:12px;}
.foot{font-size:11px;line-height:16px;color:var(--ink-soft);text-align:center;margin-top:24px;}
@media (max-width:600px){ .wrap{padding:0 12px 40px;} .sp .nm{width:84px;} .sp .us{display:none;} }
`;

const PAGE_JS = `
(function(){
  var KEY=${JSON.stringify(THEME_KEY)}, root=document.documentElement;
  var frames=[].slice.call(document.querySelectorAll('iframe[data-tw]'));
  function apply(t, save){
    root.setAttribute('data-theme', t);
    [].forEach.call(document.querySelectorAll('[data-set-theme]'), function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-set-theme')===t ? 'true' : 'false');
    });
    frames.forEach(function(f){ if(f.contentWindow) f.contentWindow.postMessage(t, '*'); });
    if(save){ try{ localStorage.setItem(KEY, t); }catch(e){} }
  }
  document.addEventListener('click', function(e){
    var b=e.target.closest && e.target.closest('[data-set-theme]');
    if(b) apply(b.getAttribute('data-set-theme'), true);
  });
  // 미리보기가 실리면(늦게 실린 것도) 지금 테마를 한 번 더 보낸다.
  frames.forEach(function(f){ f.addEventListener('load', function(){ f.contentWindow.postMessage(root.getAttribute('data-theme') || 'light', '*'); }); });
  apply(root.getAttribute('data-theme') || 'light', false);
  var wrap=document.querySelector('.cover');
  function fit(){ if(wrap) wrap.style.setProperty('--k', String(wrap.clientWidth/960)); }
  fit(); window.addEventListener('resize', fit);
})();
`;

// 첫 그림 전에 테마를 정해 깜빡임을 막는다(고른 적 없으면 시스템 밝기를 따른다).
// ?theme=dark 처럼 주소로도 고를 수 있다(링크로 «밤 테마로 보기» 를 건넬 때).
const HEAD_JS = `(function(){var t=(location.search.match(/[?&]theme=(light|dark|classic)/)||[])[1]||null;
if(!t){try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)});}catch(e){}}
if(!/^(light|dark|classic)$/.test(t||'')) t=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
document.documentElement.setAttribute('data-theme',t);})();`;

function build(root = process.cwd()){
  const R = (p) => path.join(root, SRC_DIR, p);
  const read = (p) => fs.readFileSync(R(p), 'utf8');
  const T = JSON.parse(read('tokens.json'));
  const DS = JSON.parse(read('design-system.json'));
  const bundle = read('components/bundle.css');
  const tokens = tokensCss(T);
  const logo = 'data:image/png;base64,' + fs.readFileSync(R('assets/Logos/tw-mini.png')).toString('base64');
  const css = tokens + '\n' + bundle;
  // 미리보기마다 싣는 사본은 주석 · 빈칸을 걷어 페이지를 가볍게 한다(원본 파일은 그대로 내놓는다).
  const mini = (tokens + bundle).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').trim();

  // {line} 처럼 다른 토큰을 가리키는 값은 같은 테마의 실제 색으로 풀어 견본을 칠한다.
  const byName = Object.fromEntries(T.color.tokens.map((t) => [t.name, t.value]));
  const resolved = (t) => Object.fromEntries(THEMES.map((th) => {
    let v = t.value[th.id];
    for (let n = 0; n < 4 && /^\{(.+)\}$/.test(v); n++) v = byName[v.slice(1, -1)][th.id];
    return [th.id, v];
  }));

  // 앱 마크는 한 번만 싣는다(창마다 <img> 데이터 주소를 반복하면 페이지가 수십 KB 불어난다).
  const icon = '<span class="mark" aria-hidden="true"></span>';
  const win = (id, title, body, lead) => `<section class="tw-win" id="${id}" aria-labelledby="${id}-t">
<div class="tw-titlebar">${icon}<span class="t" id="${id}-t">${esc(title)}</span></div>
<div class="tw-body">${lead ? `<p class="lead">${lead}</p>` : ''}${body}</div>
</section>`;

  /* 색 */
  const colorCards = T.color.tokens.map((t) => {
    const r = resolved(t);
    const swatches = '<div class="th3">' + THEMES.map((th) => `<div><i style="background:${esc(r[th.id])}"></i>${th.label}<br><span>${esc(t.value[th.id])}</span></div>`).join('') + '</div>';
    return `<div class="card"><div class="nm">${esc(t.name)}</div><div class="sw" style="background:var(--${esc(t.name)})" title="지금 테마의 값"></div>${swatches}<div class="us">${inline(t.usage || '')}</div></div>`;
  }).join('\n');

  /* 글자 */
  const fam = Object.entries(T.type.families).map(([k, v]) => `<tr><td><code>font-${esc(k)}</code></td><td style="font-family:var(--font-${esc(k)})">가나다 하두리 Together 0138</td><td><code>${esc(v)}</code></td></tr>`).join('');
  const typeBody = `<div class="tbl"><table><thead><tr><th>이름</th><th>보기</th><th>글꼴 순서</th></tr></thead><tbody>${fam}</tbody></table></div>`
    + T.type.groups.map((g) => `<h3 class="sub">${esc(g.name)}</h3>` + g.styles.map((s) => {
      const f = s.family || g.family;
      const st = `font-family:var(--font-${f});font-size:${s.fontSize};line-height:${s.lineHeight};font-weight:${s.fontWeight}` + (s.letterSpacing ? `;letter-spacing:${s.letterSpacing}` : '');
      return `<div class="tsample"><div class="m">${esc(s.name)} · ${esc(s.fontSize)}/${esc(s.lineHeight)} · ${s.fontWeight >= 700 ? '굵게' : '보통'} · ${esc(f)}</div><div class="s" style="${esc(st)}">${esc(s.sample || '')}</div><div class="us">${inline(s.usage || '')}</div></div>`;
    }).join('')).join('');

  /* 간격 · 모서리 · 그림자 · 크기 · 층 */
  const spacing = T.spacing.tokens.map((t) => `<div class="sp"><span class="nm">${esc(t.name)} · ${esc(t.value)}</span><span class="bar" style="width:${esc(t.value)}"></span><span class="us">${inline(t.usage || '')}</span></div>`).join('');
  const radius = '<div class="grid">' + T.radius.tokens.map((t) => `<div class="card"><div class="nm">${esc(t.name)} · ${esc(t.value)}</div><div class="rbox" style="border-radius:var(--${esc(t.name)})"></div><div class="us">${inline(t.usage || '')}</div></div>`).join('') + '</div>';
  const shadow = '<div class="grid">' + T.shadow.tokens.map((t) => `<div class="card"><div class="nm">${esc(t.name)}</div><div class="shbox" style="box-shadow:var(--${esc(t.name)})"></div>` + '<div class="us">' + THEMES.map((th) => `${th.label}: <code>${esc(t.value[th.id])}</code>`).join('<br>') + `</div><div class="us">${inline(t.usage || '')}</div></div>`).join('') + '</div>';
  const table = (list) => '<div class="tbl"><table><thead><tr><th>이름</th><th>값</th><th>쓰는 곳</th></tr></thead><tbody>'
    + list.map((t) => `<tr><td><code>${esc(t.name)}</code></td><td><code>${esc(t.value)}</code></td><td>${inline(t.usage || '')}</td></tr>`).join('') + '</tbody></table></div>';
  const scaleBody = `<h3 class="sub">간격</h3>${spacing}<h3 class="sub">모서리</h3>${radius}<h3 class="sub">그림자</h3>${shadow}`
    + `<h3 class="sub">크기</h3>${table(T.size.tokens)}<h3 class="sub">겹침 순서(z-index)</h3>${table(T.layer.tokens)}`;

  /* 부품 */
  const compDir = R('components');
  const comps = fs.readdirSync(compDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  let cover = null;
  const groups = new Map();
  for (const name of comps){
    const pf = path.join(compDir, name, 'preview.html');
    if (!fs.existsSync(pf)) continue;
    const p = parsePreview(fs.readFileSync(pf, 'utf8'));
    const rf = path.join(compDir, name, 'README.md');
    const readme = fs.existsSync(rf) ? fs.readFileSync(rf, 'utf8') : '';
    if (name === 'Cover'){ cover = p; continue; }
    const g = p.meta.group || '그 밖';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({ name, p, readme });
  }
  const gNames = [...groups.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const compBody = gNames.map((g) => `<h3 class="comp-group">${esc(g)}</h3><div class="comps">` + groups.get(g).map((c) => {
    const h = Math.max(80, parseInt(c.p.meta.height, 10) || 160);
    return `<article class="tw-win comp" id="c-${esc(c.name)}">
<div class="tw-titlebar"><span class="t">${esc(c.name)}</span>${c.p.meta.subtitle ? `<span class="sub">${esc(c.p.meta.subtitle)}</span>` : ''}</div>
<iframe data-tw title="${esc(c.name)} 미리보기" sandbox="allow-scripts" style="height:${h}px" srcdoc="${esc(srcdoc(c.p, mini, logo))}"></iframe>
<div class="md">${markdown(c.readme, { shift: 2 })}</div>
</article>`;
  }).join('\n') + '</div>').join('\n');

  /* 지침 장 */
  const secDir = R('sections');
  const sections = fs.readdirSync(secDir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const src = fs.readFileSync(path.join(secDir, f), 'utf8');
    const m = src.match(/^#\s+(.+)$/m);
    const title = m ? m[1].trim() : f.replace(/\.md$/, '');
    const body = m ? src.replace(m[0], '') : src;
    return { id: 's-' + f.replace(/\.md$/, ''), title, html: markdown(body, { shift: 1 }) };
  });

  const nav = [['principles', '원칙'], ['color', '색'], ['type', '글자'], ['scale', '간격 · 모서리'], ['components', '부품'], ...sections.map((s) => [s.id, s.title.split(/\s*[·—]\s*/)[0]])];
  const navHtml = nav.map(([id, t]) => `<a class="tw-btn tw-btn--pill" href="#${id}">${esc(t)}</a>`).join('');
  const seg = '<div class="tw-seg" role="group" aria-label="테마">' + THEMES.map((th) => `<button type="button" data-set-theme="${th.id}" aria-pressed="${th.id === 'light'}">${th.label}</button>`).join('') + '</div>';
  const version = DS.lastChange && DS.lastChange.at ? DS.lastChange.at.slice(0, 10) : '';

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<meta name="description" content="${esc(DS.title || T.name)} — 원칙 · 토큰 · 부품 지침">
<title>${esc(DS.title || T.name + ' 디자인 시스템')}</title>
<link rel="icon" href="${logo}">
<!-- 이 파일은 scripts/build-design-site.js 가 만든다. 고칠 곳은 docs/design-system/project/ (npm run design:build). -->
<script>${HEAD_JS}</script>
<style>${css}</style>
<style>:root{--mark:url(${logo});}${PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
<header class="top">
<div class="tw-win">
<div class="tw-titlebar">${icon}<span class="t">${esc(DS.title || T.name)}</span></div>
<div class="bar"><nav aria-label="차례">${navHtml}</nav>${seg}</div>
</div>
</header>
<main>
${cover ? `<div class="cover"><iframe data-tw title="표지" sandbox="allow-scripts" srcdoc="${esc(srcdoc(cover, mini, logo))}"></iframe></div>` : ''}
${win('principles', '원칙 · 하두리 감성 · 테마', `<div class="md">${markdown(read('README.md'), { shift: 1 })}</div>`)}
${win('color', '색', `<div class="grid">${colorCards}</div>`, '큰 견본은 위에서 고른 테마의 값이고, 아래 셋은 낮 · 밤 · 클래식 값이다. 글자에는 <code>ink-*</code>, 면에는 <code>accent</code> · <code>bg-*</code> 를 쓴다.')}
${win('type', '글자', typeBody, '크기는 일곱 단계(+ 오버레이 두 가지)만. 9px 이하 · 반 픽셀 크기는 쓰지 않는다. 맥에는 돋움이 없어 산돌고딕으로 보이는 것이 정상이다.')}
${win('scale', '간격 · 모서리 · 그림자 · 크기 · 층', scaleBody, '모서리와 그림자 견본은 테마를 따라 바뀐다. 클래식은 부품(bundle.css)에서 모서리를 0 으로 접는다.')}
${win('components', '부품', compBody, '미리보기는 실제 <code>bundle.css</code> 그대로다. 테마를 바꾸면 미리보기도 같이 바뀐다. 클래스 이름은 모두 <code>.tw-*</code>.')}
${sections.map((s) => win(s.id, s.title, `<div class="md">${s.html}</div>`)).join('\n')}
</main>
<p class="foot">원본: 저장소 <code>docs/design-system/</code>${version ? ` · ${esc(version)} 판` : ''} · 토큰 파일 <a href="tokens.css">tokens.css</a> · 부품 <a href="bundle.css">bundle.css</a></p>
</div>
<script>${PAGE_JS}</script>
</body>
</html>
`;
  return {
    [`${OUT_DIR}/index.html`]: html,
    [`${OUT_DIR}/tokens.css`]: tokens,
    [`${OUT_DIR}/bundle.css`]: bundle,
  };
}

module.exports = { build, markdown, tokensCss, OUT_DIR };

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
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    console.log(`  써 넣음: ${rel} (${Buffer.byteLength(content)} 바이트)`);
  }
  if (check){ console.log(stale ? `✗ ${stale}개가 낡았다` : '✓ hosting/design 최신'); process.exit(stale ? 1 : 0); }
  if (!stale) console.log('  바뀐 것 없음');
}
