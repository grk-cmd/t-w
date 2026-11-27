/* 📄 sim-wardrobe-paging.js — 꾸미기 창 파츠 칸 페이지 · 이름 찾기(wardrobe-paging.js) — node checks/run.js wardrobe-paging
   ・1절: 칸 한 줄 — 묶음 순서 · [안 함] · 이름 찾기(대소문자 · 앞뒤 공백 · 빈 말 · 없는 말)
   ・2절: 페이지 — 0개 · 16개 · 17개 · 기억한 페이지 맞추기(줄어든 목록 · 이상한 값) · 묶음 머리는 걸친 묶음만 · 번호 줄
   ・3절: 배선 — html 이 wardrobe.js · app.js 보다 먼저 싣는다 · smoke PRELOAD · 전역 이름 · 쪽 규칙은 공용(shared/paging.js)을 그대로 내놓는다
   ・4절: mutation test — 규칙을 하나씩 깨면 1 · 2절이 빨강(쪽 수 · 쪽 번호 바로잡기 자체의 mutation 은 sim-paging.js) */

const fs = require('fs');
const path = require('path');

const read = (f) => { try{ return fs.readFileSync(path.join(__dirname, f), 'utf8'); }catch(_){ return null; } };
const SRC = read('wardrobe-paging.js');
const PAGING_SRC = read('paging.js');   // 📄 쪽 규칙 공용(shared/paging.js) — html 이 이 모듈보다 먼저 싣는다
const HTML = read('desk-companion-prototype.html');
const SMOKE = read('smoke.js');
if(!SRC || !PAGING_SRC || !HTML || !SMOKE){ console.log('✗ wardrobe-paging.js · paging.js · desk-companion-prototype.html · smoke.js 를 못 찾음 — node checks/run.js wardrobe-paging 로 돌릴 것'); process.exit(2); }

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if(!ok) fail++; };
const loadPlain = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const SHARED = loadPlain(PAGING_SRC);
const load = (src, shared) => { const m = { exports: {} }; new Function('module', 'window', 'TwPaging', src)(m, undefined, shared || SHARED); return m.exports; };

const parts = (n, pre) => Array.from({ length: n }, (_, i) => ({ id: (pre || 'p') + i, name: (pre || '파츠') + ' ' + i }));
const ids = (cells) => cells.map(c => c.kind === 'none' ? '안함' : c.rec.id);

