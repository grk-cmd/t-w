/* 📄 sim-paging.js — 쪽 나누기 공용 규칙(shared/paging.js) — node checks/run.js paging
   ★ 왜 이 검사가 있는가 — 꾸미기 창 파츠 칸(wardrobe-paging.js)과 도감(gacha-album.js)이 쪽 수 · 쪽 번호 바로잡기를
     따로 한 벌씩 들고 있었다. 한 곳으로 모았으니 두 화면이 이 규칙 하나를 쓰는지 · 옛 두 벌과 같은 값을 내는지(도감 동작 무변경)를 본다.
   ・1절: 실제 호출 — 쪽 수(0개 · 딱 맞음 · 하나 넘침 · 음수) · 쪽 번호(없는 쪽 · NaN · undefined · null · 무한 · 음수 · 소수)
   ・2절: 옛 두 벌과 같은 값 — 실제로 들어오는 입력(정수 쪽 · 소수 · 이상한 값 × 칸 0~60 × 쪽 크기 12 · 16)
   ・3절: 배선 — html · smoke 가 두 모듈보다 먼저 싣는다 · 두 모듈이 TwPaging 을 받아 그대로 내놓는다 · 전역 이름
   ・4절: mutation test — 규칙 · 배선을 하나씩 깨면 빨강 */
'use strict';
const fs = require('fs');
const path = require('path');

const read = (f) => { try{ return fs.readFileSync(path.join(__dirname, f), 'utf8'); }catch(_){ return null; } };
const SRC = read('paging.js'), WD = read('wardrobe-paging.js'), GA = read('gacha-album.js');
const HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if(!SRC || !WD || !GA || !HTML || !SMOKE){ console.log('✗ paging.js · wardrobe-paging.js · gacha-album.js · desk-companion-prototype.html · smoke.js 를 못 찾음 — node checks/run.js paging 로 돌릴 것'); process.exit(2); }

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if(!ok) fail++; };
const load = (src) => { const m = { exports: {} }, win = {}; new Function('module', 'window', src)(m, win); return { api: m.exports, win }; };
const loadUser = (src, P) => { const m = { exports: {} }; new Function('module', 'window', 'TwPaging', src)(m, undefined, P); return m.exports; };

/* 옛 두 벌 — 합치기 전 글 그대로(비교 기준) */
const OLD = {
  wardrobe: {
    pageCount: (n, size) => Math.max(1, Math.ceil(Math.max(0, n | 0) / size)),
    clampPage(page, n, size){ const p = Number.isFinite(page) ? Math.floor(page) : 0; return Math.min(this.pageCount(n, size) - 1, Math.max(0, p)); },
  },
  gacha: {
    pageCount: (n, size) => Math.max(1, Math.ceil((n | 0) / size)),
    clampPage(page, n, size){ return Math.min(this.pageCount(n, size) - 1, Math.max(0, page | 0)); },
  },
};
const PAGES = [];
for(let i = -3; i <= 25; i++) PAGES.push(i);
PAGES.push(0.5, 1.7, 2.999, -0.5, -1.5, NaN, undefined, null, Infinity, -Infinity, -0);
const NS = [-1]; for(let i = 0; i <= 60; i++) NS.push(i);
const SIZES = [12, 16];

