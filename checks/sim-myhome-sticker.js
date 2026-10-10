/* ═══ 🎨 sim-myhome-sticker.js — 마이홈 스티커 관리 창 모듈 (2026-10-10 신설 · 앱 FSD 7번) ═══════════════
   app.js 의 «🎨 스티커 관리 창» 구역 가운데 스티커 몫 두 덩이(관리 창 · 편집모드 · 드래그 · 회전 · 크기)를
   parts/myhome-sticker.js 로 옮겼다. 동작은 그대로여야 한다 — 여기서는 «옮긴 것» 을 가짜 DOM 위에서 통째로 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwMyHomeSticker 뿐 · 만들면 창 버튼 둘(✕ · 전부 화면 안으로) 연결 · DOM 없으면 조용히
   ・2절: 관리 창 — 관람 중이면 안 열림(안내) · 열면 목록 · 개수 · [＋ 새 스티커] 상한 · [전부 화면 안으로] 는 밖에 있을 때만 · 닫기
   ・3절: 줄 버튼 — ◎ 데려오기(밖이면 안으로 · 안이면 가운데) · ✎ 편집(밖이면 먼저 데려옴 · 창 닫고 편집모드) · ✨ 움직임 ·
           🔗 링크(취소 · http 아님 거절 · 비우면 없음) · × 삭제(취소 · 편집 중이던 것이면 편집모드도 끝)
   ・4절: 전부 화면 안으로 — 밖에 있는 것만 · 저장 · 안내
   ・5절: 편집모드 · 드래그 · 회전 · 크기 — 편집 표시 · 빈 곳 누르면 끝 · 드래그 이동거리 · 회전 스냅(Shift 15°) · 크기 0.3 ~ 8 · 놓으면 저장
   ・6절: app.js 배선 — 정의는 모듈에만 · 만드는 곳 한 곳 · 원래 자리 · deps 모양(함수는 화살표 · let 은 읽는 / 쓰는 함수 · const 는 값) ·
           부르는 곳은 myHomeSticker.이름 · 빈 껍데기 · html 순서 · 전역 이름
   [실행] myhome-sticker.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
/* myhome-edit.js — 마이홈 페이지 편집 묶음(앱 FSD 7-2). renderMyHomeStickers 를 감싸 다시 대입하고 [+ 스티커] · 새 스티커 붙이기가 여기서 부른다. */
const need = ['myhome-sticker.js', 'app.js', 'desk-companion-prototype.html', 'myhome-edit.js'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = SRC['app.js'], HTML = SRC['desk-companion-prototype.html'], MOD = SRC['myhome-sticker.js'], EDIT = SRC['myhome-edit.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* DOM 칸 — classList · style · 이벤트 · 자식은 진짜 */
function mkEl(tag, id){
  const cls = new Set(), L = {};
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', style: {}, dataset: {}, title: '', disabled: false, onclick: null,
    children: [], parentElement: null, _text: '', _html: '',
    get textContent(){ return this._text + this.children.map(c => c.textContent).join(''); },
    set textContent(v){ this._text = String(v); this.children = []; },
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); this.children = []; this._text = ''; },
    get className(){ return [...cls].join(' '); },
    set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); },
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c),
      toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
    appendChild(c){ c.parentElement = el; el.children.push(c); return c; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); }, _L: L,
    fire(t, ev){ (L[t] || []).forEach(fn => fn(Object.assign({ preventDefault(){}, stopPropagation(){}, target: el, pointerId: 1 }, ev || {}))); },
    click(){ if(el.onclick) return el.onclick(); },
    setPointerCapture(){ el._cap = true; }, releasePointerCapture(){ el._cap = false; },
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 40, height: 40 }),
    closest: (sel) => (sel === '.mh-sticker.editing' && el._inEditing ? el : null),
  };
  return el;
}