/* 경우마다 [이름, 판정(api)] — mutation test 에서 같은 표를 다시 돈다 */
const CASES = [
  /* 1절 — 칸 한 줄 · 찾기 */
  ['기본 묶음 → [안 함] 이 맨 앞 · 다음 기본 파츠 · 끝에 커미션', (P) => {
    const c = P.buildCells({ defaultList: parts(2, 'd'), commissionList: parts(1, 'c'), withDefault: true, query: '' });
    return ids(c).join() === '안함,d0,d1,c0' && c[0].section === 'default' && c[3].section === 'commission';
  }],
  ['기본 묶음을 안 그리면(관리자 · 기본 파츠 없음) [안 함] 도 없다', (P) => ids(P.buildCells({ defaultList: [], commissionList: parts(1, 'c'), withDefault: false })).join() === 'c0'],
  ['찾기 — 대소문자 무시 · 앞뒤 공백 무시 · [안 함] 은 뺀다', (P) => {
    const list = [{ id: 'a', name: 'Star Hat' }, { id: 'b', name: '밀짚 모자' }, { id: 'c', name: 'starfish' }];
    return ids(P.buildCells({ defaultList: list, commissionList: [], withDefault: true, query: '  STAR ' })).join() === 'a,c';
  }],
  ['찾기 — 커미션 묶음에서도 거른다 · 이름이 없는 파츠는 안 걸린다', (P) => ids(P.buildCells({ defaultList: [{ id: 'x' }], commissionList: [{ id: 'k', name: '커미션 모자' }, { id: 'j', name: '안경' }], withDefault: true, query: '모자' })).join() === 'k'],
  ['빈 검색(공백만) → 원래대로(안 함 포함)', (P) => ids(P.buildCells({ defaultList: parts(2, 'd'), commissionList: [], withDefault: true, query: '   ' })).join() === '안함,d0,d1'],
  ['없는 검색 → 칸 0개', (P) => P.buildCells({ defaultList: parts(3, 'd'), commissionList: parts(2, 'c'), withDefault: true, query: '없는이름' }).length === 0],
  ['matchName — null 이름 · null 검색', (P) => P.matchName(null, null) === true && P.matchName(null, 'a') === false && P.matchName('ABC', 'b') === true],
  /* 2절 — 페이지 */
  ['0개 → 1페이지 · 칸 없음 · 번호 줄 없음', (P) => { const v = P.pageView([], 3, 16); return v.page === 0 && v.pages === 1 && v.groups.length === 0 && P.pagerItems(v.page, v.pages).length === 0; }],
  ['16개 → 1페이지에 다 · 번호 줄 없음', (P) => { const c = P.buildCells({ defaultList: parts(15, 'd'), commissionList: [], withDefault: true }); const v = P.pageView(c, 0, P.PAGE_SIZE); return c.length === 16 && v.pages === 1 && v.groups[0].cells.length === 16 && P.pagerItems(0, 1).length === 0; }],
  ['17개 → 2페이지 · 둘째 페이지는 마지막 한 칸', (P) => { const c = P.buildCells({ defaultList: parts(16, 'd'), commissionList: [], withDefault: true }); const v = P.pageView(c, 1, 16); return v.pages === 2 && v.page === 1 && ids(v.groups[0].cells).join() === 'd15' && P.pagerItems(1, 2).join() === '0,1'; }],
  ['줄어든 목록 → 기억한 페이지가 없으면 마지막 페이지', (P) => P.clampPage(4, 17, 16) === 1 && P.pageView(parts(5).map(r => ({ section: 'default', kind: 'part', rec: r })), 3, 16).page === 0],
  ['기억한 페이지가 이상한 값(NaN · 음수 · 소수) → 0 · 아래로 내림', (P) => P.clampPage(NaN, 40, 16) === 0 && P.clampPage(-2, 40, 16) === 0 && P.clampPage(1.7, 40, 16) === 1 && P.clampPage(undefined, 40, 16) === 0],
  ['묶음 머리 — 걸친 묶음만(1페이지 기본만 · 2페이지 기본 끝 + 커미션)', (P) => {
    const c = P.buildCells({ defaultList: parts(17, 'd'), commissionList: parts(3, 'c'), withDefault: true });   // 안 함 + 17 + 3 = 21
    const v0 = P.pageView(c, 0, 16), v1 = P.pageView(c, 1, 16);
    return v0.groups.map(g => g.section).join() === 'default' && v1.groups.map(g => g.section + ':' + g.cells.length).join() === 'default:2,commission:3';
  }],
  ['커미션만 남는 페이지에는 기본 머리가 없다', (P) => { const c = P.buildCells({ defaultList: parts(15, 'd'), commissionList: parts(4, 'c'), withDefault: true }); return P.pageView(c, 1, 16).groups.map(g => g.section).join() === 'commission'; }],
  ['번호 줄 — 7쪽까지는 전부 · 많으면 처음 · 끝 · 지금 앞뒤 + «…»(사이가 한 쪽뿐이면 그 번호)', (P) => P.pagerItems(2, 7).join() === '0,1,2,3,4,5,6' && P.pagerItems(5, 12).join() === '0,…,4,5,6,…,11' && P.pagerItems(0, 12).join() === '0,1,…,11' && P.pagerItems(2, 12).join() === '0,1,2,3,…,11' && P.pagerItems(3, 12).join() === '0,1,2,3,4,…,11'],
];
const runAll = (api) => CASES.map(([name, ok]) => { let r = false; try{ r = !!ok(api); }catch(_){ r = false; } return [name, r]; });

console.log('=== 1 · 2. 칸 한 줄 · 찾기 · 페이지 ===');
const api = load(SRC);
runAll(api).forEach(([name, ok]) => chk(ok, name));
chk(api.PAGE_SIZE === 16, 'PAGE_SIZE 16(4열 × 4줄)');

console.log('\n=== 3. 배선 ===');
const wire = (html, smoke, src) => {
  const iS = html.indexOf('<script src="parts/shared/paging.js"></script>');
  const iP = html.indexOf('<script src="parts/character/wardrobe-paging.js"></script>');
  const iW = html.indexOf('<script src="parts/character/wardrobe.js"></script>');
  const iA = html.indexOf('<script src="parts/app.js"></script>');
  const sP = smoke.indexOf("PRELOAD.push('wardrobe-paging.js')"), sW = smoke.indexOf("PRELOAD.push('wardrobe.js')");
  return [
    [iP > 0 && iW > iP && iA > iP, 'html — wardrobe-paging.js 를 wardrobe.js · app.js 보다 먼저 싣는다'],
    [sP > 0 && sW > sP, 'smoke PRELOAD — wardrobe.js 보다 먼저'],
    [/window\.TwWardrobePaging = api;/.test(src) && /module\.exports = api;/.test(src), '전역 이름 TwWardrobePaging · module.exports'],
    [iS > 0 && iS < iP && smoke.indexOf("PRELOAD.push('paging.js')") > 0 && smoke.indexOf("PRELOAD.push('paging.js')") < sP, 'html · smoke — 공용 쪽 규칙(paging.js)을 이 모듈보다 먼저 싣는다'],
    [/const paging = TwPaging;/.test(src) && !/function (pageCount|clampPage)\b/.test(src), '쪽 수 · 쪽 번호 바로잡기는 공용(TwPaging)을 받아 쓴다 — 여기서 다시 쓰지 않음'],
  ];
};
wire(HTML, SMOKE, SRC).forEach(([ok, msg]) => chk(ok, msg));

