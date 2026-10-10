/* ═══ 🏠 sim-myhome-edit.js — 마이홈 페이지 편집 묶음 · 👑 디자인 스튜디오 모듈 (2026-10-10 신설 · 앱 FSD 7-2) ═══════════
   app.js 의 마이홈 페이지 편집 묶음(옛 bindMyHomePage — 자동저장 · 프로필 사진 · 글 서식 · 새 스티커 붙이기 · 스티커 끌기 ·
   닉네임 · 게시글 제목 · 🎵 BGM · 바깥 배경 · 테마 · 👑 디자인 스튜디오 · 프리셋)을 parts/myhome-edit.js 로 옮겼다.
   동작은 그대로여야 한다 — 여기서는 «옮긴 것» 을 가짜 DOM 위에서 통째로 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwMyHomeEdit 뿐 · 만들면 window 고리 · BGM 창 구독 · renderMyHomeStickers 감싸기 ·
          app.js 뒤쪽 const(USER_NAME_MAX)는 만들 때 읽지 않는다 · DOM 이 없어도 서지 않는다
   ・2절: 자동저장 — 관람 중 · 불러오기 전 · 계정 바뀜(불러온 상태 무효) 이면 안 쓴다 · 쓰면 글 두 칸을 담아 saveMyHome · 거부 이유 · 경고 · 실패
   ・3절: 프로필 사진 · 글 서식 툴바(굵게 · 링크 — http 만) · 색 팝업(HEX · 최근 색 · 초기화)
   ・4절: 새 스티커 붙이기 · 스티커 끌기(이동거리 · 창 안으로 · 놓으면 저장 · 관람 중 막힘) · 삭제 버튼에 저장 한 번 더
   ・5절: 닉네임 · 게시글 제목 인라인 편집 — Enter 저장 · Esc 취소 · 관람 중 막힘 · 길이 상한
   ・6절: 🎵 BGM — 등록 · 재생 · 일시정지 · 재개 · 지우기 · 창 주인 아닐 때 안 닫음 · 플레이리스트로 넘어감
   ・7절: 바깥 배경 · 테마 · [✎ 마이홈 수정] 분기(라이선스 → 디자인 스튜디오 · 아니면 메뉴) · 초기화
   ・8절: 👑 디자인 스튜디오 · 프리셋 — 창 열기(테마 주입) · 항목 · 프리셋 저장(색만) · 불러오기(두 번 · 그림은 그대로) · 이름 · 전체 초기화 · 닫기
   ・9절: app.js 배선 — 정의는 모듈에만 · 만드는 곳 한 곳 · 원래 자리 · deps 모양 · window 고리 이름 · 빈 껍데기 · html 순서 · 전역 이름
   [실행] myhome-edit.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['myhome-edit.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = SRC['app.js'], HTML = SRC['desk-companion-prototype.html'], MOD = SRC['myhome-edit.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* DOM 칸 — classList · style · 이벤트 · 자식 · 지우기는 진짜. querySelector 는 선택자마다 칸 하나(그 칸 안의 버튼 · 입력칸) */
function mkEl(env, tag, id){
  const cls = new Set(), L = {}, qs = {};
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', dataset: {}, title: '', value: '', files: [], disabled: false, onclick: null,
    children: [], parentNode: null, parentElement: null, _text: '', _html: '', _qsa: {}, _attr: {},
    style: { setProperty(k, v){ this[k] = v; }, removeProperty(k){ delete this[k]; } },
    get textContent(){ return this._text + this.children.map(c => c.textContent).join(''); },
    set textContent(v){ this._text = String(v); this.children = []; },
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); this.children = []; this._text = ''; },
    get className(){ return [...cls].join(' '); },
    set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); },
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c),
      toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
    appendChild(c){ c.parentNode = c.parentElement = el; el.children.push(c); if(c.id) env.els[c.id] = c; return c; },
    insertBefore(c, ref){ c.parentNode = c.parentElement = el; const i = el.children.indexOf(ref); el.children.splice(i < 0 ? el.children.length : i, 0, c); if(c.id) env.els[c.id] = c; return c; },
    remove(){ const p = el.parentNode; if(p){ const i = p.children.indexOf(el); if(i >= 0) p.children.splice(i, 1); } el.parentNode = el.parentElement = null; el._removed = true; if(el.id && env.els[el.id] === el) delete env.els[el.id]; },
    replaceWith(n){ const p = el.parentNode; if(p){ const i = p.children.indexOf(el); p.children[i] = n; n.parentNode = n.parentElement = p; } el.parentNode = null; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); }, removeEventListener(t, fn){ L[t] = (L[t] || []).filter(f => f !== fn); }, _L: L,
    fire(t, ev){ const e = Object.assign({ preventDefault(){ e._pd = true; }, stopPropagation(){}, target: el }, ev || {}); (L[t] || []).slice().forEach(fn => fn(e)); return e; },
    click(){ env.clicks.push(el.id || el.className); el.fire('click'); if(el.onclick) return el.onclick({}); },
    focus(){ env.focused = el; }, select(){}, blur(){ el.fire('blur'); },
    contains(n){ for(let x = n; x; x = x.parentNode) if(x === el) return true; return false; },
    getBoundingClientRect: () => el._rect || { left: 100, top: 100, right: 140, bottom: 140, width: 40, height: 40 },
    querySelector(sel){ return qs[sel] || (qs[sel] = mkEl(env, 'div')); },
    querySelectorAll(sel){ return el._qsa[sel] || []; },
    closest(sel){ return el._closest ? el._closest(sel) : null; },
    getAttribute(k){ return k in el._attr ? el._attr[k] : null; }, setAttribute(k, v){ el._attr[k] = String(v); },
    getContext: () => ({ drawImage(){}, getImageData: () => ({ data: env.alpha ? [0, 0, 0, 10] : [0, 0, 0, 255] }) }),
    toDataURL: (t) => 'data:' + t + ';' + (env.bigPng && t === 'image/png' ? 'x'.repeat(200001) : 'ok'),
  };
  return el;
}

/* 👑 디자인 스튜디오 자식 창 — 따로 노는 문서 하나 */
function mkChildWin(env){
  const els = {};
  const cenv = { els, clicks: env.clicks };
  const body = mkEl(cenv, 'body');
  const tabs = ['home', 'friend', 'sched'].map(t => { const b = mkEl(cenv, 'button'); b.className = 'ds-tab'; b.dataset.dstab = t; return b; });
  const d = {
    html: '', body, defaultView: { innerWidth: 340, innerHeight: 580 },
    open(){ d.opened = true; }, write(h){ d.html += h; }, close(){ d.closedDoc = true; },
    getElementById: (id) => els[id] || (els[id] = mkEl(cenv, 'div', id)),
    createElement: (t) => mkEl(cenv, t),
    querySelectorAll: (sel) => sel === '.ds-tab' ? tabs : (sel === '.mh-color-pop' ? body.children.filter(c => c.className === 'mh-color-pop') : []),
    addEventListener(){}, removeEventListener(){},
  };
  const w = { document: d, closed: false, focused: 0, focus(){ w.focused++; }, close(){ w.closed = true; }, tabs };
  return w;
}

