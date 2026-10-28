/* ═══ 🎰 sim-gacha.js — 파츠 가챠 모듈 (2026-10-10 신설 · 앱 FSD 8번) ═══════════════
   app.js 의 두 구역(«🎰 파츠 가챠 — 코어» · «🎰 파츠 보관함 (T키) · 가챠 뽑기 창»)을 parts/character/gacha.js 로 옮겼다.
   동작은 그대로여야 한다 — 여기서는 «옮긴 것» 을 가짜 DOM · 가짜 서버 위에서 통째로 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwGacha 뿐 · 만들면 로컬 보유분 · 보너스 읽기 · 시각 부트스트랩 · 부팅 4.2초 · 10분 tick ·
           창 버튼 · ESC · 바깥 클릭 · blur 연결 · window 고리 셋 · 창 위치 초기화 목록 · DOM 없으면 조용히
   ・2절: 셈 — 보유 · 색상 해금(관리자 통과 · 색 없는 파츠 1개) · 풀(다 모은 것 · 다른 시즌 빠짐) · 남은 뽑기(레벨/5 + 👑 보너스) · 보너스 저장
   ・3절: 뽑기 — 서버 트랜잭션이 저장해야 결과(NEW · 색상 해금) · 티켓이 모자라면 멈춤 · 실패하면 이 PC 그대로(횟수 원복) ·
           다른 PC 가 먼저 뽑으면 서버 값으로 다시 셈(횟수 넘김 없음) · 이 PC 에만 있던 뽑기도 같이 올림 · 늦게 붙은 저장 · 겹친 누름
   ・4절: 서버 동기화 — 서버가 원본(받음 · 쓰기 0) · 이 PC 에만 있는 뽑기는 합쳐 올림(덮어쓰기 없음) · pull · 시계 틀어진 ts 상관없이 합침 ·
           읽기 실패(아무것도 안 함 · 회수 안 함) · 쓰기 거부(안내) · 진행 중 요청은 끝나고 한 번 더 · 미보유 파츠 회수 · 로그아웃 메모리 지우기 ·
           로그아웃 검문의 «서버에 없는 뽑기 수»
   ・5절: 보관함 — 정보줄(👑 보너스) · 탭 · 카테고리 · 시즌 · 8칸 페이지 · 잠긴 칸 · 누르면 착용 · 관리자 삭제(confirm 뒤 focus) · 열기 · 닫기
   ・6절: 뽑기 창 — 연출(잠금 → 결과 → 풀림) · 남은 뽑기 없음 · 뽑기 실패(오류) 안내
   ・7절: app.js 배선 — 정의는 모듈에만 · 만드는 곳 한 곳 · 원래 자리 · deps 모양 · 저장 키 세 줄은 app.js · 부르는 곳은 gachaMod.이름 ·
           빈 껍데기 · html 순서 · 전역 이름
   [실행] gacha.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🛡️ 모듈이 부르는 공용 씻기 — 진짜 파일
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['gacha.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = _joinRenderer(SRC['app.js']), HTML = SRC['desk-companion-prototype.html'], MOD = SRC['gacha.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
/* 🛠️ 파츠 등록 창은 관리자 코드 admin 폴더 4번에서 admin/admin-part-register.js 로 옮겼다 — 그 파일이 부르는 gachaMod().이름 도
   «부르는 곳» 으로 센다(모듈은 다시 대입되지 않지만 뒤에서 선언되는 const 라 읽는 함수로 받는다). 없으면(옮기기 전 판) 빈 글. */
