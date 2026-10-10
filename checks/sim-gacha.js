/* ═══ 🎰 sim-gacha.js — 파츠 가챠 모듈 (2026-10-10 신설 · 앱 FSD 8번) ═══════════════
   app.js 의 두 구역(«🎰 파츠 가챠 — 코어» · «🎰 파츠 보관함 (T키) · 가챠 뽑기 창»)을 parts/gacha.js 로 옮겼다.
   동작은 그대로여야 한다 — 여기서는 «옮긴 것» 을 가짜 DOM · 가짜 서버 위에서 통째로 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwGacha 뿐 · 만들면 로컬 보유분 · 보너스 읽기 · 시각 부트스트랩 · 부팅 4.2초 · 10분 tick ·
           창 버튼 · ESC · 바깥 클릭 · blur 연결 · window 고리 셋 · 창 위치 초기화 목록 · DOM 없으면 조용히
   ・2절: 셈 — 보유 · 색상 해금(관리자 통과 · 색 없는 파츠 1개) · 풀(다 모은 것 · 다른 시즌 빠짐) · 남은 뽑기(레벨/5 + 👑 보너스) · 보너스 저장
   ・3절: 뽑기 — 결과(NEW · 색상 해금) · 티켓이 모자라면 멈춤 · 시각은 서버 시계 · 저장 · 동기화 부름
   ・4절: 서버 동기화 — 서버가 새것(받음) · 내 것이 새것(올림) · 같고 서버 빔(올림) · pull · 미래 ts(합침) · 읽기 실패(아무것도 안 함 ·
           회수 안 함) · 쓰기 거부(안내) · 진행 중 요청은 끝나고 한 번 더 · 미보유 파츠 회수 · 로그아웃 메모리 지우기
   ・5절: 보관함 — 정보줄(👑 보너스) · 탭 · 카테고리 · 시즌 · 8칸 페이지 · 잠긴 칸 · 누르면 착용 · 관리자 삭제(confirm 뒤 focus) · 열기 · 닫기
   ・6절: 뽑기 창 — 연출(잠금 → 결과 → 풀림) · 남은 뽑기 없음 · 뽑기 실패(오류) 안내
   ・7절: app.js 배선 — 정의는 모듈에만 · 만드는 곳 한 곳 · 원래 자리 · deps 모양 · 저장 키 세 줄은 app.js · 부르는 곳은 gachaMod.이름 ·
           빈 껍데기 · html 순서 · 전역 이름
   [실행] gacha.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['gacha.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = SRC['app.js'], HTML = SRC['desk-companion-prototype.html'], MOD = SRC['gacha.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* DOM 칸 — classList · style · 이벤트 · 자식은 진짜 */
function mkEl(tag, id){
  const cls = new Set(), L = {};
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', style: { setProperty(k, v){ this[k] = v; } }, dataset: {}, title: '', disabled: false, onclick: null,
    children: [], parentElement: null, _text: '', _html: '', options: [], value: '', _q: {},
    get textContent(){ return this._text + this.children.map(c => c.textContent).join(''); },
    set textContent(v){ this._text = String(v); this.children = []; },
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); this.children = []; this._text = ''; this._q = {}; },
    get className(){ return [...cls].join(' '); },
    set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); },
    classList: { add: (...a) => a.forEach(c => { if(/\s/.test(c)) throw new Error('InvalidCharacterError'); cls.add(c); }), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c),
      toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
    appendChild(c){ c.parentElement = el; el.children.push(c); if(c.tagName === 'OPTION') el.options.push(c); return c; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); }, _L: L,
    fire(t, ev){ (L[t] || []).forEach(fn => fn(Object.assign({ preventDefault(){}, stopPropagation(){}, target: el, pointerId: 1 }, ev || {}))); },
    click(){ if(el.onclick) return el.onclick({ stopPropagation(){}, preventDefault(){} }); },
    setPointerCapture(){}, releasePointerCapture(){}, scrollIntoView(){},
    getBoundingClientRect: () => ({ left: 300, top: 100, right: 660, bottom: 500, width: 360, height: 400 }),
    closest: () => null,
    querySelector(sel){
      const c = sel.replace(/^\./, '');
      if(!el._html.includes(c)) return null;
      return el._q[sel] || (el._q[sel] = mkEl('div'));
    },
    querySelectorAll: () => el._all || [],
    get offsetWidth(){ return 360; }, get offsetHeight(){ return 400; },
  };
  return el;
}
const cells = (grid) => grid.children.filter(c => /\bgc-cell\b/.test(c.className) && !/gc-hole/.test(c.className));

