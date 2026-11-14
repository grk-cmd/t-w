/* ═══ 🧸 sim-mallang-module.js — 말랑이 · 선물 화면 모듈 모양 (0.13 앱 묶음 D7-2) ═══
   [왜] mallang.js 가 window 고리 열 개(_mallangOnOpen 등)를 걸던 것을 createMallang(deps) 모양으로 바꿨다 — 동작은 그대로다.
     마이홈 창(myhome-ui) · 친구 홈 구경(myhome-visit) · 수령함(myhome-inbox)은 deps mallangMod 로 받아 부르고,
     프리미엄 판정은 전역 window._premiumOn 대신 deps premiumOn 으로 받는다.
   ・1절: 만들 때 — 싣기만 하면 window.TwMallang 하나 · 만들 때 DOM · 서버 · 저장소 · 토스트를 안 건드림 · 내놓는 이름 열 개
   ・2절: 실제로 돌린다(가짜 DOM · 가짜 서버) — 내 집 열기 · 선물 치우기 · 다시 부르기 · 지우기 · 봤음 · 남의 집 · 닫기 · 보내기 창의
          서버 부름 · 토스트 · 이 PC 저장 · 화면 상태를 한 줄씩 적어 «옮기기 전과 같은 줄» 과 견준다
          말랑이 칸은 D7-3 부터 칸 상태 주인(mallang-store.js — 진짜 모듈 · 가짜 서버 길)으로 받는다 — 받는 줄이 getMallangImgs 대신 fetchMine · fetchOf 다.
          선물(받은 선물 · 치움 · 지우기 · 봤음 · 보내기 창)은 아직 옛 길이라 줄이 D7-2 그대로다(칸 상태 주인 검사는 sim-mallang-store.js).
   ・3절: 프리미엄 — deps premiumOn 이 폴더 · 보내기 창을 정한다(window._premiumOn 을 읽지 않는다)
   ・4절: 배선 — app.js 는 만드는 줄 하나(수령함 · 창 · 친구 홈 구경보다 먼저 · deps 5 — 칸 상태 주인은 그보다 먼저) · 세 모듈은 deps mallangMod · window._mallang* 없음 · html · smoke 순서
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const P = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f, 'apps/desktop/app/parts/' + dir + '/' + f];
const SRC = {
  ML: pick(P('mallang.js', 'myhome')), STORE: pick(P('mallang-store.js', 'myhome')), BOX: pick(P('gift-box.js', 'myhome')), GIFT: pick(P('gift-api.js', 'myhome')), AE: pick(P('api-errors.js', 'shared')), SAFE: pick(P('safe-html.js', 'shared')), RETRY: pick(P('img-retry.js', 'shared')),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js', 'apps/desktop/app/parts/app.js']),
  UI: pick(P('myhome-ui.js', 'myhome')), VISIT: pick(P('myhome-visit.js', 'myhome')), INBOX: pick(P('myhome-inbox.js', 'myhome')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html', 'apps/desktop/app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js', 'checks/smoke.js']),
};
for(const k of Object.keys(SRC)) if(!SRC[k]){ say('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const flush = () => new Promise(r => setImmediate(r));
const EXPORTS = ['onOpen', 'onClose', 'applyVisit', 'reset', 'openGift', 'placeGift', 'giftOnScreen', 'giftFull', 'dropGift'];

const loadSafe = () => { const m = { exports: {} }; new Function('window', 'module', SRC.SAFE)(undefined, m); return m.exports; };
const loadMod = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const loadRetry = (safe) => { const m = { exports: {} }; new Function('window', 'module', 'TwSafeHtml', SRC.RETRY)(undefined, m, safe); return m.exports; };

/* 가짜 DOM · 가짜 서버 — 부른 것을 log 에 한 줄씩 */
function mkEnv(src, o){
  o = o || {};
  const log = [], byId = {}, imgs = [], store = new Map();
  const mk = (tag) => {
    const cls = new Set(), L = {};
    const el = {
      tagName: String(tag).toUpperCase(), style: {}, children: [], parentElement: null, _id: '', textContent: '', title: '', _html: '', dataset: {},
      get id(){ return this._id; }, set id(v){ this._id = v; byId[v] = el; },
      classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c),
        toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
      set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); }, get className(){ return [...cls].join(' '); },
      get innerHTML(){ return el._html; },
      set innerHTML(v){ el._html = String(v); el.children = []; for(const m of el._html.matchAll(/id="([^"]+)"/g)){ const c = mk('div'); c.id = m[1]; el.appendChild(c); } },
      appendChild(c){ c.parentElement = el; el.children.push(c); return c; },
      remove(){ if(el.parentElement) el.parentElement.children = el.parentElement.children.filter(x => x !== el); el.parentElement = null; if(byId[el._id] === el) delete byId[el._id]; },
      addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
      fire(t, ev){ (L[t] || []).forEach(fn => fn(Object.assign({ preventDefault(){}, stopPropagation(){}, button: 0, clientX: 0, clientY: 0 }, ev || {}))); },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 580 }),
      querySelector: (q) => {
        if(q[0] === '#') return byId[q.slice(1)] || null;
        let hit = null; const c = q.slice(1);
        const walk = (n) => n.children.forEach(x => { if(!hit && x.classList.contains(c)) hit = x; if(!hit) walk(x); });
        if(q[0] === '.') walk(el);
        return hit;
      },
    };
    return el;
  };
  const win = mk('div'); win.id = 'myHomeWin';
  const room = mk('div'); room.id = 'mhRoomPreview';
  const tab = mk('div'); tab.className = 'mh-tab';
  class FakeImage { constructor(){ this.naturalWidth = 100; this.naturalHeight = 100; imgs.push(this); } set src(v){ this._src = v; } get src(){ return this._src; } }
  /* 가짜 서버 선물함 — 치움 · ⭐ · 지우기 · 봤음이 값을 바꾼다 */
  const srv = {
    items: [{ id: 'g1', senderName: '철수', imageUrl: 'https://x.example/g1.png', message: '안녕', starred: false, hidden: false, sentAt: 100 },
      { id: 'g2', senderName: '영희', imageUrl: 'https://x.example/g2.png', message: '', starred: true, hidden: false, sentAt: 300 },
      { id: 'g3', senderName: '민수', imageUrl: 'https://x.example/g3.png', message: '', starred: false, hidden: true, sentAt: 200 }],
    unseen: 2,
  };
  const visibleOf = { f1: [{ id: 'h1', imageUrl: 'https://x.example/h1.png', message: '' }] };
  const slotsOf = { me: [{ slot: 0, imageUrl: 'https://x.example/m1.png', enabled: true }, { slot: 1, imageUrl: 'https://x.example/m2.png', enabled: false }], f1: [{ slot: 0, imageUrl: 'https://x.example/f.png', enabled: true }] };
  const rec = (name, fn) => async (...a) => { log.push(('api ' + name + ' ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')).trimEnd()); return fn(...a); };
  /* 보내기 창은 아직 옛 길(firebaseAPI) */
  const firebaseAPI = {
    getMallangGifts: rec('getMallangGifts', async (u) => (u === 'f1' ? { h1: { imgUrl: 'x', ts: 1 } } : {})),
    getMallangGiftCount: rec('getMallangGiftCount', async () => 3),
  };
  const ctx = {
    console: { log(){}, warn(){}, error(){} }, Math: Object.assign(Object.create(Math), { random: () => 0.25 }), JSON, String, Number, Array, Object, Set, Promise, Date: class extends Date { static now(){ return 1000; } }, Error,
    document: { getElementById: (id) => byId[id] || null, createElement: mk, head: mk('head'), querySelector: (q) => (q === '.mh-tab[data-tab="friend"]' ? tab : null), querySelectorAll: () => [] },
    Image: FakeImage,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { log.push('ls ' + k + ' ' + v); store.set(k, String(v)); } },
    requestAnimationFrame: () => 1, cancelAnimationFrame(){}, setTimeout: () => 0, clearTimeout(){},
    addEventListener(){}, removeEventListener(){},
    firebaseAPI,
  };
  ctx.window = ctx;
  ctx.TwSafeHtml = loadSafe();
  ctx.TwImgRetry = loadRetry(ctx.TwSafeHtml);
  /* 말랑이 칸 — 진짜 상태 주인(mallang-store.js) 위에 가짜 서버 길 */
  const GL = loadMod(SRC.GIFT), AE = loadMod(SRC.AE);
  const giftApi = {
    fetchMine: rec('fetchMine', async () => ({ slots: slotsOf.me.map(x => Object.assign({}, x)), version: 1 })),
    fetchOf: rec('fetchOf', async (u) => ({ slots: (slotsOf[u] || []).map(x => Object.assign({}, x)), version: 1 })),
    uploadImage: rec('uploadImage', async () => 'https://x.example/new.png'),
    saveMallangs: rec('saveMallangs', async (v, sl) => ({ slots: sl.map((x, i) => ({ slot: i, imageUrl: x.imageUrl, enabled: x.enabled })), version: v + 1 })),
    reset(){},
  };
  const mallangStore = loadMod(SRC.STORE).createMallangStore({ api: giftApi, giftLib: GL, errs: AE, apiErrors: { notify: (e) => log.push('common ' + (e && e.code)) },
    notifyError: (c) => log.push('error ' + c), toast: (m) => log.push('toast ' + m) });
  const boxApi = {
    fetchBox: rec('fetchBox', async () => { if(o.holdBox) await o.holdBox.p; return { items: srv.items.map(x => Object.assign({}, x)), unseenCount: srv.unseen, starCount: srv.items.filter(x => x.starred).length, boxKeep: 30, starMax: 20 }; }),
    markSeen: rec('markSeen', async () => { srv.unseen = 0; }),
    star: rec('star', async (id, on) => { srv.items.find(x => x.id === id).starred = on; }),
    hide: rec('hide', async (id, on) => { if(o.hideFails) throw Object.assign(new Error('x'), { status: 503, code: 'X', kind: 'unavailable' }); srv.items.find(x => x.id === id).hidden = on; }),
    remove: rec('remove', async (id) => { srv.items = srv.items.filter(x => x.id !== id); }),
    fetchVisible: rec('fetchVisible', async (u) => ({ items: visibleOf[u] || [], visibleCount: (visibleOf[u] || []).length, recipientCap: 30 })),
    reset(){},
  };
  const giftBox = loadMod(SRC.BOX).createGiftBox({ api: boxApi, giftLib: GL, errs: AE, apiErrors: { notify: (e) => log.push('common ' + (e && e.code)) },
    notifyError: (c) => log.push('error ' + c), toast: (m) => log.push('toast ' + m), rtOn: () => () => {} });
  const deps = {
    toast: (m) => log.push('toast ' + m),
    getMyUserId: () => 'me',
    getDisplayName: () => '나',
    premiumOn: () => !!o.premium,
    mallangStore,
    giftBox,
  };
  if(o.windowPremium !== undefined) ctx._premiumOn = () => o.windowPremium;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'mallang.js' });
  const m = ctx.TwMallang.createMallang(deps);
  const loadAll = () => { imgs.splice(0).forEach(im => im.onload && im.onload()); };
  const guys = () => (byId.mlLayer ? byId.mlLayer.children.filter(c => c.className === 'ml-guy').length : 0);
  const state = (what) => log.push('state ' + what + ' 폴더=' + (byId.mlFolder ? 'O' : 'X') + ' 말랑이=' + guys()
    + ' 배지=' + ((tab.children.find(c => c.className === 'ml-giftbadge') || {}).textContent || '-') + ' 선물창=' + (byId.mlGift ? 'O' : 'X'));
  return { ctx, m, log, byId, store, loadAll, guys, state, giftBox, srv };
}