const CASES = [
  ['쪽 수 — 0개도 1 · 딱 맞으면 1 · 하나 넘치면 2 · 음수 칸도 1', (P) => P.pageCount(0, 16) === 1 && P.pageCount(16, 16) === 1 && P.pageCount(17, 16) === 2 && P.pageCount(-5, 16) === 1 && P.pageCount(40, 12) === 4],
  ['쪽 번호 — 없는 쪽이면 마지막 · 0개면 0', (P) => P.clampPage(4, 17, 16) === 1 && P.clampPage(9, 0, 16) === 0 && P.clampPage(1, 16, 16) === 0],
  ['쪽 번호 — 이상한 값(NaN · undefined · null · 무한)이면 0', (P) => [NaN, undefined, null, Infinity, -Infinity].every(v => P.clampPage(v, 40, 16) === 0)],
  ['쪽 번호 — 음수는 0 · 소수는 내림', (P) => P.clampPage(-2, 40, 16) === 0 && P.clampPage(-0.5, 40, 16) === 0 && P.clampPage(1.7, 40, 16) === 1 && P.clampPage(2.999, 40, 16) === 2],
  ['쪽 번호 — 있는 쪽은 그대로', (P) => P.clampPage(0, 40, 16) === 0 && P.clampPage(2, 40, 16) === 2],
];
const runAll = (P) => CASES.map(([name, ok]) => { let r = false; try{ r = !!ok(P); }catch(_){ r = false; } return [name, r]; });
/* 옛 벌과 다른 입력 수 — 0 이어야 한다 */
const diffWith = (P, old) => {
  let bad = 0;
  for(const size of SIZES) for(const n of NS){
    if(P.pageCount(n, size) !== old.pageCount(n, size)) bad++;
    for(const page of PAGES) if(P.clampPage(page, n, size) !== old.clampPage(page, n, size)) bad++;
  }
  return bad;
};

console.log('=== 1. 실제 호출 ===');
const L = load(SRC), P = L.api;
runAll(P).forEach(([name, ok]) => chk(ok, name));
chk(Object.keys(P).sort().join() === 'clampPage,pageCount', '내놓는 것은 pageCount · clampPage 둘');
chk(Object.keys(L.win).join() === 'TwPaging' && L.win.TwPaging === P, '싣기만 하면 window.TwPaging 하나 · module.exports 와 같은 것');

console.log('\n=== 2. 옛 두 벌과 같은 값 ===');
const total = SIZES.length * NS.length * (1 + PAGES.length);
const dW = diffWith(P, OLD.wardrobe), dG = diffWith(P, OLD.gacha);
chk(dW === 0, '꾸미기 창 옛 규칙과 ' + total + '개 입력에서 같다' + (dW ? ' — 다름 ' + dW : ''));
chk(dG === 0, '도감 옛 규칙과 ' + total + '개 입력에서 같다(도감 동작 무변경)' + (dG ? ' — 다름 ' + dG : ''));

console.log('\n=== 3. 배선 ===');
const wire = (html, smoke, wd, ga) => {
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const iS = order.indexOf('shared/paging.js'), iW = order.indexOf('character/wardrobe-paging.js'), iG = order.indexOf('character/gacha-album.js');
  const sS = smoke.indexOf("PRELOAD.push('paging.js')"), sW = smoke.indexOf("PRELOAD.push('wardrobe-paging.js')"), sG = smoke.indexOf("PRELOAD.push('gacha-album.js')");
  let same = false;
  try{ const W = loadUser(wd, P), G = loadUser(ga, P); same = W.pageCount === P.pageCount && W.clampPage === P.clampPage && G.pageCount === P.pageCount && G.clampPage === P.clampPage; }catch(_){ same = false; }
  const takes = (s) => /const paging = TwPaging;/.test(s) && !/function (pageCount|clampPage)\b/.test(s);
  return [
    [iS >= 0 && iW > iS && iG > iS, 'html — paging.js 를 wardrobe-paging.js · gacha-album.js 보다 먼저 싣는다'],
    [sS > 0 && sW > sS && sG > sS, 'smoke PRELOAD — 두 모듈보다 먼저'],
    [/window\.TwPaging = api;/.test(SRC_W) && /module\.exports = api;/.test(SRC_W), '전역 이름 TwPaging · module.exports'],
    [takes(wd) && takes(ga), '두 모듈이 TwPaging 을 받는다 — 쪽 수 · 쪽 번호 바로잡기를 다시 쓰지 않음'],
    [same, '두 모듈이 내놓는 pageCount · clampPage 는 공용 것 그대로(부르는 곳 gacha.js · wardrobe.js · sim 이 안 깨짐)'],
  ];
};
let SRC_W = SRC;
wire(HTML, SMOKE, WD, GA).forEach(([ok, msg]) => chk(ok, msg));