const SPRING = Date.UTC(2026, 3, 15, 3);   // 4월 = 🌸 봄
function mkEnv(opt){
  opt = opt || {};
  const env = {
    toasts: [], timers: [], intervals: [], raf: 0, docL: {}, winL: {}, focus: 0, confirmAns: true,
    ls: new Map(Object.entries(opt.ls || {})), now: opt.now || SPRING, srvNow: opt.srvNow || null,
    level: opt.level || 1, uid: opt.uid === null ? null : 'u1', admin: !!opt.admin,
    saved: opt.saved || [], cats: opt.cats || [{ cat:'hat', label:'모자', icon:'🎩' }, { cat:'glasses', label:'안경', icon:'👓' }],
    draft: null, adj: null, equips: [], commits: 0, denied: [], deleted: [], regs: [], prunedDef: [], saves: 0, colorRefresh: 0,
    seats: [], slots: [], srv: opt.srv === undefined ? { owned: {}, ts: 0 } : opt.srv, srvDelay: 0, pushes: [], pushOk: true,
    rand: [0], randI: 0,
  };
  const els = {};
  const byId = id => (opt.noDom ? null : (els[id] || (els[id] = mkEl(/^gacha(Draw1|Draw5|BackInv|GoDraw|AdminAdd)$/.test(id) ? 'button' : 'div', id))));
  const tabs = ['all', 'always', 'season'].map(t => { const b = mkEl('button'); b.dataset.gtab = t; return b; });
  if(!opt.noDom){ byId('gachaInvOverlay')._all = tabs; byId('gachaInvOverlay').style.display = 'none'; byId('gachaDrawOverlay').style.display = 'none'; }
  class FakeDate extends Date { constructor(...a){ if(a.length) super(...a); else super(env.now); } static now(){ return env.now; } }
  const fakeMath = Object.create(Math); fakeMath.random = () => env.rand[(env.randI++) % env.rand.length];
  const ctx = {
    Math: fakeMath, JSON, String, Number, Array, Object, Boolean, parseInt, Error, Promise, Date: FakeDate,
    console: { warn(){}, log(){} },
    localStorage: { getItem: k => env.ls.has(k) ? env.ls.get(k) : null, setItem: (k, v) => env.ls.set(k, String(v)), removeItem: k => env.ls.delete(k) },
    document: {
      getElementById: byId,
      createElement: (t) => mkEl(t),
      addEventListener: (t, fn) => { (env.docL[t] = env.docL[t] || []).push(fn); },
      querySelector: () => null,
    },
    setTimeout: (fn, ms) => { env.timers.push({ fn, ms }); return env.timers.length; },
    setInterval: (fn, ms) => { env.intervals.push({ fn, ms }); return env.intervals.length; },
    requestAnimationFrame: (fn) => { env.raf++; },
    confirm: () => env.confirmAns,
    innerWidth: 1600, innerHeight: 900,
  };
  ctx.window = ctx;
  ctx.focus = () => { env.focus++; };
  ctx.addEventListener = (t, fn) => { (env.winL[t] = env.winL[t] || []).push(fn); };
  ctx.firebaseAPI = opt.noApi ? undefined : {
    loadGachaOwned: async () => { env.loads = (env.loads || 0) + 1; if(env.srvDelay) await new Promise(r => setTimeout(r, env.srvDelay)); return env.srv === null ? null : JSON.parse(JSON.stringify(env.srv)); },
    saveGachaOwned: async (uid, owned, ts) => { env.pushes.push({ uid, owned: JSON.parse(JSON.stringify(owned)), ts }); if(env.pushOk) env.srv = { owned: JSON.parse(JSON.stringify(owned)), ts }; return env.pushOk; },
  };
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx, { filename: 'gacha.js' });
  env.ctx = ctx; env.els = els; env.tabs = tabs;
  env.mk = () => ctx.TwGacha.createGacha({
    toast: (m) => env.toasts.push(m),
    srvNow: () => { if(env.srvThrows) throw new Error('시계 깨짐'); return env.srvNow || env.now; },
    warnServerWriteDenied: (w) => env.denied.push(w),
    getMyUserId: () => env.uid,
    getFocusLevel: () => env.level,
    catEquippedIds: (def, cat) => { const v = def.equippedParts[cat]; return (Array.isArray(v) ? v : [v]).filter(Boolean).map(e => e.id); },
    removeEntryFromCat: (def, cat, id) => { const v = def.equippedParts[cat]; const a = (Array.isArray(v) ? v : [v]).filter(e => e && e.id !== id); if(a.length) def.equippedParts[cat] = a; else delete def.equippedParts[cat]; env.prunedDef.push(id); },
    unequipStackablePart: (s, cat, id) => { delete s.stackedPartObjs[cat][id]; },
    unequipPartFromSeat: (s, cat) => { s.unequipped = (s.unequipped || []).concat(cat); },
    applyClothVisibility: () => {},
    saveSlots: () => { env.saves++; },
    findMySeat: () => env.seats[0] || null,
    escHtml: (s) => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'),
    openPartRegister: (cat, rec) => env.regs.push({ cat, rec }),
    syncPartRegGachaLock: () => {},
    toggleEquip: async (cat, id) => { env.equips.push(cat + ':' + id); },
    createWardrobeAdjPanel: (cat, id) => { const p = mkEl('div'); p.className = 'adj'; p.dataset.id = id; return p; },
    deletePart: (id) => { env.deleted.push(id); env.saved = env.saved.filter(p => p.id !== id); },
    clearMultiPanelRef: () => {},
    refreshWdPreviewColorSection: () => { env.colorRefresh++; },
    updateWdGizmoForActivePanel: () => {},
    commitWdDraft: () => { env.commits++; },
    syncWdPreviewOwner: () => {},
    wdPreviewSavedPos: () => null,
    placeWdPreview: (x, y) => { env.placed = { x, y }; },
    clampWdPreviewIntoView: () => {},
    refreshWdPreviewChar: () => {},
    detachWdGizmo: () => {},
    isAdmin: () => env.admin,
    savedParts: () => env.saved,
    partCats: () => env.cats,
    wdDraftDef: () => env.draft,
    activeWdAdj: () => env.adj,
    setActiveWdAdj: (v) => { env.adj = v; },
    seats: env.seats,
    slots: env.slots,
    presence: { active: () => false, updateDef(){} },
    ownedKey: 'tw.gachaOwned', tsKey: 'tw.gachaOwnedTs', bonusKey: 'tw.gachaBonus',
  });
  env.runTimers = (max) => { let n = 0; while(env.timers.length && n++ < (max || 50)){ env.timers.sort((a, b) => a.ms - b.ms); const t = env.timers.shift(); t.fn(); } };
  return env;
}
const flush = () => new Promise(r => setImmediate(r));
const G = (id, extra) => Object.assign({ id, cat: 'hat', name: id, gacha: true }, extra || {});