/* 같은 순서로 불러 본다 — 마이홈 열기 → 선물 치우기 → 다시 부르기 → ⭐ 풀고 지우기 → 서브탭(봤음) → 새 선물(신호) → 남의 집 → 내 집 → 닫기 → 보내기 창 → 계정 놓음 */
async function drive(src, o){
  const e = mkEnv(src, o);
  const { m, log, giftBox } = e;
  await m.onOpen('me', false); await flush(); e.loadAll(); e.state('내 집 열기');
  const live = e.byId.mlLayer.children.filter(c => c.className === 'ml-guy');
  if(live[0]) live[0].fire('contextmenu');   // 첫 선물(g1) 우클릭 = 선물함으로 치움
  await flush(); e.state('치움');
  log.push('unhide ' + await giftBox.hide('g1', false));   // 선물함에서 다시 부르기 — 서버에 «나옴» 으로 바꾼 뒤 띄운다
  log.push('place ' + m.placeGift(giftBox.get('g1'))); e.loadAll();
  log.push('place ' + m.placeGift(giftBox.get('g1')));
  log.push('onScreen g1=' + m.giftOnScreen('g1') + ' g3=' + m.giftOnScreen('g3'));
  await flush(); e.state('다시 부름');
  log.push('remove ' + await giftBox.remove('g2'));
  log.push('star ' + await giftBox.star('g2', false));
  log.push('remove ' + await giftBox.remove('g2')); m.dropGift('g2');
  e.state('지움');
  await giftBox.openTab(); e.state('봤음');
  e.srv.items.push({ id: 'g4', senderName: '새친구', imageUrl: 'https://x.example/g4.png', message: '', starred: false, hidden: false, sentAt: 400 }); e.srv.unseen = 1;
  await giftBox.pull(false); await flush(); e.loadAll(); e.state('새 선물');
  await m.applyVisit(true, 'f1'); await flush(); e.loadAll(); e.state('남의 집');
  if(e.byId.mlFolder) e.byId.mlFolder.fire('contextmenu');
  await m.applyVisit(false, 'me'); await flush(); e.loadAll(); e.state('내 집으로');
  m.onClose(); e.state('닫기');
  await m.openGift('f1', '친구'); await flush(); e.state('보내기 창');
  m.reset(); e.state('계정 놓음');
  return { log, e };
}

