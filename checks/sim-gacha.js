/* ═══ 🎰 sim-gacha.js — 파츠 가챠 모듈 (character/gacha.js · 서버 원본) ═══════════════
   가챠는 서버가 원본이다 — 보유분 · 뽑기 수 · 시즌 · 색 해금은 서버가 정하고, 뽑기는 서버가 굴린다. 여기서는 모듈을 가짜 DOM · 가짜 서버 위에서 통째로 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwGacha 뿐 · 만들 때는 요청 · 구독 · 타이머 · 저장소 읽기 0 · 뽑기 창 버튼 · ESC · 바깥 클릭 · blur 연결 · window 고리(_gachaRestorePos) · DOM 없으면 조용히
           · startGacha — 서버에서 받기 한 번 + 서버 신호 구독 한 번(두 번 불러도 한 번) · 주기 타이머 없음
   ・2절: 셈 — 서버 값으로 보유 · 색상 해금(서버가 센 값 · 관리자 통과) · 풀(다 모은 것 · 다른 시즌 빠짐) · 남은 뽑기 · 시즌 · 받기 전 값
   ・3절: 뽑기 — 받기 전엔 거절 · 서버에 부탁 · 결과에 카탈로그 항목 · 실패 이유별(이 PC 그대로) · 겹친 누름 · 내 코드 없음
   ・4절: 받기 — 받는 중/못 받음/받음 상태 · 실패에 혼자 다시 안 함 · 오류 번호는 사용자가 연 받기에서만 · 받는 사이 뽑기가 끝나면 옛 답 버림 ·
           진행 중 요청은 끝나고 한 번 더 · 서버 신호 · 미보유 파츠 회수(받은 뒤에만) · 로그아웃 메모리 지우기
   ・5절: 도감(꾸미기 창 «도감» 탭) — 자리(#gachaInvHost)가 없으면 안 그림 · 받는 중/못 받음 표시(다시 시도) · 아래 줄(남은 뽑기 · 다음 뽑기 · 시즌 · 👑) ·
           도감 줄(상시 → 시즌 · 지금 · n / m · 뽑은 그림만) · 도감 칸(12칸 쪽 · ⏮ ◀ ▶ ⏭ · 점선 빈칸 · ??? · n월에 돌아옴 · 누르면 착용 · 우클릭) ·
           ‹ 목록 · 고른 파츠 쪽으로 · 빈 도감은 목록으로 · 관리자 삭제(confirm 뒤 focus) · 서버에서 받기(onAlbumShow)
   ・6절: 뽑기 창 — 연출(잠금 → 결과 → 풀림) · 남은 뽑기 없음 · [도감으로](그 도감 · 그 쪽 · 다시 받지 않음) · 닫기(ESC · 바깥 · blur) · 뽑기 실패(오류) 안내
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
const need = ['gacha.js', 'gacha-album.js', 'app.js', 'desk-companion-prototype.html'];
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
    /* 🎰 서버 경로 — gs = 서버 상태({ owned, unlocked, earned, bonus, left, season }) · gsFail = 뽑기 실패 이유 · gsLoadFail = 받기 실패 · gsOut = 이번 뽑기 결과 */
    gs: opt.gs || null, gsFail: null, gsLoadFail: false, gsOut: [], gsLoads: 0, gsDraws: [], gsHold: null,
  };
  const els = {};
  /* #gachaInvHost — 꾸미기 창이 «도감» 탭을 그릴 때만 있다(env.hostOn) */
  const byId = id => (opt.noDom || (id === 'gachaInvHost' && !env.hostOn) ? null : (els[id] || (els[id] = mkEl(/^gacha(Draw1|Draw5|BackInv|GoDraw|AdminAdd)$/.test(id) ? 'button' : 'div', id))));
  if(!opt.noDom){ byId('gachaDrawOverlay').style.display = 'none'; }
  class FakeDate extends Date { constructor(...a){ if(a.length) super(...a); else super(env.now); } static now(){ return env.now; } }
  const fakeMath = Object.create(Math); fakeMath.random = () => env.rand[(env.randI++) % env.rand.length];
  const ctx = {
    Math: fakeMath, JSON, String, Number, Array, Object, Boolean, parseInt, Error, Promise, Date: FakeDate,
    console: { warn(){}, log(){} },
    localStorage: { getItem: k => env.ls.has(k) ? env.ls.get(k) : null, setItem: (k, v) => env.ls.set(k, String(v)), removeItem: k => env.ls.delete(k) },
    document: {
      getElementById: byId,
      createElement: (t) => mkEl(t),
      addEventListener: (t, fn, cap) => { fn._cap = !!cap; (env.docL[t] = env.docL[t] || []).push(fn); },
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
  vm.runInContext(SRC['gacha-album.js'], ctx, { filename: 'gacha-album.js' });   // 📚 도감 규칙 — html 이 gacha.js 앞에 싣는 진짜
  vm.runInContext(MOD, ctx, { filename: 'gacha.js' });
  env.ctx = ctx; env.els = els;
  env.mk = () => { const m = ctx.TwGacha.createGacha({
    toast: (m) => env.toasts.push(m),
    getMyUserId: () => env.uid,
    shownFocusLevel: () => env.level,
    levelCap: 999,
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
    twNav: { NAV: { WARDROBE_ALBUM: 'wardrobeAlbum' }, go: (name, opts) => { if(name !== 'wardrobeAlbum') return; env.albumOpens = (env.albumOpens || 0) + 1; env.hostOn = true; m.onAlbumShow(opts); m.renderGachaInv(); } },   // 창 열기 통로 — 꾸미기 창 «도감» 탭으로 여는 것 흉내
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
    rtOn: (kind, fn) => { (env.rt[kind] = env.rt[kind] || []).push(fn); return () => { env.unsubs = (env.unsubs || 0) + 1; }; },
  });
  /* 🛠 관리자 등록 · 삭제 — app.js 가 만든 뒤 setPartEditor 로 건다 */
  m.setPartEditor({
    openPartRegister: (cat, rec) => env.regs.push({ cat, rec }),
    syncPartRegGachaLock: () => {},
    deletePart: (id) => { env.deleted.push(id); env.saved = env.saved.filter(p => p.id !== id); },
  });
  m.session = { unsubs: [], resets: [], on(u){ this.unsubs.push(u); return u; }, onReset(fn){ this.resets.push(fn); },
    dispose(){ this.unsubs.splice(0).reverse().forEach(u => u()); this.resets.splice(0).reverse().forEach(r => r()); } };   // 가짜 세션 — dispose 가 구독 해제 · 비우기 훅을 부른다
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
  chk(!e.timers.length && !e.intervals.length && !e.docL.keydown && !e.ctx._gachaRestorePos && !!e.ctx.TwGachaAlbum, '  싣기만 해서는 타이머 · 이벤트 · 고리가 없다(도감 규칙은 따로 실림)');
  e.gs = ST({ a: 1 });
  const M = e.mk();
  chk(e.gsLoads === 0 && !Object.keys(e.rt).length && !e.timers.length && !e.intervals.length && e.ls.size === 0,
      '만들 때는 요청 · 서버 신호 구독 · 타이머 · 저장소 쓰기가 0 — 계정 확인 뒤 startGacha 가 한다');
  chk(M.state.load() === 'idle' && JSON.stringify(M.owned()) === '{}', '  시작 전에는 «받지 않음»(idle) · 보유분은 빈 값');
  M.startGacha(M.session); await flush();
  chk(e.gsLoads === 1 && e.rt.collection && e.rt.collection.length === 1 && M.state.load() === 'ready' && M.gachaCount('a') === 1, 'startGacha — 서버에서 한 번 받고 서버 신호(collection)를 듣는다');
  chk(!e.timers.length && !e.intervals.length, '  주기 타이머 · 부팅 지연 타이머가 없다');
  M.startGacha(M.session); await flush();
  chk(e.gsLoads === 1 && e.rt.collection.length === 1, '  두 번 불러도 받기 · 구독은 한 번');
  chk(typeof e.els.gachaGoDraw.onclick === 'function' && typeof e.els.gachaDraw1.onclick === 'function'
      && typeof e.els.gachaDraw5.onclick === 'function' && typeof e.els.gachaBackInv.onclick === 'function' && typeof e.els.gachaDrawClose.onclick === 'function', '버튼 연결(뽑으러 가기 · 1회 · 5연속 · 도감으로 · ✕)');
  chk(e.docL.keydown && e.docL.keydown.length === 1 && e.docL.mousedown && e.docL.mousedown.length === 1 && e.winL.blur && e.winL.blur.length === 1, 'ESC · 바깥 클릭 · blur 닫기 연결(뽑기 창)');
  chk(typeof e.ctx._gachaRestorePos === 'function' && e.ctx.openGachaInv === undefined && e.ctx.closeGachaInv === undefined && M.toggleGachaInv === undefined, 'window 고리는 _gachaRestorePos 하나 — 옛 보관함 창 고리(openGachaInv · closeGachaInv · toggleGachaInv)는 없다');
  chk(Array.isArray(e.ctx.__winPosResetters) && e.ctx.__winPosResetters.length === 1, '🪟 창 위치 초기화 목록에 한 자리');
  const e4 = mkEnv({ noDom: true }); let ok = true; try{ e4.mk(); }catch(_){ ok = false; }
  chk(ok && !e4.docL.keydown && !e4.ctx._gachaRestorePos, 'DOM 이 없으면 창 연결 없이 조용히 넘어간다');
  const e5 = mkEnv({ uid: null }); e5.gs = ST({}); const M5 = e5.mk(); M5.startGacha(M5.session); await flush();
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
  const nx = M.nextTicketLevel;
  chk(nx(92, 999) === 95 && nx(90, 999) === 95 && nx(94, 999) === 95 && nx(1, 999) === 5 && nx(0, 999) === 5,
      '다음 뽑기 레벨 — 92·90·94 → 95 · 1·0 → 5(딱 5의 배수면 그다음 배수)');
  chk(nx(994, 999) === 995 && nx(995, 999) === null && nx(999, 999) === null && nx('x', 999) === 5, '  상한(999)을 넘는 레벨은 null · 숫자 아님은 0 으로');
  chk(nx(990, 995) === 995 && nx(994, 995) === 995 && nx(995, 995) === null, '  상한이 5의 배수면 상한 레벨까지는 보이고(995) 그 위는 null');
  e.hostOn = true;
  e.level = 23; M.renderGachaInv();
  chk(/다음 뽑기 <b>Lv 25<\/b>/.test(e.els.gachaInvBar.innerHTML), '  도감 아래 줄 — 레벨 23 → «다음 뽑기 Lv 25» (' + e.els.gachaInvBar.innerHTML.slice(0, 120) + ')');
  e.level = 996; M.renderGachaInv();
  chk(!/다음 뽑기/.test(e.els.gachaInvBar.innerHTML), '  상한 가까이(996)면 다음 뽑기 줄을 안 그린다');
  e.level = null; M.renderGachaInv();
  chk(/남은 뽑기/.test(e.els.gachaInvBar.innerHTML) && !/다음 뽑기/.test(e.els.gachaInvBar.innerHTML), '  서버 레벨을 못 받았으면(null) «다음 뽑기 Lv 5» 를 그리지 않는다 — 남은 뽑기는 그대로');
  e.level = 1;
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
  e = mkEnv({ saved: [G('a')] }); e.gs = ST({}); (() => { const g = e.mk(); g.startGacha(g.session); })(); await flush();
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
  e = mkEnv({ saved: [G('a')] }); e.gs = ST({ a: 1 }); M = e.mk(); M.startGacha(M.session); await flush();
  e.gs = ST({ a: 3 }); e.rt.collection[0]({ kind: 'collection' }); await flush();
  chk(e.gsLoads === 2 && M.gachaCount('a') === 3, '서버 신호(collection) — 다시 받아 그 값으로');
  chk(typeof M.refreshAfterReward === 'undefined', '달성표 보상 뒤 따로 다시 받지 않는다 — 서버가 보너스 장부를 쓰면 collection 신호가 온다(위 줄)');
  M.resetMemory(); chk(e.unsubs === 1, '로그아웃 지우기 — 서버 신호 구독을 푼다(계정이 바뀌면 구독이 겹치지 않는다)');
  M.startGacha(M.session); chk(e.rt.collection.length === 2, '  다시 시작하면 새로 건다');
  /* 세션 — 구독 · 비우기는 세션이 쥔다(S-2): 세션이 끝나면 구독을 풀고 보유분 메모리를 비운다 */
  { const e6 = mkEnv({ saved: [G('a')] }); e6.gs = ST({ a: 1 }); const M6 = e6.mk(); M6.startGacha(M6.session); await flush();
    M6.session.dispose(); chk(e6.unsubs >= 1 && M6.state.load() === 'idle' && M6.gachaCount('a') === 0, '★ 세션이 끝나면(dispose) 서버 신호 구독을 풀고 메모리를 비운다 — 로그아웃이 따로 부르지 않아도');
    M6.startGacha(M6.session); await flush(); chk(e6.gsLoads === 2 && M6.state.load() === 'ready', '  다음 로그인(새 세션)은 시작이 다시 돈다 — 받기 한 번 더'); }
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

await sec('── 5. 도감', async () => {
  /* 상시 14(2쪽) · 겨울 둘(하나만 뽑음) · 봄 하나(안 뽑음) — 지금은 봄 */
  const parts = []; for(let i = 0; i < 14; i++) parts.push(G('p' + i, { order: i, cat: i < 10 ? 'hat' : 'glasses', thumbUrl: 'https://x.test/p' + i + '.png' }));
  parts.push(G('w0', { season: 'winter', order: 1, thumbUrl: 'https://x.test/w0.png' }), G('w1', { season: 'winter', order: 2, thumbUrl: 'https://x.test/w1.png' }), G('s0', { season: 'spring', order: 1 }));
  const owned = { w0: 1 }; for(let i = 0; i < 14; i++) if(i !== 3) owned['p' + i] = i === 2 ? 4 : 1;
  const e = mkEnv({ level: 100, saved: parts.concat([{ id: 'n', cat: 'hat' }]) });
  e.gs = ST(owned, { unlocked: { p2: true }, earned: 20, bonus: 2, left: 5 });
  const M = e.mk();
  M.renderGachaInv();
  chk(!M.isInvOpen() && !e.els.gachaInvBar, '자리(#gachaInvHost)가 없으면 아무것도 안 그린다 — 다른 탭 · 창 닫힘');
  e.hostOn = true;
  M.renderGachaInv();
  chk(/불러오는 중/.test(e.els.gachaInvHost.textContent) && !e.els.gachaInvHost.children.some(c => /gc-album/.test(c.className)), '받기 전 — «불러오는 중…» (빈 도감 · ??? 를 그리지 않는다)');
  M.onAlbumShow(); await flush(); await flush();
  chk(e.gsLoads === 1 && M.state.load() === 'ready', '«도감» 탭을 보이면 서버에서 한 번 받는다(onAlbumShow)');
  M.renderGachaInv();
  const host = e.els.gachaInvHost;
  chk(M.isInvOpen() && /남은 뽑기 <b>5회<\/b>/.test(e.els.gachaInvBar.innerHTML) && /🌸 봄 시즌/.test(e.els.gachaInvBar.innerHTML) && !/레벨 <b>/.test(e.els.gachaInvBar.innerHTML)
      && /👑 달성표 2회/.test(e.els.gachaInvBar.title), '아래 줄 — 남은 뽑기 · 이번 시즌(레벨은 안 적는다 — 경험치 바에 있다) · 👑 보너스는 풀이에');
  const rows = host.children.filter(c => /\bgc-album\b/.test(c.className));
  const secs = host.children.filter(c => c.className === 'gc-al-sec').map(c => c.textContent);
  chk(rows.length === 3 && secs.join() === '⭐ 상시,🗂 시즌별 도감', '도감 줄 — 상시 · 시즌(파츠가 있는 봄 · 겨울만) · 묶음 머리 둘');
  const txt = rows.map(r => r.textContent);
  chk(/⭐ 상시/.test(txt[0]) && /13 \/ 14 모음/.test(txt[0]) && /🌸 봄/.test(txt[1]) && /0 \/ 1 모음/.test(txt[1]) && /❄ 겨울/.test(txt[2]) && /1 \/ 2 모음/.test(txt[2]), '  순서 상시 → 봄 → 겨울 · «n / m 모음»');
  chk(/\bnow\b/.test(rows[1].className) && /지금/.test(txt[1]) && !/\bnow\b/.test(rows[0].className + rows[2].className), '  지금 시즌(서버 값) 도감에 «지금»');
  const thumbs = r => r.children[0].children;
  chk(thumbs(rows[0]).length === 3 && thumbs(rows[0]).every(t => t.tagName === 'IMG') && thumbs(rows[2]).filter(t => t.tagName === 'IMG').length === 1
      && !thumbs(rows[2]).some(t => t.src === 'https://x.test/w1.png') && thumbs(rows[1]).every(t => t.textContent === '❔'), '  ★ 줄 그림은 뽑은 파츠만 셋까지(안 뽑은 겨울 그림 · 봄은 ❔)');
  rows[0].onclick();
  const grid = () => host.children.find(c => c.id === 'gachaInvGrid');
  const pager = () => host.children.find(c => c.id === 'gachaInvPager');
  chk(M.state.album() === '' && cells(grid()).length === 12 && pager().children.length === 5 && /1 \/ 2/.test(pager().textContent), '상시 도감 — 12칸 한 쪽 · ⏮ ◀ 1 / 2 ▶ ⏭');
  chk(pager().children[0].disabled && pager().children[1].disabled && !pager().children[3].disabled, '  첫 쪽에선 ⏮ ◀ 꺼짐');
  const p3 = cells(grid()).find(c => c.textContent.includes('???'));
  chk(!!p3 && /locked/.test(p3.className) && !p3.onclick && !p3.children.some(c => c.tagName === 'IMG'), '안 뽑은 파츠는 ??? · 점선(locked) · 그림 없음 · 누를 수 없음');
  p3.oncontextmenu({ preventDefault(){} });
  chk(/아직 안 뽑은/.test(e.toasts[e.toasts.length - 1]), '  안 뽑은 칸 우클릭도 안내');
  const p2 = cells(grid()).find(c => c.textContent.includes('p2'));
  chk(/●●●● 🎨/.test(p2.textContent), '뽑은 칸 — ●○ · 🎨(서버가 «열림» 이라 한 것)');
  await p2.onclick();
  chk(e.equips.join() === 'hat:p2' && M.selId() === 'p2' && e.colorRefresh > 0, '누르면 착용 · 선택 · 색상 영역 갱신');
  pager().children[4].click();
  const holes = grid().children.filter(c => /gc-hole/.test(c.className));
  chk(M.state.page() === 1 && cells(grid()).length === 2 && holes.length === 10, '⏭ — 2쪽 · 남는 자리는 점선 빈칸으로 높이 고정');
  pager().children[0].click();
  chk(M.state.page() === 0, '⏮ — 첫 쪽');
  /* 고른 파츠(2쪽의 p13)가 있는 쪽에서 다시 연다 */
  M.state.setSelId('p13'); M.state.setAlbum(''); M.onAlbumShow(); M.renderGachaInv();
  chk(M.state.page() === 1, '★ 도감 탭을 다시 열면 고른 파츠가 있는 쪽부터');
  M.renderGachaInv();
  chk(M.state.page() === 1, '  예약은 한 번만 — 다음 그리기에서 튀지 않는다');
  await flush(); await flush();
  const head = host.children.find(c => c.className === 'gc-al-head');
  chk(/⭐ 상시/.test(head.textContent) && /13 \/ 14 모음/.test(head.textContent), '도감 머리 — 이름 · n / m 모음');
  head.children[0].onclick();
  chk(M.state.album() === null && host.children.some(c => /gc-album/.test(c.className)), '‹ — 도감 목록으로');
  host.children.filter(c => /\bgc-album\b/.test(c.className))[2].onclick();
  const w1 = cells(grid()).find(c => c.textContent.includes('???'));
  chk(M.state.album() === 'winter' && cells(grid()).length === 2 && w1 && /12월에 돌아옴/.test(w1.textContent), '지금이 아닌 시즌 — 안 뽑은 칸에 «12월에 돌아옴»');
  w1.oncontextmenu({ preventDefault(){} });
  chk(/시즌 파츠/.test(e.toasts[e.toasts.length - 1]), '  우클릭 — 시즌 파츠 안내');
  /* 우클릭 상세조정 — 착용한 것만 */
  e.draft = { equippedParts: { hat: [{ id: 'w0' }] } };
  e.saved.find(p => p.id === 'w0').cat = 'hat';
  M.renderGachaInv();
  const w0 = cells(grid()).find(c => c.textContent.includes('w0'));
  w0.oncontextmenu({ preventDefault(){} });
  chk(e.adj && e.adj.id === 'w0' && grid().children.some(c => c.className === 'adj'), '착용한 칸 우클릭 — 상세조정 패널이 그 칸 뒤에');
  host.children.find(c => c.className === 'gc-al-head').children[0].onclick();
  chk(e.adj === null, '  도감을 바꾸면 상세조정은 접는다');
  /* 관리자 — 삭제 · 빈 도감은 목록으로 */
  e.admin = true; M.state.setAlbum('spring'); M.renderGachaInv();
  const s0 = cells(grid())[0];
  chk(/\(미보유\)/.test(s0.textContent) && !/locked/.test(s0.className), '관리자 — 안 뽑은 것도 열려 보인다(등록 후 시험)');
  const del = s0.children.find(c => c.className === 'gc-del');
  e.confirmAns = false; del.onclick({ stopPropagation(){} });
  chk(!e.deleted.length && e.focus === 1, '관리자 ✕ — 취소해도 window.focus()(Electron 멈춤 방지)');
  e.confirmAns = true; del.onclick({ stopPropagation(){} });
  chk(e.deleted.join() === 's0' && e.focus === 2 && M.state.album() === null, '  확인하면 지운다 · 빈 도감이 되면 목록으로');
  chk(e.els.gachaAdminCat.style.display === '' && e.els.gachaAdminCat.options.length === 2, '  관리자 등록 줄(카테고리 · + 등록)');
  e.admin = false; M.renderGachaInv();
  chk(e.els.gachaAdminCat.style.display === 'none', '  관리자가 아니면 숨김');
  /* 파츠가 하나도 없으면 */
  const e2 = mkEnv({ saved: [] }); const M2 = await ready(e2, ST({})); e2.hostOn = true; M2.renderGachaInv();
  chk(/아직 가챠로 나오는 파츠가 없어요/.test(e2.els.gachaInvHost.textContent), '가챠 파츠가 없으면 안내');
  /* 못 받음 — 빈 도감이 아니라 «못 불러왔어요 · 다시 시도» */
  const f = mkEnv({ saved: [G('a')] }); f.gs = ST({}); f.gsLoadFail = true; f.hostOn = true;
  const MF = f.mk(); MF.onAlbumShow(); await flush(); await flush(); MF.renderGachaInv();
  const retry = () => (f.els.gachaInvHost.children[0] || { children: [] }).children.find(c => c.id === 'gachaRetry');
  chk(MF.state.load() === 'failed' && /못 불러왔어요/.test(f.els.gachaInvHost.textContent) && f.errs.length === 0 && !!retry(),
      '못 받음 — «못 불러왔어요» + 다시 시도 단추(처음 연 받기는 번호를 안 띄우고 화면이 말한다)');
  f.gsLoadFail = false; retry().onclick(); await flush(); await flush();
  chk(MF.state.load() === 'ready' && f.gsLoads === 2 && f.timers.length === 0, '  다시 시도 → 받으면 ready · 혼자 되풀이한 요청 없음(총 2번)');
  f.gsLoadFail = true; MF.resetMemory(); MF.onAlbumShow(); await flush(); await flush();
  chk(f.gsLoads === 3 && MF.state.load() === 'failed', '  도감 탭을 다시 보이면 한 번 더 받는다(보이기 = 사용자가 여는 길)');
});

await sec('── 6. 뽑기 창', async () => {
  let e = mkEnv({ saved: [G('a'), G('b')] });
  let M = await ready(e, ST({}, { earned: 2, left: 2 }));
  e.els.gachaGoDraw.onclick();
  chk(M.isDrawOpen() && /gc-cap-wrap idle/.test(e.els.gachaDrawStage.innerHTML), '뽑으러 가기 — 대기 캡슐');
  chk(/남은 뽑기 <b>2회<\/b>/.test(e.els.gachaDrawBar.innerHTML) && e.els.gachaDraw5.textContent === '2연속 뽑기' && !e.els.gachaDraw5.disabled, '정보줄 · 5연속은 남은 수만큼(죽이지 않는다)');
  chk(/남은 뽑기 <b>2회<\/b> · 다음 뽑기 <b>Lv 5<\/b>/.test(e.els.gachaDrawBar.innerHTML), '  뽑기 창 정보줄 — 레벨 1 → «다음 뽑기 Lv 5»');
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
  const loadsBefore = e.gsLoads;
  e.adj = { cat: 'hat', id: 'zz' };   // 다른 도감에서 보던 상세조정
  e.els.gachaBackInv.onclick(); await flush();
  chk(e.adj === null, '도감으로 — 다른 도감으로 가면 상세조정을 접는다');
  chk(e.gsLoads === loadsBefore, '도감으로 — 방금 뽑기가 서버 값을 받아 왔으니 다시 받지 않는다');
  M.onAlbumShow(); await flush(); await flush();
  chk(e.gsLoads === loadsBefore + 1, '  건너뛰기는 한 번만 — 다음에 도감을 보이면 다시 받는다');
  chk(e.albumOpens === 1 && M.isInvOpen() && !M.isDrawOpen() && M.state.album() === '' && M.selId() === 'b'
      && e.els.gachaInvHost.children.some(c => c.id === 'gachaInvGrid'), '도감으로 — 뽑기 창 닫고 꾸미기 창 «도감» 탭 · 방금 뽑은 파츠의 도감 · 그 파츠를 고른다');
  let stopped = 0;
  e.els.gachaGoDraw.onclick(); e.docL.keydown[0]({ key: 'Escape', stopPropagation(){ stopped++; } });
  chk(e.docL.keydown[0]._cap === true, 'ESC 는 캡처 단계에서 받는다 — 먼저 걸린 꾸미기 창의 ESC 보다 앞서 멈추려고');
  chk(!M.isDrawOpen() && !e.els.gachaDrawStage.innerHTML && stopped === 1, 'ESC — 뽑기 창만 닫고 무대를 비운다 · 멈춰서 뒤 꾸미기 창은 안 닫힌다');
  e.docL.keydown[0]({ key: 'Escape', stopPropagation(){ stopped++; } });
  chk(stopped === 1, '  뽑기 창이 없으면 ESC 를 막지 않는다(꾸미기 창이 받는다)');
  e.els.gachaGoDraw.onclick(); e.docL.mousedown[0]({ target: { closest: (sel) => /#wardrobePanel/.test(sel) ? {} : null } });
  chk(M.isDrawOpen(), '  꾸미기 창 안을 누르면 안 닫는다(입혀 보는 곳)');
  e.docL.mousedown[0]({ target: { closest: () => null } });
  chk(!M.isDrawOpen(), '  바깥을 누르면 닫는다');
  e.els.gachaGoDraw.onclick(); e.winL.blur[0]();
  chk(!M.isDrawOpen(), '  창이 포커스를 잃으면 닫는다');
  e.els.gachaGoDraw.onclick(); e.toasts.length = 0;
  await e.els.gachaDraw1.onclick();
  chk(e.toasts.join() === '남은 뽑기가 없어요' || e.els.gachaDraw1.disabled, '남은 뽑기가 없으면 버튼이 꺼져 있다(눌러도 서버에 안 간다)');
  M.renderGachaDraw();   // 결과 없이 다시 그리기 — 남은 뽑기 0 이면 무대에 안내
  chk(/레벨 5부터 1회가 생겨요/.test(e.els.gachaDrawStage.children[0] ? e.els.gachaDrawStage.children[0].textContent : ''), '  무대 문구에 다음 뽑기 레벨(5)');
  /* 뽑기 안에서 던지면(여기서는 서버 경로) 에러코드로 알리고 잠금을 푼다 */
  e = mkEnv({ saved: [G('a')] }); M = await ready(e, ST({}, { earned: 2, left: 2 }));
  e.els.gachaGoDraw.onclick(); e.gsThrows = true;
  await e.els.gachaDraw1.onclick();
  chk(e.errs.join() === 'E-CHAR-12' && e.els.gachaBackInv.disabled === false && /gc-cap-wrap idle/.test(e.els.gachaDrawStage.innerHTML), '뽑기 오류 — E-CHAR-12 · 잠금 풀림 · 대기 캡슐로');
  /* 안내가 던져도 잠금은 풀린다(finally) */
  e = mkEnv({ saved: [G('a')] }); M = await ready(e, ST({}, { earned: 2, left: 2 }));
  e.els.gachaGoDraw.onclick(); e.gsFail = 'nouser'; e.errThrows = true;
  try{ await e.els.gachaDraw1.onclick(); }catch(_){}
  chk(e.els.gachaDraw1.disabled === false && e.els.gachaBackInv.disabled === false, '실패 안내가 던져도 뽑기 버튼 잠금이 풀린다');
  /* 서버 저장 실패 — 이유별 번호 · 횟수 그대로 */
  const want = { nouser: 'E-CHAR-09', offline: 'E-CHAR-10', timeout: 'E-CHAR-11', error: 'E-CHAR-12' };
  for(const why of Object.keys(want)){
    e = mkEnv({ saved: [G('a')] }); M = await ready(e, ST({}, { earned: 2, left: 2 }));
    e.els.gachaGoDraw.onclick(); e.gsFail = why;
    await e.els.gachaDraw1.onclick();
    chk(e.errs.join() === want[why] && /남은 뽑기 <b>2회<\/b>/.test(e.els.gachaDrawBar.innerHTML) && e.els.gachaDraw1.disabled === false,
        '  ' + why + ' → ' + want[why] + ' · 남은 뽑기 그대로(2회) · 다시 누를 수 있다');
  }
});

await sec('── 7. app.js 배선', () => {
  const code = strip(APP);
  const defs = /function (gachaDraw|gachaPool|pullGacha|pruneUnownedGachaParts|renderGachaInv|onAlbumShow|closeGachaDraw|_gachaRunDraw|sceneHasColorGroup|_gachaInvOpen)\(|\blet (gachaOwned|_gachaLoad|_gachaAlbum|_gachaSelId)\b/;
  chk(!defs.test(code) && defs.test(MOD), '가챠 정의는 모듈에만');
  chk(/^const isGachaPart = deps\.isGachaPart;/m.test(MOD) && !/function isGachaPart\(/.test(MOD) && /isGachaPart: \(\.\.\.a\)=>(premiumMod\.)?isGachaPart\(\.\.\.a\),/.test(APP), '  isGachaPart 는 카탈로그(premium-assets.js)가 정의하고 가챠는 deps 로 받는다(모듈 순환 끊기 3)');
  chk(/gachaMod\.setPartEditor\(\{/.test(APP) && !/\b(openPartRegister|syncPartRegGachaLock|deletePart): \(\.\.\.a\)=>adminPartReg\./.test((APP.match(/TwGacha\.createGacha\(\{([\s\S]*?)\n\}\);/) || [])[1] || ''), '  관리자 등록 · 삭제는 만든 뒤 setPartEditor 로 건다 — 가챠는 관리자 모듈을 부르지 않는다');
  const code2 = code.replace(/const GACHA_OFF = \{[\s\S]*?\};/, '').replace(/\brenderGachaInv: \(\)=>/, '');   // 빈 껍데기 · 👑 달성표 deps 의 이름 칸은 뺀다
  chk(!/(?<![\w$.])(isGachaColorUnlocked|gachaCount|sceneHasColorGroup|syncGachaToServer|pullGacha|pruneUnownedGachaParts|renderGachaInv|onAlbumShow|toggleGachaInv|_gachaInvOpen|_gachaDrawOpen|_gachaSelId|gachaOwned|_gachaTs|_gachaBonus|_setGachaBonusLocal|GACHA_DUPES_FOR_COLOR)\b/.test(code2), '  app.js 는 옛 이름을 부르지 않는다(gachaMod.이름)');
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
  chk(deps.length === 31 && fnDeps.length === 18 && getters.every(g => deps.includes(g)) && vals.every(v => deps.includes(v)) && deps.includes('twNav: twNav,') && deps.some(l => /^levelCap: (focusTotalMod\.)?FOCUS_LEVEL_CAP_HOURS,$/.test(l)),
      'deps 31개 — 함수 18은 화살표 · 📚 [도감으로] 는 창 열기 통로(twNav) · 다시 대입되는 let 5는 읽는 함수 + 쓰는 함수 1 · const 셋 · 레벨 상한은 값 · 서버 경로와 구독은 만든 것 (' + deps.length + ' · 화살표 ' + fnDeps.length + ')');
  chk(['seats', 'slots', 'Presence'].every(n => { const i = APP.search(new RegExp('^const ' + n + '\\s*=', 'm')); return i > 0 && i < iMk; }), '  seats · slots · Presence 는 만드는 줄보다 앞에 선언된 const');
  const m = strip(MOD);
  chk(!/[^.\w$](activeWdAdj|isAdmin|savedParts|PART_CATS|wdDraftDef)\s*=[^=]/.test(m.replace(/const (activeWdAdj|isAdmin|savedParts|PART_CATS|wdDraftDef) = deps\.\w+;/g, '')), '모듈은 app.js 의 let 에 직접 쓰지 않는다(쓰는 함수로)');
  const calls = ['gachaMod.onAlbumShow(opts);', 'gachaMod.isInvOpen()', 'gachaMod.isDrawOpen()', 'gachaMod.pruneUnownedGachaParts();', 'gachaMod.selId()',
    'gachaMod.isGachaPart(', 'gachaMod.isGachaColorUnlocked(', 'gachaMod.gachaCount(', 'gachaMod.DUPES_FOR_COLOR', 'gachaMod.sceneHasColorGroup(',
    'gachaMod.renderGachaInv();', 'gachaMod.resetMemory();', 'gachaMod.startGacha('];
  const callCode = code + '\n' + strip(PREG).replace(/gachaMod\(\)/g, 'gachaMod');   // 파츠 등록 창(admin-part-register.js)이 부르는 곳까지
  const miss = calls.filter(c => !callCode.includes(c));
  const nPart = (callCode.match(/gachaMod\.isGachaPart\(/g) || []).length, nPrune = (callCode.match(/gachaMod\.pruneUnownedGachaParts\(\)/g) || []).length;
  chk(!miss.length && nPart === 6 && nPrune === 4,
      '부르는 곳 — 꾸미기 창 «도감» 탭 · 꾸미기 색상 영역 · 파츠 등록 · 카탈로그 · 옷장 받은 뒤 · 런처 · 로그아웃 (' + (miss[0] || '다 있음') + ' · isGachaPart ' + nPart + ' · prune ' + nPrune + ')');
  const off = (APP.match(/const GACHA_OFF = \{([\s\S]*?)\};/) || [])[1] || '';
  const used = [...new Set((code.match(/gachaMod\.(\w+)/g) || []).map(s => s.split('.')[1]))];
  chk(!/\bGACHA_OFF\b/.test(APP), '빈 껍데기 GACHA_OFF 없음 — 모듈은 늘 싣는다(가드 걷기 3차)');
  const ret = (MOD.match(/\nreturn \{([\s\S]*?)\n\};\n\}/) || [])[1] || '';
  chk(used.every(n => new RegExp('(^|\\n)\\s*' + n + '\\b').test(ret)), '  모듈 반환값도 그 이름을 다 갖는다');
  const iS = HTML.indexOf('<script src="parts/myhome/myhome-sticker.js"></script>'), iG = HTML.indexOf('<script src="parts/character/gacha.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  const iAl = HTML.indexOf('<script src="parts/character/gacha-album.js"></script>');
  chk(iS > 0 && iG > iS && iA > iG && iAl > 0 && iAl < iG, 'html — gacha-album.js → gacha.js → app.js 차례로 싣는다');
  const iGs = HTML.indexOf('<script src="parts/character/gacha-api.js"></script>');
  chk(iGs > 0 && iGs < iA && deps.includes('gachaApi: gachaApiMod,') && deps.some(l => /^rtOn: \(kind, fn\)=>TwRtHub\.store\.on\(kind, fn\),/.test(l))
      && APP.indexOf('const gachaApiMod = TwGachaApi.createGachaApi({') > 0 && APP.indexOf('const gachaApiMod') < iMk && !/gachaSource|TwSourceSwitch\.store\.pick\('gacha'\)|TwGachaServer|gacha-server/.test(APP + MOD + HTML),
      '  서버 경로 — gacha-api.js 를 app.js 앞에 · 만든 것을 deps 로 · 서버 신호(rtOn) · 옛 경로(source-switch · gacha-server)는 없다');
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