(async () => {
const sec = async (t, fn) => { say(t); try{ await fn(); }catch(e){ chk(false, '예외 — ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' / ')); } };

await sec('── 1. 만들 때', () => {
  const e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":2}', 'tw.gachaBonus': '3' } });
  chk(typeof e.ctx.TwGacha.createGacha === 'function' && Object.keys(e.ctx.TwGacha).join() === 'createGacha', '싣기만 하면 window.TwGacha(createGacha) 하나뿐');
  chk(!e.timers.length && !e.intervals.length && !e.docL.keydown && !e.ctx.openGachaInv, '  싣기만 해서는 타이머 · 이벤트 · 고리가 없다');
  const M = e.mk();
  chk(M.gachaCount('a') === 2 && M.bonus() === 3, '로컬 보유분 · 👑 보너스를 읽는다');
  chk(M.state.ts() === e.now && e.ls.get('tw.gachaOwnedTs') === String(e.now), '시각이 없는데 뽑은 게 있으면 지금(서버 시계)으로 찍는다 — 옛 로컬 기록이 서버로 올라가게');
  chk(e.timers.some(t => t.ms === 4200) && e.intervals.some(t => t.ms === 10 * 60 * 1000), '부팅 4.2초 동기화 · 10분 tick');
  chk(typeof e.els.gachaInvClose.onclick === 'function' && typeof e.els.gachaGoDraw.onclick === 'function' && typeof e.els.gachaDraw1.onclick === 'function'
      && typeof e.els.gachaDraw5.onclick === 'function' && typeof e.els.gachaBackInv.onclick === 'function' && typeof e.els.gachaDrawClose.onclick === 'function', '창 버튼 연결(✕ 둘 · 뽑으러 가기 · 1회 · 5연속 · 보관함으로)');
  chk(e.docL.keydown && e.docL.keydown.length === 1 && e.docL.mousedown && e.docL.mousedown.length === 1 && e.winL.blur && e.winL.blur.length === 1, 'ESC · 바깥 클릭 · blur 닫기 연결');
  chk(typeof e.ctx.openGachaInv === 'function' && typeof e.ctx.closeGachaInv === 'function' && typeof e.ctx._gachaRestorePos === 'function', 'window 고리 셋(openGachaInv · closeGachaInv · _gachaRestorePos) 그대로');
  chk(Array.isArray(e.ctx.__winPosResetters) && e.ctx.__winPosResetters.length === 1, '🪟 창 위치 초기화 목록에 한 자리');
  const e2 = mkEnv(); e2.mk();
  chk(!e2.ls.has('tw.gachaOwnedTs'), '새 기기(보유 0 · 시각 없음)는 시각을 안 찍는다 — 서버가 이긴다');
  const e3 = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '77' } }); const M3 = e3.mk();
  chk(M3.state.ts() === 77, '저장된 시각이 있으면 그대로');
  const e4 = mkEnv({ noDom: true }); let ok = true; try{ e4.mk(); }catch(_){ ok = false; }
  chk(ok && !e4.docL.keydown && !e4.ctx.openGachaInv, 'DOM 이 없으면 창 연결 없이 조용히 넘어간다');
});

await sec('── 2. 셈 — 보유 · 색상 해금 · 풀 · 남은 뽑기', () => {
  const e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":4,"b":1,"n":1}' }, level: 23,
    saved: [G('a'), G('b'), G('n', { noColor: true }), G('w', { season: 'winter' }), G('s', { season: 'spring' }), { id: 'x', cat: 'hat' }] });
  const M = e.mk();
  chk(M.isGachaPart(G('a')) && !M.isGachaPart({ id: 'x' }) && !M.isGachaPart(null), 'isGachaPart — rec.gacha 만');
  chk(M.isGachaColorUnlocked('a') && !M.isGachaColorUnlocked('b'), '같은 파츠 4개 → 색상 변경 해금');
  chk(M.isGachaColorUnlocked('n'), '  색 없는 파츠(noColor)는 1개로 끝');
  e.admin = true; chk(M.isGachaColorUnlocked('b'), '  관리자는 게이트 통과(검수)'); e.admin = false;
  chk(M.pool().map(p => p.id).join() === 'b,s', '풀 — 다 모은 것(a · n) · 다른 시즌(겨울)은 빠진다 (' + M.pool().map(p => p.id).join() + ')');
  chk(M.seasonNow() === 'spring', '  4월은 봄');
  chk(M.ticketsEarned() === 4 && M.ticketsLeft() === 0, '남은 뽑기 = 레벨/5(4) − 보유 합(6) → 0');
  M.setBonusLocal(5);
  chk(M.bonus() === 5 && M.ticketsEarned() === 9 && M.ticketsLeft() === 3 && e.ls.get('tw.gachaBonus') === '5', '👑 보너스 5 → 9 − 6 = 3 · 로컬 저장');
  M.setBonusLocal(-3); chk(M.bonus() === 0, '  음수는 0'); M.setBonusLocal(1e9); chk(M.bonus() === 9999, '  상한 9999');
  chk(M.sceneHasColorGroup({ traverse(f){ f({ isMesh: true, name: 'cap_col1', material: {} }); } }) === true
      && M.sceneHasColorGroup({ traverse(f){ f({ isMesh: true, name: 'cap', material: { name: 'm_col' } }); } }) === true
      && M.sceneHasColorGroup({ traverse(f){ f({ isMesh: true, name: 'cap', material: { name: 'm' } }); } }) === false
      && M.sceneHasColorGroup({ traverse(){ throw new Error('x'); } }) === true, 'sceneHasColorGroup — 메쉬 · 머티리얼 이름의 _col · 못 훑으면 «있다»');
  chk(M.DUPES_FOR_COLOR === 4, 'DUPES_FOR_COLOR = 4');
});