function mkEnv(opt){
  opt = opt || {};
  const env = {
    toasts: [], commits: 0, renders: 0, anims: [], prompts: [], confirmAns: true, focus: 0,
    editSid: null, dragDist: -1, viewing: opt.viewing || null, promptAns: null, timers: [], docL: {},
    data: { stickers: opt.stickers || {} }, W: 600, H: 400,
  };
  const els = {};
  const byId = id => (opt.noDom ? null : (els[id] || (els[id] = mkEl('div', id))));
  const ctx = {
    Math, JSON, String, Number, Array, Object, Boolean, parseInt, Error,
    console: { warn(){}, log(){} },
    document: {
      getElementById: byId,
      createElement: (t) => mkEl(t),
      addEventListener: (t, fn, cap) => { (env.docL[t] = env.docL[t] || []).push(fn); },
      removeEventListener: (t, fn) => { env.docL[t] = (env.docL[t] || []).filter(f => f !== fn); },
    },
    setTimeout: (fn) => { env.timers.push(fn); return env.timers.length; },
    confirm: () => env.confirmAns,
  };
  ctx.window = ctx;
  ctx.focus = () => { env.focus++; };
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx, { filename: 'myhome-sticker.js' });
  env.ctx = ctx; env.els = els;
  const out = (s) => (s.x || 0) < 0 || (s.y || 0) < 0 || (s.x || 0) > env.W - 10 || (s.y || 0) > env.H - 10;
  env.mk = () => ctx.TwMyHomeSticker.createMyHomeSticker({
    toast: (m) => env.toasts.push(m),
    asyncPrompt: async (o) => { env.prompts.push(o); return env.promptAns; },
    commitMyHomePage: (silent) => { env.commits++; env.lastSilent = silent; },
    renderMyHomeStickers: () => { env.renders++; },
    mhStickerOutOfView: (s) => out(s),
    mhClampStickerPos: (s) => { s.x = Math.max(0, Math.min(env.W - 40, s.x || 0)); s.y = Math.max(0, Math.min(env.H - 40, s.y || 0)); },
    mhStickerDispSize: () => ({ w: 40, h: 40 }),
    mhHomeWinSize: () => ({ W: env.W, H: env.H }),
    mhStickerTransform: (s) => 'rotate(' + (s.rot || 0) + 'deg) scale(' + (s.size || 1) + ')',
    mhOpenStickerAnim: (sid) => env.anims.push(sid),
    myHomeData: () => env.data,
    mhViewingUserId: () => env.viewing,
    mhStickerEditSid: () => env.editSid,
    setMhStickerEditSid: (v) => { env.editSid = v; },
    setMhStickerDragDist: (v) => { env.dragDist = v; },
    stickerMax: 5, stickerBase: 40, stickerRotSnap: 3,
  });
  env.row = (i) => els.stMgrList.children[i];
  env.btn = (i, txt) => env.row(i).children.find(c => c.className === 'st-mgr-btns').children.find(b => b.textContent === txt);
  env.runTimers = () => { const t = env.timers.splice(0); t.forEach(fn => fn()); };
  return env;
}
const flush = () => new Promise(r => setImmediate(r));