/* 부른 순서 · 값 — 말랑이 칸(fetchMine · fetchOf)과 선물(fetchBox · hide · star · remove · markSeen · fetchVisible)은 서버 길 · 보내기 창만 아직 옛 길(getMallangGiftCount · getMallangGifts). 동작이 바뀌면 여기가 어긋난다 */
const GOLDEN = [
  'api fetchMine',
  'api fetchBox',
  'state 내 집 열기 폴더=O 말랑이=2 배지=🎁2 선물창=X',
  'api hide g1 true',
  'toast 🎁 선물함으로 돌아갔어요 (선물함에서 다시 부를 수 있어요)',
  'state 치움 폴더=O 말랑이=1 배지=🎁2 선물창=X',
  'api hide g1 false',
  'unhide ok',
  'place ok',
  'place already',
  'onScreen g1=true g3=false',
  'state 다시 부름 폴더=O 말랑이=2 배지=🎁2 선물창=X',
  'toast 즐겨찾기한 선물은 지울 수 없어요 — ⭐ 를 먼저 풀어 주세요',
  'remove starred',
  'api star g2 false',
  'star ok',
  'api remove g2',
  'remove ok',
  'state 지움 폴더=O 말랑이=1 배지=🎁2 선물창=X',
  'api fetchBox',
  'api markSeen',
  'state 봤음 폴더=O 말랑이=1 배지=- 선물창=X',
  'api fetchBox',
  'state 새 선물 폴더=O 말랑이=2 배지=🎁1 선물창=X',
  'api fetchOf f1',
  'api fetchVisible f1',
  'state 남의 집 폴더=O 말랑이=1 배지=🎁1 선물창=X',
  'toast 관람 중에는 이미지를 등록할 수 없어요',
  'api fetchMine',
  'api fetchBox',
  'state 내 집으로 폴더=O 말랑이=2 배지=🎁1 선물창=X',
  'state 닫기 폴더=O 말랑이=0 배지=🎁1 선물창=X',
  'api fetchMine',
  'api getMallangGiftCount me <오늘>',
  'api getMallangGifts f1',
  'state 보내기 창 폴더=O 말랑이=0 배지=🎁1 선물창=O',
  'state 계정 놓음 폴더=O 말랑이=0 배지=- 선물창=X',
].join('\n');