await sec('── 3. 뽑기', async () => {
  const e = mkEnv({ level: 10, saved: [G('a'), G('b', { noColor: true })], srvNow: SPRING + 5000 });
  const M = e.mk(); e.rand = [0.0, 0.0, 0.0];
  const r = M.draw(5);
  chk(r.length === 2, '티켓 2장 — 5회 요청해도 2회에서 멈춘다 (' + r.length + ')');
  chk(r[0].id === 'a' && r[0].isNew && r[0].count === 1 && r[1].id === 'a' && !r[1].isNew && r[1].count === 2, '결과 — 첫 개는 NEW · 둘째는 개수만');
  chk(M.state.ts() === SPRING + 5000 && JSON.parse(e.ls.get('tw.gachaOwned')).a === 2, '시각은 서버 시계로 찍고 로컬에 저장');
  await flush(); await flush();
  chk(e.loads === 1, '뽑으면 서버와 맞춘다(draw)');
  M.setBonusLocal(10); e.rand = [0.99];
  const r2 = M.draw(1); chk(r2.length === 1 && r2[0].id === 'b' && r2[0].isNew && !r2[0].unlockedColor, '색 없는 파츠는 «색상 해금» 표식이 안 선다');
  M.state.setOwned({ a: 3 }); e.rand = [0];
  const r3 = M.draw(1); chk(r3.length === 1 && r3[0].unlockedColor === true, '4번째로 막 열리면 unlockedColor');
  M.state.setOwned({ a: 4, b: 1 }); chk(M.draw(3).length === 0, '풀이 비면 빈 결과');
});