const PREG = ['admin-part-register.js', 'parts/admin/admin-part-register.js', 'app/parts/admin/admin-part-register.js'].map(read).find(Boolean) || '';

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
    seats: [], slots: [], srv: opt.srv === undefined ? { owned: {}, ts: 0 } : opt.srv, srvDelay: 0, pushes: [], txCalls: 0, txFail: null, txRace: null, txLate: false, errs: [],
    rand: [0], randI: 0,
    /* 🎰 서버 길 — source 가 'server' 면 gacha.js 가 gachaServer 를 부른다. gs = 서버 상태 · gsFail = 실패 이유 · gsOut = 이번 뽑기 결과 */
    source: opt.source || 'firebase', gs: opt.gs || null, gsFail: null, gsOut: [], gsLoads: 0, gsDraws: [],
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
    /* 트랜잭션 흉내 — apply(지금 서버 값) 가 null 이면 안 쓴다. txRace 는 첫 시도 뒤 다른 PC 가 먼저 쓴 경우(새 값으로 다시 돈다) */
    updateGacha: async (uid, apply, opt) => {
      const clone = v => JSON.parse(JSON.stringify(v));
      env.txCalls++;
      if(env.txFail) return { ok:false, reason: env.txFail };
      let cur = clone(env.srv || { owned: {}, ts: 0 });
      let next = apply(cur);
      if(env.txRace){ const race = env.txRace; env.txRace = null; race(env); cur = clone(env.srv); next = apply(cur); }
      if(next == null) return { ok:true, committed:false, value: cur };
      env.srv = clone(next); env.pushes.push(clone(next));
      if(env.txLate){ env.lateOpt = opt; return { ok:false, reason:'timeout' }; }
      return { ok:true, committed:true, value: clone(next) };
    },
  };
  ctx.TwSafeHtml = globalThis.TwSafeHtml; vm.createContext(ctx);
  vm.runInContext(MOD, ctx, { filename: 'gacha.js' });
  env.ctx = ctx; env.els = els; env.tabs = tabs;
  env.mk = () => { const m = ctx.TwGacha.createGacha({
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
    toggleEquip: async (cat, id) => { env.equips.push(cat + ':' + id); },
    createWardrobeAdjPanel: (cat, id) => { const p = mkEl('div'); p.className = 'adj'; p.dataset.id = id; return p; },
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
    isGachaPart: (rec) => !!(rec && rec.gacha),   // 정의는 카탈로그(premium-assets.js) — 같은 한 줄
    notifyError: (code, err) => { env.errs.push(code); if(env.errThrows) throw new Error('알림 깨짐'); },
    gachaSource: () => env.source,
    gachaServer: {
      load: async () => { env.gsLoads++; const snap = JSON.parse(JSON.stringify(env.gs)); if(env.gsHold) await env.gsHold; if(env.gsFail) throw Object.assign(new Error('x'), { kind: 'unavailable' }); return snap; },
      draw: async (n) => { env.gsDraws.push(n); if(env.gsFail) return { ok: false, reason: env.gsFail }; return { ok: true, out: env.gsOut, state: JSON.parse(JSON.stringify(env.gs)) }; },
    },
  });
  /* 🛠 관리자 등록 · 삭제 — app.js 가 만든 뒤 setPartEditor 로 건다 */
  m.setPartEditor({
    openPartRegister: (cat, rec) => env.regs.push({ cat, rec }),
    syncPartRegGachaLock: () => {},
    deletePart: (id) => { env.deleted.push(id); env.saved = env.saved.filter(p => p.id !== id); },
  });
  return m; };
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
  chk(M.state.ts() === 0 && !e.ls.has('tw.gachaOwnedTs'), '시각을 새로 찍지 않는다 — 서버가 원본이라 판정에 안 쓴다(이 PC 에만 있는 뽑기는 합치기로 올라간다)');
  chk(e.timers.some(t => t.ms === 4200) && e.intervals.some(t => t.ms === 10 * 60 * 1000), '부팅 4.2초 동기화 · 10분 tick');
  chk(typeof e.els.gachaInvClose.onclick === 'function' && typeof e.els.gachaGoDraw.onclick === 'function' && typeof e.els.gachaDraw1.onclick === 'function'
      && typeof e.els.gachaDraw5.onclick === 'function' && typeof e.els.gachaBackInv.onclick === 'function' && typeof e.els.gachaDrawClose.onclick === 'function', '창 버튼 연결(✕ 둘 · 뽑으러 가기 · 1회 · 5연속 · 보관함으로)');
  chk(e.docL.keydown && e.docL.keydown.length === 1 && e.docL.mousedown && e.docL.mousedown.length === 1 && e.winL.blur && e.winL.blur.length === 1, 'ESC · 바깥 클릭 · blur 닫기 연결');
  chk(typeof e.ctx.openGachaInv === 'function' && typeof e.ctx.closeGachaInv === 'function' && typeof e.ctx._gachaRestorePos === 'function', 'window 고리 셋(openGachaInv · closeGachaInv · _gachaRestorePos) 그대로');
  chk(Array.isArray(e.ctx.__winPosResetters) && e.ctx.__winPosResetters.length === 1, '🪟 창 위치 초기화 목록에 한 자리');
  const e2 = mkEnv(); e2.mk();
  chk(!e2.ls.has('tw.gachaOwnedTs'), '새 기기(보유 0 · 시각 없음)도 시각을 안 찍는다');
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
  let e = mkEnv({ level: 10, saved: [G('a'), G('b', { noColor: true })], srvNow: SPRING + 5000 });
  let M = e.mk(); e.rand = [0.0, 0.0, 0.0];
  let r = await M.draw(5);
  chk(r.ok && r.out.length === 2, '티켓 2장 — 5회 요청해도 2회에서 멈춘다 (' + (r.out ? r.out.length : r.reason) + ')');
  chk(r.out[0].id === 'a' && r.out[0].isNew && r.out[0].count === 1 && r.out[1].id === 'a' && !r.out[1].isNew && r.out[1].count === 2, '결과 — 첫 개는 NEW · 둘째는 개수만');
  chk(e.txCalls === 1 && e.srv.owned.a === 2 && e.srv.ts === SPRING + 5000, '서버 트랜잭션 한 번에 저장 — 시각은 서버 시계');
  chk(M.owned().a === 2 && JSON.parse(e.ls.get('tw.gachaOwned')).a === 2 && M.state.srvSeen() === true, '  저장된 뒤에야 이 PC 사본 · 로컬에 적는다');
  M.setBonusLocal(10); e.rand = [0.99];
  r = await M.draw(1); chk(r.ok && r.out.length === 1 && r.out[0].id === 'b' && r.out[0].isNew && !r.out[0].unlockedColor, '색 없는 파츠는 «색상 해금» 표식이 안 선다');
  e.srv = { owned: { a: 3 }, ts: 1 }; M.state.setOwned({ a: 3 }); e.rand = [0];
  r = await M.draw(1); chk(r.ok && r.out.length === 1 && r.out[0].unlockedColor === true, '4번째로 막 열리면 unlockedColor');
  e.srv = { owned: { a: 4, b: 1 }, ts: 1 }; M.state.setOwned({ a: 4, b: 1 }); const n0 = e.txCalls, p0 = e.pushes.length;
  r = await M.draw(3); chk(r.ok && r.out.length === 0 && e.txCalls === n0 + 1 && e.pushes.length === p0, '풀이 비면 빈 결과 · 서버에 쓰지 않는다');

  /* 실패 — 이 PC 는 아무것도 안 바뀐다(횟수 원복) */
  for(const why of ['denied', 'offline', 'timeout', 'error']){
    e = mkEnv({ level: 10, saved: [G('a')], srv: { owned: {}, ts: 0 } }); M = e.mk(); e.txFail = why;
    const left = M.ticketsLeft();
    r = await M.draw(1);
    chk(!r.ok && r.reason === why && JSON.stringify(M.owned()) === '{}' && M.ticketsLeft() === left && !e.ls.has('tw.gachaOwned') && JSON.stringify(e.srv.owned) === '{}',
        '서버 저장 실패(' + why + ') — 결과 없음 · 보유 · 횟수 · 로컬 그대로');
  }
  e = mkEnv({ uid: null, level: 10, saved: [G('a')] }); M = e.mk();
  r = await M.draw(1); chk(!r.ok && r.reason === 'nouser' && e.txCalls === 0, '내 코드가 없으면 서버에 가지도 않는다');

  /* 동시성 — 다른 PC 가 먼저 뽑으면 서버 값으로 다시 센다 */
  e = mkEnv({ level: 5, saved: [G('a'), G('b')], srv: { owned: {}, ts: 0 } }); M = e.mk(); e.rand = [0];
  e.txRace = (env) => { env.srv = { owned: { b: 1 }, ts: 9 }; };   // 1장뿐인 티켓을 다른 PC 가 먼저 씀
  r = await M.draw(1);
  chk(r.ok && r.out.length === 0 && JSON.stringify(e.srv.owned) === '{"b":1}' && JSON.stringify(M.owned()) === '{"b":1}',
      '다른 PC 가 먼저 마지막 티켓을 쓰면 다시 센 결과 «남은 뽑기 없음» — 횟수를 넘겨 뽑지 못한다 · 사본은 서버 값');
  e = mkEnv({ level: 10, saved: [G('a'), G('b')], srv: { owned: {}, ts: 0 } }); M = e.mk(); e.rand = [0];
  e.txRace = (env) => { env.srv = { owned: { b: 1 }, ts: 9 }; };
  r = await M.draw(1);
  chk(r.ok && r.out.length === 1 && JSON.stringify(e.srv.owned) === '{"b":1,"a":1}', '  티켓이 남으면 다른 PC 뽑기를 지우지 않고 그 위에 더한다');
  /* 겹친 누름 — 한 번에 하나 */
  e = mkEnv({ level: 10, saved: [G('a')] }); M = e.mk();
  const p1 = M.draw(1), p2 = M.draw(1);
  const [r1, r2] = await Promise.all([p1, p2]);
  chk(r1.ok && !r2.ok && r2.reason === 'busy' && e.txCalls === 1, '뽑는 중에 또 누르면 «busy» — 서버에 두 번 가지 않는다');
  /* 이 PC 에만 있던 뽑기(옛 판 · 로그인 풀림) — 뽑을 때 같이 올라간다 */
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"c":1}' }, level: 15, saved: [G('a'), G('c')], srv: { owned: { a: 1 }, ts: 1 } }); M = e.mk(); e.rand = [0];
  r = await M.draw(1);
  chk(r.ok && r.out.length === 1 && e.srv.owned.c === 1 && e.srv.owned.a === 2,
      'B-1021-13 — 서버에 없던 이 PC 의 뽑기(c)가 뽑을 때 서버에 같이 오른다 (' + JSON.stringify(e.srv.owned) + ')');
  chk(M.ticketsLeft() === 0, '  남은 횟수는 서버 + 이 PC 를 합친 보유로 센다(3 − 3 = 0)');
  /* 늦게 붙은 저장 — 시간 초과 뒤 서버에 들어가면 사본에 합친다 */
  e = mkEnv({ level: 10, saved: [G('a')] }); M = e.mk(); e.txLate = true;
  r = await M.draw(1);
  chk(!r.ok && r.reason === 'timeout' && JSON.stringify(M.owned()) === '{}', '시간 초과 — 결과는 «확인 못 함» · 사본은 그대로');
  e.lateOpt.onLate(e.srv);
  chk(M.owned().a === 1 && JSON.parse(e.ls.get('tw.gachaOwned')).a === 1, '  늦게 붙으면 onLate 로 사본에 합친다 — 뽑기가 사라지지 않는다');
});

