/* sim-gift-img-retry.js — 🖼 말랑이 · 선물 그림을 못 받으면 캐시를 비켜 한 번 더 받기(img-retry.js retryOnError)
   [무엇을 지키나] 서버의 선물 그림은 멀쩡한데 한 PC 에서만 빈칸으로 남던 것 — 실패 응답이 캐시에 남으면 같은 주소로는
     계속 실패한다. 표식 주소(twr=1)로 한 번만 더 받고, 그래도 못 받으면 예전처럼 그만둔다(늘 받기가 되지 않게).
   ・1절: retryOnError 를 실제로 돌린다 — 한 번 더 · 두 번째 실패면 그만둠(onGiveUp 한 번) · data: 는 다시 안 받음 · onGiveUp 없어도 던지지 않음
   ・2절: mallang.js 를 가짜 DOM 에서 실제로 돌린다 — 선물 말랑이 그림이 실패하면 표식 주소로 한 번 더 · 또 실패하면 그 말랑이를 치운다
   ・3절: mallang.js 등록 칸(우클릭 등록 창) · 선물 고르기 칸을 실제로 열어 그 칸 그림이 한 번 더 받는지 · html 싣는 순서
     (💝 선물함 칸은 sim-myhome-inbox 5절이 진짜 _giftBoxPaint 로 본다)
   ・4절: 일부러 깨 보기 — 다시 받기 없음 · 끝없이 다시 받음 · 말랑이 · 등록 칸 · 선물 고르기 칸에 안 걺 · html 싣는 순서
   [실행] node checks/run.js sim-gift-img-retry */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/parts/myhome/' + f, 'app/parts/shared/' + f, 'app/' + f]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = { retry: read('img-retry.js'), safe: read('safe-html.js'), mallang: read('mallang.js'), html: read('desk-companion-prototype.html') };
if(Object.values(SRC).some(v => !v)){ say('  ? 원본 못 찾음 — img-retry.js · safe-html.js · mallang.js · desk-companion-prototype.html'); process.exit(2); }

const loadSafe = () => { const m = { exports: {} }; new Function('window', 'module', SRC.safe)(undefined, m); return m.exports; };
/* img-retry.js 를 싣는다 — TwSafeHtml 은 그 안에서 전역 이름으로 찾는다 */
function loadRetry(src){
  const m = { exports: {} };
  new Function('window', 'module', 'TwSafeHtml', src)(undefined, m, loadSafe());
  return m.exports;
}

const GIFT = 'https://firebasestorage.googleapis.com/v0/b/x/o/users%2Fu%2Fgiftimg%2Fg1.png?alt=media&token=t';
const MINE = ['https://firebasestorage.googleapis.com/v0/b/x/o/m1.png?alt=media', 'https://firebasestorage.googleapis.com/v0/b/x/o/m2.png?alt=media'];

function judgeUnit(retrySrc){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const R = loadRetry(retrySrc);
    let gave = 0;
    const im = R.retryOnError({ src: '' }, () => { gave++; });
    im.src = GIFT;
    im.onerror();
    t(im.src === GIFT + '&twr=1' && gave === 0, '★ 못 받으면 표식 주소(&twr=1)로 한 번 더 받는다');
    im.onerror();
    t(gave === 1 && im.onerror === null && im.src === GIFT + '&twr=1', '★ 또 못 받으면 그만둔다(onGiveUp 한 번 · 세 번째 요청 없음)');
    let g2 = 0;
    const d = R.retryOnError({ src: 'data:image/png;base64,AA' }, () => { g2++; });
    d.onerror();
    t(g2 === 1 && d.src === 'data:image/png;base64,AA', 'data: 그림은 다시 받지 않는다(바로 그만둠)');
    const q = R.retryOnError({ src: 'https://a.example/b.png' });
    q.onerror(); q.onerror();
    t(q.src === 'https://a.example/b.png?twr=1', '  onGiveUp 이 없어도 던지지 않는다 · 물음표 없는 주소는 ?twr=1');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}