await sec('── 4. 서버 동기화', async () => {
  let e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '100' }, srv: { owned: { b: 2 }, ts: 200 } });
  let M = e.mk(); await M.syncGachaToServer('boot');
  chk(JSON.stringify(M.owned()) === '{"b":2}' && M.state.ts() === 200 && !e.pushes.length, '서버가 새것 — 통째로 받고 시각을 물려받는다(핑퐁 없음)');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '300' }, srv: { owned: { b: 2 }, ts: 200 } });
  M = e.mk(); await M.syncGachaToServer('tick');
  chk(e.pushes.length === 1 && JSON.stringify(e.pushes[0].owned) === '{"a":1}' && e.pushes[0].ts === 300, '내 것이 새것 — 통째로 올린다');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '300' }, srv: { owned: {}, ts: 300 } });
  M = e.mk(); await M.syncGachaToServer('tick');
  chk(e.pushes.length === 1, '시각이 같고 서버가 비었으면 한 번 올린다');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '900' }, srv: { owned: { b: 1 }, ts: 5 } });
  M = e.mk(); await M.syncGachaToServer('transfer', 'pull');
  chk(JSON.stringify(M.owned()) === '{"b":1}' && !e.pushes.length, 'pull(계정 연동) — 내 것이 더 최신이어도 저쪽 것을 받는다');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '900' }, srv: { owned: {}, ts: 0 } });
  M = e.mk(); await M.syncGachaToServer('transfer', 'pull');
  chk(e.pushes.length === 1 && M.owned().a === 1, '  저쪽이 비었으면 로컬을 지우지 않고 올린다');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":2,"c":1}', 'tw.gachaOwnedTs': '100' }, srv: { owned: { a: 1, b: 3 }, ts: SPRING + 60 * 60 * 1000 } });
  M = e.mk(); await M.syncGachaToServer('boot');
  chk(JSON.stringify(M.owned()) === '{"a":2,"b":3,"c":1}' && e.pushes.length === 1 && e.pushes[0].ts === SPRING, '서버 ts 가 미래 — 파츠별 max 로 합치고 지금 시각으로 바로잡아 올린다');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '100' }, srv: null, saved: [G('a')] });
  M = e.mk(); await M.syncGachaToServer('boot');
  chk(M.owned().a === 1 && !e.pushes.length && M.state.srvSeen() === false, '읽기 실패(null) — 아무것도 안 하고 «서버를 읽었다» 도 안 선다');
  e = mkEnv({ uid: null }); M = e.mk(); await M.syncGachaToServer('boot');
  chk(!e.loads, 'uid 가 정해지기 전이면 읽지도 않는다');
  e = mkEnv({ noApi: true }); M = e.mk(); let ok = true; try{ await M.syncGachaToServer('boot'); }catch(_){ ok = false; }
  chk(ok, 'firebaseAPI 가 없으면 조용히 돌아간다');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '300' }, srv: { owned: {}, ts: 1 } });
  e.pushOk = false; M = e.mk(); await M.syncGachaToServer('tick');
  chk(e.denied.join() === '가챠', '쓰기가 거부되면(false) 🔑 안내를 부른다(_warnServerWriteDenied)');
  /* 진행 중에 들어온 요청 — 버리지 않고 끝난 뒤 한 번 더 */
  e = mkEnv({ srv: { owned: {}, ts: 0 } }); M = e.mk();
  let release; e.ctx.firebaseAPI.loadGachaOwned = () => { e.loads = (e.loads || 0) + 1; return new Promise(r => { release = () => r({ owned: {}, ts: 0 }); }); };
  const p1 = M.syncGachaToServer('boot'); await flush();
  await M.syncGachaToServer('inv-open');
  chk(e.loads === 1, '진행 중이면 두 번째 요청은 바로 읽지 않는다');
  release(); await p1; await flush();
  chk(e.loads === 2, '  끝나면 삼켜진 요청을 한 번 더 돈다');
  release(); await flush(); await flush();
  /* 미보유 파츠 회수 — 서버를 실제로 읽은 뒤에만 */
  e = mkEnv({ ls: { 'tw.gachaOwned': '{}', 'tw.gachaOwnedTs': '0' }, srv: { owned: {}, ts: 5 }, saved: [G('g'), { id: 'n', cat: 'hat' }] });
  const seat = { remote: false, charDef: { equippedParts: { hat: [{ id: 'g' }, { id: 'n' }] } }, stackedPartObjs: { hat: { g: {} } } };
  e.seats.push(seat); e.slots.push({ equippedParts: { hat: [{ id: 'g' }] } });
  M = e.mk();
  chk(M.pruneUnownedGachaParts() === 0 && e.prunedDef.length === 0, '서버를 읽기 전에는 벗기지 않는다');
  await M.syncGachaToServer('boot');
  chk(e.prunedDef.join() === 'g,g' && !seat.stackedPartObjs.hat.g && seat.charDef.equippedParts.hat.length === 1 && e.saves === 1, '읽은 뒤 — 좌석 · 슬롯의 미보유 가챠 파츠를 벗긴다(일반 파츠는 그대로) · 슬롯 저장');
  chk(e.toasts.some(t => /보유하지 않은 가챠 파츠 2개/.test(t)), '  조용히 벗기지 않는다(안내)');
  /* 이 세션에 서버를 한 번 읽은 뒤라도, 이번 읽기가 실패했으면 그 왕복 끝에서는 회수하지 않는다 */
  e.saved = [G('g2')]; e.srv = null; seat.charDef.equippedParts.hat.push({ id: 'g2' }); seat.stackedPartObjs.hat.g2 = {};
  await M.syncGachaToServer('tick');
  chk(seat.charDef.equippedParts.hat.some(x => x.id === 'g2'), '  읽기 실패한 왕복 끝에서는 회수하지 않는다(_srvRead)');
  e.admin = true; e.seats[0].charDef.equippedParts.hat.push({ id: 'g' });
  chk(M.pruneUnownedGachaParts() === 0, '  관리자는 건너뛴다(보유 없이 착용해 검수)');
  M.setBonusLocal(3); M.resetMemory();
  chk(JSON.stringify(M.owned()) === '{}' && M.state.ts() === 0 && M.bonus() === 0, '로그아웃 지우기 — 보유 · 시각 · 보너스 메모리를 빈 기기 값으로');
});

