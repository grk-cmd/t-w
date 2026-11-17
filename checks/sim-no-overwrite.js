/* ═══ 🛡 sim-no-overwrite.js — 읽기 실패 뒤 기본값으로 덮어쓰지 않기 (app.js 분리 F5 · shared/json-store.js 의 blocked) ═══
   자리 여섯(여덟 칸): 커미션 책상 · 아이템(commission.js) · 저장 파츠(premium-assets.js) · 북마크(bookmark.js) · 뽀모도로 설정(pomodoro.js) ·
   말랑 백업(mallang.js) · 바탕화면 모험(myhome-desktop.js). 플레이리스트 · 가챠는 이 묶음 밖(다른 결정 · 0.13 서버 판).
   ・1절: 자리마다 실제 읽기 · 쓰기 함수를 떼어 돌린다(나머지 이름은 가짜 값)
     · 망가진 저장분 — 읽으면 기본값 · «못 불러옴» E-SYS-11 · 쓰면 망가진 글이 그대로(덮어쓰지 않음) · E-SYS-11
     · 없음 — 안내 없이 기본값 · 쓰면 남는다
     · 멀쩡한 저장분 — 그 값을 읽고 · 쓰면 바뀐다
   ・2절: 번호 표 · 문서
   ・3절: 일부러 깨 보기 — 쓰기를 옛 모양(그냥 setItem)으로 · 읽기를 옛 모양(빈 catch)으로 되돌리면 빨강
   [실행] node checks/run.js sim-no-overwrite */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'app/parts/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = {
  js: read('shared/json-store.js'), codes: read('shared/error-codes.js'), doc: read('docs/ERROR_CODES.md') || read('ERROR_CODES.md'),
  commission: read('character/commission.js'), premium: read('character/premium-assets.js'), bookmark: read('myhome/bookmark.js'),
  pomodoro: read('focus/pomodoro.js'), mallang: read('myhome/mallang.js'), desktop: read('myhome/myhome-desktop.js'),
};
for(const k of Object.keys(SRC)) if(SRC[k] == null){ say('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const BROKEN = '{망가진';

/* 괄호 짝까지 — «표지» 다음 첫 { 부터 짝이 맞는 } 까지(표지 포함) */
function cut(src, marker){
  const i = src.indexOf(marker);
  if(i < 0) return null;
  let j = src.indexOf('{', i), d = 0;
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}' && --d === 0) break; }
  return src.slice(i, j + 1);
}
const fnOf = (src, name) => cut(src, 'function ' + name + '(');
/* 아무 이름이나 받아 주는 가짜 값 */
const ANY = new Proxy(function(){}, {
  get(t, k){ if(k === Symbol.toPrimitive) return (h) => (h === 'number' ? 0 : ''); if(k === Symbol.iterator) return function*(){}; if(k === 'then' || k === Symbol.unscopables) return undefined; if(k === 'length') return 0; return ANY; },
  apply(){ return ANY; },
});
const REAL = new Set(['JSON', 'String', 'Number', 'Math', 'Array', 'Object', 'Set', 'Map', 'Date', 'parseInt', 'isFinite', 'undefined', 'NaN', 'Infinity', 'Error', 'Symbol', 'console']);
function env(stored, jsSrc){
  const m = new Map(Object.entries(stored || {}));
  const ls = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
  const mod = { exports: {} }; new Function('window', 'module', jsSrc || SRC.js)(undefined, mod);
  const J = mod.exports, store = J.createJsonStore({ storage: () => ls });
  const notes = [], toasts = [];
  const vars = {
    localStorage: ls,
    TwJsonStore: Object.assign({}, J, { load: store.load, save: store.save }),
    TwErrorCodes: { notify: (c, e) => { notes.push(c); return true; } },
    toast: (t) => toasts.push(t),
  };
  const scope = new Proxy(vars, {
    has: (t, k) => typeof k === 'string' && !REAL.has(k),
    get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : ANY),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const run = (code) => new Function('__s', 'with(__s){ ' + code + ' }')(scope);
  return { m, notes, toasts, vars, run };
}
/* 자리 — key: 저장 키 · def: 읽은 기본값 판정 · good: 멀쩡한 저장분 · load / save: 돌릴 글 · got(): 읽은 값 · change(): 쓰기 전에 바꿀 것 */
const SITES = [
  { name: '커미션 책상', file: 'commission', key: 'tw.savedDesks', vars: { SAVED_DESK_KEY: 'tw.savedDesks', SAVED_ITEM_KEY: 'tw.savedItems' },
    fns: ['catalogBacked', 'loadSavedAssets', 'persistSavedAssets'], load: 'loadSavedAssets();', save: 'savedDesks = [{ id: "n" }]; persistSavedAssets();',
    got: (v) => v.savedDesks, good: [{ id: 'd1' }] },
  { name: '커미션 아이템', file: 'commission', key: 'tw.savedItems', vars: { SAVED_DESK_KEY: 'tw.savedDesks', SAVED_ITEM_KEY: 'tw.savedItems' },
    fns: ['catalogBacked', 'loadSavedAssets', 'persistSavedAssets'], load: 'loadSavedAssets();', save: 'savedItems = [{ id: "n" }]; persistSavedAssets();',
    got: (v) => v.savedItems, good: [{ id: 'i1' }] },
  { name: '저장 파츠', file: 'premium', key: 'tw.savedParts', vars: { SAVED_PARTS_KEY: 'tw.savedParts' },
    fns: ['_normPartRec', 'loadSavedParts', 'persistSavedParts'], load: 'loadSavedParts();', save: 'savedParts = [{ id: "n", cat: "hat" }]; persistSavedParts();',
    got: (v) => v.savedParts, good: [{ id: 'p1', cat: 'hat' }] },
  { name: '북마크', file: 'bookmark', key: 'tw.bookmarks', vars: { BM_KEY: 'tw.bookmarks', bmClean: (o) => ({ order: Array.isArray(o.order) ? o.order : String(o.order || '').split(',').filter(Boolean), items: o.items || {}, ts: o.ts || 0 }) },
    fns: ['bmLoadLocal', 'bmSaveLocal'], load: 'bmLoadLocal();', save: 'bmData = { order: ["n"], items: { n: {} }, ts: 2 }; bmSaveLocal();',
    got: (v) => v.bmData && v.bmData.order, good: { order: 'b1', items: { b1: {} }, ts: 1 } },
  { name: '뽀모도로 설정', file: 'pomodoro', key: 'tw.pomo', vars: { POMO_KEY: 'tw.pomo' },
    pre: '_pomoCfg = { preset: "25", f: 25 };', loadCut: '{ const r = TwJsonStore.load(POMO_KEY', fns: ['_pomoSaveCfg'], save: '_pomoCfg = { preset: "50", f: 50 }; _pomoSaveCfg();',
    got: (v) => v._pomoCfg && v._pomoCfg.f, good: { preset: '25', f: 30 }, defVal: 25 },
  { name: '말랑 백업', file: 'mallang', key: 'tw.mallang.me', vars: { lsKey: () => 'tw.mallang.me' },
    pre: 'raw = [];', loadCut: 'const r = TwJsonStore.load(lsKey(), null);', loadEnd: 'raw = r.list;', fns: ['saveLocal'], save: 'imgs = [{ url: "n" }]; saveLocal();',
    got: (v) => v.raw, good: [{ url: 'm1' }] },
  { name: '바탕화면 모험', file: 'desktop', key: 'tw.advZ.v2', vars: { ADV_KEY: 'tw.advZ.v2', ADV_KEY_V1: 'tw.advZ', blankSlot: () => ({ alloc: {}, bonus: {} }) },
    fns: ['advLoad', 'advSave'], load: 'ADV = advLoad();', save: 'ADV = { slots: [{ face: "n" }], bg: "new" }; advSave();',
    got: (v) => v.ADV && v.ADV.bg, good: { slots: [{}, {}, {}], bg: 'g1' }, defVal: null },
];
function code(site, src){
  const fns = site.fns.map(n => fnOf(src, n));
  if(fns.some(f => !f)) return null;
  let load = site.load;
  if(site.loadCut){
    if(site.loadEnd){ const i = src.indexOf(site.loadCut), j = src.indexOf(site.loadEnd, i); if(i < 0 || j < 0) return null; load = src.slice(i, j + site.loadEnd.length); }
    else { load = cut(src, site.loadCut); if(!load) return null; }
  }
  return { def: fns.join('\n'), load: (site.pre || '') + load, save: site.save };
}
/* 한 자리를 세 갈래로 돌려 어긋난 것을 돌려준다 */
function judge(site, src){
  const c = code(site, src);
  if(!c) return ['원본에서 함수를 못 찾음'];
  const bad = [];
  const go = (stored) => { const e = env(stored); Object.assign(e.vars, site.vars); e.run(c.def + '\n' + c.load); return e; };
  try{
    /* 망가진 저장분 */
    let e = go({ [site.key]: BROKEN });
    const v = site.got(e.vars);
    const isDef = ('defVal' in site) ? v === site.defVal : (Array.isArray(v) ? v.length === 0 : !v);
    if(!isDef) bad.push('망가진 저장분을 기본값으로 읽지 않음');
    if(e.notes.join() !== 'E-SYS-11') bad.push('읽기 실패 안내가 E-SYS-11 하나가 아님(' + e.notes.join('|') + ')');
    e.run(c.def + '\n' + c.save);
    if(e.m.get(site.key) !== BROKEN) bad.push('★ 망가진 저장분을 덮어씀');
    if(e.notes.filter(x => x === 'E-SYS-11').length !== 2) bad.push('막은 쓰기에 E-SYS-11 이 없음');
    /* 없음 */
    e = go({});
    if(e.notes.length) bad.push('없음인데 안내(' + e.notes.join('|') + ')');
    e.run(c.def + '\n' + c.save);
    if(e.m.get(site.key) == null || e.notes.length) bad.push('없음 → 쓰기가 안 남거나 안내가 뜸');
    /* 멀쩡한 저장분 */
    e = go({ [site.key]: JSON.stringify(site.good) });
    const g = site.got(e.vars);
    if(g == null || (Array.isArray(g) && !g.length) || e.notes.length) bad.push('멀쩡한 저장분을 못 읽음');
    const before = e.m.get(site.key);
    e.run(c.def + '\n' + c.save);
    if(e.m.get(site.key) === before || e.notes.length) bad.push('멀쩡한 저장분 위에 못 씀');
  }catch(err){ bad.push('던짐 ' + err.message); }
  return bad;
}

say('── 1. 자리마다');
for(const s of SITES){
  const bad = judge(s, SRC[s.file]);
  chk(!bad.length, s.name + '(' + s.key + ') — 망가지면 기본값 · E-SYS-11 · 덮어쓰지 않음 / 없으면 조용히 기본값 · 씀 / 멀쩡하면 읽고 씀' + (bad.length ? ' — ' + bad.join(' · ') : ''));
}

say('── 2. 번호');
{
  const m = { exports: {} }; new Function('window', 'module', SRC.codes)(undefined, m);
  const E = m.exports;
  chk(!!E.CODES['E-SYS-11'] && /읽지 못해 덮어쓰지 않았어요/.test(E.CODES['E-SYS-11'].msg), 'E-SYS-11 이 표에 있다 — «읽지 못해 덮어쓰지 않았어요»');
  chk(SRC.doc.indexOf('E-SYS-11') >= 0, '문서(docs/ERROR_CODES.md)에 있다');
}

say('── 3. 일부러 깨 보기');
{
  const brk = (s, a, b) => { const r = s.replace(a, b); return r === s ? null : r; };
  const site = (n) => SITES.find(s => s.name === n);
  const p1 = brk(SRC.pomodoro, /function _pomoSaveCfg\(\)\{[^\n]*\}/, 'function _pomoSaveCfg(){ try{ localStorage.setItem(POMO_KEY, JSON.stringify(_pomoCfg)); }catch(_){} }');
  chk(!!p1 && judge(site('뽀모도로 설정'), p1).some(x => /덮어씀/.test(x)), '뽀모도로 쓰기를 옛 모양으로 되돌리면 빨강(덮어씀)');
  const b1 = brk(SRC.bookmark, /    const r = TwJsonStore\.load\(BM_KEY, \{\}\);[^\n]*\n    bmData = bmClean\(r\.list\);\n    if\(!r\.ok\)[^\n]*\n/, "    try{ bmData = bmClean(JSON.parse(localStorage.getItem(BM_KEY) || '{}')); }catch(_){ bmData = { order:[], items:{}, ts:0 }; }\n");
  chk(!!b1 && judge(site('북마크'), b1).some(x => /읽기 실패 안내/.test(x)), '북마크 읽기를 옛 모양(빈 catch)으로 되돌리면 빨강(«없음» 과 구분 못 함)');
  const d1 = brk(SRC.desktop, /function advSave\(\)\{[^\n]*\}/, 'function advSave(){ try{ localStorage.setItem(ADV_KEY, JSON.stringify(ADV)); }catch(_){} }');
  chk(!!d1 && judge(site('바탕화면 모험'), d1).some(x => /덮어씀/.test(x)), '바탕화면 쓰기를 옛 모양으로 되돌리면 빨강');
  const js1 = brk(SRC.js, 'if(unreadable(key)){', 'if(false){');
  chk(!!js1 && (() => { const s = site('커미션 아이템'); const c = code(s, SRC.commission); const e = env({ [s.key]: BROKEN }, js1); Object.assign(e.vars, s.vars); e.run(c.def + '\n' + c.load + '\n' + c.save); return e.m.get(s.key) !== BROKEN; })(), 'json-store 의 막기(blocked)를 빼면 빨강 — 자리들이 그 한 곳에 기댄다');
}

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass));
process.exit(fail ? 1 : 0);