/* mallang.js 를 가짜 DOM 에서 — 이 모듈이 쓰는 만큼만 */
function mkEnv(mallangSrc, retrySrc){
  const byId = {}, imgs = [];
  const mk = (tag) => {
    const cls = new Set(), L = {};
    const el = {
      tagName: String(tag).toUpperCase(), style: {}, children: [], parentElement: null, _id: '', textContent: '', title: '', _html: '',
      get id(){ return this._id; }, set id(v){ this._id = v; byId[v] = el; },
      classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c),
        toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
      set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); }, get className(){ return [...cls].join(' '); },
      /* innerHTML 로 만든 id 칸은 같은 id 의 가짜 요소로 — getElementById · querySelector('#id') 가 찾는다 */
      get innerHTML(){ return el._html; },
      set innerHTML(v){ el._html = String(v); el.children = []; for(const m of el._html.matchAll(/id="([^"]+)"/g)){ const c = mk('div'); c.id = m[1]; el.appendChild(c); } },
      appendChild(c){ c.parentElement = el; el.children.push(c); return c; },
      remove(){ if(el.parentElement) el.parentElement.children = el.parentElement.children.filter(x => x !== el); el.parentElement = null; },
      addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
      fire(t){ (L[t] || []).forEach(fn => fn({ preventDefault(){}, stopPropagation(){} })); },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 580 }),
      dataset: {},
      /* '#id' 는 id 로 · '.cls' 는 자식 가운데 그 클래스 */
      querySelector: (q) => {
        if(q[0] === '#') return byId[q.slice(1)] || null;
        const c = q.slice(1); let hit = null;
        const walk = (n) => n.children.forEach(x => { if(!hit && x.classList.contains(c)) hit = x; if(!hit) walk(x); });
        if(q[0] === '.') walk(el);
        return hit;
      },
    };
    return el;
  };
  const win = mk('div'); win.id = 'myHomeWin';
  const room = mk('div'); room.id = 'mhRoomPreview';
  class FakeImage { constructor(){ this.naturalWidth = 100; this.naturalHeight = 100; imgs.push(this); } }
  const gifts = { home1: { g1: { imgUrl: GIFT } } };
  const ctx = {
    console: { log(){}, warn(){} }, Math, JSON, String, Number, Array, Object, Set, Promise, Date, Error,
    document: { getElementById: (id) => byId[id] || null, createElement: mk, head: mk('head'), querySelector: () => null, querySelectorAll: () => [] },
    Image: FakeImage, localStorage: { getItem: () => null, setItem(){} },
    requestAnimationFrame: () => 1, cancelAnimationFrame(){}, setTimeout: () => 0, clearTimeout(){},
    toast(){}, getMyUserId: () => 'me', _premiumOn: () => true, getDisplayName: () => '나',
    firebaseAPI: {
      getMallangImgs: async (id) => (id === 'me' ? MINE.map(url => ({ url, on: true })) : []),
      getMallangGifts: async (id) => gifts[id] || {},
      getMallangGiftCount: async () => 0,
    },
  };
  ctx.window = ctx;
  ctx.TwSafeHtml = loadSafe();
  ctx.TwImgRetry = loadRetry(retrySrc);
  vm.createContext(ctx);
  vm.runInContext(mallangSrc, ctx, { filename: 'mallang.js' });
  return { ctx, imgs, byId, layer: () => byId.mlLayer };
}
const flush = () => new Promise(r => setImmediate(r));

async function judgeMallang(mallangSrc, retrySrc){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const e = mkEnv(mallangSrc, retrySrc);
    await e.ctx._mallangOnOpen('home1', false); await flush();
    const im = e.imgs.find(x => String(x.src || '').startsWith(GIFT));
    const guys = () => (e.layer() ? e.layer().children.length : 0);
    t(im && guys() === 1, '선물 말랑이 하나가 뜬다(그림을 받는 중)');
    if(im){
      im.onerror();
      t(im.src === GIFT + '&twr=1' && guys() === 1, '★ 그림을 못 받으면 표식 주소로 한 번 더 받는다(말랑이는 그대로)');
      im.onerror();
      t(guys() === 0, '★ 또 못 받으면 그 말랑이를 치운다(예전과 같은 끝)');
    }
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}