console.log('\n=== 4. mutation test ===');
const BREAKS = [
  ['[안 함] 을 찾는 중에도 넣음', "if(!q) cells.push({ section: 'default', kind: 'none' });", "cells.push({ section: 'default', kind: 'none' });"],
  ['대소문자를 안 무시', "return String(name == null ? '' : name).toLowerCase().includes(n);", "return String(name == null ? '' : name).includes(String(q).trim());"],
  ['앞뒤 공백을 안 뗌', "String(q == null ? '' : q).trim().toLowerCase()", "String(q == null ? '' : q).toLowerCase()"],
  ['커미션 묶음은 안 거름', "(o.commissionList || []).forEach(rec => { if(matchName(rec && rec.name, q)) cells.push", "(o.commissionList || []).forEach(rec => { if(true) cells.push"],
  /* 쪽 수 · 쪽 번호 바로잡기는 공용 — 공용(shared/paging.js)을 깨면 이 모듈의 1 · 2절도 빨강(공용을 정말 쓰는지) */
  ['공용 — 0개면 0페이지', 'return Math.max(1, Math.ceil(', 'return Math.max(0, Math.ceil(', 'shared'],
  ['공용 — 페이지 수를 내림으로(17개가 1페이지)', 'Math.ceil((n | 0) / size)', 'Math.floor((n | 0) / size)', 'shared'],
  ['공용 — 없는 페이지를 마지막으로 안 당김', 'return Math.min(pageCount(n, size) - 1, Math.max(0, p));', 'return Math.max(0, p);', 'shared'],
  ['공용 — 이상한 값을 그대로 씀', 'const p = Number.isFinite(page) ? Math.floor(page) : 0;', 'const p = page;', 'shared'],
  ['pageView 가 기억한 페이지를 안 맞춤', 'const p = clampPage(page, list.length, size);', 'const p = page | 0;'],
  ['묶음을 안 나눔(머리가 한 번만)', 'if(last && last.section === c.section) last.cells.push(c);', 'if(last) last.cells.push(c);'],
  ['한 쪽 사이도 «…»', 'if(gap === 2) all.push(v - 1);', 'if(gap === 2) all.push(\'…\');'],
  ['한 페이지여도 번호 줄', 'if(pages <= 1) return [];', ''],
];
BREAKS.forEach(([name, from, to, where]) => {
  const base = where === 'shared' ? PAGING_SRC : SRC;
  const broken = base.replace(from, to);
  if(broken === base){ chk(false, '  ' + name + ' — 바꿀 줄을 못 찾음(코드가 바뀌었다)'); return; }
  let allOk; try{ allOk = runAll(where === 'shared' ? load(SRC, loadPlain(broken)) : load(broken)).every(([, ok]) => ok); }catch(_){ allOk = false; }
  chk(!allOk, '  ' + name + ' → 빨강');
});
const WIRE_BREAKS = [
  ['html 줄 빠짐', (h) => h.replace('<script src="parts/character/wardrobe-paging.js"></script>', ''), null, null],
  ['html 에서 wardrobe.js 뒤로', (h) => h.replace('<script src="parts/character/wardrobe-paging.js"></script>', '').replace('<script src="parts/app.js"></script>', '<script src="parts/character/wardrobe-paging.js"></script><script src="parts/app.js"></script>'), null, null],
  ['smoke PRELOAD 빠짐', null, (s) => s.replace("PRELOAD.push('wardrobe-paging.js')", ''), null],
  ['전역 이름 안 걺', null, null, (m) => m.replace('window.TwWardrobePaging = api;', '')],
  ['html 에서 공용 쪽 규칙 빠짐', (h) => h.replace('<script src="parts/shared/paging.js"></script>', ''), null, null],
  ['smoke 에서 공용 쪽 규칙 빠짐', null, (s) => s.replace("PRELOAD.push('paging.js')", ''), null],
  ['쪽 수를 여기서 다시 씀', null, null, (m) => m.replace('const pageCount = paging.pageCount;', 'function pageCount(n, size){ return Math.max(1, Math.ceil(n / size)); }')],
];
WIRE_BREAKS.forEach(([name, fh, fs2, fm]) => {
  const h = fh ? fh(HTML) : HTML, s = fs2 ? fs2(SMOKE) : SMOKE, m = fm ? fm(SRC) : SRC;
  const changed = h !== HTML || s !== SMOKE || m !== SRC;
  chk(changed && wire(h, s, m).some(([ok]) => !ok), '  ' + name + ' → 빨강' + (changed ? '' : ' — 바꿀 글을 못 찾음'));
});

if(fail){ console.log('✗ 실패 ' + fail + '건'); process.exit(1); }
console.log('전부 통과 ✅');