await sec('── 3-2. 서버 길(sources.gacha = server) — 서버가 뽑고 저장한다', async () => {
  const ST = (owned, extra) => Object.assign({ owned, ts: 500, earned: 3, left: 3 - Object.values(owned).reduce((a, b) => a + b, 0), season: 'winter' }, extra || {});
  let e = mkEnv({ source: 'server', level: 50, saved: [G('a'), G('w', { season: 'winter' }), G('s', { season: 'spring' })], ls: { 'tw.gachaOwned': '{"a":1,"z":9}' } });
  let M = e.mk();
  e.gs = ST({ a: 1, w: 1 }); e.gsOut = [{ id: 'w', count: 1, isNew: true, unlockedColor: false }];
  let r = await M.draw(5);
  chk(r.ok && e.gsDraws.join() === '5' && e.txCalls === 0, '뽑기는 서버에 부탁한다 — 앱 트랜잭션(옛 길)은 안 돈다');
  chk(r.out.length === 1 && r.out[0].id === 'w' && r.out[0].rec && r.out[0].rec.id === 'w' && r.out[0].isNew, '  결과에 카탈로그 항목(rec)을 붙인다 — 연출이 이름 · 그림을 읽는다');
  chk(JSON.stringify(M.owned()) === '{"a":1,"w":1}' && JSON.parse(e.ls.get('tw.gachaOwned')).z === undefined && M.state.ts() === 500 && M.state.srvSeen(),
      '  보유분은 서버 값으로 갈아 끼운다 — 이 PC 에만 있던 뽑기(z)는 올리지도 남기지도 않는다');
  chk(M.ticketsEarned() === 3 && M.ticketsLeft() === 1 && M.seasonNow() === 'winter', '  남은 뽑기 · 시즌은 서버 값(레벨 50 · 이 PC 시계 4월이어도)');
  e.gs = ST({ a: 1, w: 1 }, { left: 0 }); await M.syncGachaToServer('tick');
  chk(M.ticketsLeft() === 0 && M.ticketsEarned() === 3, '  남은 뽑기는 서버가 준 left 그대로(earned − 보유 합으로 다시 세지 않음)');
  e.gs = ST({ a: 1, w: 1 });
  await M.syncGachaToServer('tick');
  chk(M.pool().map(p => p.id).join() === 'a,w', '  풀도 서버 시즌으로 센다(겨울 w 는 들고 · 이 PC 시계로는 제철인 봄 s 는 빠짐)');
  e.gsOut = [{ id: 'gone', count: 1, isNew: true, unlockedColor: false }];
  r = await M.draw(1); chk(r.ok && r.out[0].rec.name === '파츠', '  카탈로그에 없는 파츠는 이름 없는 칸으로(연출이 멈추지 않게)');
  for(const why of ['offline', 'timeout', 'nouser', 'error']){
    e = mkEnv({ source: 'server', level: 10, saved: [G('a')], ls: { 'tw.gachaOwned': '{"a":1}' } }); M = e.mk(); e.gs = ST({ a: 1 }); e.gsFail = why;
    r = await M.draw(1);
    chk(!r.ok && r.reason === why && e.txCalls === 0 && JSON.stringify(M.owned()) === '{"a":1}', '서버 뽑기 실패(' + why + ') — 옛 길로 넘기지 않고 이 PC 도 그대로');
  }
  chk(e.gsLoads === 1, '  실패하면 서버 값을 다시 받으러 간다(시간 초과 뒤 서버엔 들어갔을 수 있다)');
  e = mkEnv({ source: 'server', uid: null, saved: [G('a')] }); M = e.mk();
  r = await M.draw(1); chk(!r.ok && r.reason === 'nouser' && !e.gsDraws.length, '  내 코드가 없으면 서버에 가지도 않는다');

  /* 맞추기 — 받기만 · 합치지 않음 · 못 받으면 아무것도 안 함 */
  e = mkEnv({ source: 'server', level: 10, saved: [G('a')], ls: { 'tw.gachaOwned': '{"a":2,"loc":3}' } }); M = e.mk(); e.gs = ST({ a: 1 });
  await M.syncGachaToServer('tick');
  chk(JSON.stringify(M.owned()) === '{"a":1}' && e.txCalls === 0 && e.loads === undefined && e.pushes.length === 0, '맞추기 — 서버 값을 받는다(이 PC 의 큰 값 · 이 PC 에만 있는 것도 안 올림 · Firebase 안 읽음)');
  e.gs = ST({ b: 2 }); await M.syncGachaToServer('transfer', 'pull');
  chk(JSON.stringify(M.owned()) === '{"b":2}', '  계정 연동(pull)도 서버 값');
  e = mkEnv({ source: 'server', level: 10, saved: [G('a')], ls: { 'tw.gachaOwned': '{"a":2}' } }); M = e.mk(); e.gsFail = 'offline';
  e.seats.push({ remote: false, charDef: { equippedParts: { hat: [{ id: 'a' }] } }, stackedPartObjs: { hat: {} } });
  await M.syncGachaToServer('tick');
  chk(JSON.stringify(M.owned()) === '{"a":2}' && !M.state.srvSeen() && !e.prunedDef.length, '  못 받으면 아무것도 안 바꾸고 착용도 안 벗긴다');
  /* 늦게 온 상태 받기 — 받는 사이 뽑기가 끝나면 그 답(뽑기 전 상태)은 버린다 */
  e.source = 'server'; e.gsFail = null; e.gs = ST({ a: 1 }); await M.syncGachaToServer('tick');
  let release; e.gsHold = new Promise(r => { release = r; });
  const pend = M.syncGachaToServer('inv-open');
  e.gs = ST({ a: 2 }); e.gsOut = [{ id: 'a', count: 2, isNew: false, unlockedColor: false }];
  e.gsHold = null; r = await M.draw(1);
  release(); await pend; await flush();
  chk(JSON.stringify(M.owned()) === '{"a":2}', '  받는 사이 뽑기가 끝나면 늦게 온 옛 상태로 덮지 않는다(방금 뽑은 a 2개 유지)');
  e.gs = ST({});
  chk(M.unsynced({}) === 0, '  로그아웃 검문 — 서버 길은 이 PC 몫을 올리지 않으니 «서버에 없는 뽑기» 로 세지 않는다');
  e.source = 'firebase'; chk(M.unsynced({}) === 2, '  ↳ 옛 길은 그대로 센다');
  M.resetMemory();
  chk(M.seasonNow() === 'spring' && M.ticketsEarned() === 2, '로그아웃 지우기 뒤 · 옛 길로 돌아가면 이 PC 의 레벨 · 시계로 센다');
});

