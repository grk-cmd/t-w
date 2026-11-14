/* sim-label-anim-paint.js — 🖼️ 실행 화면 좌석 라벨의 끝없는 애니메이션은 합성기만 쓴다(transform · opacity)
   실행:  node sim-label-anim-paint.js   (desk-companion-prototype.html · overhead.js · exp-bar.js · lv-tier.js 가 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 실행 화면은 화면 전체를 덮는 투명 창이다. 좌석 라벨(경험치 바 흐름 · 회차 별 반짝임)이
     background-position · filter · left 같은 «칠하는» 속성을 끝없이 움직이면, 초당 20장 그리기 상한과 상관없이
     주사율마다 다시 칠하고 배치를 늘 «다시 계산할 상태» 로 두어 0.1초 위치 재기 · 마우스 판정까지 무거워진다.
     누가 칠하는 키프레임을 다시 넣으면 여기서 빨강.
   ・1절: html 의 CSS 를 실제로 파싱 — 좌석 라벨(overhead.js · exp-bar.js 가 만드는 seat-* 클래스)이 쓰는 @keyframes 는
          transform · opacity 만 움직이고, 움직임 최소화(prefers-reduced-motion)에서 멈춘다
   ・2절: 그림이 옛것과 같은가 — 경험치 바 띠(폭 · 무늬 칸 · 미는 거리)가 옛 background-position 흐름과 같은 값 ·
          별 빛 쓸기 창과 안쪽 글자가 서로 상쇄돼 글자가 제자리
   ・3절: 별 겹을 만드는 lv-tier.js npStarFill 을 가짜 DOM 에서 돌린다 — 글은 그대로 · 겹 클래스가 CSS 에 있다 · 다시 채워도 안 쌓인다
   ・4절: 깨 보기 — background-position · filter · animation-name 을 다시 넣거나 움직임 최소화 줄을 빼면 빨강 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const HTML = read('desk-companion-prototype.html'), OV = read('overhead.js') || read('room/overhead.js'),
  EXP = read('exp-bar.js') || read('focus/exp-bar.js'), LVT = read('lv-tier.js') || read('focus/lv-tier.js');
if (!HTML || !OV || !EXP || !LVT) { say('  ? 원본 못 찾음 — desk-companion-prototype.html · overhead.js · exp-bar.js · lv-tier.js'); process.exit(2); }

/* 합성기만으로 움직일 수 있는 속성 — 이 밖의 것은 칠하거나 배치를 다시 한다 */
const COMPOSITE_ONLY = new Set(['transform', 'opacity']);
/* 움직임 최소화에서 멈추지 않아도 되는 것 — 공지 배너 글 흐름은 꾸밈이 아니라 긴 글을 읽게 하는 움직임(원래 목록 밖) */
const REDUCED_MOTION_EXEMPT = new Set(['.seat-announce.scrolling .marquee']);