(async () => {
  say('── 1. 만들 때');
  {
    const w = {};
    new Function('window', 'module', SRC.ML)(w, undefined);
    chk(Object.keys(w).join() === 'TwMallang' && typeof w.TwMallang.createMallang === 'function', '싣기만 하면 window.TwMallang 하나뿐(window._mallang* 고리 없음)');
    const e = mkEnv(SRC.ML, { premium: true });
    chk(e.log.length === 0 && e.store.size === 0 && !e.byId.mlLayer && !e.byId.mlFolder, '만들 때 DOM · 서버 · 저장소 · 토스트를 안 건드린다');
    chk(JSON.stringify(Object.keys(e.m)) === JSON.stringify(EXPORTS), '내놓는 이름 — ' + EXPORTS.join(' · '));
  }

  say('── 2. 실제로 돌린다');
  const NEW = await drive(SRC.ML, { premium: true });
  const L = NEW.log;
  const has = (s) => L.includes(s);
  chk(L[0] === 'api fetchMine' && L[1] === 'api fetchBox', '내 집 열기 — 내 칸 · 내 선물함을 서버 길로 읽는다(옛 봤음 시각 읽기 없음)');
  chk(has('state 내 집 열기 폴더=O 말랑이=2 배지=🎁2 선물창=X'), '  폴더 보임 · 치우지 않은 선물 둘이 뜸(g3 는 서버가 치움) · 배지 🎁2 는 서버 unseenCount');
  chk(has('api hide g1 true') && has('toast 🎁 선물함으로 돌아갔어요 (선물함에서 다시 부를 수 있어요)') && has('state 치움 폴더=O 말랑이=1 배지=🎁2 선물창=X'),
    '나온 선물 우클릭 — 서버에 치움 · 서버 답 뒤에 안내 · 한 마리 줄어듦(이 PC 에 적지 않음)');
  chk(has('place ok') && has('place already') && has('onScreen g1=true g3=false') && has('state 다시 부름 폴더=O 말랑이=2 배지=🎁2 선물창=X'),
    '다시 부르기 — 선물함이 서버에서 풀어 준 뒤 띄움 · 두 번째는 «이미 나와 있음» · 화면 여부를 묻는 함수');
  chk(has('remove starred') && has('api remove g2') && has('remove ok') && has('state 지움 폴더=O 말랑이=1 배지=🎁2 선물창=X'),
    '지우기 — ⭐ 는 요청 없이 막고 · 아니면 서버에서 지우고 화면에서도 뺌');
  chk(has('api markSeen') && has('state 봤음 폴더=O 말랑이=1 배지=- 선물창=X'), '서브탭 — 받기 뒤 봤음(시각 없이) · 배지 지움');
  chk(has('state 새 선물 폴더=O 말랑이=2 배지=🎁1 선물창=X'), '내 집이 열려 있는 동안 선물함을 다시 받으면 전에 없던 새 선물이 바로 뜸 · 배지가 따라 바뀜(Q1 가)');
  chk(has('api fetchOf f1') && has('api fetchVisible f1') && has('state 남의 집 폴더=O 말랑이=1 배지=🎁1 선물창=X') && has('toast 관람 중에는 이미지를 등록할 수 없어요'),
    '남의 집 — 그 집 그림 · 그 집에 나온 선물 · 폴더(그 집에 그림이 있음) · 등록 창은 막음');
  chk(has('state 닫기 폴더=O 말랑이=0 배지=🎁1 선물창=X'), '닫기 — 말랑이 전부 치움');
  chk(L.filter(l => l === 'api fetchMine').length === 3 && has('api getMallangGiftCount me ' + todayStr()) && has('state 보내기 창 폴더=O 말랑이=0 배지=🎁1 선물창=O'), '보내기 창 — 내 그림 · 오늘 보낸 수 · 그 집 선물 수를 읽고 창을 연다(아직 옛 길)');
  chk(has('state 계정 놓음 폴더=O 말랑이=0 배지=- 선물창=X'), '계정을 놓으면(reset) 말랑이 · 열린 창 · 배지를 걷음');
  const GOLD = goldOf(L);
  chk(GOLD === GOLDEN, '★ 부른 순서 · 값 전체가 옮기기 전과 같은 줄이다(' + L.length + '줄)' + (GOLD === GOLDEN ? '' : ' — 처음 어긋난 줄: ' + firstDiff(GOLD, GOLDEN)));
  chk(!L.some(l => /^ls tw\.mallang\./.test(l)), '말랑이 칸을 이 PC 에 적지 않는다(옛 로컬 백업 걷음)');

  say('── 3. 프리미엄은 deps 로');
  {
    const no = await drive(SRC.ML, { premium: false, windowPremium: true });
    chk(no.log.includes('state 내 집 열기 폴더=X 말랑이=2 배지=🎁2 선물창=X'), 'deps premiumOn 이 거짓이면 내 집 폴더 숨김(window._premiumOn 이 참이어도)');
    chk(no.log.includes('toast 👑 말랑이 선물은 라이선스 보유자 전용이에요') && no.log.includes('state 보내기 창 폴더=X 말랑이=0 배지=🎁1 선물창=X') && !no.log.includes('api getMallangGiftCount me ' + todayStr()),
      '  보내기 창도 안내만 · 서버 요청 없음');
    const yes = await drive(SRC.ML, { premium: true, windowPremium: false });
    chk(yes.log.includes('state 내 집 열기 폴더=O 말랑이=2 배지=🎁2 선물창=X'), 'deps premiumOn 이 참이면 보임(window._premiumOn 이 거짓이어도)');
    const e = mkEnv(SRC.ML.replace('const premiumOn = deps.premiumOn;', 'const premiumOn = ()=>{ throw new Error(\'x\'); };'), {});
    await e.m.onOpen('me', false); await flush(); e.state('던짐');
    chk(e.log.some(l => l.startsWith('state 던짐 폴더=X ')), '  판정이 던지면 «아님»(예전 try 그대로)');
  }

  say('── 4. 배선');
  wiring(SRC, true);

  say('── 5. 일부러 깨 보기');
  {
    const brk = async (name, src, o) => { const r = await drive(src, o || { premium: true }); return goldOf(r.log) !== GOLDEN; };
    {
      const r = await drive(SRC.ML.replace("else if(r === 'failed' || r === 'busy') placeGift(", "else if(false) placeGift("), { premium: true, hideFails: true });
      const c = await drive(SRC.ML, { premium: true, hideFails: true });
      chk(c.log.includes('state 치움 폴더=O 말랑이=2 배지=🎁2 선물창=X') && c.log.includes('error E-GIFT-05') && !c.log.includes('toast 🎁 선물함으로 돌아갔어요 (선물함에서 다시 부를 수 있어요)'), '치움이 서버에서 실패하면 E-GIFT-05 · 안내 없음 · 그 말랑이가 다시 뜬다');
      chk(r.log.includes('state 치움 폴더=O 말랑이=1 배지=🎁2 선물창=X'), '  깨 보기 — 다시 안 띄우면 한 마리가 비어 보임(빨강)');
    }
    {
      const late = async (src) => {
        let go; const holdBox = { p: new Promise(r => { go = r; }) };
        const e = mkEnv(src, { premium: true, holdBox });
        const open = e.m.onOpen('me', false); await flush();   // 선물함 답을 기다리는 중
        e.m.onClose(); go(); await open; await flush(); e.loadAll();
        return e.guys();
      };
      chk(await late(SRC.ML) === 0, '선물함 답을 기다리는 중 마이홈을 닫으면 늦게 온 답은 아무것도 안 띄운다');
      chk(await late(SRC.ML.replace("if(seq !== houseSeq || r !== 'ready') return;", "if(r !== 'ready') return;")) !== 0, '  깨 보기 — 늦은 답 검사를 빼면 닫은 뒤에 뜬다(빨강)');
    }
    chk(await brk('새 선물 띄우기', SRC.ML.replace("if(!knownGifts || visiting) return;", "return;")), '내 집이 열려 있어도 새 선물을 안 띄우면 빨강');
    {
      const r = await drive(SRC.ML.replace('function hasLicense(){ try{ return !!premiumOn(); }', 'function hasLicense(){ try{ return !!window._premiumOn(); }'), { premium: false, windowPremium: true });
      chk(!r.log.includes('state 내 집 열기 폴더=X 말랑이=2 배지=🎁2 선물창=X'), '전역 window._premiumOn 을 다시 읽으면 빨강');
    }
    {
      let threw = false;
      try{ const e = mkEnv(SRC.ML.replace('giftFull: liveFull, dropGift,', 'giftFull: liveFull,'), {}); threw = JSON.stringify(Object.keys(e.m)) !== JSON.stringify(EXPORTS); }catch(_){ threw = true; }
      chk(threw, '내놓는 이름이 빠지면 빨강');
    }
    const w = (patch) => { const s = Object.assign({}, SRC, patch); return !wiring(s, false); };
    const iMk = SRC.APP.indexOf('\nconst mallangMod = TwMallang.createMallang(');
    const block = SRC.APP.slice(iMk, SRC.APP.indexOf('\n});', iMk) + 4);
    const late = SRC.APP.replace(block, '').replace('\nconst mhStateMod = ', block + '\nconst mhStateMod = ');
    chk(w({ APP: late }), '만드는 줄이 수령함 · 창보다 뒤로 가면 빨강(값으로 넘기면 TDZ)');
    chk(w({ INBOX: SRC.INBOX.replace('mallangMod.openGift(fid', 'window._mallangOpenGift(fid') }), 'window._mallang* 고리가 다시 생기면 빨강');
    chk(w({ ML: SRC.ML.replace('function hasLicense(){ try{ return !!premiumOn(); }', 'function hasLicense(){ try{ return !!window._premiumOn(); }') }), '전역 프리미엄 읽기가 글에 다시 생기면 빨강');
    chk(w({ HTML: SRC.HTML.replace(/<script src="parts\/myhome\/mallang\.js"><\/script>[^\n]*\n/, '').replace('<script src="parts/myhome/myhome-desktop.js"></script>', '<script src="parts/myhome/mallang.js"></script>\n<script src="parts/myhome/myhome-desktop.js"></script>') }), 'html 에서 app.js 뒤로 가면 빨강');
    chk(w({ VISIT: SRC.VISIT.replace('Promise.resolve(mallangMod.applyVisit(', 'if(mallangMod) Promise.resolve(mallangMod.applyVisit(').replace("    Promise.resolve(mallangMod.applyVisit", "    if(typeof mallangMod.applyVisit === 'function') Promise.resolve(mallangMod.applyVisit") }), '«있으면 부르기» 가드가 생기면 빨강');
  }

  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(err => { say('  ✗ 실행 오류 — ' + (err && err.stack || err)); process.exit(1); });

function todayStr(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
/* 날짜가 들어간 줄은 «오늘» 로 바꿔 견준다 */
function goldOf(log){ return log.map(l => l.split(todayStr()).join('<오늘>')).join('\n'); }
function firstDiff(a, b){ const x = a.split('\n'), y = b.split('\n'); for(let i = 0; i < Math.max(x.length, y.length); i++) if(x[i] !== y[i]) return (i + 1) + '번째 «' + (x[i] || '없음') + '» ≠ «' + (y[i] || '없음') + '»'; return ''; }

/* 4절 판정 — quiet 면 결과만 돌려준다(깨 보기) */
function wiring(S, loud){
  let ok = true;
  const t = (c, msg) => { if(!c) ok = false; if(loud) chk(c, msg); };
  const A = strip(S.APP);
  const iMk = A.indexOf('const mallangMod = TwMallang.createMallang(');
  t((A.match(/TwMallang\.createMallang\(/g) || []).length === 1 && iMk > 0, 'app.js 가 만드는 곳은 한 곳(const mallangMod)');
  const call = (S.APP.match(/const mallangMod = TwMallang\.createMallang\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('//'));
  t(JSON.stringify(deps) === JSON.stringify(['toast: (...a)=>toast(...a),', 'getMyUserId: (...a)=>getMyUserId(...a),', 'getDisplayName: (...a)=>getDisplayName(...a),', 'premiumOn: (...a)=>_premiumOn(...a),', 'mallangStore: mallangStoreMod,', 'giftBox: giftBoxMod,']),
    '  deps 6 — toast · getMyUserId · getDisplayName · premiumOn(_premiumOn) · mallangStore(칸 상태 주인) · giftBox(선물 상태 주인) — 함수는 화살표');
  const iSt = A.indexOf('const mallangStoreMod = TwMallangStore.createMallangStore(');
  t(iSt > 0 && iSt < iMk, '  칸 상태 주인(mallangStoreMod)을 말랑이 화면보다 먼저 만든다');
  const users = ['TwMyHomeInbox.createMyHomeInbox(', 'TwMyHomeUi.createMyHomeUi(', 'TwMyHomeVisit.createMyHomeVisit('];
  t(users.every(u => { const i = A.indexOf(u); return i > iMk && /\n  mallangMod: mallangMod,\n/.test(A.slice(i, A.indexOf('\n});', i) + 1)); }),
    '  수령함 · 마이홈 창 · 친구 홈 구경보다 먼저 만들고 셋 다 값으로 넘긴다(mallangMod: mallangMod)');
  t(!/_mallang[A-Z]\w*/.test(strip(S.ML)) && !/window\._premiumOn/.test(strip(S.ML)) && /const premiumOn = deps\.premiumOn;/.test(S.ML), 'mallang.js — window 고리 · 전역 프리미엄 읽기 없음 · premiumOn 은 deps');
  t(![S.APP, S.UI, S.VISIT, S.INBOX].some(x => /_mallang[A-Z]\w*/.test(strip(x))) && !/window\._premiumOn\s*=/.test(A), '  app.js · 세 모듈에 window._mallang* 없음 · window._premiumOn 을 걸지 않음');
  const used = { UI: ['mallangMod.onOpen(', 'mallangMod.onClose()'], VISIT: ['mallangMod.applyVisit('],
    INBOX: ['mallangMod.openGift(', 'mallangMod.placeGift(', 'mallangMod.giftOnScreen(', 'mallangMod.giftFull(', 'mallangMod.dropGift('] };
  t(Object.keys(used).every(k => /\nconst mallangMod = deps\.mallangMod;/.test(S[k]) && used[k].every(u => strip(S[k]).includes(u))), '  세 모듈은 deps.mallangMod 를 받아 부른다');
  t(![S.UI, S.VISIT, S.INBOX].some(x => /typeof\s+mallangMod|if\(mallangMod\)|mallangMod\s*&&/.test(strip(x))), '  «있으면 부르기» 가드 없음');
  const H = S.HTML.replace(/<!--[\s\S]*?-->/g, '');
  const at = (f) => H.indexOf('<script src="parts/' + f + '"');
  t(at('shared/safe-html.js') > 0 && at('shared/img-retry.js') > 0 && at('myhome/mallang.js') > at('shared/img-retry.js') && at('myhome/mallang.js') > at('shared/safe-html.js') && at('myhome/mallang.js') < at('app.js') && H.split('parts/myhome/mallang.js').length === 2,
    'html — mallang.js 는 safe-html.js · img-retry.js 뒤 · app.js 앞(한 번)');
  t(/PRELOAD\.push\('mallang\.js'\)/.test(S.SMOKE), 'smoke.js PRELOAD 에 mallang.js');
  return ok;
}
