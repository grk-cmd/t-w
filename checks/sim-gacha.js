/* ═══ 🎰 sim-gacha.js — 파츠 가챠 모듈 (character/gacha.js · 서버 원본) ═══════════════
   가챠는 서버가 원본이다 — 보유분 · 뽑기 수 · 시즌 · 색 해금은 서버가 정하고, 뽑기는 서버가 굴린다. 여기서는 모듈을 가짜 DOM · 가짜 서버 위에서 통째로 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwGacha 뿐 · 만들 때는 요청 · 구독 · 타이머 · 저장소 읽기 0 · 창 버튼 · ESC · 바깥 클릭 · blur 연결 · window 고리 셋 · DOM 없으면 조용히
           · startGacha — 서버에서 받기 한 번 + 서버 신호 구독 한 번(두 번 불러도 한 번) · 주기 타이머 없음
   ・2절: 셈 — 서버 값으로 보유 · 색상 해금(서버가 센 값 · 관리자 통과) · 풀(다 모은 것 · 다른 시즌 빠짐) · 남은 뽑기 · 시즌 · 받기 전 값
   ・3절: 뽑기 — 받기 전엔 거절 · 서버에 부탁 · 결과에 카탈로그 항목 · 실패 이유별(이 PC 그대로) · 겹친 누름 · 내 코드 없음
   ・4절: 받기 — 받는 중/못 받음/받음 상태 · 실패에 혼자 다시 안 함 · 오류 번호는 사용자가 연 받기에서만 · 받는 사이 뽑기가 끝나면 옛 답 버림 ·
           진행 중 요청은 끝나고 한 번 더 · 서버 신호 · 미보유 파츠 회수(받은 뒤에만) · 로그아웃 메모리 지우기
   ・5절: 보관함 — 받는 중/못 받음 표시(다시 시도) · 정보줄 · 탭 · 카테고리 · 시즌 · 8칸 페이지 · 잠긴 칸 · 누르면 착용 · 관리자 삭제 · 열기 · 닫기
   ・6절: 뽑기 창 — 연출(잠금 → 결과 → 풀림) · 남은 뽑기 없음 · 뽑기 실패(오류) 안내
   ・7절: app.js 배선 — 정의는 모듈에만 · 만드는 곳 한 곳 · deps 모양 · 부르는 곳은 gachaMod.이름 · html 순서
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
    ls: new Map(), now: opt.now || SPRING,
    level: opt.level || 1, uid: opt.uid === null ? null : 'u1', admin: !!opt.admin,
    saved: opt.saved || [], cats: opt.cats || [{ cat:'hat', label:'모자', icon:'🎩' }, { cat:'glasses', label:'안경', icon:'👓' }],
    draft: null, adj: null, equips: [], commits: 0, denied: [], deleted: [], regs: [], prunedDef: [], saves: 0, colorRefresh: 0,
    seats: [], slots: [], errs: [], rt: {}, rand: [0], randI: 0,
    /* 🎰 서버 길 — gs = 서버 상태({ owned, unlocked, earned, bonus, left, season }) · gsFail = 뽑기 실패 이유 · gsLoadFail = 받기 실패 · gsOut = 이번 뽑기 결과 */
    gs: opt.gs || null, gsFail: null, gsLoadFail: false, gsOut: [], gsLoads: 0, gsDraws: [], gsHold: null,
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
  ctx.TwSafeHtml = globalThis.TwSafeHtml; vm.createContext(ctx);
  vm.runInContext(MOD, ctx, { filename: 'gacha.js' });
  env.ctx = ctx; env.els = els; env.tabs = tabs;
  env.mk = () => { const m = ctx.TwGacha.createGacha({
    toast: (m) => env.toasts.push(m),
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
    isGachaPart: (rec) => !!(rec && rec.gacha),   // 정의는 카탈로그(premium-assets.js) — 같은 한 줄
    notifyError: (code, err) => { env.errs.push(code); if(env.errThrows) throw new Error('알림 깨짐'); },
    gachaApi: {
      load: async () => { env.gsLoads++; const snap = JSON.parse(JSON.stringify(env.gs)); if(env.gsHold) await env.gsHold; if(env.gsLoadFail) throw Object.assign(new Error('x'), { kind: 'unavailable' }); return snap; },
      draw: async (n) => { env.gsDraws.push(n); if(env.gsThrows) throw new Error('깨짐'); if(env.gsFail) return { ok: false, reason: env.gsFail }; return { ok: true, out: env.gsOut, state: JSON.parse(JSON.stringify(env.gs)) }; },
    },
    rtOn: (kind, fn) => { (env.rt[kind] = env.rt[kind] || []).push(fn); return () => {}; },
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

/* 서버 상태 한 벌 — earned 는 뽑을 수 있는 총수 · left 는 남은 수(보유 합을 뺀 값은 서버가 센다) */
const ST = (owned, extra) => Object.assign({ owned, unlocked: {}, earned: 3, bonus: 0, left: 3 - Object.values(owned).reduce((a, b) => a + b, 0), season: 'spring' }, extra || {});
/* 만들고 서버에서 한 번 받아 «받음» 상태로 */
const ready = async (e, gs) => { e.gs = gs; const M = e.mk(); await M.pullGacha(false); return M; };

await sec('── 1. 만들 때 · 시작', async () => {
  const e = mkEnv();
  chk(typeof e.ctx.TwGacha.createGacha === 'function' && Object.keys(e.ctx.TwGacha).join() === 'createGacha', '싣기만 하면 window.TwGacha(createGacha) 하나뿐');
  chk(!e.timers.length && !e.intervals.length && !e.docL.keydown && !e.ctx.openGachaInv, '  싣기만 해서는 타이머 · 이벤트 · 고리가 없다');
  e.gs = ST({ a: 1 });
  const M = e.mk();
  chk(e.gsLoads === 0 && !Object.keys(e.rt).length && !e.timers.length && !e.intervals.length && e.ls.size === 0,
      '만들 때는 요청 · 서버 신호 구독 · 타이머 · 저장소 쓰기가 0 — 계정 확인 뒤 startGacha 가 한다');
  chk(M.state.load() === 'idle' && JSON.stringify(M.owned()) === '{}', '  시작 전에는 «받지 않음»(idle) · 보유분은 빈 값');
  M.startGacha(); await flush();
  chk(e.gsLoads === 1 && e.rt.collection && e.rt.collection.length === 1 && M.state.load() === 'ready' && M.gachaCount('a') === 1, 'startGacha — 서버에서 한 번 받고 서버 신호(collection)를 듣는다');
  chk(!e.timers.length && !e.intervals.length, '  주기 타이머 · 부팅 지연 타이머가 없다');
  M.startGacha(); await flush();
  chk(e.gsLoads === 1 && e.rt.collection.length === 1, '  두 번 불러도 받기 · 구독은 한 번');
  chk(typeof e.els.gachaInvClose.onclick === 'function' && typeof e.els.gachaGoDraw.onclick === 'function' && typeof e.els.gachaDraw1.onclick === 'function'
      && typeof e.els.gachaDraw5.onclick === 'function' && typeof e.els.gachaBackInv.onclick === 'function' && typeof e.els.gachaDrawClose.onclick === 'function', '창 버튼 연결(✕ 둘 · 뽑으러 가기 · 1회 · 5연속 · 보관함으로)');
  chk(e.docL.keydown && e.docL.keydown.length === 1 && e.docL.mousedown && e.docL.mousedown.length === 1 && e.winL.blur && e.winL.blur.length === 1, 'ESC · 바깥 클릭 · blur 닫기 연결');
  chk(typeof e.ctx.openGachaInv === 'function' && typeof e.ctx.closeGachaInv === 'function' && typeof e.ctx._gachaRestorePos === 'function', 'window 고리 셋(openGachaInv · closeGachaInv · _gachaRestorePos) 그대로');
  chk(Array.isArray(e.ctx.__winPosResetters) && e.ctx.__winPosResetters.length === 1, '🪟 창 위치 초기화 목록에 한 자리');
  const e4 = mkEnv({ noDom: true }); let ok = true; try{ e4.mk(); }catch(_){ ok = false; }
  chk(ok && !e4.docL.keydown && !e4.ctx.openGachaInv, 'DOM 이 없으면 창 연결 없이 조용히 넘어간다');
  const e5 = mkEnv({ uid: null }); e5.gs = ST({}); const M5 = e5.mk(); M5.startGacha(); await flush();
  chk(e5.gsLoads === 0 && M5.state.load() === 'idle', '내 코드가 없으면 받지 않는다(요청 0)');
});

await sec('── 2. 셈 — 보유 · 색상 해금 · 풀 · 남은 뽑기', async () => {
  const e = mkEnv({ saved: [G('a'), G('b'), G('n', { noColor: true }), G('w', { season: 'winter' }), G('s', { season: 'spring' }), { id: 'x', cat: 'hat' }] });
  const M0 = e.mk();
  chk(M0.ticketsEarned() === 0 && M0.ticketsLeft() === 0 && M0.seasonNow() === null && M0.bonus() === 0, '받기 전 — 뽑기 수 0 · 시즌 null(이 PC 레벨 · 시계로 세지 않는다)');
  chk(M0.isGachaColorUnlocked('a') === false, '  받기 전엔 해금도 «아직»');
  const M = await ready(e, ST({ a: 4, b: 1, n: 1 }, { unlocked: { a: true, n: true }, earned: 9, bonus: 5, left: 3 }));
  chk(M.isGachaPart(G('a')) && !M.isGachaPart({ id: 'x' }) && !M.isGachaPart(null), 'isGachaPart — rec.gacha 만');
  chk(M.isGachaColorUnlocked('a') && !M.isGachaColorUnlocked('b'), '색상 해금은 서버가 센 값(4개 모은 a 만)');
  chk(M.isGachaColorUnlocked('n'), '  색 없는 파츠(noColor)도 서버가 «열림» 이라 하면 열림');
  e.admin = true; chk(M.isGachaColorUnlocked('b'), '  관리자는 게이트 통과(검수)'); e.admin = false;
  chk(M.pool().map(p => p.id).join() === 'b,s', '풀 — 다 모은 것(a · n) · 다른 시즌(겨울)은 빠진다 (' + M.pool().map(p => p.id).join() + ')');
  chk(M.seasonNow() === 'spring', '  시즌은 서버 값');
  chk(M.ticketsEarned() === 9 && M.ticketsLeft() === 3 && M.bonus() === 5, '남은 뽑기 · 총 · 보너스는 서버가 센 값 그대로(보유 합으로 다시 세지 않는다)');
  chk(M.sceneHasColorGroup({ traverse(f){ f({ isMesh: true, name: 'cap_col1', material: {} }); } }) === true
      && M.sceneHasColorGroup({ traverse(f){ f({ isMesh: true, name: 'cap', material: { name: 'm_col' } }); } }) === true
      && M.sceneHasColorGroup({ traverse(f){ f({ isMesh: true, name: 'cap', material: { name: 'm' } }); } }) === false
      && M.sceneHasColorGroup({ traverse(){ throw new Error('x'); } }) === true, 'sceneHasColorGroup — 메쉬 · 머티리얼 이름의 _col · 못 훑으면 «있다»');
  chk(M.DUPES_FOR_COLOR === 4, 'DUPES_FOR_COLOR = 4');
  chk(e.ls.size === 0, '이 PC 에 가챠 값을 쓰지 않는다(localStorage 0)');
});

await sec('── 3. 뽑기', async () => {
  let e = mkEnv({ saved: [G('a'), G('w', { season: 'winter' })] });
  let M = await ready(e, ST({ a: 1 }));
  e.gs = ST({ a: 1, w: 1 }, { left: 1 }); e.gsOut = [{ id: 'w', count: 1, isNew: true, unlockedColor: false }];
  let r = await M.draw(5);
  chk(r.ok && e.gsDraws.join() === '5', '뽑기는 서버에 부탁한다(요청 횟수 그대로 — 모자란 만큼 줄이는 건 서버)');
  chk(r.out.length === 1 && r.out[0].id === 'w' && r.out[0].rec && r.out[0].rec.id === 'w' && r.out[0].isNew, '  결과에 카탈로그 항목(rec)을 붙인다 — 연출이 이름 · 그림을 읽는다');
  chk(JSON.stringify(M.owned()) === '{"a":1,"w":1}' && M.ticketsLeft() === 1 && e.ls.size === 0, '  뽑은 뒤 상태는 서버 답 그대로 · 이 PC 에 적지 않는다');
  e.gsOut = [{ id: 'gone', count: 1, isNew: true, unlockedColor: false }];
  r = await M.draw(1); chk(r.ok && r.out[0].rec.name === '파츠', '  카탈로그에 없는 파츠는 이름 없는 칸으로(연출이 멈추지 않게)');
  e.gsOut = []; e.gs = ST({ a: 1, w: 1 }, { left: 0 });
  r = await M.draw(1); chk(r.ok && r.out.length === 0 && M.ticketsLeft() === 0, '  서버가 «뽑을 것 없음(빈 결과)» 이라 하면 성공 · 빈 결과');
  for(const why of ['offline', 'timeout', 'nouser', 'error']){
    e = mkEnv({ saved: [G('a')] }); M = await ready(e, ST({ a: 1 })); e.gsFail = why;
    r = await M.draw(1);
    chk(!r.ok && r.reason === why && JSON.stringify(M.owned()) === '{"a":1}' && M.ticketsLeft() === 2, '서버 뽑기 실패(' + why + ') — 이 PC 그대로(보유 · 횟수)');
  }
  e = mkEnv({ saved: [G('a')] }); M = e.mk(); e.gs = ST({});
  r = await M.draw(1); chk(!r.ok && r.reason === 'nouser' && !e.gsDraws.length, '받기 전에는 보내지 않는다(요청 0) — 보유분을 모른다');
  e = mkEnv({ saved: [G('a')], uid: null }); M = e.mk();
  r = await M.draw(1); chk(!r.ok && r.reason === 'nouser' && !e.gsDraws.length, '  내 코드가 없어도 보내지 않는다');
  e = mkEnv({ saved: [G('a')] }); M = await ready(e, ST({}));
  e.gsLoadFail = false; e.gs = ST({ a: 1 });
  const [r1, r2] = await Promise.all([M.draw(1), M.draw(1)]);
  chk(r1.ok && !r2.ok && r2.reason === 'busy' && e.gsDraws.length === 1, '뽑는 중에 또 누르면 «busy» — 서버에 두 번 가지 않는다');
});

await sec('── 4. 받기 — 상태 · 실패 · 경합 · 신호 · 회수', async () => {
  let e = mkEnv({ saved: [G('a')] });
  e.gs = ST({ a: 2 }); e.gsLoadFail = true;
  let M = e.mk();
  let res = await M.pullGacha(false);
  chk(res === 'failed' && M.state.load() === 'failed' && e.errs.length === 0 && e.gsLoads === 1, '못 받음 — failed 로 남고 오류 번호는 안 띄운다(서버 신호 · 시작에서는 조용히)');
  await flush(); e.timers.length && e.runTimers();
  chk(e.gsLoads === 1 && !e.timers.length && !e.intervals.length, '  혼자 다시 받지 않는다(타이머 · 되풀이 0)');
  res = await M.pullGacha(true);
  chk(res === 'failed' && e.errs.join() === 'E-CHAR-15', '  사용자가 연 · 누른 받기가 실패하면 E-CHAR-15');
  e.gsLoadFail = false; res = await M.pullGacha(true);
  chk(res === 'ready' && M.state.load() === 'ready' && M.gachaCount('a') === 2, '  다시 시도 — 받으면 ready');
  /* 받은 뒤 한 번 실패해도 알던 값은 그대로 */
  e.gsLoadFail = true; res = await M.pullGacha(false);
  chk(res === 'failed' && M.state.load() === 'ready' && M.gachaCount('a') === 2, '받은 뒤 한 번 못 받아도 알던 값 · ready 는 그대로');
  e = mkEnv({ saved: [G('a')] }); e.gs = ST({}); e.mk().startGacha(); await flush();
  chk(e.gsLoads === 1, '(참고) 빈 보유분 응답은 성공 — 빈 목록 ≠ 못 받음');
  /* 받는 사이 뽑기가 끝나면 늦게 온 옛 상태로 덮지 않는다 */
  e = mkEnv({ saved: [G('a')] }); M = await ready(e, ST({ a: 1 }));
  let release; e.gsHold = new Promise(r => { release = r; });
  const pend = M.pullGacha(false);
  e.gs = ST({ a: 2 }); e.gsOut = [{ id: 'a', count: 2, isNew: false, unlockedColor: false }];
  const saveHold = e.gsHold; e.gsHold = null;
  const r = await M.draw(1);
  e.gsHold = saveHold; release(); await pend; await flush();
  chk(r.ok && JSON.stringify(M.owned()) === '{"a":2}', '받는 사이 뽑기가 끝나면 늦게 온 옛 상태로 덮지 않는다(방금 뽑은 a 2개 유지)');
  /* 진행 중인 받기에 들어온 요청 — 끝난 뒤 한 번 더 */
  e = mkEnv({ saved: [G('a')] }); e.gs = ST({}); M = e.mk();
  e.gsHold = new Promise(r => { release = r; });
  const p1 = M.pullGacha(false); await flush();
  const p2 = await M.pullGacha(false);
  chk(p2 === 'skipped' && e.gsLoads === 1, '진행 중이면 두 번째 요청은 바로 보내지 않는다');
  e.gsHold = null; release(); await p1; await flush(); await flush();
  chk(e.gsLoads === 2, '  끝나면 삼켜진 요청을 한 번 더 받는다');
  /* 서버 신호 */
  e = mkEnv({ saved: [G('a')] }); e.gs = ST({ a: 1 }); M = e.mk(); M.startGacha(); await flush();
  e.gs = ST({ a: 3 }); e.rt.collection[0]({ kind: 'collection' }); await flush();
  chk(e.gsLoads === 2 && M.gachaCount('a') === 3, '서버 신호(collection) — 다시 받아 그 값으로');
  M.refreshAfterReward(); await flush();
  chk(e.gsLoads === 3, '달성표 보상 뒤 — 서버에서 다시 받는다(보너스를 값으로 받아 적지 않음)');
  /* 미보유 파츠 회수 — 받은 뒤에만 */
  e = mkEnv({ saved: [G('g'), { id: 'n', cat: 'hat' }] });
  const seat = { remote: false, charDef: { equippedParts: { hat: [{ id: 'g' }, { id: 'n' }] } }, stackedPartObjs: { hat: { g: {} } } };
  e.seats.push(seat); e.slots.push({ equippedParts: { hat: [{ id: 'g' }] } });
  e.gs = ST({}); M = e.mk();
  chk(M.pruneUnownedGachaParts() === 0 && e.prunedDef.length === 0, '서버에서 받기 전에는 벗기지 않는다');
  e.gsLoadFail = true; await M.pullGacha(false);
  chk(!e.prunedDef.length && seat.charDef.equippedParts.hat.length === 2, '  못 받았으면 벗기지 않는다(보유분을 모른다)');
  e.gsLoadFail = false; await M.pullGacha(false);
  chk(e.prunedDef.join() === 'g,g' && !seat.stackedPartObjs.hat.g && seat.charDef.equippedParts.hat.length === 1 && e.saves === 1, '받은 뒤 — 좌석 · 슬롯의 미보유 가챠 파츠를 벗긴다(일반 파츠는 그대로) · 슬롯 저장');
  chk(e.toasts.some(t => /보유하지 않은 가챠 파츠 2개/.test(t)), '  조용히 벗기지 않는다(안내)');
  e.admin = true; seat.charDef.equippedParts.hat.push({ id: 'g' });
  chk(M.pruneUnownedGachaParts() === 0, '  관리자는 건너뛴다(보유 없이 착용해 검수)'); e.admin = false;
  /* 로그아웃 지우기 */
  e = mkEnv({ saved: [G('a')] }); M = await ready(e, ST({ a: 1 }, { bonus: 2 }));
  M.resetMemory();
  chk(JSON.stringify(M.owned()) === '{}' && M.state.load() === 'idle' && M.bonus() === 0 && M.ticketsLeft() === 0 && M.seasonNow() === null, '로그아웃 지우기 — 보유 · 뽑기 수 · 보너스 · 받음 상태를 비운다');
  /* 지우는 사이 나간 받기는 새 계정 값을 덮지 않는다 */
  e = mkEnv({ saved: [G('a')] }); e.gs = ST({ a: 1 }); M = e.mk();
  e.gsHold = new Promise(r => { release = r; });
  const pp = M.pullGacha(false); await flush();
  M.resetMemory(); release(); await pp; await flush();
  chk(JSON.stringify(M.owned()) === '{}' && M.state.load() === 'idle', '  계정을 놓는 사이 나간 받기의 답은 버린다(앞 계정 값이 남지 않는다)');
});

await sec('── 5. 보관함', async () => {
  const many = []; for(let i = 0; i < 10; i++) many.push(G('p' + i, { order: i, cat: i < 7 ? 'hat' : 'glasses', season: i === 9 ? 'spring' : (i === 8 ? 'winter' : undefined) }));
  const owned = {}; for(let i = 0; i < 9; i++) owned['p' + i] = i === 2 ? 4 : 1;
  const e = mkEnv({ level: 50, saved: many });
  e.gs = ST(owned, { earned: 12, bonus: 2, left: 3 });
  const M = e.mk();
  M.openGachaInv();
  chk(/불러오는 중/.test(e.els.gachaInvBar.textContent) && e.els.gachaInvGrid.children.length === 1 && !cells(e.els.gachaInvGrid).length, '열면 서버에서 받는 중 — «불러오는 중…» (빈 보관함을 그리지 않는다)');
  await flush(); await flush();
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
  /* 못 받음 — 빈 보관함이 아니라 «못 불러왔어요 · 다시 시도» */
  const f = mkEnv({ saved: [G('a')] }); f.gs = ST({}); f.gsLoadFail = true;
  const MF = f.mk(); MF.openGachaInv(); await flush(); await flush();
  chk(MF.state.load() === 'failed' && /못 불러왔어요/.test(f.els.gachaInvBar.textContent) && f.errs.length === 0 && f.els.gachaInvGrid.children[0].children.some(c => c.id === 'gachaRetry'),
      '못 받음 — «못 불러왔어요» + 다시 시도 단추(처음 연 받기는 번호를 안 띄우고 화면이 말한다)');
  f.gsLoadFail = false; f.els.gachaInvGrid.children[0].children.find(c => c.id === 'gachaRetry').onclick(); await flush(); await flush();
  chk(MF.state.load() === 'ready' && f.gsLoads === 2 && f.timers.length === 0, '  다시 시도 → 받으면 ready · 혼자 되풀이한 요청 없음(총 2번)');
  f.gsLoadFail = true; MF.resetMemory(); MF.openGachaInv(); await flush(); await flush(); MF.closeGachaInv();
  f.gsLoadFail = true; MF.openGachaInv(); await flush(); await flush();
  chk(f.gsLoads >= 3 && MF.state.load() === 'failed', '  닫았다 다시 열면 한 번 더 받는다(열기 = 사용자가 여는 길)');
});

await sec('── 6. 뽑기 창', async () => {
  const open = async (e, gs) => { e.gs = gs; const M = e.mk(); M.openGachaInv(); await flush(); await flush(); return M; };
  let e = mkEnv({ saved: [G('a'), G('b')] });
  let M = await open(e, ST({}, { earned: 2, left: 2 }));
  e.els.gachaGoDraw.onclick();
  chk(e.els.gachaDrawOverlay.style.display === 'block' && e.els.gachaInvOverlay.style.display === 'none' && /gc-cap-wrap idle/.test(e.els.gachaDrawStage.innerHTML), '뽑으러 가기 — 대기 캡슐');
  chk(/남은 뽑기 <b>2회<\/b>/.test(e.els.gachaDrawBar.innerHTML) && e.els.gachaDraw5.textContent === '2연속 뽑기' && !e.els.gachaDraw5.disabled, '정보줄 · 5연속은 남은 수만큼(죽이지 않는다)');
  e.gs = ST({ a: 1, b: 1 }, { earned: 2, left: 0 });
  e.gsOut = [{ id: 'a', count: 1, isNew: true, unlockedColor: false }, { id: 'b', count: 1, isNew: true, unlockedColor: false }];
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
  chk(e.toasts.join() === '남은 뽑기가 없어요' || e.els.gachaDraw1.disabled, '남은 뽑기가 없으면 버튼이 꺼져 있다(눌러도 서버에 안 간다)');
  /* 뽑기 안에서 던지면(여기서는 서버 길) 에러코드로 알리고 잠금을 푼다 */
  e = mkEnv({ saved: [G('a')] }); M = await open(e, ST({}, { earned: 2, left: 2 }));
  e.els.gachaGoDraw.onclick(); e.gsThrows = true;
  await e.els.gachaDraw1.onclick();
  chk(e.errs.join() === 'E-CHAR-12' && e.els.gachaBackInv.disabled === false && /gc-cap-wrap idle/.test(e.els.gachaDrawStage.innerHTML), '뽑기 오류 — E-CHAR-12 · 잠금 풀림 · 대기 캡슐로');
  /* 안내가 던져도 잠금은 풀린다(finally) */
  e = mkEnv({ saved: [G('a')] }); M = await open(e, ST({}, { earned: 2, left: 2 }));
  e.els.gachaGoDraw.onclick(); e.gsFail = 'nouser'; e.errThrows = true;
  try{ await e.els.gachaDraw1.onclick(); }catch(_){}
  chk(e.els.gachaDraw1.disabled === false && e.els.gachaBackInv.disabled === false, '실패 안내가 던져도 뽑기 버튼 잠금이 풀린다');
  /* 서버 저장 실패 — 이유별 번호 · 횟수 그대로 */
  const want = { nouser: 'E-CHAR-09', offline: 'E-CHAR-10', timeout: 'E-CHAR-11', error: 'E-CHAR-12' };
  for(const why of Object.keys(want)){
    e = mkEnv({ saved: [G('a')] }); M = await open(e, ST({}, { earned: 2, left: 2 }));
    e.els.gachaGoDraw.onclick(); e.gsFail = why;
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
  const iMk = APP.indexOf('TwGacha.createGacha('), iPrev = APP.indexOf('function _starColorOk('), iTheme = APP.indexOf('/* ═══ 🎨 디자인 테마');
  chk(iPrev > 0 && iMk > iPrev && iTheme > iMk, '원래 자리 — 🚩 신고 · 별 색 뒤 · 🎨 디자인 테마 앞');
  chk(!/GACHA_(OWNED|TS|BONUS)_KEY/.test(APP) && !/'tw\.gacha(Owned|OwnedTs|Bonus)'/.test(strip(MOD)) && !/localStorage\.(get|set)Item\([^)]*gacha(Owned|Bonus)/i.test(strip(MOD)),
      '이 PC 저장 키(tw.gachaOwned · Ts · Bonus)는 app.js · 모듈 어디에도 없다 — 서버가 원본');
  const call = (APP.match(/TwGacha\.createGacha\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  const fnDeps = deps.filter(l => /^\w+: \(\.\.\.a\)=>[\w$.]+\(\.\.\.a\),$/.test(l));   // 파츠 등록 창 셋은 adminPartReg.이름
  const getters = ['isAdmin: ()=>isAdmin,', 'savedParts: ()=>savedParts,', 'partCats: ()=>PART_CATS,', 'wdDraftDef: ()=>wdDraftDef,', 'activeWdAdj: ()=>activeWdAdj,', 'setActiveWdAdj: (v)=>{ activeWdAdj = v; },'];
  const vals = ['seats: seats,', 'slots: slots,', 'presence: Presence,'];
  chk(deps.length === 36 && fnDeps.length === 25 && getters.every(g => deps.includes(g)) && vals.every(v => deps.includes(v)),
      'deps 36개 — 함수 25는 화살표 · 다시 대입되는 let 5는 읽는 함수 + 쓰는 함수 1 · const 셋은 값 · 서버 길과 구독은 만든 것 (' + deps.length + ' · 화살표 ' + fnDeps.length + ')');
  chk(['seats', 'slots', 'Presence'].every(n => { const i = APP.search(new RegExp('^const ' + n + '\\s*=', 'm')); return i > 0 && i < iMk; }), '  seats · slots · Presence 는 만드는 줄보다 앞에 선언된 const');
  const m = strip(MOD);
  chk(!/[^.\w$](activeWdAdj|isAdmin|savedParts|PART_CATS|wdDraftDef)\s*=[^=]/.test(m.replace(/const (activeWdAdj|isAdmin|savedParts|PART_CATS|wdDraftDef) = deps\.\w+;/g, '')), '모듈은 app.js 의 let 에 직접 쓰지 않는다(쓰는 함수로)');
  const calls = ['gachaMod.toggleGachaInv();', 'gachaMod.isInvOpen()', 'gachaMod.isDrawOpen()', 'gachaMod.pruneUnownedGachaParts();', 'gachaMod.selId()',
    'gachaMod.isGachaPart(', 'gachaMod.isGachaColorUnlocked(', 'gachaMod.gachaCount(', 'gachaMod.DUPES_FOR_COLOR', 'gachaMod.sceneHasColorGroup(',
    'gachaMod.renderGachaInv();', 'gachaMod.resetMemory();', 'gachaMod.startGacha()',
    'setGachaBonusLocal: ()=>gachaMod.refreshAfterReward(),', 'renderGachaInv: ()=>gachaMod.renderGachaInv(),', 'gachaBonus: ()=>gachaMod.bonus(),'];
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
  const iGs = HTML.indexOf('<script src="parts/character/gacha-api.js"></script>');
  chk(iGs > 0 && iGs < iA && deps.includes('gachaApi: gachaApiMod,') && deps.some(l => /^rtOn: \(kind, fn\)=>TwRtHub\.store\.on\(kind, fn\),/.test(l))
      && APP.indexOf('const gachaApiMod = TwGachaApi.createGachaApi({') > 0 && APP.indexOf('const gachaApiMod') < iMk && !/gachaSource|TwSourceSwitch\.store\.pick\('gacha'\)|TwGachaServer|gacha-server/.test(APP + MOD + HTML),
      '  서버 길 — gacha-api.js 를 app.js 앞에 · 만든 것을 deps 로 · 서버 신호(rtOn) · 옛 길(source-switch · gacha-server)은 없다');
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