function mkEnv(opt){
  opt = opt || {};
  const env = {
    toasts: [], saves: [], saveRes: undefined, saveThrows: false, commitsName: [], renders: 0, origRenders: 0, page: 0, clicks: [], exec: [],
    prompts: [], promptAns: [], viewing: opt.viewing || null, loaded: opt.loaded !== false, homeUid: 'u1', uid: 'u1', setLoaded: [],
    dragDist: 0, dragSets: [], premium: !!opt.premium, admin: false, userName: '나', nameMaxReady: !opt.lateConst, sticker: { open: 0, render: 0 },
    timers: [], docL: {}, els: {}, ls: {}, comp: [], compCb: {}, rt: [], uploads: [], opened: [], themeChild: [], raf: [],
    data: Object.assign({ avatar: null, bio: '', postTitle: '', post: '', stickers: {}, bgm: null, bg: null, theme: null }, opt.data || {}),
  };
  /* 입력칸(편집 중에만 생기는 것)은 저절로 만들지 않는다 — «이미 편집 중» 판정이 그 칸이 있는지로 갈린다 */
  const DYN = new Set(['mhMyNameInput', 'mhPostTitleInput']);
  const byId = (id) => (opt.noDom ? null : (env.els[id] || (DYN.has(id) ? null : (env.els[id] = mkEl(env, 'div', id)))));
  env.$ = byId;
  /* 문서 전체에서 찾는 선택자 — 이 묶음이 쓰는 것만 */
  env.bar = mkEl(env, 'div'); env.bar.dataset.target = 'mhBioBox';
  env.bold = mkEl(env, 'button'); env.bold.dataset.cmd = 'bold';
  env.link = mkEl(env, 'button'); env.link.dataset.cmd = 'mhLink';
  env.fore = mkEl(env, 'button'); env.fore.dataset.cmd = 'foreColor';
  env.bar._qsa['button[data-cmd], select[data-cmd]'] = [env.bold, env.link, env.fore];
  env.mhTabs = ['home', 'friend', 'scheduler'].map(t => { const b = mkEl(env, 'button'); b.className = 'mh-tab'; b.dataset.tab = t; return b; });
  env.dels = [];
  env.body = mkEl(env, 'body');
  const sel = { removeAllRanges(){ env.rangeSet = 0; }, addRange(r){ env.rangeSet = r; }, rangeCount: 0, anchorNode: null, getRangeAt: () => ({ cloneRange: () => ({ saved: true }) }) };
  const comp = new Proxy({}, { get: (t, k) => {
    if(typeof k === 'symbol' || k === 'then') return undefined;
    if(opt.noCompanion) return undefined;
    if(k === 'onBgmClosed' || k === 'onBgmMode'){ return (cb) => { env.compCb[k] = cb; }; }
    if(k === 'pickImage') return async () => { env.comp.push(['pickImage']); return env.pickAns === undefined ? 'data:src' : env.pickAns; };
    return (...a) => { env.comp.push([k, ...a]); };
  } });
  const ctx = {
    Math, JSON, String, Number, Array, Object, Boolean, Set, WeakMap, Date, parseInt, Error, Promise,
    console: { warn(){}, log(){}, error(){} },
    document: {
      getElementById: byId, body: env.body, defaultView: null,
      createElement: (t) => mkEl(env, t),
      createRange: () => ({ selectNodeContents(n){ this.n = n; }, collapse(){ this.c = true; } }),
      querySelectorAll: (s) => opt.noDom ? [] : (s === '.mh-rt-toolbar' ? [env.bar] : s === '.mh-tab' ? env.mhTabs : s === '.mh-sticker-del' ? env.dels
        : s === '.mh-color-pop' ? env.body.children.filter(c => c.className === 'mh-color-pop') : []),
      querySelector: (s) => { const m = /data-tab="(\w+)"/.exec(s); return m ? env.mhTabs.find(b => b.dataset.tab === m[1]) || null : null; },
      addEventListener: (t, fn) => { (env.docL[t] = env.docL[t] || []).push(fn); },
      removeEventListener: (t, fn) => { env.docL[t] = (env.docL[t] || []).filter(f => f !== fn); },
      execCommand: (c, ui, v) => { env.exec.push([c, v]); return true; },
    },
    setTimeout: (fn, ms) => { env.timers.push({ fn, ms }); return env.timers.length; },
    clearTimeout: (id) => { if(env.timers[id - 1]) env.timers[id - 1].fn = () => {}; },
    requestAnimationFrame: (fn) => { env.raf.push(fn); },
    getComputedStyle: () => ({ fontSize: '15px', fontWeight: '700' }),
    getSelection: () => sel,
    localStorage: { getItem: (k) => (k in env.ls ? env.ls[k] : null), setItem: (k, v) => { env.ls[k] = String(v); } },
    Image: function(){ const self = this; let s = ''; this.width = 800; this.height = 400;
      Object.defineProperty(this, 'src', { get: () => s, set: (v) => { s = v; if(self.onload) self.onload(); } }); },
    FileReader: function(){ this.readAsDataURL = (f) => { this.onload({ target: { result: 'data:file;' + f.name } }); }; },
    firebaseAPI: {
      saveMyHome: async (uid, d) => { if(env.saveThrows) throw new Error('망'); env.saves.push([uid, JSON.parse(JSON.stringify(d))]); return env.saveRes; },
      uploadUserImage: async (uid, slot, url) => { env.uploads.push([uid, slot]); return { ok: true, url: 'https://st/' + slot }; },
    },
    open: (u, name, feat) => { env.opened.push([name, feat]); if(opt.noWin) return null; env.child = mkChildWin(env); return env.child; },
    _mhPreviewMode: false,
  };
  ctx.companion = comp;
  ctx.window = ctx;
  ctx.document.defaultView = { innerWidth: 1600, innerHeight: 900 };
  ctx.innerWidth = 1600; ctx.innerHeight = 900;
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx, { filename: 'myhome-edit.js' });
  env.ctx = ctx;
  env.origRender = () => { env.origRenders++; };
  env.curRender = env.origRender;
  env.mk = () => ctx.TwMyHomeEdit.createMyHomeEdit({
    toast: (m) => env.toasts.push(m),
    asyncPrompt: async (o) => { env.prompts.push(o); return env.promptAns.length ? env.promptAns.shift() : null; },
    renderMyHomePage: () => { env.page++; },
    renderMyHomeStickers: (...a) => env.curRender(...a),
    getRenderMyHomeStickers: () => env.curRender,
    setRenderMyHomeStickers: (f) => { env.curRender = f; env.wrapped = (env.wrapped || 0) + 1; },
    mhSaveRT: (el, max) => 'RT:' + el.id + ':' + max,
    mhUpdateRTCount: (id) => env.rt.push(id),
    mhClampStickerPos: (s) => { s.x = Math.max(0, Math.min(500, s.x || 0)); s.y = Math.max(0, Math.min(300, s.y || 0)); env.clamped = (env.clamped || 0) + 1; },
    mhViewingDisplayName: () => '친구이름',
    mhApplyVisitUI: () => { env.visitUI = (env.visitUI || 0) + 1; },
    ytVideoId: (u) => { const m = /youtu\.?be[^/]*\/(?:watch\?v=)?([\w-]+)/.exec(u || ''); return m ? m[1] : null; },
    applyThemeToChildDoc: (d) => env.themeChild.push(d),
    commitUserName: (v) => env.commitsName.push(v),
    getDisplayName: () => env.userName === '나' ? '(이름 없음)' : env.userName,
    getUserName: () => env.userName,
    getMyUserId: () => env.uid,
    myHomeData: () => env.data,
    mhViewingUserId: () => env.viewing,
    myHomeLoaded: () => env.loaded,
    setMyHomeLoaded: (v) => { env.loaded = v; env.setLoaded.push(v); },
    myHomeUid: () => env.homeUid,
    mhStickerDragDist: () => env.dragDist,
    setMhStickerDragDist: (v) => { env.dragDist = v; env.dragSets.push(v); },
    isPremium: () => env.premium,
    isAdmin: () => env.admin,
    userNameMax: () => { if(!env.nameMaxReady) throw new ReferenceError("Cannot access 'USER_NAME_MAX' before initialization"); return 20; },
    myHomeSticker: { open: () => env.sticker.open++, render: () => env.sticker.render++ },
    stickerMax: 3, stickerImgMaxW: 400,
    dsImgMaxBgW: 1920, dsImgMaxBgH: 1080, dsImgMaxPanel: 800, dsImgQuality: 0.85,
  });
  env.runTimers = () => { const t = env.timers.splice(0); t.forEach(x => x.fn()); };
  env.saveCount = () => env.saves.length;
  return env;
}
const flush = () => new Promise(r => setImmediate(r));