(async () => {
const sec = async (t, fn) => { say(t); try{ await fn(); }catch(e){ chk(false, '예외 — ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' / ')); } };

await sec('── 1. 만들 때', () => {
  const e = mkEnv();
  chk(typeof e.ctx.TwMyHomeSticker.createMyHomeSticker === 'function' && Object.keys(e.ctx.TwMyHomeSticker).join() === 'createMyHomeSticker', '싣기만 하면 window.TwMyHomeSticker(createMyHomeSticker) 하나뿐');
  chk(!e.els.stMgrClose, '  싣기만 해서는 DOM 을 건드리지 않는다');
  const M = e.mk();
  const names = ['open', 'close', 'render', 'bringIn', 'editStart', 'editEnd', 'bindDrag', 'bindRotate', 'bindResize'];
  chk(names.every(n => typeof M[n] === 'function') && Object.keys(M).length === names.length, '반환값 9개 — ' + names.join(' · '));
  chk(typeof e.els.stMgrClose.onclick === 'function' && typeof e.els.stMgrBringAll.onclick === 'function', '만들면 창 버튼 둘(✕ · 전부 화면 안으로)을 잇는다');
  const n = mkEnv({ noDom: true }); let ok = true; try{ n.mk(); }catch(_){ ok = false; }
  chk(ok, 'DOM 이 없어도 만들 때 서지 않는다(버튼 연결은 try 안)');
});

await sec('── 2. 관리 창 — 열기 · 목록 · 닫기', () => {
  const e = mkEnv({ viewing: 'friend1', stickers: { a: { img: 'data:a', x: 10, y: 20, size: 1.5, link: 'https://x.y' } } });
  const M = e.mk(); const E = e.els;
  M.open();
  chk(!E.mhStickerMgrOverlay && e.toasts[0] === '친구 홈에서는 스티커를 관리할 수 없어요', '관람 중이면 안 열리고 안내');
  e.viewing = null; M.open();
  chk(E.mhStickerMgrOverlay.classList.contains('on') && E.stMgrList.children.length === 1, '내 홈이면 열리고 목록 한 줄');
  const r = e.row(0);
  chk(r.className === 'st-mgr-row' && r.children[0].children[0].src === 'data:a', '  줄 — 그림 섬네일');
  const meta = r.children[1];
  chk(meta.children[0].innerHTML === '위치 10, 20 · 크기 150%' && meta.children[1].textContent === '🔗 https://x.y' && meta.children[1].title === 'https://x.y', '  위치 · 크기 · 링크');
  chk(E.stMgrCount.textContent === '1 / 5' && E.stMgrAdd.disabled === false && E.stMgrBringAll.disabled === true, '  개수 1 / 5 · [＋] 됨 · [전부 화면 안으로] 꺼짐(밖에 있는 것 없음)');
  chk(['◎', '✎', '✨', '🔗', '×'].every(t => !!e.btn(0, t)), '  버튼 다섯 — ◎ ✎ ✨ 🔗 ×');
  e.data.stickers = { a: { emoji: '🐱', x: -50, y: 5 }, b: {}, c: {}, d: {}, e: {} };
  M.render();
  chk(E.stMgrCount.textContent === '5 / 5' && E.stMgrAdd.disabled === true && E.stMgrBringAll.disabled === false, '다섯 개 — [＋] 꺼짐 · 밖에 하나 → [전부 화면 안으로] 켜짐');
  chk(e.row(0).children[0].textContent === '🐱' && /화면 밖/.test(e.row(0).children[1].children[0].innerHTML) && e.row(1).children[0].textContent === '⭐', '  이모지 · «화면 밖» 표시 · 그림도 이모지도 없으면 ⭐');
  chk(e.row(1).children[1].children[1].textContent === '링크 없음', '  링크 없으면 «링크 없음»');
  e.data.stickers = {}; M.render();
  chk(E.stMgrList.children.length === 1 && E.stMgrList.children[0].className === 'st-mgr-empty', '비면 안내 한 줄');
  E.stMgrClose.onclick();
  chk(!E.mhStickerMgrOverlay.classList.contains('on'), '✕ — 닫힘');
  const before = E.stMgrList.children.length; e.data.stickers = { z: {} }; M.render();
  chk(E.stMgrList.children.length === before, '닫혀 있으면 render 는 아무것도 안 한다');
});

await sec('── 3. 줄 버튼', async () => {
  const e = mkEnv({ stickers: { a: { x: 10, y: 10 }, b: { x: 900, y: 10, link: 'https://old' } } });
  const M = e.mk(); const E = e.els;
  M.open();
  e.btn(0, '◎').click();
  chk(e.data.stickers.a.x === 280 && e.data.stickers.a.y === 180 && e.renders === 1 && e.commits === 1 && e.lastSilent === true, '◎ — 안에 있던 것은 가운데로 · 다시 그림 · 조용히 저장');
  e.btn(1, '◎').click();
  chk(e.data.stickers.b.x === 560 && e.data.stickers.b.y === 10, '◎ — 밖에 있던 것은 창 안으로 당김');
  e.data.stickers.b.x = 900; M.render();
  const c0 = e.commits; e.btn(1, '✎').click();
  chk(e.data.stickers.b.x === 560 && e.commits === c0 + 1 && !E.mhStickerMgrOverlay.classList.contains('on'), '✎ — 밖이면 먼저 데려와 저장 · 관리 창 닫음');
  chk(e.editSid === 'b' && E.mhStickerEditHint.classList.contains('on') && e.timers.length === 1, '  편집모드 — 편집 id · 안내 켬 · 빈 곳 누름 감시는 다음 차례에');
  M.open(); e.btn(0, '✨').click();
  chk(e.anims[0] === 'a', '✨ — 움직임 창(그 스티커)');
  e.promptAns = null; await e.btn(1, '🔗').click(); await flush();
  chk(e.data.stickers.b.link === 'https://old' && e.prompts[0].defaultValue === 'https://old' && e.prompts[0].maxLength === 300, '🔗 취소 — 그대로 · 지금 링크를 기본값으로');
  e.promptAns = 'ftp://x'; await e.btn(1, '🔗').click(); await flush();
  chk(e.data.stickers.b.link === 'https://old' && e.toasts[e.toasts.length - 1] === 'http:// 또는 https:// 로 시작하는 주소만 넣을 수 있어요', '🔗 http 아님 — 거절 · 안내');
  e.promptAns = '  https://new  '; const c1 = e.commits; await e.btn(1, '🔗').click(); await flush();
  chk(e.data.stickers.b.link === 'https://new' && e.commits === c1 + 1, '🔗 — 바꿈(앞뒤 공백 뺌) · 저장');
  e.promptAns = ''; await e.btn(1, '🔗').click(); await flush();
  chk(e.data.stickers.b.link === null, '🔗 비우면 링크 없음(null)');
  e.confirmAns = false; const f0 = e.focus; e.btn(1, '×').click();
  chk(!!e.data.stickers.b && e.focus === f0 + 1, '× 취소 — 안 지움 · 창 포커스 되돌림');
  e.confirmAns = true; e.editSid = 'b'; const c2 = e.commits; e.btn(1, '×').click();
  chk(!e.data.stickers.b && e.editSid === null && !E.mhStickerEditHint.classList.contains('on') && e.commits === c2 + 1 && e.focus === f0 + 2, '× — 지움 · 편집 중이던 것이면 편집모드도 끝 · 저장');
  chk(E.stMgrList.children.length === 1, '  목록 다시 그림');
});

await sec('── 4. 전부 화면 안으로', () => {
  const e = mkEnv({ stickers: { a: { x: -80, y: 10 }, b: { x: 20, y: 30 }, c: { x: 10, y: 999 } } });
  const M = e.mk(); const E = e.els;
  M.open(); E.stMgrBringAll.onclick();
  chk(e.data.stickers.a.x === 0 && e.data.stickers.c.y === 360 && e.data.stickers.b.x === 20 && e.data.stickers.b.y === 30, '밖에 있는 것만 당긴다(안의 것은 그대로)');
  chk(e.commits === 1 && e.renders === 1 && e.toasts[0] === '2개를 화면 안으로 데려왔어요', '  저장 한 번 · 다시 그림 · «2개를…»');
  E.stMgrBringAll.onclick();
  chk(e.commits === 1 && e.toasts.length === 1, '다 안에 있으면 저장 · 안내 없음');
});

await sec('── 5. 편집모드 · 드래그 · 회전 · 크기', () => {
  const e = mkEnv({ stickers: { a: { x: 50, y: 60, size: 1 } } });
  const M = e.mk(); const E = e.els;
  M.editStart('a'); e.runTimers();
  chk(e.editSid === 'a' && e.renders === 1 && (e.docL.mousedown || []).length === 1, '편집 시작 — 다시 그림 · 빈 곳 누름 감시(mousedown) 하나');
  const inside = mkEl(); inside._inEditing = true;
  e.docL.mousedown[0]({ target: inside });
  chk(e.editSid === 'a', '  편집 중인 스티커 안을 누르면 그대로');
  e.docL.mousedown[0]({ target: mkEl() });
  chk(e.editSid === null && (e.docL.mousedown || []).length === 0 && !E.mhStickerEditHint.classList.contains('on') && e.renders === 2, '  빈 곳 → 편집 끝 · 감시 뗌 · 안내 끔 · 다시 그림');
  const r0 = e.renders; M.editEnd();
  chk(e.renders === r0, '편집 중이 아니면 editEnd 는 아무것도 안 한다');
  // 드래그
  const el = mkEl(); M.bindDrag(el, 'a');
  el.fire('pointerdown', { clientX: 0, clientY: 0, target: el });
  chk(e.dragDist === -1 && !el._cap, '드래그 — 편집모드 아니면 안 잡는다');
  el.classList.add('editing');
  const handle = mkEl(); handle.classList.add('mh-sticker-handle');
  el.fire('pointerdown', { clientX: 0, clientY: 0, target: handle });
  chk(!el._cap, '  크기 핸들에서 시작한 것은 드래그가 아니다');
  el.fire('pointerdown', { clientX: 0, clientY: 0, target: el });
  chk(el._cap && e.dragDist === 0, '  잡으면 이동거리 0 으로');
  el.fire('pointermove', { clientX: 30, clientY: -100 });
  chk(e.data.stickers.a.x === 80 && e.data.stickers.a.y === 0 && el.style.left === '80px' && el.style.top === '0px' && e.dragDist === 130, '  옮김 · 창 안으로 붙잡음 · 이동거리 130');
  el.fire('pointerup', {});
  chk(!el._cap && e.commits === 1, '  놓으면 저장');
  el.fire('pointermove', { clientX: 300, clientY: 300 });
  chk(e.data.stickers.a.x === 80, '  놓은 뒤 움직임은 무시');
  // 회전
  const parent = mkEl(); const rot = mkEl(); parent.appendChild(rot); const lbl = mkEl();
  M.bindRotate(rot, 'a', lbl);
  rot.fire('pointerdown', { clientX: 120, clientY: 80 });   // 중심(120,120) 위쪽 = 0°
  chk(parent.classList.contains('rotating'), '회전 — 잡으면 rotating 표시');
  rot.fire('pointermove', { clientX: 160, clientY: 120 });  // 오른쪽 = 90°
  chk(e.data.stickers.a.rot === 90 && lbl.textContent === '90°' && parent.style.transform === 'rotate(90deg) scale(1)', '  90° · 각도 표시 · transform');
  rot.fire('pointermove', { clientX: 160, clientY: 121 });  // 91.4° → 3° 스냅 = 90
  chk(e.data.stickers.a.rot === 90, '  3° 스냅');
  rot.fire('pointermove', { clientX: 160, clientY: 132, shiftKey: true });  // 106.7° → Shift 15° = 105
  chk(e.data.stickers.a.rot === 105, '  Shift = 15° 스냅');
  rot.fire('pointermove', { clientX: 100, clientY: 140 });  // 왼쪽 아래 = 225° → -180 ~ 180 으로
  chk(e.data.stickers.a.rot === -135 && lbl.textContent === '-135°', '  180° 를 넘으면 음수 쪽으로(225° → -135°)');
  const c1 = e.commits; rot.fire('pointerup', {});
  chk(!parent.classList.contains('rotating') && e.commits === c1 + 1, '  놓으면 표시 끄고 저장');
  // 크기
  const p2 = mkEl(); const h = mkEl(); p2.appendChild(h); e.data.stickers.a.size = 1;
  M.bindResize(h, 'a');
  h.fire('pointerdown', { clientX: 0, clientY: 0 });
  h.fire('pointermove', { clientX: 40, clientY: 40 });
  chk(e.data.stickers.a.size === 2 && /scale\(2\)/.test(p2.style.transform), '크기 — 우하단 80px = +1(기준 40 × 2)');
  h.fire('pointermove', { clientX: 9999, clientY: 9999 });
  chk(e.data.stickers.a.size === 8, '  상한 8');
  h.fire('pointermove', { clientX: -9999, clientY: -9999 });
  chk(e.data.stickers.a.size === 0.3, '  하한 0.3');
  const c2 = e.commits; h.fire('pointerup', {});
  chk(e.commits === c2 + 1, '  놓으면 저장');
  delete e.data.stickers.a;
  let ok = true; try{ h.fire('pointerdown', {}); h.fire('pointermove', { clientX: 5, clientY: 5 }); rot.fire('pointerdown', {}); el.fire('pointerdown', { target: el }); }catch(_){ ok = false; }
  chk(ok, '지워진 스티커의 핸들은 조용히 넘어간다');
});

await sec('── 6. app.js 배선', () => {
  const code = strip(APP);
  const defs = /function (openStickerMgr|closeStickerMgr|renderStickerMgr|_mhBringStickerIn|_mhStickerEditStart|_mhStickerEditEnd|_mhStickerEditCloser|_mhBindStickerDrag|_mhBindStickerRotate|_mhBindStickerResize)\(/;
  chk(!defs.test(code) && defs.test(MOD), '스티커 관리 창 · 편집 · 드래그 · 회전 · 크기 정의는 모듈에만');
  chk(!/\b(openStickerMgr|closeStickerMgr|renderStickerMgr|_mhStickerEditStart|_mhStickerEditEnd|_mhBindSticker\w+)\b/.test(code), '  app.js 는 옛 이름을 부르지 않는다(myHomeSticker.이름)');
  chk(/window\.TwMyHomeSticker = api/.test(MOD) && (code.match(/TwMyHomeSticker\.createMyHomeSticker\(/g) || []).length === 1, '모듈은 window.TwMyHomeSticker · 만드는 곳은 한 곳');
  const iMk = APP.indexOf('TwMyHomeSticker.createMyHomeSticker('), iPrev = APP.indexOf('function renderMyHomeStickers('),
    iLinks = APP.indexOf('(function bindMyHomeExternalLinks(){'), iPage = APP.indexOf('TwMyHomeEdit.createMyHomeEdit(');
  chk(iPrev > 0 && iMk > iPrev && iLinks > iMk && iPage > iLinks, '원래 자리 — renderMyHomeStickers 뒤 · 🔗 마이홈 본문 링크 · 마이홈 페이지 편집 묶음(myhome-edit.js 연결) 앞');
  const call = (APP.match(/TwMyHomeSticker\.createMyHomeSticker\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  const want = [
    /^toast: \(\.\.\.a\)=>toast\(\.\.\.a\),$/, /^asyncPrompt: \(\.\.\.a\)=>asyncPrompt\(\.\.\.a\),$/,
    /^commitMyHomePage: \(\.\.\.a\)=>commitMyHomePage\(\.\.\.a\),$/, /^renderMyHomeStickers: \(\.\.\.a\)=>renderMyHomeStickers\(\.\.\.a\),$/,
    /^mhStickerOutOfView: \(\.\.\.a\)=>_mhStickerOutOfView\(\.\.\.a\),$/, /^mhClampStickerPos: \(\.\.\.a\)=>_mhClampStickerPos\(\.\.\.a\),$/,
    /^mhStickerDispSize: \(\.\.\.a\)=>_mhStickerDispSize\(\.\.\.a\),$/, /^mhHomeWinSize: \(\.\.\.a\)=>_mhHomeWinSize\(\.\.\.a\),$/,
    /^mhStickerTransform: \(\.\.\.a\)=>_mhStickerTransform\(\.\.\.a\),$/, /^mhOpenStickerAnim: \(\.\.\.a\)=>_mhOpenStickerAnim\(\.\.\.a\),$/,
    /^myHomeData: \(\)=>_myHomeData,$/, /^mhViewingUserId: \(\)=>_mhViewingUserId,$/, /^mhStickerEditSid: \(\)=>_mhStickerEditSid,$/,
    /^setMhStickerEditSid: \(v\)=>\{ _mhStickerEditSid = v; \},$/, /^setMhStickerDragDist: \(v\)=>\{ _mhStickerDragDist = v; \},$/,
    /^stickerMax: STICKER_MAX,$/, /^stickerBase: STICKER_BASE,$/, /^stickerRotSnap: STICKER_ROT_SNAP,$/,
  ];
  const bad = want.map((re, i) => re.test(deps[i] || '') ? null : (i + ':' + (deps[i] || '없음'))).filter(Boolean);
  chk(deps.length === want.length && !bad.length, 'deps 18개 — 함수는 화살표 · let 은 읽는 / 쓰는 함수 · const 는 값 (' + deps.length + (bad.length ? ' · 어긋남 ' + bad[0] : '') + ')');
  /* ★ renderMyHomeStickers 는 마이홈 페이지 편집 묶음(myhome-edit.js)이 감싸 다시 대입한다 — 값으로 받으면 감싼 쪽(삭제 버튼 자동 저장)을 못 부른다.
       대입은 app.js 의 연결 줄(setRenderMyHomeStickers)이 하고, 그 연결은 이 모듈을 만드는 줄보다 뒤다. */
  chk(/_setRenderMyHomeStickers\(function\(\)\{ origRenderStickers\(\);/.test(EDIT) && APP.indexOf('setRenderMyHomeStickers: (f)=>{ renderMyHomeStickers = f; },') > iMk, '  renderMyHomeStickers 는 만드는 줄 뒤에 다시 대입된다 — 그래서 화살표');
  const consts = ['STICKER_MAX', 'STICKER_BASE', 'STICKER_ROT_SNAP'].map(n => APP.indexOf('const ' + n + ' = '));
  chk(consts.every(i => i > 0 && i < iMk) && !/\bSTICKER_(MAX|BASE|ROT_SNAP)\s*=[^=]/.test(code.replace(/const STICKER_(MAX|BASE|ROT_SNAP) = /g, '')), '  STICKER_* 는 만드는 줄보다 앞 · 다시 대입되지 않는다');
  chk(/let _mhStickerEditSid = null;/.test(APP) && /let _mhStickerDragDist = 0;/.test(APP) && /if\(sid === _mhStickerEditSid && canEdit\)/.test(APP) && /if\(_mhStickerDragDist>5\) return;/.test(APP), '  두 let 은 app.js 에 남아 renderMyHomeStickers 가 읽는다');
  const m = strip(MOD);
  chk(!/[^.\w](_mhStickerEditSid|_mhStickerDragDist)\s*=[^=]/.test(m.replace(/const _mhStickerEditSid = deps\.mhStickerEditSid;/, '')), '모듈은 app.js 의 let 에 직접 쓰지 않는다(쓰는 함수로)');
  const calls = ['myHomeSticker.close();', 'myHomeSticker.editEnd(); return;', 'myHomeSticker.editStart(sid);', 'myHomeSticker.bindResize(handle, sid);',
    'myHomeSticker.bindRotate(rot, sid, rotLbl);', 'myHomeSticker.bindDrag(el, sid);', 'myHomeSticker.open();', 'myHomeSticker.render();'];
  const codeAll = code + '\n' + strip(EDIT);   // [+ 스티커] · 새 스티커 붙이기는 myhome-edit.js 가 부른다
  chk(calls.every(c => codeAll.includes(c)) && (codeAll.match(/myHomeSticker\.editEnd\(\)/g) || []).length === 2, '부르는 곳 — 마이홈 닫기 · renderMyHomeStickers · [+ 스티커] · 새 스티커 붙이기');
  const off = (APP.match(/const MYHOME_STICKER_OFF = \{([\s\S]*?)\};/) || [])[1] || '';
  chk(['open', 'close', 'render', 'bringIn', 'editStart', 'editEnd', 'bindDrag', 'bindRotate', 'bindResize'].every(n => new RegExp('\\b' + n + '\\(\\)\\{\\}').test(off)), '빈 껍데기 MYHOME_STICKER_OFF — 반환값 이름을 다 갖는다');
  const iP = HTML.indexOf('<script src="parts/pomodoro.js"></script>'), iS = HTML.indexOf('<script src="parts/myhome-sticker.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iP > 0 && iS > iP && iA > iS, 'html — myhome-sticker.js 를 app.js 앞에 싣는다');
  chk(/^Tw[A-Z]/.test('TwMyHomeSticker') && !/window\.MyHomeSticker\s*=/.test(MOD), '전역 이름은 Tw 접두사(#103 — 크로미움 내장 전역과 겹치지 않게)');
  /* 모듈이 없을 때 — 빈 껍데기 줄만 떼어 굴린다 */
  const wire = (APP.match(/const MYHOME_STICKER_OFF = [\s\S]*?\n\}\);/) || [''])[0];
  const box = { STICKER_MAX: 5, STICKER_BASE: 40, STICKER_ROT_SNAP: 3 };
  let got = null; try{ got = vm.runInNewContext(wire + '\nmyHomeSticker;', box); }catch(_){}
  chk(!!got && typeof got.open === 'function' && got.close() === undefined && got.editEnd() === undefined, '모듈이 안 실려도 그 자리는 서지 않는다(빈 껍데기)');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
/* 기다리던 약속이 영영 안 풀려 이벤트 고리가 비면 node 는 0 으로 조용히 끝난다 — 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
