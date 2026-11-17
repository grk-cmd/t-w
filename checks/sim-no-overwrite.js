/* ═══ 🛡 sim-no-overwrite.js — 읽기 실패 뒤 기본값으로 덮어쓰지 않기 (app.js 분리 F5 · shared/json-store.js 의 blocked) ═══
   자리 여섯(여덟 칸): 커미션 책상 · 아이템(commission.js) · 저장 파츠(premium-assets.js) · 북마크(bookmark.js) · 뽀모도로 설정(pomodoro.js) ·
   말랑 백업(mallang.js) · 바탕화면 모험(myhome-desktop.js). 플레이리스트 · 가챠는 이 묶음 밖(다른 결정 · 0.13 서버 판).
   ・1절: 자리마다 실제 읽기 · 쓰기 함수를 떼어 돌린다(나머지 이름은 가짜 값) — 읽기는 TwLsSet.lsLoadJson · 쓰기는 lsSaveJson / lsSetJson
     · 망가진 칸 하나에 안내(E-SYS-11)는 한 번 — 읽기에서든 막은 쓰기에서든
     · 부팅 중(토스트가 아직 없음) 읽기 실패가 뒤의 막은 쓰기 안내를 막지 않는다(진짜 error-codes 로)
     · 북마크 · 말랑 — 서버에서 실제로 받았을 때만 로컬은 사본(고쳐 씀). 서버가 비었음 · 못 읽음 · 아직 안 받음이면 로컬이 원본 — 막음 · 안내 한 번 · «이 기기에만» 안 뜸
     · 망가진 저장분 — 읽으면 기본값 · «못 불러옴» E-SYS-11 · 쓰면 망가진 글이 그대로(덮어쓰지 않음) · E-SYS-11
     · 없음 — 안내 없이 기본값 · 쓰면 남는다
     · 멀쩡한 저장분 — 그 값을 읽고 · 쓰면 바뀐다
   ・2절: 번호 표 · 문서
   ・3절: 일부러 깨 보기 — 쓰기를 옛 모양(그냥 setItem)으로 · 읽기를 옛 모양(빈 catch)으로 되돌리면 빨강 · json-store 의 막기를 빼면 빨강
   쓰기 쪽은 ls-set 의 JSON 칸(lsSaveJson · lsSetJson)이 막은 쓰기를 E-SYS-11 로 알린다.
   [실행] node checks/run.js sim-no-overwrite */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const PENDING = [];
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'app/parts/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = {
  js: read('shared/json-store.js'), ls: read('shared/ls-set.js'), codes: read('shared/error-codes.js'), doc: read('docs/ERROR_CODES.md') || read('ERROR_CODES.md'),
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
function env(stored, jsSrc, opts){
  const m = new Map(Object.entries(stored || {}));
  const ls = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
  const mod = { exports: {} }; new Function('window', 'module', jsSrc || SRC.js)(undefined, mod);
  const J = mod.exports, store = J.createJsonStore({ storage: () => ls });
  const notes = [], toasts = [];
  const vars = {
    localStorage: ls,
    TwJsonStore: Object.assign({}, J, { load: store.load, save: store.save }),
    TwErrorCodes: (opts && opts.notice) ? opts.notice(notes) : { notify: (c, e) => { notes.push(c); return true; } },
    toast: (t) => toasts.push(t),
  };
  /* 쓰기는 ls-set 의 JSON 칸(lsSaveJson · lsSetJson)을 거친다 — 같은 저장소 · 같은 json-store · 안내는 같은 notes 로 */
  vars.TwLsSet = vars.TwJsonStore && (() => { const w = { TwErrorCodes: vars.TwErrorCodes, TwJsonStore: vars.TwJsonStore }; new Function('window', 'localStorage', 'console', 'module', SRC.ls)(w, ls, { warn(){} }, undefined); return w.TwLsSet; })();
  const scope = new Proxy(vars, {
    has: (t, k) => typeof k === 'string' && !REAL.has(k),
    get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : ANY),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const run = (code) => new Function('__s', 'with(__s){ ' + code + ' }')(scope);
  return { m, ls, notes, toasts, vars, run };
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
  { name: '북마크', file: 'bookmark', key: 'tw.bookmarks', vars: { BM_KEY: 'tw.bookmarks', bmFromServer: false, bmClean: (o) => ({ order: Array.isArray(o.order) ? o.order : String(o.order || '').split(',').filter(Boolean), items: o.items || {}, ts: o.ts || 0 }) },
    fns: ['bmLoadLocal', 'bmLocalPayload', 'bmSaveLocal'], load: 'bmLoadLocal();', save: 'bmData = { order: ["n"], items: { n: {} }, ts: 2 }; bmSaveLocal();',
    got: (v) => v.bmData && v.bmData.order, good: { order: 'b1', items: { b1: {} }, ts: 1 } },
  { name: '뽀모도로 설정', file: 'pomodoro', key: 'tw.pomo', vars: { POMO_KEY: 'tw.pomo' },
    pre: '_pomoCfg = { preset: "25", f: 25 };', loadCut: '{ const r = TwLsSet.lsLoadJson(POMO_KEY', fns: ['_pomoSaveCfg'], save: '_pomoCfg = { preset: "50", f: 50 }; _pomoSaveCfg();',
    got: (v) => v._pomoCfg && v._pomoCfg.f, good: { preset: '25', f: 30 }, defVal: 25 },
  { name: '말랑 백업', file: 'mallang', key: 'tw.mallang.me', vars: { lsKey: () => 'tw.mallang.me', _mlFromServer: false },
    pre: 'raw = [];', loadCut: 'const r = TwLsSet.lsLoadJson(lsKey(), null', loadEnd: 'raw = r.list;', fns: ['saveLocal'], save: 'imgs = [{ url: "n" }]; saveLocal();',
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
    if(e.notes.join() !== (site.quiet ? '' : 'E-SYS-11')) bad.push('읽기 실패 안내가 ' + (site.quiet ? '없어야 함(서버가 원본)' : 'E-SYS-11 하나가 아님') + '(' + e.notes.join('|') + ')');
    e.run(c.def + '\n' + c.save);
    if(e.m.get(site.key) !== BROKEN) bad.push('★ 망가진 저장분을 덮어씀');
    e.run(c.def + '\n' + c.save);
    if(e.notes.filter(x => x === 'E-SYS-11').length !== 1) bad.push('망가진 칸 하나에 E-SYS-11 이 한 번이 아님(' + e.notes.join('|') + ')');
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

{
  /* 저장 공간이 차서 책상 · 아이템 두 칸이 다 못 남아도 한 저장에 안내는 하나(E-SYS-10 · 옛 토스트 없음) */
  const s = SITES.find(x => x.name === '커미션 책상'), c = code(s, SRC.commission);
  const e = env({}); Object.assign(e.vars, s.vars); e.run(c.def + '\n' + c.load);
  e.ls.setItem = () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); };
  e.run(c.def + '\n' + c.save); e.run(c.def + '\n' + c.save);
  chk(e.notes.join() === 'E-SYS-10' && !e.toasts.length, '커미션 — 공간이 차서 두 칸 다 못 남아도 안내는 E-SYS-10 하나(세션당 한 번) · 옛 토스트 없음' + (e.notes.length !== 1 ? ' — ' + e.notes.join('|') : ''));
  const p = SITES.find(x => x.name === '저장 파츠'), cp = code(p, SRC.premium);
  const f = env({}); Object.assign(f.vars, p.vars); f.run(cp.def + '\n' + cp.load);
  f.ls.setItem = () => { throw new Error('quota'); };
  f.run(cp.def + '\n' + cp.save);
  chk(f.notes.join() === 'E-SYS-10' && !f.toasts.length, '저장 파츠 — 못 남기면 E-SYS-10 · 옛 토스트 없음');
}


say('── 1-2. 부팅 중 · 여러 번 · 서버가 원본인 칸');
/* 진짜 error-codes 의 notice — 토스트를 바꿔 낄 수 있게(부팅 중엔 없다 = 던진다) */
function realNotice(st){
  return (notes) => {
    const m = { exports: {} }; new Function('window', 'module', SRC.codes)(undefined, m);
    const n = m.exports.createErrorNotice({ now: () => st.now, toast: (t) => { if(!st.ready) throw new ReferenceError('toast'); st.toasts.push(t); } });
    return { notify: (c, e) => { notes.push(c); return n.notify(c, e); } };
  };
}
{
  const st = { now: 1000, ready: false, toasts: [] };
  const s = SITES.find(x => x.name === '커미션 책상'), c = code(s, SRC.commission);
  const e = env({ [s.key]: BROKEN }, null, { notice: realNotice(st) }); Object.assign(e.vars, s.vars);
  const origWarn = console.warn; console.warn = () => {};
  try{
    e.run(c.def + '\n' + c.load);   // 토스트가 아직 없다(app.js 의 toastMod 앞)
    const before = st.toasts.length;
    st.ready = true; st.now += 3000;
    e.run(c.def + '\n' + c.save);
    chk(before === 0 && st.toasts.length === 1 && /E-SYS-11/.test(st.toasts[0]) && e.m.get(s.key) === BROKEN, '★ 부팅 중 읽기 실패(토스트 없음) → 3초 뒤 막은 쓰기에서 토스트 1개 · 망가진 글 그대로');
    e.run(c.def + '\n' + c.save); st.now += 20000; e.run(c.def + '\n' + c.save);
    chk(st.toasts.length === 1, '  그 뒤로는 조용(세션당 한 번)');
  } finally { console.warn = origWarn; }
}
/* 말랑 · 북마크 — 서버가 원본인 칸. 떼어 낸 글은 «function 이름(» 부터라 async 를 다시 붙인다 */
const asyncFns = (src, names, asyncs) => names.map(n => { const f = fnOf(src, n); return f && asyncs.includes(n) ? 'async ' + f : f; });
const scopeOf = (vars) => new Proxy(vars, { has: (t, k) => typeof k === 'string' && !REAL.has(k), get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : ANY), set: (t, k, v) => { t[k] = v; return true; } });
/* server: 'none'(연결 없음) · 'empty'(비었음) · 'got'(내 말랑이 있음) · 'throw'(읽기 던짐) — save: 서버 쓰기 성공 여부 */
function mallang(src, stored, server, saveOk){
  const fns = asyncFns(src, ['saveLocal', 'persist', 'warnIfUnsaved', 'loadImgsFor'], ['persist', 'loadImgsFor']);
  if(fns.some(f => !f)) return null;
  const e = env(stored);
  Object.assign(e.vars, { lsKey: () => 'tw.mallang.me', myId: () => 'me', _persistWarnAt: 0, _mlFromServer: false, imgs: [], fbReady: () => server !== 'none',
    firebaseAPI: { getMallangImgs: async () => { if(server === 'throw') throw new Error('net'); return server === 'got' ? [{ url: 's1' }] : []; }, saveMallangImgs: async () => ({ ok: !!saveOk }) } });
  e.go = (body) => new Function('__s', 'with(__s){ ' + fns.join('\n') + '\nreturn (async () => { ' + body + ' })(); }')(scopeOf(e.vars));
  return e;
}
/* server: 'none' · 'empty'(받기 ok · 데이터 없음) · 'got' · 'fail'(받기 · 쓰기 실패) */
function bookmark(src, stored, server){
  const fns = asyncFns(src, ['bmLoadLocal', 'bmLocalPayload', 'bmSaveLocal', 'bmPull', 'bmPush'], ['bmPull', 'bmPush']);
  if(fns.some(f => !f)) return null;
  const e = env(stored);
  const ok = server === 'empty' || server === 'got';
  Object.assign(e.vars, { BM_KEY: 'tw.bookmarks', bmLoaded: false, bmFromServer: false, bmRender: () => {}, toastOf: (t) => e.toasts.push(t), uid: () => 'me',
    bmClean: (o) => ({ order: Array.isArray(o.order) ? o.order : String(o.order || '').split(',').filter(Boolean), items: o.items || {}, ts: o.ts || 0 }),
    api: () => (server === 'none' ? null : { getBookmarks: async () => ({ ok, data: server === 'got' ? { order: 'b9', items: { b9: {} }, ts: 9 } : null }), saveBookmarks: async () => ({ ok }) }) });
  /* 함수 안의 let bmFromServer 는 떼어 낸 글에 없다 — 범위 값(vars)으로 */
  e.go = (body) => new Function('__s', 'with(__s){ ' + fns.join('\n') + '\nreturn (async () => { ' + body + ' })(); }')(scopeOf(e.vars));
  return e;
}
const ADD_ML = "await loadImgsFor('me'); imgs = imgs.concat([{ url: 'n' }]); warnIfUnsaved(await persist());";
const ADD_BM = "bmData = { order: bmData.order.concat(['n']), items: Object.assign({}, bmData.items, { n: {} }), ts: 1 }; await bmPush();";
/* 판정 — 망가진 백업이 그대로 · 안내 한 번 · «이 기기에만» 안 뜸 / 고쳐 씀 · 안내 없음(북마크는 서버를 보기 전 읽기에서 한 번) */
async function branches(mlSrc, bmSrc){
  const out = {};
  const keep = (e, key) => e.m.get(key) === BROKEN && e.notes.join() === 'E-SYS-11' && !e.toasts.length;
  let e = mallang(mlSrc, { 'tw.mallang.me': BROKEN }, 'none', false);   if(!e) return null;
  await e.go("await loadImgsFor('me'); await loadImgsFor('me'); imgs = [{ url: 'n' }]; warnIfUnsaved(await persist()); warnIfUnsaved(await persist());"); out.mlOffline = keep(e, 'tw.mallang.me');
  e = mallang(mlSrc, { 'tw.mallang.me': BROKEN }, 'empty', true);  await e.go(ADD_ML); out.mlEmpty = keep(e, 'tw.mallang.me');
  e = mallang(mlSrc, { 'tw.mallang.me': BROKEN }, 'throw', true);  await e.go(ADD_ML); out.mlThrow = keep(e, 'tw.mallang.me');
  e = mallang(mlSrc, { 'tw.mallang.me': BROKEN }, 'got', true);    await e.go(ADD_ML); out.mlGot = !e.notes.length && !e.toasts.length && /s1/.test(e.m.get('tw.mallang.me') || '') && /"n"/.test(e.m.get('tw.mallang.me') || '');
  e = mallang(mlSrc, {}, 'empty', false);                          await e.go(ADD_ML); out.mlLocalOnly = !e.notes.length && e.toasts.length === 1 && /이 기기에만/.test(e.toasts[0]);
  e = bookmark(bmSrc, { 'tw.bookmarks': BROKEN }, 'got');   if(!e) return null;
  await e.go('bmLoadLocal(); await bmPull(); ' + ADD_BM); out.bmGot = e.notes.join() === 'E-SYS-11' && !e.toasts.length && /b9/.test(e.m.get('tw.bookmarks') || '') && /"n"/.test(e.m.get('tw.bookmarks') || '');
  e = bookmark(bmSrc, { 'tw.bookmarks': BROKEN }, 'empty'); await e.go('bmLoadLocal(); await bmPull(); ' + ADD_BM); out.bmEmpty = keep(e, 'tw.bookmarks');
  e = bookmark(bmSrc, { 'tw.bookmarks': BROKEN }, 'fail');  await e.go('bmLoadLocal(); await bmPull(); ' + ADD_BM + ' ' + ADD_BM); out.bmFail = keep(e, 'tw.bookmarks');
  e = bookmark(bmSrc, { 'tw.bookmarks': BROKEN }, 'got');   await e.go('bmLoadLocal(); ' + ADD_BM); out.bmBeforePull = keep(e, 'tw.bookmarks');
  e = bookmark(bmSrc, {}, 'fail');                          await e.go('bmLoadLocal(); ' + ADD_BM); out.bmLocalOnly = !e.notes.length && e.toasts.length === 1 && /이 기기에만/.test(e.toasts[0]);
  return out;
}
PENDING.push((async () => {
  const origWarn = console.warn; console.warn = () => {};
  try{
    const r = await branches(SRC.mallang, SRC.bookmark);
    if(!r){ chk(false, '말랑 · 북마크 함수를 못 찾음'); return; }
    chk(r.mlOffline, '★ 말랑 — 서버 연결 없음 + 백업 망가짐: 두 번 열고 두 번 바꿔도 덮어쓰지 않음 · E-SYS-11 한 번 · «이 기기에만» 안 뜸');
    chk(r.mlEmpty, '★ 말랑 — 서버 비었음 + 백업 망가짐: 백업이 원본 — 서버 쓰기가 돼도 덮어쓰지 않음 · 안내 한 번');
    chk(r.mlThrow, '★ 말랑 — 서버 읽기 실패 + 백업 망가짐: 같음(«비었음» 과 «못 읽음» 모두 원본)');
    chk(r.mlGot, '★ 말랑 — 서버에서 받음 + 백업 망가짐: 백업은 사본 — 고쳐 씀 · 안내 없음');
    chk(r.mlLocalOnly, '  말랑 — 서버 쓰기 실패 + 백업 남음: «이 기기에만 저장했어요» 그대로');
    chk(r.bmGot, '★ 북마크 — 서버에서 받음 + 로컬 망가짐: 사본을 고쳐 씀(안내는 서버를 보기 전 읽기에서 한 번)');
    chk(r.bmEmpty, '★ 북마크 — 서버에 책장 없음 + 로컬 망가짐: 덮어쓰지 않음 · 안내 한 번');
    chk(r.bmFail, '★ 북마크 — 서버 실패 + 로컬 망가짐: 덮어쓰지 않음 · 안내 한 번 · «이 기기에만 남아 있어요» 안 뜸');
    chk(r.bmBeforePull, '★ 북마크 — 첫 받기 전에 바꿈 + 로컬 망가짐: 덮어쓰지 않음 · 안내 한 번');
    chk(r.bmLocalOnly, '  북마크 — 서버 실패 + 로컬 남음: «이 기기에만 남아 있어요» 그대로');
    /* 깨 보기 */
    const brk = (a, b, c) => { const t = a.replace(b, c); return t === a ? null : t; };
    const m1 = brk(SRC.mallang, "if(Array.isArray(s) && s.length){ raw = s; got = true; }", "raw = Array.isArray(s) ? s : []; got = true;");
    chk(!!m1 && (await branches(m1, SRC.bookmark)).mlEmpty === false, '  깨 보기 — «서버 비었음» 을 «받음» 으로 섞으면 빨강(망가진 백업을 덮어씀)');
    const m2 = brk(SRC.bookmark, "bmFromServer = true; ", "");
    chk(!!m2 && (await branches(SRC.mallang, m2)).bmGot === false, '  깨 보기 — 서버에서 받아도 사본으로 안 보면 빨강(못 고침)');
    const m3 = brk(SRC.bookmark, "  function bmSaveLocal(){ return TwLsSet.lsSaveCopy(BM_KEY, bmLocalPayload(), bmFromServer); }", "  function bmSaveLocal(){ return TwLsSet.lsSaveCopy(BM_KEY, bmLocalPayload(), true); }");
    chk(!!m3 && (await branches(SRC.mallang, m3)).bmBeforePull === false, '  깨 보기 — 받기 전에도 사본으로 보면 빨강(망가진 원본을 덮어씀)');
  }catch(err){ chk(false, '말랑 · 북마크 갈래를 못 돌림 — ' + err.message); }
  finally { console.warn = origWarn; }
})());

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
  const b1 = brk(SRC.premium, /  savedParts = TwLsSet\.lsLoadJson\(SAVED_PARTS_KEY, \[\]\)\.list;[^\n]*\n/, "  try{ savedParts=JSON.parse(localStorage.getItem(SAVED_PARTS_KEY)||'[]'); }catch(_){ savedParts=[]; }\n");
  chk(!!b1 && judge(site('저장 파츠'), b1).some(x => /읽기 실패 안내/.test(x)), '저장 파츠 읽기를 옛 모양(빈 catch)으로 되돌리면 빨강(«없음» 과 구분 못 함)');
  const b2 = brk(SRC.mallang, "TwLsSet.lsLoadJson(lsKey(), null)", "TwLsSet.lsLoadJson(lsKey(), null, { quiet: true })");
  chk(!!b2 && judge(site('말랑 백업'), b2).some(x => /읽기 실패 안내/.test(x)), '말랑 백업을 quiet 로 읽으면 빨강 — 서버에서 못 받았으면 백업이 원본이라 알려야 한다');
  const l1 = brk(SRC.ls, "if(_warned[code]) return;", '');
  chk(!!l1 && (() => { const s = site('커미션 책상'); const c = code(s, SRC.commission); const e = env({ [s.key]: BROKEN }); e.vars.TwLsSet = (() => { const w = { TwErrorCodes: e.vars.TwErrorCodes, TwJsonStore: e.vars.TwJsonStore }; new Function('window', 'localStorage', 'console', 'module', l1)(w, e.ls, { warn(){} }, undefined); return w.TwLsSet; })(); Object.assign(e.vars, s.vars); e.run(c.def + '\n' + c.load + '\n' + c.save); return e.notes.length > 1; })(), 'ls-set 의 «한 번» 을 빼면 빨강(읽기 + 쓰기 두 번)');
  const d1 = brk(SRC.desktop, /function advSave\(\)\{[^\n]*\}/, 'function advSave(){ try{ localStorage.setItem(ADV_KEY, JSON.stringify(ADV)); }catch(_){} }');
  chk(!!d1 && judge(site('바탕화면 모험'), d1).some(x => /덮어씀/.test(x)), '바탕화면 쓰기를 옛 모양으로 되돌리면 빨강');
  const js1 = brk(SRC.js, 'if(unreadable(key)){', 'if(false){');
  chk(!!js1 && (() => { const s = site('커미션 아이템'); const c = code(s, SRC.commission); const e = env({ [s.key]: BROKEN }, js1); Object.assign(e.vars, s.vars); e.run(c.def + '\n' + c.load + '\n' + c.save); return e.m.get(s.key) !== BROKEN; })(), 'json-store 의 막기(blocked)를 빼면 빨강 — 자리들이 그 한 곳에 기댄다');
}

Promise.all(PENDING).then(() => {
  say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass));
  process.exit(fail ? 1 : 0);
});