await sec('── 5. 보관함', async () => {
  const many = []; for(let i = 0; i < 10; i++) many.push(G('p' + i, { order: i, cat: i < 7 ? 'hat' : 'glasses', season: i === 9 ? 'spring' : (i === 8 ? 'winter' : undefined) }));
  const owned = {}; for(let i = 0; i < 9; i++) owned['p' + i] = i === 2 ? 4 : 1;
  const e = mkEnv({ ls: { 'tw.gachaOwned': JSON.stringify(owned) }, level: 50, saved: many });
  const M = e.mk(); M.setBonusLocal(2);
  M.openGachaInv();
  const grid = e.els.gachaInvGrid;
  chk(e.els.gachaInvOverlay.style.display === 'block' && M.isInvOpen() && !M.isDrawOpen(), '열면 보관함이 보이고 뽑기 창은 닫힌다');
  chk(/레벨 <b>50<\/b>/.test(e.els.gachaInvBar.innerHTML) && /👑달성표 2회/.test(e.els.gachaInvBar.innerHTML) && /🌸 봄/.test(e.els.gachaInvBar.innerHTML), '정보줄 — 레벨 · 👑 보너스 · 이번 시즌');
  chk(cells(grid).length === 8 && e.els.gachaInvPager.children.length === 3, '8칸 한 페이지 · ◀ 1/2 ▶');
  e.els.gachaInvPager.children[2].click();
  chk(M.state.page() === 1 && cells(grid).length === 2 && grid.children.filter(c => /gc-hole/.test(c.className)).length === 6, '▶ — 2페이지 · 남는 자리는 빈 칸으로 높이 고정');
  const p9 = cells(grid).find(c => c.textContent.includes('???'));
  chk(!!p9 && /locked/.test(p9.className) && !p9.onclick, '안 뽑은 파츠는 ??? · 잠김 · 누를 수 없음');
  p9.oncontextmenu({ preventDefault(){} });
  chk(/아직 안 뽑은/.test(e.toasts[e.toasts.length - 1]), '  잠긴 칸 우클릭도 안내');
  const p8 = cells(grid).find(c => c.textContent.includes('p8'));
  chk(!!p8, '다른 시즌이어도 가진 파츠는 보인다');
  await p8.onclick();
  chk(e.equips.join() === 'glasses:p8' && M.selId() === 'p8' && e.colorRefresh > 0, '누르면 착용 · 선택 · 색상 영역 갱신');
  e.tabs[1].onclick();
  chk(M.state.tab() === 'always' && M.state.page() === 0 && cells(grid).every(c => !/p8|p9/.test(c.textContent)), '상시 탭 — 시즌 파츠 빠짐 · 1페이지로');
  const catBtns = e.els.gachaInvSubs.children[0].children;
  chk(catBtns.length === 3 && /전체/.test(catBtns[0].innerHTML), '카테고리 줄 — 목록에 있는 것만(전체 · 모자 · 안경)');
  catBtns[2].onclick();
  chk(M.state.cat() === 'glasses' && cells(grid).length === 1, '  안경만');
  e.els.gachaInvSubs.children[0].children[1].onclick();
  chk(M.state.cat() === 'hat' && cells(grid).length === 7, '  모자만');
  e.tabs[2].onclick();
  chk(M.state.cat() === 'all', '시즌 탭으로 가 모자가 하나도 없으면 «전체» 로 되돌린다');
  const sel = e.els.gachaInvSubs.children.find(c => c.id === 'gachaInvSeason');
  chk(!!sel && sel.options.length === 3, '시즌 드롭다운 — 시즌 탭 · 후보 둘 이상일 때만');
  sel.value = 'winter'; sel.onchange();
  chk(M.state.season() === 'winter' && cells(grid).length === 1 && cells(grid)[0].textContent.includes('p8'), '  겨울만');
  e.admin = true; M.renderGachaInv();
  const del = cells(grid)[0].children.find(c => c.className === 'gc-del');
  e.confirmAns = false; del.onclick({ stopPropagation(){} });
  chk(!e.deleted.length && e.focus === 1, '관리자 ✕ — 취소해도 window.focus()(Electron 멈춤 방지)');
  e.confirmAns = true; del.onclick({ stopPropagation(){} });
  chk(e.deleted.join() === 'p8' && e.focus === 2, '  확인하면 지운다');
  e.admin = false;
  e.adj = { cat: 'hat', id: 'p1' };
  M.closeGachaInv();
  chk(e.els.gachaInvOverlay.style.display === 'none' && e.commits === 1 && e.adj === null, '닫으면 저장(commitWdDraft) · 상세조정 선택도 푼다');
  M.toggleGachaInv(); chk(M.isInvOpen(), 'T — 닫혀 있으면 연다');
  e.docL.keydown[0]({ key: 'Escape' }); chk(!M.isInvOpen() && e.commits === 2, 'ESC — 닫고 저장');
  M.toggleGachaInv(); e.docL.mousedown[0]({ target: { closest: () => null } }); chk(!M.isInvOpen(), '바깥 클릭 — 닫는다');
  M.toggleGachaInv(); e.winL.blur[0](); chk(!M.isInvOpen(), '창이 포커스를 잃으면 닫는다');
});

