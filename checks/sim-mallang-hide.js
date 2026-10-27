/* sim-mallang-hide.js — 마이홈 말랑이 잠깐 숨기기(mallang.js · 제목줄 #mhMallangHideBtn)
   실행:  node sim-mallang-hide.js   (mallang.js · myhome-ui.js · desk-companion-prototype.html 이 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 숨겨 놓고 집을 옮기면 다음 집 말랑이까지 안 보이거나, 버튼이 말랑이 없이 떠 있거나,
     숨긴 동안에도 움직임 계산이 계속 돌면 «잠깐 가리기» 가 아니게 된다.
   ・1절: mallang.js 를 가짜 DOM 에서 실제로 돌린다 — 선물 말랑이 둘이 뜨면 버튼이 보임 · 누르면 판을 가리고 움직임을 멈춤 ·
          다시 누르면 보이고 다시 움직임 · 마이홈을 닫거나 집을 옮기면 다시 보임 · 말랑이가 없으면 버튼도 없음 · 남의 집에서도 됨
   ・2절: 깨 보기 — 규칙 줄을 망가뜨리면 1절이 빨강인가
   ・3절: 배선 — 제목줄 «👁 방문자 시점» 바로 앞 · 처음엔 숨김 · 제목줄 끌기가 이 버튼을 잡지 않음 */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/parts/myhome/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('mallang.js'), UI = read('myhome-ui.js'), HTML = read('desk-companion-prototype.html');
if (!MOD || !UI || !HTML) { say('  ? 원본 못 찾음 — mallang.js · myhome-ui.js · desk-companion-prototype.html'); process.exit(2); }

/* 가짜 DOM — id 로 찾고 · 붙이고 · class · style · 이벤트만 진짜 */
function mkEnv(src){
  const byId = {}, imgs = [], rafs = [];
  const mk = (tag) => {
    const cls = new Set(), L = {};
    const el = {
      tagName: String(tag).toUpperCase(), style: {}, children: [], parentElement: null, _id: '', textContent: '', title: '', innerHTML: '',
      get id(){ return this._id; }, set id(v){ this._id = v; byId[v] = el; },
      classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c),
        toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
      set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); }, get className(){ return [...cls].join(' '); },
      appendChild(c){ c.parentElement = el; el.children.push(c); return c; },
      remove(){ if (el.parentElement) el.parentElement.children = el.parentElement.children.filter(x => x !== el); },
      addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); }, fire(t){ (L[t] || []).forEach(fn => fn({ preventDefault(){}, stopPropagation(){} })); },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 580 }),
      querySelector: () => null,
    };
    return el;
  };
  const win = mk('div'); win.id = 'myHomeWin';
  const room = mk('div'); room.id = 'mhRoomPreview';
  const btn = mk('span'); btn.id = 'mhMallangHideBtn'; btn.style.display = 'none';
  class FakeImage { constructor(){ this.naturalWidth = 100; this.naturalHeight = 100; imgs.push(this); } set src(v){ this._src = v; } get src(){ return this._src; } }
  const gifts = { home1: { g1: { imgUrl: 'https://x.example/a.png' }, g2: { imgUrl: 'https://x.example/b.png' } }, empty: {} };
  const ctx = {
    console: { log(){}, warn(){} }, Math, JSON, String, Number, Array, Object, Set, Promise, Date, Error,
    document: { getElementById: (id) => byId[id] || null, createElement: mk, head: mk('head'), querySelectorAll: () => [] },
    Image: FakeImage, localStorage: { getItem: () => null, setItem(){} },
    requestAnimationFrame: (fn) => { rafs.push(fn); return rafs.length; }, cancelAnimationFrame(){},
    setTimeout: () => 0, clearTimeout(){},
    toast(){}, getMyUserId: () => 'me',
    firebaseAPI: { getMallangImgs: async () => [], getMallangGifts: async (id) => gifts[id] || {} },
  };
  ctx.window = ctx;
  ctx.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => fs.existsSync(p)));   // 🛡️ 공용 씻기 — 진짜 파일
  ctx.TwImgRetry = require([__dirname, process.cwd()].flatMap(d => ['img-retry.js', 'parts/shared/img-retry.js', 'app/parts/shared/img-retry.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🖼 말랑이 그림 한 번 더 받기 — 진짜 파일
  globalThis.TwSafeHtml = ctx.TwSafeHtml;   // img-retry.js 는 node 쪽 전역에서 TwSafeHtml 을 찾는다
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'mallang.js' });
  const loadAll = () => { imgs.splice(0).forEach(im => im.onload && im.onload()); };
  const layer = () => byId.mlLayer;
  return { ctx, btn, layer, loadAll, rafs };
}
const flush = () => new Promise(r => setImmediate(r));