await sec('── 4. 서버 동기화', async () => {
  let e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '100' }, srv: { owned: { a: 2, b: 1 }, ts: 50 } });
  let M = e.mk(); await M.syncGachaToServer('boot');
  chk(JSON.stringify(M.owned()) === '{"a":2,"b":1}' && M.state.ts() === 50 && !e.pushes.length, '서버가 원본 — 이 PC 에만 있는 뽑기가 없으면 받기만 한다(ts 가 작아도 · 쓰기 0)');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '300' }, srv: { owned: { b: 2 }, ts: 200 } });
  M = e.mk(); await M.syncGachaToServer('tick');
  chk(e.pushes.length === 1 && JSON.stringify(e.srv.owned) === '{"b":2,"a":1}' && JSON.stringify(M.owned()) === '{"b":2,"a":1}', '이 PC 에만 있는 뽑기 — 덮어쓰지 않고 합쳐 올린다(서버의 b 가 남는다)');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '100' }, srv: { owned: { b: 2 }, ts: 200 } });
  M = e.mk(); await M.syncGachaToServer('tick');
  chk(JSON.stringify(e.srv.owned) === '{"b":2,"a":1}', '  ts 가 작아도 합친다 — 예전엔 «서버가 새것» 이라 이 PC 의 a 를 지웠다');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '900' }, srv: { owned: { b: 1 }, ts: 5 } });
  M = e.mk(); await M.syncGachaToServer('transfer', 'pull');
  chk(JSON.stringify(M.owned()) === '{"b":1}' && !e.pushes.length, 'pull(계정 연동) — 합치지 않고 저쪽 것을 받는다(이 PC 사본은 다른 계정 것일 수 있다)');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '900' }, srv: { owned: {}, ts: 0 } });
  M = e.mk(); await M.syncGachaToServer('transfer', 'pull');
  chk(e.pushes.length === 1 && M.owned().a === 1 && e.srv.owned.a === 1, '  저쪽이 비었으면 로컬을 지우지 않고 올린다');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":2,"c":1}', 'tw.gachaOwnedTs': '100' }, srv: { owned: { a: 1, b: 3 }, ts: SPRING + 60 * 60 * 1000 } });
  M = e.mk(); await M.syncGachaToServer('boot');
  chk(JSON.stringify(M.owned()) === '{"a":2,"b":3,"c":1}' && e.pushes.length === 1 && e.pushes[0].ts === SPRING, '시계가 틀어진(미래) ts 와 상관없이 파츠마다 큰 쪽 · 쓸 때 지금 시각');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '100' }, srv: null, saved: [G('a')] });
  M = e.mk(); await M.syncGachaToServer('boot');
  chk(M.owned().a === 1 && !e.pushes.length && M.state.srvSeen() === false, '읽기 실패(null) — 아무것도 안 하고 «서버를 읽었다» 도 안 선다');
  e = mkEnv({ uid: null }); M = e.mk(); await M.syncGachaToServer('boot');
  chk(!e.loads, 'uid 가 정해지기 전이면 읽지도 않는다');
  e = mkEnv({ noApi: true }); M = e.mk(); let ok = true; try{ await M.syncGachaToServer('boot'); }catch(_){ ok = false; }
  chk(ok, 'firebaseAPI 가 없으면 조용히 돌아간다');
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":1}', 'tw.gachaOwnedTs': '300' }, srv: { owned: {}, ts: 1 } });
  e.txFail = 'denied'; M = e.mk(); await M.syncGachaToServer('tick');
  chk(e.denied.join() === '가챠' && M.owned().a === 1, '쓰기가 거부되면 🔑 안내(_warnServerWriteDenied) · 이 PC 뽑기는 지우지 않는다');
  /* 규칙이 거부하는 옛 키(null · 앞뒤 공백)는 다시 쓰지 않는다 — 하나라도 실으면 트랜잭션 전체가 거부된다 */
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"c":1}' }, srv: { owned: { 'null': 1, ' a': 2, 'b ': 1, b: 1 }, ts: 1 } });
  M = e.mk(); await M.syncGachaToServer('tick');
  chk(e.pushes.length === 1 && JSON.stringify(e.pushes[0].owned) === '{"b":1,"c":1}', '규칙이 거부하는 키(null · 앞뒤 공백)는 걸러서 쓴다 (' + JSON.stringify(e.pushes[0] && e.pushes[0].owned) + ')');
  /* 규칙 파일과 대조 — 앱이 쓰는 (키, 값)은 규칙 owned/$partId .validate 를 늘 통과하고, 규칙이 받는 값은 버리지 않는다 */
  {
    const RULES = read('firebase-database-rules.json');
    const rule = RULES && (((((JSON.parse(RULES).rules || {}).users || {})['$userId'] || {}).gacha || {}).owned || {})['$partId'];
    const src = rule && rule['.validate'];
    chk(typeof src === 'string', '규칙 파일에 users/$userId/gacha/owned/$partId .validate 가 있다');
    const expr = String(src || 'false')
      .replace(/\$partId\.matches\(/g, 'RX(k, ').replace(/\$partId\.beginsWith\(/g, 'k.startsWith(').replace(/\$partId\.endsWith\(/g, 'k.endsWith(')
      .replace(/newData\.isNumber\(\)/g, "(typeof v === 'number')").replace(/newData\.val\(\)/g, 'v');
    const evalRule = new Function('RX', 'k', 'v', 'return (' + expr + ');');
    const rulePass = (k, v) => { try{ return !!evalRule((x, re) => re.test(x), k, v); }catch(_){ return false; } };
    const sample = { 'null': 1, 'undefined': 2, 'NaN': 3, ' lead': 1, 'trail ': 1, 'ok1': 1, 'big': 10000, 'neg': -2, 'zero': 0, 'frac': 2.7, 'str': '3', 'max': 9999 };
    e = mkEnv({ ls: { 'tw.gachaOwned': '{"mine":1}' }, srv: { owned: sample, ts: 1 } });
    M = e.mk(); await M.syncGachaToServer('tick');
    const out = (e.pushes[0] || {}).owned || {};
    const bad = Object.keys(out).filter(k => !rulePass(k, out[k]));
    chk(e.pushes.length === 1 && !bad.length, '  앱이 쓰는 값은 전부 규칙을 통과한다' + (bad.length ? ' — 걸림: ' + bad.join(',') : ''));
    const lost = Object.keys(sample).filter(k => rulePass(k, sample[k]) && sample[k] > 0 && !(k in out));
    chk(!lost.length && out.big === 9999 && out.max === 9999 && out.frac === 2 && out.str === 3 && out.mine === 1,
        '  규칙이 받는 키는 버리지 않는다 · 상한 9999 로 자름 · 소수 · 글자 숫자는 정수로 (' + JSON.stringify(out) + ')');
    chk(rulePass('a', 1) && !rulePass('null', 1) && !rulePass(' a', 1) && !rulePass('a', 10000), '  (대조기 자체 확인 — 규칙 해석이 맞다)');
  }
  /* 로그아웃 검문 — 서버에 없는 이 PC 의 뽑기 수 */
  e = mkEnv({ ls: { 'tw.gachaOwned': '{"a":2,"c":1}' } }); M = e.mk();
  chk(M.unsynced({ a: 1 }) === 2 && M.unsynced({ a: 2, c: 1, z: 9 }) === 0 && M.unsynced(null) === 3 && M.unsynced({ a: 5 }) === 1,
      '로그아웃 검문 — 서버에 없는 뽑기 수(파츠마다 개수 차 · 서버가 더 많으면 0 · 서버 빔이면 전부)');
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
  const pDraw = e.els.gachaDraw5.onclick();
  chk(e.els.gachaDraw1.disabled === true && /rumble/.test(e.els.gachaDrawStage.innerHTML) && !e.els.gachaDrawStage.querySelector('.gc-reveal'), '서버 저장을 기다리는 동안 — 뽑기 버튼 잠금 · 캡슐 떨림 · 아직 결과 없음');
  await pDraw;
  chk(e.els.gachaDrawClose.style.pointerEvents !== 'none', '  닫기(✕)는 잠그지 않는다');
  e.runTimers();
  const wrap = e.els.gachaDrawStage.querySelector('.gc-cap-wrap');
  const reveal = wrap && wrap.children.find(c => c.className === 'gc-reveal');
  chk(!!reveal && reveal.children.length === 2 && wrap.classList.contains('crack') && wrap.classList.contains('wide'), '갈라짐(2회 이상은 wide — 토큰 하나씩) · 결과 둘');
  chk(e.els.gachaDraw1.disabled === true && /남은 뽑기 <b>0회<\/b>/.test(e.els.gachaDrawBar.innerHTML), '끝나면 정보줄 갱신 · 남은 뽑기 0 이면 버튼 꺼짐');
  e.els.gachaBackInv.onclick();
  chk(M.isInvOpen() && !M.isDrawOpen(), '보관함으로 — 방금 뽑은 파츠가 있는 페이지');
  e.els.gachaGoDraw.onclick(); e.toasts.length = 0;
  await e.els.gachaDraw1.onclick();
  chk(e.toasts.join() === '남은 뽑기가 없어요' && /남은 뽑기가 없어요/.test(e.els.gachaDrawStage.children[0] ? e.els.gachaDrawStage.children[0].textContent : ''), '남은 뽑기가 없으면 안내 · 무대에 문구');
  /* 오류 — 뽑기 안에서 던지면(여기서는 서버 시계) 에러코드로 알리고 잠금을 푼다 */
  e = mkEnv({ level: 10, saved: [G('a')] }); M = e.mk();
  M.openGachaInv(); e.els.gachaGoDraw.onclick();
  e.srvThrows = true;
  await e.els.gachaDraw1.onclick();
  chk(e.errs.join() === 'E-CHAR-12' && e.els.gachaBackInv.disabled === false && /gc-cap-wrap idle/.test(e.els.gachaDrawStage.innerHTML), '뽑기 오류 — E-CHAR-12 · 잠금 풀림 · 대기 캡슐로');
  e.srvThrows = false;
  /* 안내가 던져도 잠금은 풀린다(finally) */
  e = mkEnv({ level: 10, saved: [G('a')] }); M = e.mk();
  M.openGachaInv(); e.els.gachaGoDraw.onclick(); e.txFail = 'denied'; e.errThrows = true;
  try{ await e.els.gachaDraw1.onclick(); }catch(_){}
  chk(e.els.gachaDraw1.disabled === false && e.els.gachaBackInv.disabled === false, '실패 안내가 던져도 뽑기 버튼 잠금이 풀린다');
  /* 서버 저장 실패 — 이유별 번호 · 횟수 그대로 */
  const want = { denied: 'E-CHAR-09', offline: 'E-CHAR-10', timeout: 'E-CHAR-11', error: 'E-CHAR-12' };
  for(const why of Object.keys(want)){
    e = mkEnv({ level: 10, saved: [G('a')] }); M = e.mk();
    M.openGachaInv(); e.els.gachaGoDraw.onclick(); e.txFail = why;
    await e.els.gachaDraw1.onclick();
    chk(e.errs.join() === want[why] && /남은 뽑기 <b>2회<\/b>/.test(e.els.gachaDrawBar.innerHTML) && e.els.gachaDraw1.disabled === false,
        '  ' + why + ' → ' + want[why] + ' · 남은 뽑기 그대로(2회) · 다시 누를 수 있다');
  }
});

await sec('── 7. app.js 배선', () => {
  const code = strip(APP);
  const defs = /function (gachaDraw|gachaPool|syncGachaToServer|pruneUnownedGachaParts|renderGachaInv|openGachaInv|closeGachaInv|toggleGachaInv|_gachaRunDraw|sceneHasColorGroup|_gachaInvOpen)\(|\blet (gachaOwned|_gachaTs|_gachaBonus|_gachaTab|_gachaSelId)\b/;
  chk(!defs.test(code) && defs.test(MOD), '가챠 정의는 모듈에만');
  chk(/^const isGachaPart = deps\.isGachaPart;/m.test(MOD) && !/function isGachaPart\(/.test(MOD) && /isGachaPart: \(\.\.\.a\)=>(premiumMod\.)?isGachaPart\(\.\.\.a\),/.test(APP), '  isGachaPart 는 카탈로그(premium-assets.js)가 정의하고 가챠는 deps 로 받는다(모듈 순환 끊기 3)');
  chk(/gachaMod\.setPartEditor\(\{/.test(APP) && !/\b(openPartRegister|syncPartRegGachaLock|deletePart): \(\.\.\.a\)=>adminPartReg\./.test((APP.match(/TwGacha\.createGacha\(\{([\s\S]*?)\n\}\);/) || [])[1] || ''), '  관리자 등록 · 삭제는 만든 뒤 setPartEditor 로 건다 — 가챠는 관리자 모듈을 부르지 않는다');
  const code2 = code.replace(/const GACHA_OFF = \{[\s\S]*?\};/, '').replace(/\brenderGachaInv: \(\)=>/, '');   // 빈 껍데기 · 👑 달성표 deps 의 이름 칸은 뺀다
  chk(!/(?<![\w$.])(isGachaColorUnlocked|gachaCount|sceneHasColorGroup|syncGachaToServer|pruneUnownedGachaParts|renderGachaInv|toggleGachaInv|_gachaInvOpen|_gachaDrawOpen|_gachaSelId|gachaOwned|_gachaTs|_gachaBonus|_setGachaBonusLocal|GACHA_DUPES_FOR_COLOR)\b/.test(code2), '  app.js 는 옛 이름을 부르지 않는다(gachaMod.이름)');
  chk(/window\.TwGacha = api/.test(MOD) && (code.match(/TwGacha\.createGacha\(/g) || []).length === 1, '모듈은 window.TwGacha · 만드는 곳은 한 곳');
  const iMk = APP.indexOf('TwGacha.createGacha('), iPrev = APP.indexOf('function _starColorOk('), iWarn = APP.indexOf('async function _warnServerWriteDenied('), iTheme = APP.indexOf('/* ═══ 🎨 디자인 테마');
  chk(iPrev > 0 && iMk > iPrev && iWarn > iMk && iTheme > iWarn, '원래 자리 — 🚩 신고 · 별 색 뒤 · 🔑 쓰기 거부 안내 · 🎨 디자인 테마 앞');
  const keys = ["const GACHA_OWNED_KEY = 'tw.gachaOwned';", "const GACHA_TS_KEY    = 'tw.gachaOwnedTs';", "const GACHA_BONUS_KEY = 'tw.gachaBonus';"];
  chk(keys.every(k => APP.includes(k) && APP.indexOf(k) < iMk) && !/'tw\.gacha(Owned|OwnedTs|Bonus)'/.test(strip(MOD)), '저장 키 세 줄은 app.js(계정 전환 지움 목록) — 모듈은 deps 값으로');
  const call = (APP.match(/TwGacha\.createGacha\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  const fnDeps = deps.filter(l => /^\w+: \(\.\.\.a\)=>[\w$.]+\(\.\.\.a\),$/.test(l));   // 파츠 등록 창 셋은 adminPartReg.이름
  const getters = ['isAdmin: ()=>isAdmin,', 'savedParts: ()=>savedParts,', 'partCats: ()=>PART_CATS,', 'wdDraftDef: ()=>wdDraftDef,', 'activeWdAdj: ()=>activeWdAdj,', 'setActiveWdAdj: (v)=>{ activeWdAdj = v; },'];
  const vals = ['seats: seats,', 'slots: slots,', 'presence: Presence,', 'ownedKey: GACHA_OWNED_KEY,', 'tsKey: GACHA_TS_KEY,', 'bonusKey: GACHA_BONUS_KEY,'];
  chk(deps.length === 41 && fnDeps.length === 27 && getters.every(g => deps.includes(g)) && vals.every(v => deps.includes(v)),
      'deps 41개 — 함수 27은 화살표 · 다시 대입되는 let 5는 읽는 함수 + 쓰는 함수 1 · const 셋과 저장 키 셋은 값 (' + deps.length + ' · 화살표 ' + fnDeps.length + ')');
  chk(['seats', 'slots', 'Presence'].every(n => { const i = APP.search(new RegExp('^const ' + n + '\\s*=', 'm')); return i > 0 && i < iMk; }), '  seats · slots · Presence 는 만드는 줄보다 앞에 선언된 const');
  const m = strip(MOD);
  chk(!/[^.\w$](activeWdAdj|isAdmin|savedParts|PART_CATS|wdDraftDef)\s*=[^=]/.test(m.replace(/const (activeWdAdj|isAdmin|savedParts|PART_CATS|wdDraftDef) = deps\.\w+;/g, '')), '모듈은 app.js 의 let 에 직접 쓰지 않는다(쓰는 함수로)');
  const calls = ['gachaMod.toggleGachaInv();', 'gachaMod.isInvOpen()', 'gachaMod.isDrawOpen()', 'gachaMod.pruneUnownedGachaParts();', 'gachaMod.selId()',
    'gachaMod.isGachaPart(', 'gachaMod.isGachaColorUnlocked(', 'gachaMod.gachaCount(', 'gachaMod.DUPES_FOR_COLOR', 'gachaMod.sceneHasColorGroup(',
    'gachaMod.renderGachaInv();', "gachaMod.syncGachaToServer('launcher');", "call(gachaMod.syncGachaToServer, 'logout');", 'gachaMod.owned()', 'gachaMod.resetMemory();',
    'setGachaBonusLocal: (...a)=>gachaMod.setBonusLocal(...a),', 'renderGachaInv: ()=>gachaMod.renderGachaInv(),', 'gachaBonus: ()=>gachaMod.bonus(),'];
  const callCode = code + '\n' + strip(PREG).replace(/gachaMod\(\)/g, 'gachaMod');   // 파츠 등록 창(admin-part-register.js)이 부르는 곳까지
  const miss = calls.filter(c => !callCode.includes(c));
  chk(!miss.length && (callCode.match(/gachaMod\.isGachaPart\(/g) || []).length === 5 && (callCode.match(/gachaMod\.pruneUnownedGachaParts\(\)/g) || []).length === 3,
      '부르는 곳 — T 키 · 꾸미기 색상 영역 · 파츠 등록 · 카탈로그 · 런처 · 로그아웃 · 👑 달성표(연동 pull 은 0.13 에서 걷음) (' + (miss[0] || '다 있음') + ')');
  const off = (APP.match(/const GACHA_OFF = \{([\s\S]*?)\};/) || [])[1] || '';
  const used = [...new Set((code.match(/gachaMod\.(\w+)/g) || []).map(s => s.split('.')[1]))];
  chk(!/\bGACHA_OFF\b/.test(APP), '빈 껍데기 GACHA_OFF 없음 — 모듈은 늘 싣는다(가드 걷기 3차)');
  const ret = (MOD.match(/\nreturn \{([\s\S]*?)\n\};\n\}/) || [])[1] || '';
  chk(used.every(n => new RegExp('(^|\\n)\\s*' + n + '\\b').test(ret)), '  모듈 반환값도 그 이름을 다 갖는다');
  const iS = HTML.indexOf('<script src="parts/myhome/myhome-sticker.js"></script>'), iG = HTML.indexOf('<script src="parts/character/gacha.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iS > 0 && iG > iS && iA > iG, 'html — gacha.js 를 app.js 앞에 싣는다');
  const iGs = HTML.indexOf('<script src="parts/character/gacha-server.js"></script>');
  chk(iGs > 0 && iGs < iA && deps.includes('gachaServer: gachaServerMod,') && deps.some(l => /^gachaSource: \(\)=>TwSourceSwitch\.store\.pick\('gacha'\),/.test(l))
      && APP.indexOf('const gachaServerMod = TwGachaServer.createGachaServer({') < iMk && APP.indexOf('const gachaServerMod') > 0,
      '  서버 길 — gacha-server.js 를 app.js 앞에 · 만든 것을 deps 로 · 받는 곳은 source-switch(gacha)');
  chk(/^Tw[A-Z]/.test('TwGacha') && !/window\.Gacha\s*=/.test(MOD), '전역 이름은 Tw 접두사(#103 — 크로미움 내장 전역과 겹치지 않게)');
  /* 모듈이 없을 때 — 빈 껍데기 줄만 떼어 굴린다 */
  const wire = (APP.match(/const GACHA_OFF = [\s\S]*?\n\}\);/) || [''])[0];
  let got = null; try{ got = vm.runInNewContext(wire + '\ngachaMod;', { seats: [], slots: [], Presence: {}, GACHA_OWNED_KEY: 'a', GACHA_TS_KEY: 'b', GACHA_BONUS_KEY: 'c' }); }catch(_){}
  chk(/^const gachaMod = TwGacha\.createGacha\(\{/m.test(APP), '만드는 줄에 «없으면 빈 껍데기» 가드가 없다 — 모듈이 안 실리면 그 줄에서 멈춘다(가드 걷기 3차)');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
/* 기다리던 약속이 영영 안 풀려 이벤트 고리가 비면 node 는 0 으로 조용히 끝난다 — 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