await sec('── 6. 뽑기 창', async () => {
  let e = mkEnv({ level: 10, saved: [G('a'), G('b')] });
  let M = e.mk();
  M.openGachaInv(); e.els.gachaGoDraw.onclick();
  chk(e.els.gachaDrawOverlay.style.display === 'block' && e.els.gachaInvOverlay.style.display === 'none' && /gc-cap-wrap idle/.test(e.els.gachaDrawStage.innerHTML), '뽑으러 가기 — 대기 캡슐');
  chk(/남은 뽑기 <b>2회<\/b>/.test(e.els.gachaDrawBar.innerHTML) && e.els.gachaDraw5.textContent === '2연속 뽑기' && !e.els.gachaDraw5.disabled, '정보줄 · 5연속은 남은 수만큼(죽이지 않는다)');
  e.rand = [0.0, 0.6];
  e.timers.length = 0;
  e.els.gachaDraw5.onclick();
  chk(e.els.gachaDraw1.disabled === true && /rumble/.test(e.els.gachaDrawStage.innerHTML), '연출 중 — 뽑기 버튼 잠금 · 캡슐 떨림');
  chk(e.els.gachaDrawClose.style.pointerEvents !== 'none', '  닫기(✕)는 잠그지 않는다');
  e.runTimers();
  const wrap = e.els.gachaDrawStage.querySelector('.gc-cap-wrap');
  const reveal = wrap && wrap.children.find(c => c.className === 'gc-reveal');
  chk(!!reveal && reveal.children.length === 2 && wrap.classList.contains('crack') && wrap.classList.contains('wide'), '갈라짐(2회 이상은 wide — 토큰 하나씩) · 결과 둘');
  chk(e.els.gachaDraw1.disabled === true && /남은 뽑기 <b>0회<\/b>/.test(e.els.gachaDrawBar.innerHTML), '끝나면 정보줄 갱신 · 남은 뽑기 0 이면 버튼 꺼짐');
  e.els.gachaBackInv.onclick();
  chk(M.isInvOpen() && !M.isDrawOpen(), '보관함으로 — 방금 뽑은 파츠가 있는 페이지');
  e.els.gachaGoDraw.onclick(); e.toasts.length = 0;
  e.els.gachaDraw1.onclick();
  chk(e.toasts.join() === '남은 뽑기가 없어요' && /남은 뽑기가 없어요/.test(e.els.gachaDrawStage.children[0] ? e.els.gachaDrawStage.children[0].textContent : ''), '남은 뽑기가 없으면 안내 · 무대에 문구');
  /* 오류 — 뽑기 안에서 던지면(여기서는 서버 시계) 안내하고 잠금을 푼다 */
  e = mkEnv({ level: 10, saved: [G('a')] }); M = e.mk();
  M.openGachaInv(); e.els.gachaGoDraw.onclick();
  e.srvThrows = true; e.toasts.length = 0;
  e.els.gachaDraw1.onclick();
  chk(e.toasts.join() === '뽑기에 실패했어요 — 잠시 후 다시 시도해 주세요' && e.els.gachaBackInv.disabled === false, '뽑기 실패 — 안내 · 잠금 풀림');
  e.srvThrows = false;
});