/* ── CSS 파서 — 주석 · 따옴표 안 괄호를 건너뛰고 { } 를 짝지어 규칙 나무를 만든다 ── */
function styleText(html){
  const out = []; const re = /<style[^>]*>([\s\S]*?)<\/style>/g; let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out.join('\n');
}
function parseCss(src){
  src = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  let i = 0;
  function block(){
    const nodes = []; let buf = '';
    while (i < src.length){
      const c = src[i];
      if (c === '"' || c === "'"){ const q = c; let j = i + 1; while (j < src.length && src[j] !== q){ if (src[j] === '\\') j++; j++; } buf += src.slice(i, j + 1); i = j + 1; continue; }
      if (c === '{'){ i++; const prelude = buf.trim(); buf = '';
        if (/^@(media|supports|layer|keyframes|-webkit-keyframes)/.test(prelude)) nodes.push({ prelude, children: block() });
        else nodes.push({ prelude, decls: body() });
        continue; }
      if (c === '}'){ i++; return nodes; }
      buf += c; i++;
    }
    return nodes;
  }
  function body(){
    let buf = '';
    while (i < src.length){
      const c = src[i];
      if (c === '"' || c === "'"){ const q = c; let j = i + 1; while (j < src.length && src[j] !== q){ if (src[j] === '\\') j++; j++; } buf += src.slice(i, j + 1); i = j + 1; continue; }
      if (c === '}'){ i++; return decls(buf); }
      buf += c; i++;
    }
    return decls(buf);
  }
  function decls(s){
    const out = []; let depth = 0, cur = '', q = null;
    for (const c of s){
      if (q){ cur += c; if (c === q) q = null; continue; }
      if (c === '"' || c === "'"){ q = c; cur += c; continue; }
      if (c === '(') depth++; if (c === ')') depth--;
      if (c === ';' && depth === 0){ out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map(d => { const k = d.indexOf(':'); return k < 0 ? null : { prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim() }; }).filter(d => d && d.prop);
  }
  return block();
}
/* 규칙을 평평하게 — 어느 @media 안인지 같이 */
function flatten(nodes, media, out){
  out = out || { rules: [], keyframes: {} };
  for (const n of nodes){
    if (n.children && /^@(-webkit-)?keyframes\s+/.test(n.prelude)){
      const name = n.prelude.replace(/^@(-webkit-)?keyframes\s+/, '').trim();
      out.keyframes[name] = (out.keyframes[name] || []).concat(n.children);
    } else if (n.children) flatten(n.children, n.prelude, out);
    else out.rules.push({ selectors: n.prelude.split(',').map(s => s.replace(/\s+/g, ' ').trim()), decls: n.decls, media: media || '' });
  }
  return out;
}
/* 쉼표를 괄호 밖에서만 나눈다(animation 여러 개 · var(--x, 9s)) */
function splitTop(v){ const out = []; let d = 0, cur = ''; for (const c of v){ if (c === '(') d++; if (c === ')') d--; if (c === ',' && d === 0){ out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map(s => s.trim()); }
/* animation · animation-name 에서 이름 — 정의된 @keyframes 이름과 맞는 낱말만 */
function animNames(decls, known){
  const names = [];
  for (const d of decls){
    if (d.prop !== 'animation' && d.prop !== 'animation-name') continue;
    for (const part of splitTop(d.value)) for (const tok of part.replace(/\([^)]*\)/g, ' ').split(/\s+/)) if (known.has(tok)) names.push(tok);
  }
  return names;
}
/* 좌석 라벨 뿌리 클래스 — overhead.js · exp-bar.js 가 실제로 만드는 seat-* 클래스(목록을 여기 박지 않는다) */
function labelRoots(...srcs){
  const s = new Set();
  for (const src of srcs){ const re = /className\s*=\s*'([^']*)'/g; let m; while ((m = re.exec(src))) m[1].split(/\s+/).filter(c => /^seat-/.test(c)).forEach(c => s.add(c)); }
  return s;
}
const hasRoot = (sel, roots) => [...roots].some(r => new RegExp('\\.' + r.replace(/-/g, '\\-') + '(?![\\w-])').test(sel));

function judge(html){
  const r = { bad: [], used: new Map(), noReduce: [], seatAnimSel: [] };
  const roots = labelRoots(OV, EXP);
  const css = flatten(parseCss(styleText(html)));
  const known = new Set(Object.keys(css.keyframes));
  const reduced = css.rules.filter(x => /prefers-reduced-motion\s*:\s*reduce/.test(x.media));
  for (const rule of css.rules){
    if (/prefers-reduced-motion/.test(rule.media)) continue;
    const names = animNames(rule.decls, known);
    if (!names.length) continue;
    for (const sel of rule.selectors.filter(s => hasRoot(s, roots))){
      r.seatAnimSel.push(sel);
      names.forEach(n => r.used.set(n, (r.used.get(n) || []).concat(sel)));
      const stopped = reduced.some(x => x.selectors.includes(sel) && x.decls.some(d => (d.prop === 'animation' || d.prop === 'animation-name') && /^none\b/.test(d.value)));
      if (!stopped && !REDUCED_MOTION_EXEMPT.has(sel)) r.noReduce.push(sel);
    }
  }
  for (const [name] of r.used) for (const fr of css.keyframes[name]) for (const d of fr.decls || [])
    if (!COMPOSITE_ONLY.has(d.prop) && d.prop !== 'animation-timing-function') r.bad.push(name + ' { ' + d.prop + ' }');
  r.css = css; r.roots = roots;
  return r;
}

say('── 1. 좌석 라벨이 쓰는 @keyframes 는 transform · opacity 만');
const J = judge(HTML);
chk(J.roots.has('seat-exp') && J.roots.has('seat-nameplate') && J.roots.size >= 3, '좌석 라벨 뿌리를 코드에서 읽었다 — ' + [...J.roots].join(' · '));
chk(J.used.size >= 3 && J.seatAnimSel.some(s => /\.exp-fill/.test(s)) && J.seatAnimSel.some(s => /\.np-star/.test(s)),
  '경험치 바 · 이름표 별의 애니메이션을 찾았다 — ' + [...J.used.keys()].join(' · '));
chk(!J.bad.length, '★ 칠하는 속성을 움직이는 키프레임 없음' + (J.bad.length ? ' — ' + J.bad.join(' · ') : ''));
chk(!J.noReduce.length, '★ 움직임 최소화(prefers-reduced-motion)에서 전부 멈춘다' + (J.noReduce.length ? ' — 빠짐: ' + J.noReduce.join(' · ') : ''));
chk(!J.used.has('mhLvFlow') && !J.used.has('npSweep'), '  옛 칠하는 흐름(mhLvFlow · npSweep)을 좌석 라벨이 안 쓴다');

say('── 2. 그림은 옛것과 같다');
const ruleOf = (sel) => J.css.rules.find(x => !x.media && x.selectors.includes(sel));
const decl = (sel, prop) => { const x = ruleOf(sel); const d = x && x.decls.filter(d => d.prop === prop).pop(); return d ? d.value : null; };
/* 아주 작은 길이 계산 — 'N%' · 'calc(A% / B)' · 'calc(-A% / B)' 만 */
const pct = (v) => { if (!v) return NaN; v = v.trim(); if (v === '0') return 0; let m = /^(-?[\d.]+)%$/.exec(v); if (m) return +m[1] / 100;
  m = /^calc\(\s*(-?[\d.]+)%\s*\/\s*([\d.]+)\s*\)$/.exec(v); if (m) return +m[1] / 100 / +m[2]; return NaN; };
const tx = (v) => { const m = /translateX\((.*)\)\s*$/.exec(v || ''); return m ? pct(m[1]) : (v === 'none' ? 0 : NaN); };
const kfEnds = (name) => { const fr = (J.css.keyframes[name] || []); const at = (k) => { const f = fr.find(f => f.prelude.split(',').map(s => s.trim()).includes(k)); const d = f && f.decls.find(d => d.prop === 'transform'); return d ? d.value : null; };
  return { from: at('from') || at('0%'), to: at('to') || at('100%'), fr }; };
{
  const S = '.seat-exp.lvx .exp-fill::before';
  const w = pct(decl(S, 'width')), bs = pct((decl(S, 'background-size') || '').replace(/\s+100%$/, ''));
  const k = kfEnds('seatLvFlow');
  const tile = w * bs, travel = -(tx(k.to) - tx(k.from)) * w;   // 채움 폭 W = 1 기준
  /* 옛 흐름: background-size 300% · background-position 0→300% → 무늬 칸 3W · 한 바퀴에 (W−3W)×3 = −6W */
  chk(Math.abs(tile - 3) < 1e-3, '★ 무늬 칸 = 채움 폭의 3배(옛 background-size 300% 와 같아 비스듬한 각도도 같다) — ' + tile.toFixed(4));
  chk(Math.abs(travel - 6) < 1e-3 && Math.abs(travel / tile - Math.round(travel / tile)) < 1e-3, '★ 한 바퀴에 6W 를 민다 — 옛 흐름과 같은 빠르기 · 칸의 정수배라 이음매가 안 튄다 — ' + travel.toFixed(4));
  chk(w - travel >= 1 - 1e-9, '  띠가 끝까지 밀려도 채움(W)을 다 덮는다 — 남는 폭 ' + (w - travel).toFixed(3));
  chk(/var\(--lv-speed,\s*9s\)/.test(decl(S, 'animation') || '') && /var\(--lv-bar\)/.test(decl(S, 'background') || ''), '  속도는 --lv-speed · 색은 --lv-bar 그대로(티어 토큰이 유일한 출처)');
  chk(/overflow:\s*hidden/.test((ruleOf('.seat-exp.lvx .exp-fill') || { decls: [] }).decls.map(d => d.prop + ':' + d.value).join(';')), '  채움이 띠를 자른다(overflow:hidden)');
}
{
  const win = pct(decl('.seat-nameplate .np-star .np-sw', 'width')), inW = pct(decl('.seat-nameplate .np-star .np-sw::before', 'width')) * win;
  const A = J.css.keyframes.npSweepWin || [], B = J.css.keyframes.npSweepIn || [];
  const offs = (fr) => fr.flatMap(f => f.prelude.split(',').map(s => s.trim()).map(o => [o, tx((f.decls.find(d => d.prop === 'transform') || {}).value)]));
  const oa = offs(A), ob = new Map(offs(B));
  const net = oa.map(([o, t]) => t * win + (ob.has(o) ? ob.get(o) * inW : NaN));
  chk(Math.abs(inW - 1) < 1e-3, '★ 빛 쓸기 안쪽 글자 폭 = 별 칸 폭 — ' + inW.toFixed(4));
  chk(oa.length >= 2 && oa.length === ob.size && net.every(n => Math.abs(n) < 2e-3), '★ 창과 안쪽 글자가 모든 키프레임에서 상쇄 — 글자는 제자리, 창만 지나간다 (' + net.map(n => n.toFixed(4)).join(' · ') + ')');
  const wa = oa.map(([, t]) => t * win);
  chk(Math.min(...wa) <= -win + 1e-6 && Math.max(...wa) >= 1 - 1e-6, '  창은 별 칸 왼쪽 밖에서 오른쪽 밖까지 — 쉬는 동안 글자 위에 안 남는다');
  const ra = decl('.seat-nameplate .np-star .np-sw', 'animation') || '', rb = decl('.seat-nameplate .np-star .np-sw::before', 'animation') || '';
  const durT = (s) => (/([\d.]+)s\b/.exec(s) || [])[1];
  chk(durT(ra) && durT(ra) === durT(rb) && /linear/.test(ra) && /linear/.test(rb), '  둘은 같은 길이 · 같은 linear — 박자가 어긋나지 않는다');
  chk(/attr\(data-s\)/.test(decl('.seat-nameplate .np-star::before', 'content') || '') && /attr\(data-s\)/.test(decl('.seat-nameplate .np-star .np-sw::before', 'content') || ''), '  겹 글자는 data-s 에서(글을 두 번 적지 않는다)');
  const glintF = decl('.seat-nameplate .np-star::before', 'filter') || '';
  chk(!/drop-shadow/.test(glintF), '  번쩍임 겹에는 빛(drop-shadow)이 없다 — 바깥 검은 윤곽이 그 빛에 걸려 옆 글자 위에 회색 안개가 낀다');
}

say('── 3. 별 겹 만들기(lv-tier.js npStarFill) — 가짜 DOM');
function fakeDoc(){
  const mk = (tag) => { const el = { tagName: tag, className: '', attrs: {}, children: [], _text: '',
    setAttribute(k, v){ this.attrs[k] = String(v); }, getAttribute(k){ return k in this.attrs ? this.attrs[k] : null; },
    appendChild(c){ this.children.push(c); return c; },
    get textContent(){ return this._text + this.children.map(c => c.textContent).join(''); },
    set textContent(v){ this._text = String(v); this.children = []; } }; return el; };
  return { createElement: mk };
}
let LV = null;
try{ const w = {}; new Function('window', 'document', 'module', LVT)(w, fakeDoc(), undefined); LV = w.TwLvTier.createLvTier({}); }catch(e){ say('  ! ' + e.message); }
chk(LV && typeof LV.npStarFill === 'function', 'npStarFill 을 내놓는다');
if (LV){
  const doc = fakeDoc(); const sp = doc.createElement('span');
  LV.npStarFill(sp, '☆★');
  const sw = sp.children[0];
  chk(sp.textContent === '☆★' && sp.getAttribute('data-s') === '☆★', '★ 글(textContent)은 별 문자열 그대로 · 번쩍임 글자는 data-s');
  chk(sp.children.length === 1 && sw && sw.getAttribute('data-s') === '☆★' && sw.getAttribute('aria-hidden') === 'true', '  빛 쓸기 창 하나 · 글자는 data-s · 읽기 도구엔 숨김');
  const cls = J.css.rules.some(x => x.selectors.some(s => s.includes('.' + sw.className + '::before')));
  chk(sw.className && cls, '  JS 가 붙인 클래스(' + sw.className + ')에 CSS 규칙이 있다');
  LV.npStarFill(sp, '★×13');
  chk(sp.children.length === 1 && sp.textContent === '★×13', '  다시 채워도 겹이 쌓이지 않는다(회차 · 색이 바뀔 때)');
  LV.npStarFill(sp, ''); LV.npStarFill(null, 'x');
  chk(sp.textContent === '' && sp.getAttribute('data-s') === '', '  경계: 빈 문자열 · 요소 없음에서 던지지 않는다');
}
chk(/npStarFill\(sp, focusLevelMod\(\)\.lvStarStr\(star\.cyc\)\)/.test(OV), '  좌석 이름표는 npStarFill 로 별을 채운다(겹을 다른 곳에서 만들지 않는다)');

say('── 4. 깨 보기');
const breakIt = (name, fn) => { const h = fn(HTML); const r = judge(h); return { r, changed: h !== HTML }; };
{
  const a = breakIt('bg', h => h.replace(/@keyframes seatLvFlow\{[^}]*\}[^}]*\}\s*\}/, '@keyframes seatLvFlow{ from{background-position:0% 50%;} to{background-position:300% 50%;} }'));
  chk(a.changed && a.r.bad.some(b => /seatLvFlow.*background-position/.test(b)), '★ 경험치 바 키프레임에 background-position 을 다시 넣으면 빨강');
  const b = breakIt('old', h => h.replace('animation:seatLvFlow var(--lv-speed,9s) linear infinite;', 'animation:mhLvFlow var(--lv-speed,9s) linear infinite;'));
  chk(b.changed && b.r.bad.some(x => /^mhLvFlow/.test(x)), '★ 바가 옛 배지 흐름(mhLvFlow)을 다시 쓰면 빨강');
  const c = breakIt('filter', h => h.replace('@keyframes npGlint{ 0%,78%,100%{ opacity:0; } 86%{ opacity:1; } }', '@keyframes npGlint{ 0%,78%,100%{ opacity:0; filter:brightness(1); } 86%{ opacity:1; filter:brightness(1.75); } }'));
  chk(c.changed && c.r.bad.some(x => /npGlint.*filter/.test(x)), '★ 별 번쩍임에 filter 를 움직이면 빨강');
  const d = breakIt('longhand', h => h.replace('</style>', '.seat-nameplate .np-star b{animation-name:donateShine;animation-duration:2s}</style>'));
  chk(d.changed && d.r.bad.some(x => /^donateShine/.test(x)), '  animation-name 낱말로 걸어도 잡는다(다른 곳 키프레임 · steps 여도)');
  const e = breakIt('reduce', h => h.replace('    .seat-nameplate .np-star .np-sw{ animation:none; display:none; }\n', ''));
  chk(e.changed && e.r.noReduce.includes('.seat-nameplate .np-star .np-sw'), '★ 움직임 최소화 줄을 빼면 빨강');
  const f = breakIt('left', h => h.replace('@keyframes npSpark{ 0%,72%,100%{ opacity:0;', '@keyframes npSpark{ 0%,72%,100%{ left:-5px; opacity:0;'));
  chk(f.changed && f.r.bad.some(x => /npSpark.*left/.test(x)), '  left(배치)를 움직여도 빨강');
  /* 경계 — 좌석 라벨이 아닌 곳(친구 목록 배지 .mh-flv)의 칠하는 흐름은 이 검사가 탓하지 않는다(과하게 잡지 않음) */
  chk(!J.used.has('mhLvShine') && (J.css.keyframes.mhLvFlow || []).length > 0, '  경계: 배지(.mh-flv) 전용 키프레임은 대상 밖 — 좌석 라벨 뿌리로만 고른다');
  const g = breakIt('root', h => h.replace('.mh-flv.lvx{ background-size:300% 100%;', '.mh-flv.lvx, .seat-announce .marquee b{ background-size:300% 100%;'));
  chk(g.changed && g.r.bad.some(x => /^mhLvFlow/.test(x)), '  같은 키프레임을 좌석 라벨 선택자가 같이 쓰기 시작하면 잡는다');
  /* 그림 판정도 깨 본다 — 안쪽 글자 반대 이동을 틀리게 하면 글자가 흔들린다 */
  const h2 = HTML.replace('@keyframes npSweepIn{ 0%{ transform:translateX(60%); }', '@keyframes npSweepIn{ 0%{ transform:translateX(50%); }');
  const css2 = flatten(parseCss(styleText(h2)));
  const v0 = tx(((css2.keyframes.npSweepIn || [])[0].decls.find(d => d.prop === 'transform') || {}).value);
  chk(h2 !== HTML && Math.abs(-1 * 0.6 + v0 * 1) > 2e-3, '  빛 쓸기 안쪽 이동을 틀리게 하면 상쇄가 깨진다(2절이 빨강이 될 값)');
}

say('');
say(fail ? `✗ 통과 ${pass} · 실패 ${fail}` : `✓ 전부 통과 (${pass})`);
process.exit(fail ? 1 : 0);