/* 칸 안의 <img> 들 */
const imgsIn = (el) => { const out = []; const walk = (n) => n.children.forEach(c => { if(c.tagName === 'IMG') out.push(c); walk(c); }); if(el) walk(el); return out; };
const retriesOnce = (im) => { const a = im.src; if(im.onerror) im.onerror(); return /^https:/.test(a) && im.src === a + '&twr=1'; };

async function judgeSlots(mallangSrc, retrySrc){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try{
    const e = mkEnv(mallangSrc, retrySrc);
    await e.ctx._mallangOnOpen('me', false); await flush();
    const folder = e.byId.mlFolder;
    t(!!folder, '내 집 — 말랑이 폴더가 뜬다');
    if(folder){
      folder.fire('contextmenu');
      const ims = imgsIn(e.byId.mlSlots);
      t(ims.length === 2 && ims.every(retriesOnce), '★ 등록 칸(우클릭 창) 그림 — 못 받으면 표식 주소로 한 번 더');
    }
    await e.ctx._mallangOpenGift('f1', '친구'); await flush();
    const gims = imgsIn(e.byId.mlGiftGrid);
    t(gims.length === 2 && gims.every(retriesOnce), '★ 선물 고르기 칸 그림 — 못 받으면 표식 주소로 한 번 더');
  }catch(e){ t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 100)); }
  return r;
}

function judgeWire(s){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const at = (f) => s.html.indexOf('<script src="parts/' + f + '"');
  t(at('shared/safe-html.js') > 0 && at('shared/img-retry.js') > at('shared/safe-html.js') && at('shared/img-retry.js') < at('myhome/myhome-inbox.js') && at('shared/img-retry.js') < at('myhome/mallang.js'),
    'html — safe-html.js → img-retry.js → myhome-inbox.js · mallang.js 순서');
  return r;
}

(async () => {
  say('── 1. retryOnError');
  judgeUnit(SRC.retry).forEach(([ok, m]) => chk(ok, m));
  say('── 2. mallang.js 선물 말랑이');
  (await judgeMallang(SRC.mallang, SRC.retry)).forEach(([ok, m]) => chk(ok, m));
  say('── 3. 등록 칸 · 선물 고르기 칸 · 연결');
  (await judgeSlots(SRC.mallang, SRC.retry)).forEach(([ok, m]) => chk(ok, m));
  judgeWire(SRC).forEach(([ok, m]) => chk(ok, m));
  say('── 4. 일부러 깨 보기');
  const breaks = [
    ['다시 받기 없음(예전 — 바로 그만둠)', 'retry', s => s.replace("    if(again){ img.src = again; return; }\n", '')],
    ['표식을 안 봐서 끝없이 다시 받음', 'retry', s => s.replace("  if(/[?&]twr=1(?:&|$)/.test(s)) return null;   // 이미 다시 받은 주소 — 두 번까지만\n", '')],
    ['말랑이가 예전 onerror(바로 치움)', 'mallang', s => s.replace("    TwImgRetry.retryOnError(im, ()=>{ _release(); try{ guy.remove(); }catch(_){} });", "    im.onerror = ()=>{ _release(); try{ guy.remove(); }catch(_){} };")],
    ['등록 칸에 안 걺', 'mallang', s => s.replace("        if(src){ const im = TwImgRetry.retryOnError(document.createElement('img'));", "        if(src){ const im = document.createElement('img');")],
    ['선물 고르기 칸에 안 걺', 'mallang', s => s.replace("      if(gsrc){ const gim = TwImgRetry.retryOnError(document.createElement('img'));", "      if(gsrc){ const gim = document.createElement('img');")],
    ['html 이 img-retry.js 를 늦게 실음', 'html', s => s.replace('<script src="parts/shared/img-retry.js"></script>', '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n<script src="parts/shared/img-retry.js"></script>')],
  ];
  for(const [name, key, f] of breaks){
    const s2 = Object.assign({}, SRC, { [key]: f(SRC[key]) });
    const changed = s2[key] !== SRC[key];
    let rows = [];
    if(changed){
      rows = rows.concat(judgeUnit(s2.retry), await judgeMallang(s2.mallang, s2.retry), await judgeSlots(s2.mallang, s2.retry), judgeWire(s2));
    }
    chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