await sec('── 7. app.js 배선', () => {
  const code = strip(APP);
  const defs = /function (gachaDraw|gachaPool|syncGachaToServer|pruneUnownedGachaParts|renderGachaInv|openGachaInv|closeGachaInv|toggleGachaInv|_gachaRunDraw|isGachaPart|sceneHasColorGroup|_gachaInvOpen)\(|\blet (gachaOwned|_gachaTs|_gachaBonus|_gachaTab|_gachaSelId)\b/;
  chk(!defs.test(code) && defs.test(MOD), '가챠 정의는 모듈에만');
  const code2 = code.replace(/const GACHA_OFF = \{[\s\S]*?\};/, '').replace(/\brenderGachaInv: \(\)=>/, '');   // 빈 껍데기 · 👑 달성표 deps 의 이름 칸은 뺀다
  chk(!/(?<![\w$.])(isGachaPart|isGachaColorUnlocked|gachaCount|sceneHasColorGroup|syncGachaToServer|pruneUnownedGachaParts|renderGachaInv|toggleGachaInv|_gachaInvOpen|_gachaDrawOpen|_gachaSelId|gachaOwned|_gachaTs|_gachaBonus|_setGachaBonusLocal|GACHA_DUPES_FOR_COLOR)\b/.test(code2), '  app.js 는 옛 이름을 부르지 않는다(gachaMod.이름)');
  chk(/window\.TwGacha = api/.test(MOD) && (code.match(/TwGacha\.createGacha\(/g) || []).length === 1, '모듈은 window.TwGacha · 만드는 곳은 한 곳');
  const iMk = APP.indexOf('TwGacha.createGacha('), iPrev = APP.indexOf('function _starColorOk('), iWarn = APP.indexOf('async function _warnServerWriteDenied('), iTheme = APP.indexOf('/* ═══ 🎨 디자인 테마');
  chk(iPrev > 0 && iMk > iPrev && iWarn > iMk && iTheme > iWarn, '원래 자리 — 🚩 신고 · 별 색 뒤 · 🔑 쓰기 거부 안내 · 🎨 디자인 테마 앞');
  const keys = ["const GACHA_OWNED_KEY = 'tw.gachaOwned';", "const GACHA_TS_KEY    = 'tw.gachaOwnedTs';", "const GACHA_BONUS_KEY = 'tw.gachaBonus';"];
  chk(keys.every(k => APP.includes(k) && APP.indexOf(k) < iMk) && !/'tw\.gacha(Owned|OwnedTs|Bonus)'/.test(strip(MOD)), '저장 키 세 줄은 app.js(계정 전환 지움 목록) — 모듈은 deps 값으로');
  const call = (APP.match(/TwGacha\.createGacha\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  const fnDeps = deps.filter(l => /^\w+: \(\.\.\.a\)=>[\w$]+\(\.\.\.a\),$/.test(l));
  const getters = ['isAdmin: ()=>isAdmin,', 'savedParts: ()=>savedParts,', 'partCats: ()=>PART_CATS,', 'wdDraftDef: ()=>wdDraftDef,', 'activeWdAdj: ()=>activeWdAdj,', 'setActiveWdAdj: (v)=>{ activeWdAdj = v; },'];
  const vals = ['seats: seats,', 'slots: slots,', 'presence: Presence,', 'ownedKey: GACHA_OWNED_KEY,', 'tsKey: GACHA_TS_KEY,', 'bonusKey: GACHA_BONUS_KEY,'];
  chk(deps.length === 40 && fnDeps.length === 28 && getters.every(g => deps.includes(g)) && vals.every(v => deps.includes(v)),
      'deps 40개 — 함수 28은 화살표 · 다시 대입되는 let 5는 읽는 함수 + 쓰는 함수 1 · const 셋과 저장 키 셋은 값 (' + deps.length + ' · 화살표 ' + fnDeps.length + ')');
  chk(['seats', 'slots', 'Presence'].every(n => { const i = APP.search(new RegExp('^const ' + n + '\\s*=', 'm')); return i > 0 && i < iMk; }), '  seats · slots · Presence 는 만드는 줄보다 앞에 선언된 const');
  const m = strip(MOD);
  chk(!/[^.\w$](activeWdAdj|isAdmin|savedParts|PART_CATS|wdDraftDef)\s*=[^=]/.test(m.replace(/const (activeWdAdj|isAdmin|savedParts|PART_CATS|wdDraftDef) = deps\.\w+;/g, '')), '모듈은 app.js 의 let 에 직접 쓰지 않는다(쓰는 함수로)');
  const calls = ['gachaMod.toggleGachaInv();', 'gachaMod.isInvOpen()', 'gachaMod.isDrawOpen()', 'gachaMod.pruneUnownedGachaParts();', 'gachaMod.selId()',
    'gachaMod.isGachaPart(', 'gachaMod.isGachaColorUnlocked(', 'gachaMod.gachaCount(', 'gachaMod.DUPES_FOR_COLOR', 'gachaMod.sceneHasColorGroup(',
    'gachaMod.renderGachaInv();', "gachaMod.syncGachaToServer('launcher');", "call(gachaMod.syncGachaToServer, 'logout');", 'gachaMod.owned()', 'gachaMod.resetMemory();',
    "await gachaMod.syncGachaToServer('transfer', 'pull');", 'setGachaBonusLocal: (...a)=>gachaMod.setBonusLocal(...a),', 'renderGachaInv: ()=>gachaMod.renderGachaInv(),', 'gachaBonus: ()=>gachaMod.bonus(),'];
  const miss = calls.filter(c => !code.includes(c));
  chk(!miss.length && (code.match(/gachaMod\.isGachaPart\(/g) || []).length === 7 && (code.match(/gachaMod\.pruneUnownedGachaParts\(\)/g) || []).length === 3,
      '부르는 곳 — T 키 · 꾸미기 색상 영역 · 파츠 등록 · 카탈로그 · 런처 · 로그아웃 · 연동 · 👑 달성표 (' + (miss[0] || '다 있음') + ')');
  const off = (APP.match(/const GACHA_OFF = \{([\s\S]*?)\};/) || [])[1] || '';
  const used = [...new Set((code.match(/gachaMod\.(\w+)/g) || []).map(s => s.split('.')[1]))];
  chk(off && used.every(n => new RegExp('\\b' + n + '\\b').test(off)), '빈 껍데기 GACHA_OFF 가 부르는 이름을 다 갖는다 (' + used.length + '개)');
  const ret = (MOD.match(/\nreturn \{([\s\S]*?)\n\};\n\}/) || [])[1] || '';
  chk(used.every(n => new RegExp('(^|\\n)\\s*' + n + '\\b').test(ret)), '  모듈 반환값도 그 이름을 다 갖는다');
  const iS = HTML.indexOf('<script src="parts/myhome-sticker.js"></script>'), iG = HTML.indexOf('<script src="parts/gacha.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iS > 0 && iG > iS && iA > iG, 'html — gacha.js 를 app.js 앞에 싣는다');
  chk(/^Tw[A-Z]/.test('TwGacha') && !/window\.Gacha\s*=/.test(MOD), '전역 이름은 Tw 접두사(#103 — 크로미움 내장 전역과 겹치지 않게)');
  /* 모듈이 없을 때 — 빈 껍데기 줄만 떼어 굴린다 */
  const wire = (APP.match(/const GACHA_OFF = [\s\S]*?\n\}\);/) || [''])[0];
  let got = null; try{ got = vm.runInNewContext(wire + '\ngachaMod;', { seats: [], slots: [], Presence: {}, GACHA_OWNED_KEY: 'a', GACHA_TS_KEY: 'b', GACHA_BONUS_KEY: 'c' }); }catch(_){}
  chk(!!got && got.isGachaPart({ gacha: true }) === false && got.renderGachaInv() === undefined && got.isInvOpen() === false && JSON.stringify(got.owned()) === '{}', '모듈이 안 실려도 그 자리는 서지 않는다(빈 껍데기)');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
/* 기다리던 약속이 영영 안 풀려 이벤트 고리가 비면 node 는 0 으로 조용히 끝난다 — 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