console.log('\n=== 4. mutation test ===');
const BREAKS = [
  ['0개면 0쪽', 'return Math.max(1, Math.ceil(', 'return Math.max(0, Math.ceil('],
  ['쪽 수를 내림으로(17개가 1쪽)', 'Math.ceil((n | 0) / size)', 'Math.floor((n | 0) / size)'],
  ['쪽 크기를 안 씀(한 칸이 한 쪽)', 'Math.ceil((n | 0) / size)', 'Math.ceil((n | 0) / 1)'],
  ['없는 쪽을 마지막으로 안 당김', 'return Math.min(pageCount(n, size) - 1, Math.max(0, p));', 'return Math.max(0, p);'],
  ['음수 쪽을 그대로', 'return Math.min(pageCount(n, size) - 1, Math.max(0, p));', 'return Math.min(pageCount(n, size) - 1, p);'],
  ['이상한 값을 그대로 씀', 'const p = Number.isFinite(page) ? Math.floor(page) : 0;', 'const p = page;'],
  ['소수를 반올림', 'Math.floor(page)', 'Math.round(page)'],
];
BREAKS.forEach(([name, from, to]) => {
  const broken = SRC.replace(from, to);
  if(broken === SRC){ chk(false, '  ' + name + ' — 바꿀 줄을 못 찾음(코드가 바뀌었다)'); return; }
  let caught; try{ const B = load(broken).api; caught = !runAll(B).every(([, ok]) => ok) || diffWith(B, OLD.wardrobe) > 0; }catch(_){ caught = true; }
  chk(caught, '  ' + name + ' → 빨강');
});
const WIRE_BREAKS = [
  ['html 줄 빠짐', { h: (h) => h.replace('<script src="parts/shared/paging.js"></script>', '') }],
  ['html 에서 gacha-album.js 뒤로', { h: (h) => h.replace('<script src="parts/shared/paging.js"></script>', '').replace('<script src="parts/character/gacha-album.js"></script>', '<script src="parts/character/gacha-album.js"></script><script src="parts/shared/paging.js"></script>') }],
  ['smoke PRELOAD 빠짐', { s: (s) => s.replace("PRELOAD.push('paging.js')", '') }],
  ['전역 이름 안 걺', { m: (m) => m.replace('window.TwPaging = api;', '') }],
  ['꾸미기 창이 쪽 수를 다시 씀', { wd: (w) => w.replace('const pageCount = paging.pageCount;', 'function pageCount(n, size){ return Math.max(1, Math.ceil(n / size)); }') }],
  ['도감이 쪽 번호 바로잡기를 다시 씀', { ga: (g) => g.replace('const clampPage = paging.clampPage;', 'function clampPage(page, n, size){ return Math.min(pageCount(n, size) - 1, Math.max(0, page | 0)); }') }],
  ['도감이 공용 것을 안 내놓음', { ga: (g) => g.replace('const clampPage = paging.clampPage;', 'const clampPage = (page, n, size) => paging.clampPage(page, n, size);') }],
];
WIRE_BREAKS.forEach(([name, f]) => {
  const h = f.h ? f.h(HTML) : HTML, s = f.s ? f.s(SMOKE) : SMOKE, wd = f.wd ? f.wd(WD) : WD, ga = f.ga ? f.ga(GA) : GA;
  SRC_W = f.m ? f.m(SRC) : SRC;
  const changed = h !== HTML || s !== SMOKE || wd !== WD || ga !== GA || SRC_W !== SRC;
  chk(changed && wire(h, s, wd, ga).some(([ok]) => !ok), '  ' + name + ' → 빨강' + (changed ? '' : ' — 바꿀 글을 못 찾음'));
});
SRC_W = SRC;

if(fail){ console.log('✗ 실패 ' + fail + '건'); process.exit(1); }
console.log('전부 통과 ✅');