(async () => {
const sec = async (t, fn) => { say(t); try{ await fn(); }catch(e){ chk(false, '예외 — ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' / ')); } };

const HOOKS = ['commitMyHomePage', '_mhOpenColorPopup', '_mhBeginNameEdit', '_mhBgmRefresh', '_mhBgmPlaying', '_mhBgmSetPlaying', '_bgmDestroy', '_mhApplyBg', '_mhApplyTheme', '_mhDsClose'];
const RET = ['commit', 'openColorPopup', 'beginNameEdit', 'beginPostTitleEdit', 'bgmRefresh', 'bgmDestroy', 'applyBg', 'applyTheme', 'openDesignStudio', 'presets', 'presetSave', 'presetApply', 'presetRename'];

await sec('── 1. 만들 때', () => {
  const e = mkEnv({ lateConst: true });
  chk(typeof e.ctx.TwMyHomeEdit.createMyHomeEdit === 'function' && Object.keys(e.ctx.TwMyHomeEdit).join() === 'createMyHomeEdit', '싣기만 하면 window.TwMyHomeEdit(createMyHomeEdit) 하나뿐');
  chk(HOOKS.every(n => e.ctx[n] === undefined) && !Object.keys(e.els).length, '  싣기만 해서는 window 고리도 DOM 도 건드리지 않는다');
  let M = null, err = null; try{ M = e.mk(); }catch(x){ err = x; }
  chk(!!M && !err, '★ 만들 때 USER_NAME_MAX(app.js 에서 한참 뒤 const)를 읽지 않는다 — 값으로 받으면 TDZ 로 앱이 선다' + (err ? ' — ' + err.message : ''));
  chk(RET.every(n => typeof M[n] === 'function') && Object.keys(M).length === RET.length, '반환값 ' + RET.length + '개 — ' + RET.join(' · '));
  chk(HOOKS.every(n => typeof e.ctx[n] === 'function'), 'window 고리 ' + HOOKS.length + '개를 예전 이름 그대로 건다');
  chk(e.ctx.commitMyHomePage === M.commit && e.ctx._mhApplyTheme === M.applyTheme && e.ctx._bgmDestroy === M.bgmDestroy && e.ctx._mhOpenColorPopup === M.openColorPopup, '  고리와 반환값은 같은 함수');
  chk(typeof e.compCb.onBgmClosed === 'function' && typeof e.compCb.onBgmMode === 'function', 'BGM 창 닫힘 · 주인 바뀜을 구독한다');
  chk(e.wrapped === 1 && e.curRender !== e.origRender, 'renderMyHomeStickers 를 감싸 다시 대입한다(한 번)');
  chk(typeof e.els.mhAvatarBig._L.click[0] === 'function' && e.els.mhBioBox._L.blur.length === 1 && e.els.mhPostBox._L.input.length === 1, '  사진 · 글 두 칸 · 툴바를 잇는다');
  const n = mkEnv({ noDom: true, noCompanion: true }); let ok = true; try{ n.mk(); }catch(x){ ok = x.message; }
  chk(ok === true, 'DOM · companion 이 없어도 만들 때 서지 않는다' + (ok === true ? '' : ' — ' + ok));
});

await sec('── 2. 자동저장', async () => {
  let e = mkEnv({ viewing: 'f1' }); let M = e.mk();
  await M.commit(false);
  chk(e.saveCount() === 0 && !e.toasts.length, '관람 중이면 조용히 안 쓴다(남의 홈이 내 홈을 덮지 않게)');
  e = mkEnv({ loaded: false }); M = e.mk();
  await M.commit(false); await M.commit(true);
  chk(e.saveCount() === 0 && e.toasts.join() === '마이홈 정보를 아직 불러오지 못했어요 — 창을 닫았다 다시 열어주세요', '불러오기 전이면 안 쓴다 · silent 면 안내도 없음');
  e = mkEnv(); M = e.mk(); e.uid = 'u2';
  await M.commit(false);
  chk(e.saveCount() === 0 && e.setLoaded.join() === 'false' && e.loaded === false && /계정이 바뀌어서 저장하지 않았어요/.test(e.toasts[0]), '★ 불러온 계정 ≠ 지금 계정 — 안 쓰고 불러온 상태도 무효(쓰는 함수로)');
  e = mkEnv(); M = e.mk();
  await M.commit(false);
  chk(e.saveCount() === 1 && e.saves[0][0] === 'u1' && e.saves[0][1].bio === 'RT:mhBioBox:120' && e.saves[0][1].post === 'RT:mhPostBox:1000', '쓰면 소개글 120 · 게시글 1000 을 담아 saveMyHome(내 uid)');
  chk(e.toasts.join() === '마이홈을 저장했어요', '  silent 아니면 «저장했어요»');
  e.toasts.length = 0; e.saveRes = { ok: false, reason: '소개글이 너무 길어요' }; await M.commit(true);
  e.saveRes = { warn: '사진은 빠졌어요' }; await M.commit(true);
  e.saveThrows = true; await M.commit(true);
  chk(e.toasts.join('|') === '소개글이 너무 길어요|사진은 빠졌어요|저장에 실패했어요 — 잠시 뒤 다시 시도해 주세요', '거부 이유 · 경고 · 실패는 silent 여도 알린다');
  const f = mkEnv(); const F = f.mk(); delete f.ctx.firebaseAPI;
  await F.commit(false);
  chk(f.toasts.join() === '아직 준비 중이에요', 'firebaseAPI 가 없으면 «준비 중»');
  f.els.mhBioBox.fire('blur'); await flush();
  chk(f.saves.length === 0, '  (그때도 서지 않는다)');
  const g = mkEnv(); g.mk(); g.els.mhPostBox.fire('blur'); g.els.mhBioBox.fire('input'); await flush();
  chk(g.saveCount() === 1 && g.rt.join() === 'mhBioBox', '글 칸에서 벗어나면 조용히 저장 · 입력하면 글자 수');
});

await sec('── 3. 프로필 사진 · 글 서식 · 색 팝업', async () => {
  let e = mkEnv(); let M = e.mk();
  e.els.mhAvatarBig.fire('click');
  chk(e.clicks.includes('mhAvatarInput'), '사진 칸을 누르면 파일 고르기');
  e.els.mhAvatarInput.files = [{ name: 'a.png' }]; e.els.mhAvatarInput.fire('change'); await flush();
  chk(e.data.avatar === 'data:image/jpeg;ok' && e.page === 1 && e.saveCount() === 1, '알파 없는 사진은 JPEG · 다시 그림 · 저장');
  e.alpha = true; e.els.mhAvatarInput.fire('change'); await flush();
  chk(e.data.avatar === 'data:image/png;ok', '  투명이 있으면 PNG');
  e.bigPng = true; e.els.mhAvatarInput.fire('change'); await flush();
  chk(e.data.avatar === 'data:image/jpeg;ok' && e.toasts.includes('사진이 너무 커서 투명 배경은 유지하지 못했어요'), '  PNG 가 200,000자를 넘으면 JPEG 로 · 안내');
  /* 툴바 */
  e.bold.fire('click'); await flush();
  chk(JSON.stringify(e.exec) === '[["bold",null]]' && e.focused === e.els.mhBioBox && e.rt.includes('mhBioBox'), '굵게 — 그 편집기에 명령 · 글자 수');
  const md = e.bold.fire('mousedown');
  chk(md._pd === true, '  버튼을 눌러도 편집기 포커스를 안 뺏는다');
  e.exec.length = 0; e.promptAns = ['javascript:alert(1)']; e.link.fire('click'); await flush(); await flush();
  e.promptAns = ['  https://a.b/x']; e.link.fire('click'); await flush(); await flush();
  e.promptAns = ['https://a.b/c  ']; e.link.fire('click'); await flush(); await flush();
  chk(JSON.stringify(e.exec) === '[["createLink","https://a.b/c"]]', '링크 — http(s) 로 시작할 때만(앞 공백도 거른다 — 옮기기 전 그대로) · 뒤 공백 걷음');
  /* 색 팝업 — 툴바 글자색 */
  e.exec.length = 0; e.fore.fire('click'); await flush();
  const pop = e.body.children.find(c => c.className === 'mh-color-pop');
  chk(!!pop && /data-c="#c0392b"/.test(pop.innerHTML) && /class="hex"/.test(pop.innerHTML), '글자색 — 팝업(팔레트 · HEX 칸)이 뜬다');
  const hex = pop.querySelector('.hex');
  hex.value = 'zz'; hex.fire('keydown', { key: 'Enter' });
  chk(hex.style.borderColor === '#c0392b' && !pop._removed, '  HEX 형식이 틀리면 테두리로 알리고 그대로');
  hex.value = '#AABBCC'; hex.fire('keydown', { key: 'Enter' });
  chk(JSON.stringify(e.exec.slice(-1)) === '[["foreColor","#aabbcc"]]' && pop._removed && e.ls['tw.mhRecentColors.foreColor'] === '["#aabbcc"]', '  HEX → 칠하고 최근 색에 넣고 닫힌다');
  e.fore.fire('click'); await flush();
  const pop2 = e.body.children.find(c => c.className === 'mh-color-pop');
  chk(/data-c="#aabbcc"/.test(pop2.innerHTML.split('팔레트')[0]), '  다음에 열면 최근 색 칸에 보인다');
  pop2.querySelector('.reset').fire('click');
  chk(JSON.stringify(e.exec.slice(-1)) === '[["foreColor","#444444"]]' && pop2._removed, '  초기화 — 소개글은 #444444 로');
  const pop3 = M.openColorPopup(e.fore, 'theme', () => {}, () => {}) || e.body.children.find(c => c.className === 'mh-color-pop');
  pop3.querySelector('.custom').fire('click');
  chk(e.comp.some(c => c[0] === 'colorDialog' && c[1] === true), '  직접 선택 — OS 색 창 앞에 «항상 위» 를 비켜 달라고 알린다');
  e.runTimers();
  chk((e.docL.mousedown || []).length >= 1, '  바깥을 누르면 닫히게 문서에 건다(한 박자 뒤)');
});

await sec('── 4. 새 스티커 · 스티커 끌기 · 삭제 저장', async () => {
  let e = mkEnv(); let M = e.mk();
  e.els.mhStickerAddBtn.fire('click');
  chk(e.sticker.open === 1, '[+ 스티커] — 관리 창(myhome-sticker.js)을 연다');
  e.els.stMgrAdd.onclick();
  chk(e.clicks.includes('mhStickerFileInput'), '관리 창 [＋ 새 스티커] — 파일 고르기');
  e.promptAns = ['  https://link.example  '];
  e.els.mhStickerFileInput.files = [{ name: 's.png' }]; e.els.mhStickerFileInput.fire('change'); await flush(); await flush();
  const ids = Object.keys(e.data.stickers);
  const s = e.data.stickers[ids[0]];
  chk(ids.length === 1 && /^s/.test(ids[0]) && s.img === 'data:image/png;ok' && s.link === 'https://link.example' && s.size === 1 && s.w === 400 && s.h === 200, '붙이기 — PNG · 링크 · 가로 400 으로 줄인 원본 비율');
  chk(e.clamped === 1 && e.origRenders === 1 && e.saveCount() === 1 && e.sticker.render === 1, '  창 안으로 · 다시 그림(감싼 함수) · 저장 · 관리 창 목록');
  e.data.stickers = { a: {}, b: {}, c: {} }; e.clicks.length = 0; e.els.stMgrAdd.onclick();
  chk(e.toasts.includes('스티커는 최대 3개까지만 붙일 수 있어요') && !e.clicks.includes('mhStickerFileInput'), '  상한이면 안내만');
  /* 끌기 */
  e = mkEnv({ data: { stickers: { a: { x: 10, y: 10 } } } }); M = e.mk();
  const st = mkEl(e, 'div'); st.dataset.sid = 'a'; st._rect = { left: 110, top: 110 };
  const zone = e.els.mhStickerZone; zone._rect = { left: 100, top: 100, width: 600, height: 400 };
  const tgt = { closest: (q) => q === '.mh-sticker' ? st : null };
  zone.fire('mousedown', { target: tgt, clientX: 120, clientY: 120 });
  chk(e.dragSets.join() === '0', '누르면 이동거리 0 부터(쓰는 함수)');
  (e.docL.mousemove || []).forEach(f => f({ clientX: 150, clientY: 130 }));
  (e.docL.mousemove || []).forEach(f => f({ clientX: 125, clientY: 121 }));
  chk(e.dragDist === 40 && e.dragSets.join() === '0,40,40', '  이동거리는 가장 멀리 간 값(읽는 함수 + 쓰는 함수)');
  chk(e.data.stickers.a.x === 15 && e.data.stickers.a.y === 11 && st.style.left === '15px' && st.style.top === '11px', '  스티커 자리 · 화면 위치가 따라간다');
  (e.docL.mouseup || []).forEach(f => f({})); await flush();
  (e.docL.mouseup || []).forEach(f => f({})); await flush();
  chk(e.saveCount() === 1, '  놓으면 한 번 저장(끄는 중이 아니면 안 쓴다)');
  e.viewing = 'f1'; e.dragSets.length = 0;
  zone.fire('mousedown', { target: tgt, clientX: 120, clientY: 120 });
  e.ctx._mhPreviewMode = true; e.viewing = null; zone.fire('mousedown', { target: tgt, clientX: 120, clientY: 120 }); e.ctx._mhPreviewMode = false;
  chk(!e.dragSets.length, '관람 · 미리보기 중에는 못 끈다');
  /* 감싼 renderMyHomeStickers — 삭제 버튼에 저장 한 번 더 */
  const del = mkEl(e, 'button'); let orig = 0; del.onclick = () => { orig++; }; e.dels = [del];
  e.curRender();
  del.onclick({}); await flush();
  chk(e.origRenders === 1 && orig === 1 && e.saveCount() === 2, '감싼 함수 — 옛 함수를 부르고, 삭제 버튼은 옛 처리 뒤 저장 한 번 더');
});

await sec('── 5. 닉네임 · 게시글 제목', async () => {
  let e = mkEnv({ lateConst: true }); let M = e.mk(); e.nameMaxReady = true;
  const nameEl = e.els.mhMyName; const row = mkEl(e, 'div'); row.appendChild(nameEl);
  chk(nameEl.title === '더블클릭해서 닉네임 수정' && nameEl.style.cursor === 'pointer', '닉네임 — 더블클릭 안내');
  nameEl.fire('dblclick');
  let inp = e.els.mhMyNameInput;
  chk(!!inp && inp.value === '' && inp.maxLength === 20 && inp.placeholder === '닉네임' && nameEl.style.display === 'none' && e.focused === inp, '★ 편집 — 기본값 «나» 는 빈칸 · 길이 상한은 열 때 읽는다(USER_NAME_MAX) · 이름표 숨김');
  chk(/font-size:15px;font-weight:700;/.test(inp.style.cssText), '  글씨 크기 · 굵기는 이름표를 실측해 따른다');
  chk(typeof e.ctx._mhCancelNameEdit === 'function', '  밖에서 접는 길(_mhCancelNameEdit)을 건다');
  M.beginNameEdit();
  chk(row.children.filter(c => c.id === 'mhMyNameInput').length === 1, '  이미 편집 중이면 또 안 연다');
  inp.value = '새이름'; inp.fire('keydown', { key: 'Enter' });
  chk(e.commitsName.join() === '새이름' && !e.els.mhMyNameInput && nameEl.style.display === '' && e.ctx._mhCancelNameEdit === null && e.visitUI === 1, 'Enter — 저장 · 입력칸 걷고 · 관람 화면 판정에 다시 묻는다');
  e.userName = '민지'; e.els.mhNameEditLink.fire('click', {});
  inp = e.els.mhMyNameInput;
  chk(inp && inp.value === '민지', '「수정」 링크도 같은 편집(정한 이름은 그대로 채움)');
  inp.fire('keydown', { key: 'Escape' });
  chk(e.commitsName.length === 1 && nameEl.textContent === '민지', '  Esc — 저장 안 함');
  M.beginNameEdit(); e.ctx._mhCancelNameEdit();
  chk(e.commitsName.length === 1 && !e.els.mhMyNameInput, '  _mhCancelNameEdit — 저장 없이 접힌다');
  e.viewing = 'f1'; M.beginNameEdit();
  chk(!e.els.mhMyNameInput, '관람 중이면 안 열린다');
  e.viewing = null; e.ctx._mhPreviewMode = true; M.beginNameEdit(); e.ctx._mhPreviewMode = false;
  chk(!e.els.mhMyNameInput, '  미리보기 중에도');
  /* 게시글 제목 */
  const title = e.els.mhPostTitle; const trow = mkEl(e, 'div'); trow.appendChild(title);
  title.fire('dblclick');
  let ti = e.els.mhPostTitleInput;
  chk(!!ti && ti.maxLength === 30 && e.els.mhPostTitleEditBtn.style.display === 'none', '게시글 제목 — 더블클릭 편집 · 30자');
  ti.value = '  ' + '가'.repeat(40); ti.fire('keydown', { key: 'Enter' }); await flush();
  chk(e.data.postTitle === '가'.repeat(30) && title.textContent === e.data.postTitle && e.saveCount() === 1, '  Enter — 30자로 잘라 저장');
  e.els.mhPostTitleEditBtn.fire('click', {});
  ti = e.els.mhPostTitleInput; ti.value = '버림'; ti.fire('keydown', { key: 'Escape' }); await flush();
  chk(e.data.postTitle === '가'.repeat(30) && e.saveCount() === 1, '  ✏️ 버튼도 같은 편집 · Esc 취소');
  e.data.postTitle = ''; M.beginPostTitleEdit(); e.els.mhPostTitleInput.value = ''; e.els.mhPostTitleInput.blur(); await flush();
  chk(title.textContent === '게시글 제목', '  비우면 «게시글 제목»');
});

await sec('── 6. 🎵 BGM', async () => {
  const e = mkEnv(); const M = e.mk();
  const lab = e.$('mhBgmLabel'), play = e.$('mhBgmPlay');
  e.els.mhBgmPlay.fire('click');
  chk(e.toasts.join() === '오른쪽 ((o 를 눌러 유튜브 링크를 먼저 등록해주세요' && !e.comp.length, '등록 전 ▶ — 안내만');
  e.promptAns = ['https://example.com/x']; e.els.mhBgmSet.fire('click'); await flush(); await flush();
  chk(e.toasts.includes('유튜브 링크를 인식하지 못했어요') && !e.data.bgm, '유튜브가 아니면 안내');
  e.promptAns = ['https://youtu.be/abc ', '  봄노래 ']; e.els.mhBgmSet.fire('click'); await flush(); await flush(); await flush();
  chk(JSON.stringify(e.data.bgm) === '{"url":"https://youtu.be/abc","title":"봄노래"}' && e.saveCount() === 1, '등록 — 주소 · 제목 저장');
  chk(JSON.stringify(e.comp.filter(c => c[0] === 'openBgm')) === '[["openBgm","https://www.youtube.com/watch?v=abc","봄노래"]]', '  새 곡은 바로 연다(watch 주소)');
  chk(lab.textContent === '봄노래' && play.textContent === '▐▐' && e.ctx._mhBgmPlaying() === true, '  위젯 — 제목 · ▐▐');
  play.fire('click');
  chk(e.comp.slice(-1)[0][0] === 'pauseBgm' && play.textContent === '▶', '▐▐ — 창은 두고 일시정지');
  play.fire('click');
  chk(e.comp.slice(-1)[0][0] === 'resumeBgm', '  ▶ — 같은 곡이면 재개');
  M.bgmDestroy(); M.bgmDestroy();
  chk(e.comp.filter(c => c[0] === 'closeBgm').length === 1 && play.textContent === '▶', '_bgmDestroy — 창 주인일 때만 닫는다(두 번째는 안 닫음)');
  play.fire('click');
  chk(e.comp.slice(-1)[0][0] === 'openBgm', '  닫힌 뒤 ▶ — 새로 연다');
  e.compCb.onBgmMode('playlist');
  chk(e.ctx._mhBgmPlaying() === false, '🎵 플레이리스트가 창을 가져가면 재생 표시를 내린다');
  M.bgmDestroy();
  chk(e.comp.filter(c => c[0] === 'closeBgm').length === 1, '  그 뒤 마이홈을 닫아도 플레이리스트 창은 안 닫는다');
  e.ctx._mhBgmSetPlaying(true);
  chk(play.textContent === '▐▐', '📷 스티커사진이 표시만 맞춘다(_mhBgmSetPlaying)');
  e.compCb.onBgmClosed();
  chk(play.textContent === '▶', '× 로 창이 닫히면 표시도');
  e.promptAns = ['   ']; e.els.mhBgmSet.fire('click'); await flush(); await flush();
  chk(e.data.bgm === null && lab.textContent === '배경음악 없음', '비우고 확인 — 지운다');
  e.promptAns = [null]; const n = e.saveCount(); e.els.mhBgmSet.fire('click'); await flush();
  chk(e.saveCount() === n, '  취소 — 아무 일 없음');
  /* 긴 제목 — 흐르는 글씨 */
  e.data.bgm = { url: 'https://youtu.be/q', title: '긴 제목' }; lab.scrollWidth = 300; e.$('mhBgmLabelVp').clientWidth = 100;
  M.bgmRefresh(); e.raf.splice(0).forEach(f => f());
  chk(lab.classList.contains('mh-bgm-marquee') && lab.style['--mhBgmW'] === '332px' && lab.children.length === 2, '  넘치면 복제본을 붙여 흐른다(한 벌 폭 + 32)');
});

await sec('── 7. 바깥 배경 · 테마 · [✎ 마이홈 수정]', async () => {
  let e = mkEnv(); let M = e.mk(); const win = e.$('myHomeWin');
  e.data.bg = { color: '#123456' }; M.applyBg();
  chk(win.style.background === '#123456', '바깥 배경 — 색');
  e.data.bg = { img: 'https://i/b.jpg' }; M.applyBg();
  chk(win.style.background === 'url(https://i/b.jpg) center/cover no-repeat, var(--win-face)', '  그림');
  e.data.bg = null; M.applyBg();
  chk(win.style.background === 'var(--win-face)', '  없으면 창 기본색');
  e.data.theme = { tab: '#a1', tabText: '#a2', left: '#a3', leftImg: 'https://i/l', name: '#a4', fHead: '#a5', fHeadText: '#a6', fTabsBg: '#a7', fChat: '#a8', fChatImg: 'https://i/c', fChatText: '#a9', roomBg: '#b1', bioBg: '#b2' };
  M.applyTheme();
  chk(e.mhTabs.every(t => t.style.background === '#a1' && t.style.color === '#a2'), '테마 — 탭 배경 · 글씨');
  chk(e.$('mhHomeLeft').style.background === 'url(https://i/l) center/cover no-repeat' && e.$('mhMyName').style.color === '#a4' && e.$('mhRoomPreview').style.background === '#b1' && e.$('mhBioBox').style.background === '#b2', '  그림이 색보다 먼저 · 이름 · 방 미리보기 · 소개글 칸');
  chk(['mhFriendHead', 'mhInboxTop', 'mhFmTop'].every(id => e.$(id).style.background === '#a5' && e.$(id).style.color === '#a6') && ['mhInboxTabs', 'mhFmTabs'].every(id => e.$(id).style.background === '#a7'), '  ★ 친구 · 친구 관리 · 우편함 헤더와 카테고리 줄은 한 토큰(짝을 빠뜨리지 않는다)');
  chk(['mhInboxList', 'mhFmList'].every(id => e.$(id).style.background === 'url(https://i/c) center/cover no-repeat' && e.$(id).style.color === '#a9'), '  목록 칸 — 친구 관리 · 우편함이 한 토큰');
  e.data.theme = null; M.applyTheme();
  chk(e.mhTabs[0].style.background === '' && e.$('mhRoomPreview').style.background === '', '  비우면 CSS 기본으로');
  /* [✎ 마이홈 수정] */
  const btn = e.els.mhEditHomeBtn, menu = e.els.mhBgMenu;
  btn.fire('click', {});
  chk(menu.classList.contains('on') && !e.opened.length, '라이선스 없으면 — 바깥 배경 메뉴');
  (e.docL.click || []).forEach(f => f({ target: { closest: () => null } }));
  chk(!menu.classList.contains('on'), '  바깥을 누르면 닫힘');
  e.premium = true; btn.fire('click', {});
  chk(!menu.classList.contains('on') && e.opened.length === 1, '★ 라이선스(읽는 함수 — 로그인 뒤 바뀐 값) — 👑 디자인 스튜디오');
  e.premium = false; e.admin = true; e.child.closed = true; btn.fire('click', {});
  chk(e.opened.length === 2, '  관리자도');
  e.els.mhBgColorInput.value = '#00ff00'; e.els.mhBgColorInput.fire('input');
  chk(JSON.stringify(e.data.bg) === '{"color":"#00ff00"}' && win.style.background === '#00ff00' && e.saveCount() === 0, '색 고르는 중 — 미리보기만');
  e.els.mhBgColorInput.fire('change'); await flush();
  chk(e.saveCount() === 1, '  고르면 저장');
  e.els.mhBgImgInput.files = [{ name: 'b.jpg' }]; e.els.mhBgImgInput.fire('change'); await flush();
  chk(JSON.stringify(e.data.bg) === '{"img":"data:image/jpeg;ok"}' && e.saveCount() === 2, '바깥 그림 — 줄여서 저장');
  e.data.theme = { tab: '#1' }; e.els.mhBgResetBtn.fire('click'); await flush();
  chk(e.data.bg === null && e.data.theme === null && e.saveCount() === 3, '초기화 — 배경 · 테마 둘 다');
});

await sec('── 8. 👑 디자인 스튜디오 · 프리셋', async () => {
  let e = mkEnv({ data: { theme: { tab: '#111111', tabImg: 'https://i/t', left: '#222222' }, bg: { color: '#333333' } } }); let M = e.mk();
  M.openDesignStudio();
  const W = e.child, d = W.document;
  chk(!!W && /<div id="dsPresets"><\/div>/.test(d.html) && /👑/.test(d.html) && d.closedDoc, '창 — DS_HTML 을 써 넣는다');
  chk(e.themeChild.length === 1 && e.themeChild[0] === d, '  쓰자마자 테마 토큰을 넣는다(applyThemeToChildDoc)');
  const body = d.getElementById('dsBody');
  chk(body.children.length === 17 && body.children[0].className === 'ds-group' && body.children[1].className === 'ds-row' && /바깥 배경/.test(body.children[1].innerHTML), '마이홈 탭 — 그룹 넷 · 항목 열셋(17줄)');
  chk(/background:#333333;/.test(body.children[1].innerHTML) && /data-act="img"/.test(body.children[1].innerHTML), '  바깥 배경 칸 — 지금 색 · IMG 버튼');
  const line = d.getElementById('dsPresets');
  chk(line.children.length === 4 && line.children[3].className === 'ps-save' && line.children[0].className === 'ps-tab cur', '프리셋 줄 — 칸 셋 + [저장] · 1번이 고른 칸');
  /* 저장 — 색만 */
  line.children[3].fire('click'); await flush();
  const p0 = e.data.themePresets[0];
  chk(JSON.stringify(p0) === '{"name":"","theme":{"tab":"#111111","left":"#222222"},"bg":{"color":"#333333"}}' && e.data.themePresetCur === 0 && e.saveCount() === 1, '★ 저장 — 색만 담는다(그림 키 tabImg 는 안 담김)');
  chk(e.toasts.slice(-1)[0] === '👑 1 에 저장했어요', '  안내');
  line.children[3].fire('click'); await flush();
  chk(e.saveCount() === 1 && line.children[3].textContent === '한 번 더', '  찬 칸에 다시 저장 — 한 번 더 눌러야');
  line.children[3].fire('click'); await flush();
  chk(e.saveCount() === 2, '  두 번 누르면 덮어쓴다');
  /* 빈 칸 고르기 → 저장 */
  line.children[1].fire('click'); await flush();
  chk(e.data.themePresetCur === 1 && line.children[1].className === 'ps-tab cur' && /2번 칸을 골랐어요/.test(e.toasts.slice(-1)[0]), '빈 칸 — 고르기만(확인 없음)');
  e.data.theme = { tab: '#999999', tabImg: 'https://i/t2' }; e.data.bg = { img: 'https://i/bg' };
  line.children[3].fire('click'); await flush();
  chk(JSON.stringify(e.data.themePresets[1]) === '{"name":"","theme":{"tab":"#999999"},"bg":null}', '  빈 칸 [저장] — 바로 담김 · 그림 배경은 안 담김');
  /* 불러오기 — 두 번 · 그림은 그대로 */
  line.children[0].fire('click');
  chk(line.children[0].classList.contains('armed') && line.children[0].textContent === '한 번 더' && e.data.theme.tab === '#999999', '다른 칸 — 한 번은 «한 번 더» 만');
  line.children[0].fire('click'); await flush();
  chk(JSON.stringify(e.data.theme) === '{"tabImg":"https://i/t2","tab":"#111111","left":"#222222"}' && e.data.bg.img === 'https://i/bg' && e.data.themePresetCur === 0, '★ 두 번 — 색은 통째로 갈리고 그림(tabImg · 바깥 그림)은 그대로');
  chk(/1 로 바꿨어요/.test(e.toasts.slice(-1)[0]) && body.children.length === 17, '  안내 · 항목 다시 그림');
  e.timers.forEach(t => { if(t.ms === 3000) t.fn(); });
  /* 이름 */
  chk(M.presetRename(0, '  봄봄봄봄봄봄봄봄봄봄  ') === true && e.data.themePresets[0].name === '봄봄봄봄봄봄봄봄' && M.presetRename(0, '봄봄봄봄봄봄봄봄') === false, '이름 — 8자 · 같으면 안 씀');
  line.children[0].fire('click');
  const ed = line.children[0];
  chk(ed.className === 'ps-edin' && ed.value === '봄봄봄봄봄봄봄봄', '  고른 칸을 누르면 입력칸');
  ed.value = '여름'; ed.fire('keydown', { key: 'Enter' });
  chk(e.data.themePresets[0].name === '여름' && line.children[0].querySelector('.ps-nm').textContent === '여름', '  Enter — 저장 · 다시 그림');
  /* 저장본이 RTDB 에서 객체로 돌아와도 */
  e.data.themePresets = { 2: { name: '겨울', theme: { tab: '#fff' } } };
  chk(JSON.stringify(M.presets().map(p => p && p.name)) === '[null,null,"겨울"]', '빈 자리 있는 저장본(객체)도 세 칸으로');
  chk(M.presetApply(0) === false, '  빈 칸 불러오기는 아무 일 없음');
  /* 항목 색 · 초기화 */
  const row = body.children[3];   // 탭 배경
  row.querySelector('.ds-sw').fire('click');
  const pop = d.body.children.find(c => c.className === 'mh-color-pop');
  chk(!!pop && e.comp.some(c => c[0] === 'dsHold'), '색 칸 — 팝업은 스튜디오 문서 안에 · 창 닫힘 유예');
  pop.querySelector('.hex').value = '0a0b0c'; pop.querySelector('.hex').fire('change'); await flush();
  chk(e.data.theme.tab === '#0a0b0c' && e.ls['tw.mhRecentColors.theme'] === '["#0a0b0c"]', '  고른 색이 테마에 · 최근 색은 theme 칸');
  body.children[3].querySelector('[data-act="reset"]').fire('click'); await flush();
  chk(!('tab' in e.data.theme) && !('tabImg' in e.data.theme), '  ↺ — 그 항목 색 · 그림 지움');
  /* 그림 올리기 */
  const n = e.uploads.length;
  body.children[3].querySelector('[data-act="img"]').fire('click'); await flush(); await flush(); await flush();
  chk(e.uploads.length === n + 1 && e.uploads[n][1] === 'tabImg' && e.data.theme.tabImg === 'https://st/tabImg', 'IMG — 고른 그림을 줄여 올리고 주소를 테마에');
  /* 탭 · 전체 초기화 · 다시 열기 · 닫기 */
  W.tabs[1].fire('click');
  chk(body.children.length === 10 && e.clicks.includes('mh-tab'), '친구 탭 — 항목 바뀜(10줄) · 마이홈 탭도 친구로');
  const all = d.getElementById('dsResetAll');
  all.onclick();
  chk(all.textContent === '⚠ 한 번 더 누르면 전체 초기화' && e.data.theme !== null, '전체 초기화 — 한 번은 경고만');
  all.onclick(); await flush();
  chk(e.data.theme === null && e.data.bg === null && e.data.themePresets && e.data.themePresets[2].name === '겨울', '  두 번 — 디자인만 지우고 프리셋은 남긴다');
  M.openDesignStudio();
  chk(e.opened.length === 1 && W.focused === 1, '열려 있으면 새로 안 열고 앞으로');
  d.getElementById('dsDone').onclick(); await flush();
  chk(W.closed === true, '[완료] — 저장하고 닫음');
  M.openDesignStudio(); e.ctx._mhDsClose();
  chk(e.opened.length === 2 && e.child.closed === true, '_mhDsClose — 마이홈을 닫을 때 같이 닫힌다');
  const f = mkEnv({ noWin: true }); f.mk().openDesignStudio();
  chk(f.toasts.join() === '디자인 창을 열 수 없어요', '창을 못 열면 안내');
});

await sec('── 9. app.js 배선', () => {
  const code = strip(APP);
  const defs = /function (commitMyHomePage|_mhOpenColorPopup|_mhBeginNameEdit|_mhBeginPostTitleEdit|_bgmLabelRefresh|_bgmDestroy|_bgmStart|applyMyHomeBg|applyMyHomeTheme|_mhPresets|_mhPresetSave|_mhPresetApply|_mhDsRender|_mhOpenDesignStudio)\(|\bconst (DS_HTML|_MH_DS_ROWS|_MH_PALETTE|MH_PRESET_MAX)\b/;
  chk(!defs.test(code) && defs.test(MOD), '편집 묶음 · 디자인 스튜디오 정의는 모듈에만');
  chk(!/bindMyHomePage\s*\(/.test(code) && !/renderMyHomeStickers = function/.test(code), '  app.js 에 옛 묶음(bindMyHomePage)이 없다');
  chk(/window\.TwMyHomeEdit = api/.test(MOD) && (code.match(/TwMyHomeEdit\.createMyHomeEdit\(/g) || []).length === 1, '모듈은 window.TwMyHomeEdit · 만드는 곳은 한 곳');
  const iMk = APP.indexOf('TwMyHomeEdit.createMyHomeEdit('), iLinks = APP.indexOf('(function bindMyHomeExternalLinks(){'), iGb = APP.indexOf('const GUESTBOOK_OFF = ');
  const iSt = APP.indexOf('TwMyHomeSticker.createMyHomeSticker(');
  chk(iSt > 0 && iLinks > iSt && iMk > iLinks && iGb > iMk, '원래 자리 — 🎨 스티커 관리 창 연결 · 🔗 마이홈 본문 링크 뒤 · 📖 방명록 연결 앞');
  const call = (APP.match(/TwMyHomeEdit\.createMyHomeEdit\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  const fnDeps = deps.filter(l => /^\w+: \(\.\.\.a\)=>[\w$]+\(\.\.\.a\),$/.test(l));
  const getters = ['myHomeData: ()=>_myHomeData,', 'mhViewingUserId: ()=>_mhViewingUserId,', 'myHomeLoaded: ()=>_myHomeLoaded,', 'myHomeUid: ()=>_myHomeUid,',
    'mhStickerDragDist: ()=>_mhStickerDragDist,', 'isPremium: ()=>isPremium,', 'isAdmin: ()=>isAdmin,', 'userNameMax: ()=>USER_NAME_MAX,', 'getRenderMyHomeStickers: ()=>renderMyHomeStickers,'];
  const setters = ['setMyHomeLoaded: (v)=>{ _myHomeLoaded = v; },', 'setMhStickerDragDist: (v)=>{ _mhStickerDragDist = v; },', 'setRenderMyHomeStickers: (f)=>{ renderMyHomeStickers = f; },'];
  const vals = ['myHomeSticker,', 'stickerMax: STICKER_MAX,', 'stickerImgMaxW: STICKER_IMG_MAX_W,', 'dsImgMaxBgW: DS_IMG_MAX_BG_W,', 'dsImgMaxBgH: DS_IMG_MAX_BG_H,', 'dsImgMaxPanel: DS_IMG_MAX_PANEL,', 'dsImgQuality: DS_IMG_QUALITY,'];
  chk(deps.length === 34 && fnDeps.length === 15 && getters.every(g => deps.includes(g)) && setters.every(s => deps.includes(s)) && vals.every(v => deps.includes(v)),
      'deps 34개 — 함수 15는 화살표 · 읽는 함수 9 · 쓰는 함수 3 · 앞에 선언된 const 7은 값 (' + deps.length + ' · 화살표 ' + fnDeps.length + ')');
  const before = (n) => { const i = APP.search(new RegExp('^const ' + n + '\\s*=', 'm')); return i > 0 && i < iMk; };
  chk(['myHomeSticker', 'STICKER_MAX', 'STICKER_IMG_MAX_W', 'DS_IMG_MAX_BG_W', 'DS_IMG_MAX_BG_H', 'DS_IMG_MAX_PANEL', 'DS_IMG_QUALITY'].every(before), '  값으로 넘기는 것은 만드는 줄보다 앞에 선언된 const');
  chk(!before('USER_NAME_MAX') && APP.search(/^const USER_NAME_MAX\s*=/m) > iMk, '  ★ USER_NAME_MAX 는 만드는 줄보다 뒤 — 그래서 읽는 함수');
  const m = strip(MOD);
  chk(!/[^.\w$](_myHomeData|_mhViewingUserId|_myHomeLoaded|_myHomeUid|_mhStickerDragDist|isPremium|isAdmin|USER_NAME_MAX|renderMyHomeStickers)\s*=[^=]/.test(m.replace(/const (_myHomeData|_mhViewingUserId|_myHomeLoaded|_myHomeUid|_mhStickerDragDist|isPremium|isAdmin|USER_NAME_MAX|renderMyHomeStickers) = deps\.\w+;/g, '')), '모듈은 app.js 의 let 에 직접 쓰지 않는다(쓰는 함수로)');
  chk(!/[^.\w$](_myHomeData|_mhViewingUserId|_myHomeLoaded|_myHomeUid|isPremium|isAdmin|USER_NAME_MAX)(?!\s*\()(?![\w$])/.test(m.replace(/const (_myHomeData|_mhViewingUserId|_myHomeLoaded|_myHomeUid|isPremium|isAdmin|USER_NAME_MAX) = deps\.\w+;/g, '')), '  읽을 때는 늘 함수로 부른다(값을 붙들지 않는다)');
  chk(/const origRenderStickers = _getRenderMyHomeStickers\(\);/.test(MOD) && /_setRenderMyHomeStickers\(function\(\)\{ origRenderStickers\(\);/.test(MOD), '★ 감싸기 전 함수는 값으로 받는다 — 화살표로 받으면 감싼 함수가 자기를 부른다');
  const off = (APP.match(/const MYHOME_EDIT_OFF = \{([\s\S]*?)\};/) || [])[1] || '';
  chk(RET.every(n => new RegExp('\\b' + n + '\\(\\)\\{').test(off)), '빈 껍데기 MYHOME_EDIT_OFF — 반환값 이름을 다 갖는다');
  chk(HOOKS.every(n => new RegExp('window\\.' + n + '\\s*=').test(m)), 'window 고리는 모듈이 예전 이름으로 건다(' + HOOKS.length + '개)');
  const used = HOOKS.filter(n => new RegExp('\\b' + n + '\\b').test(code));
  const wantUsed = ['commitMyHomePage', '_mhBgmRefresh', '_bgmDestroy', '_mhApplyBg', '_mhApplyTheme', '_mhDsClose'];
  chk(wantUsed.every(n => used.includes(n)), '  app.js 는 그 이름으로 부른다(' + used.join(' · ') + ' — _mhBgmPlaying · _mhBgmSetPlaying 은 purikura-ui.js)');
  const iS = HTML.indexOf('<script src="parts/myhome-sticker.js"></script>'), iE = HTML.indexOf('<script src="parts/myhome-edit.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iS > 0 && iE > iS && iA > iE, 'html — myhome-edit.js 를 myhome-sticker.js 뒤 · app.js 앞에 싣는다');
  chk(/^Tw[A-Z]/.test('TwMyHomeEdit') && !/window\.MyHomeEdit\s*=/.test(MOD), '전역 이름은 Tw 접두사(#103 — 크로미움 내장 전역과 겹치지 않게)');
  /* 모듈이 없을 때 — 빈 껍데기 줄만 떼어 굴린다 */
  const wire = (APP.match(/const MYHOME_EDIT_OFF = [\s\S]*?\n\}\);/) || [''])[0];
  const box = { myHomeSticker: {}, STICKER_MAX: 1, STICKER_IMG_MAX_W: 1, DS_IMG_MAX_BG_W: 1, DS_IMG_MAX_BG_H: 1, DS_IMG_MAX_PANEL: 1, DS_IMG_QUALITY: 1 };
  let got = null; try{ got = vm.runInNewContext(wire + '\nmyHomeEdit;', box); }catch(_){}
  chk(!!got && got.commit() === undefined && got.presetApply(0) === false && Array.isArray(got.presets()), '모듈이 안 실려도 그 자리는 서지 않는다(빈 껍데기)');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
/* 기다리던 약속이 영영 안 풀려 이벤트 고리가 비면 node 는 0 으로 조용히 끝난다 — 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