/* 1절 판정 — 깨 보기가 같은 판정을 다시 굴린다. 실패한 줄 이름을 돌려준다. */
async function judge(src){
  const bad = [];
  const t = (ok, name) => { if (!ok) bad.push(name); };
  try {
    const e = mkEnv(src);
    await e.ctx._mallangOnOpen('home1', false); await flush(); e.loadAll();
    t(e.btn.style.display === 'inline' && e.btn.textContent === '말랑이 숨기기', '말랑이가 뜨면 버튼이 보인다');
    t(!e.layer().classList.contains('ml-hidden'), '처음엔 보인다');
    const r0 = e.rafs.length;
    e.btn.fire('click');
    t(e.layer().classList.contains('ml-hidden') && e.btn.textContent === '말랑이 보이기' && e.btn.style.display === 'inline', '누르면 판을 가리고 «보이기» 로');
    e.rafs.slice(r0).concat(e.rafs.slice(-1)).forEach(fn => { try { fn(); } catch (_) {} });
    const r1 = e.rafs.length; e.rafs.slice(-1)[0] && e.rafs.slice(-1)[0]();
    t(e.rafs.length === r1, '숨긴 동안은 움직임을 멈춘다(다음 프레임을 안 건다)');
    e.btn.fire('click');
    t(!e.layer().classList.contains('ml-hidden') && e.btn.textContent === '말랑이 숨기기' && e.rafs.length === r1 + 1, '다시 누르면 보이고 다시 움직인다');
    e.btn.fire('click');
    e.ctx._mallangOnClose();
    t(!e.layer().classList.contains('ml-hidden') && e.btn.style.display === 'none', '숨긴 채 닫으면 다시 보이는 상태 · 말랑이가 없으니 버튼도 없음');
    e.btn.fire('click');
    await e.ctx._mallangApplyVisit(true, 'home1'); await flush(); e.loadAll();
    t(!e.layer().classList.contains('ml-hidden') && e.btn.style.display === 'inline', '숨긴 채 다른 집으로 가면 그 집 말랑이는 보인다 · 남의 집에서도 버튼');
    const e2 = mkEnv(src);
    await e2.ctx._mallangOnOpen('empty', false); await flush(); e2.loadAll();
    t(e2.btn.style.display === 'none', '말랑이가 없으면 버튼이 없다');
  } catch (err) { bad.push('던짐 — ' + (err && err.message)); }
  return bad;
}

(async () => {
say('── 1. mallang.js 실제로 돌리기 (가짜 DOM)');
const NAMES = ['말랑이가 뜨면 버튼이 보인다', '처음엔 보인다', '누르면 판을 가리고 «보이기» 로', '숨긴 동안은 움직임을 멈춘다(다음 프레임을 안 건다)', '다시 누르면 보이고 다시 움직인다',
  '숨긴 채 닫으면 다시 보이는 상태 · 말랑이가 없으니 버튼도 없음', '숨긴 채 다른 집으로 가면 그 집 말랑이는 보인다 · 남의 집에서도 버튼', '말랑이가 없으면 버튼이 없다'];
const bad = await judge(MOD);
NAMES.forEach(n => chk(!bad.includes(n), n));
chk(!bad.some(n => /^던짐/.test(n)), '던지지 않는다' + (bad.find(n => /^던짐/.test(n)) ? ' — ' + bad.find(n => /^던짐/.test(n)) : ''));
chk(/#mlLayer\.ml-hidden\{visibility:hidden;\}/.test(MOD), '  css — 숨기면 말랑이 · 하트 · 말풍선을 통째로 가린다(누를 수도 없다)');

say('── 2. 깨 보기 — 규칙 줄을 망가뜨리면 1절이 빨강인가');
const BREAKS = [
  ['닫아도 숨긴 채로', "    hidden = false;   // 집을 옮기거나 닫으면", '    // 집을 옮기거나 닫으면'],
  ['뜰 때 버튼을 안 고침', '      if(!rafId) rafId = requestAnimationFrame(tick);\n      syncHideBtn();', '      if(!rafId) rafId = requestAnimationFrame(tick);'],
  ['숨겨도 계속 움직임', 'if(!win || hidden){ rafId=null; return; }', 'if(!win){ rafId=null; return; }'],
  ['다시 보여도 안 깨움', 'if(!hidden && live.length && !rafId) rafId = requestAnimationFrame(tick);', ''],
  ['말랑이 없어도 버튼', "(hidden || liveCount() > 0) ? 'inline' : 'none'", "'inline'"],
];
for (const [name, a, b] of BREAKS) {
  if (!MOD.includes(a)) { chk(false, '깨 보기 «' + name + '» — 바꿀 글을 못 찾음(mallang.js 가 바뀌었으면 이 표도)'); continue; }
  chk((await judge(MOD.replace(a, b))).length > 0, '깨 보기 «' + name + '» → 빨강');
}

say('── 3. 배선');
const iH = HTML.indexOf('<span id="mhMallangHideBtn"'), iP = HTML.indexOf('<span id="mhPreviewBtn"');
chk(iH > 0 && iP > iH && iP - iH < 400 && /<span id="mhMallangHideBtn" style="display:none;/.test(HTML), '제목줄 «👁 방문자 시점» 바로 앞 · 처음엔 숨김(말랑이가 뜨면 보인다)');
chk(/closest\('[^']*#mhMallangHideBtn[^']*'\)\) return;/.test(UI), '  제목줄 끌기가 이 버튼을 잡지 않는다(myhome-ui.js)');

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 말랑이는 잠깐만 가려진다'));
process.exit(fail ? 1 : 0);
})();
