/* myhome-store.js — 🏠 마이홈 상태 주인 — 내 홈(페이지) · 보고 있는 집 (검사 sim-myhome-store.js)
   책임: 내 마이홈 페이지의 «원본은 서버» — 앱은 받아서 보여 주고, 고친 칸만 보낸다(PATCH · 디자인은 PUT design · 같은 판 page.version).
     화면은 값을 직접 고치지 않는다 — setField · setFields · setAvatar · addSticker · editSticker · removeSticker · moveSticker · setDesign · resetBg 를 부른다.
     내놓는 page() 는 얼려 둔 값이라 화면이 고치려 해도 아무 일이 없다(고치려면 위 동작 함수).
   저장 규칙(한 줄): 한 번에 하나 — 보내는 중 또 고치면 끝난 뒤 «그때까지 바뀐 칸» 을 모아 한 번 더(같은 판으로 두 번 보내면 두 번째가 409 다).
     바뀐 칸만 싣는다(dirty) — 바뀐 칸이 없으면 요청 0. «바뀜» 은 내가 마지막으로 보낸(또는 받은) 값과 견준다 — 서버가 글을 씻어도 다시 보내지 않는다.
     디자인(테마 · 프리셋 · 고른 칸 · 바깥 배경)은 PUT design 통째 — 페이지 PATCH 와 한 줄에서 차례로(디자인 먼저).
   409 CONCURRENT_UPDATE: 페이지 PATCH 는 다시 받은 뒤 내가 고친 글 칸(소개 · 게시글 · 제목)만 새 판에 얹어 한 번 더(스티커 · 사진 · 배경 · BGM 은 받은 값) — 두 번째도 409 면 받은 값 + 알림.
     디자인 PUT 이 409 여도 내가 고친 글 칸은 새 판에 한 번 얹는다 — 디자인 고침만 버리고 받은 값으로 그린다 + 알림. 고치기는 다시 받는 동안 잠긴다.
     실패는 고친 화면을 그대로 두고 그 자리 번호를 한 번(이어지는 실패는 한 번 · 성공하면 풂). 혼자 다시 보내지 않는다 — 다음 고침 · 창 닫기 · 로그아웃 올리기(flush) · 앱 끄기가 한 번.
     저장 중이거나 못 올린 고침이 있을 때 내 홈 받기는 요청하지 않는다(받은 판이 고친 칸을 덮지 않게).
   그림: 고르면 줄인 뒤 올려 주소만 저장에 싣는다(upload). 같은 칸에 올리는 중 또 고르면 busy · 올리기가 실패하면 그 칸은 예전 값 · 다른 칸 저장은 그대로 간다.
   보고 있는 집: 내 집이면 내 홈을 가리키고(사본 없음), 남의 집이면 그 집 페이지를 받는다. 집을 옮길 때마다 gen 이 올라 늦게 온 앞 집 답은 버린다.
   deps: api — createMyHomeApi 가 돌려준 것(myhome-api.js — fetchMine · fetchOf · patchPage · putDesign · uploadImage · reset)
         lib — TwMyHomeApi(failOf · KIND · LIMITS) · errs — TwApiErrors · apiErrors — TwApiErrors.store(공통 code 번호 알림)
         notifyError — TwErrorCodes.notify · toast(msg) · previewOn() — 👁 방문자 시점 미리보기 중인가 · rules — TwMyHomeStickerRules(순서 규칙)
   내보냄: createMyHomeStore(deps) → {
     mine() → { load, page, pageVersion, desktop, desktopVersion, saving, uploading } · page() — 지금 화면에 그릴 페이지(구경 중이면 그 집 것) · canEdit() — 고칠 수 있는가 · avatar() — 내 사진
     view() → { owner, load, page, desktop, name } · viewing() — 구경 중인 코드(없으면 null) · viewName() · setViewName(n) · onChange(fn) → 해제 함수
     pullMine({ site }?) → Promise<boolean>(받은 뒤 ready 인가 — site: 'load'(E-MH-20 · 기본) | 'quiet'(번호 없음)) · ensureMine(opts) — ready 면 요청 없이 true
     openView(code, nameHint?) → Promise<'ok'|'missing'|'failed'|'stale'> · closeView()
     setField(칸, 값) · setFields({칸:값…}) · setAvatar(그림) · addSticker(그림, { link, x, y, w, h, size }) · editSticker(sid, 바꿀 칸) · editStickers({sid:바꿀 칸}) · removeSticker(sid) · moveSticker(sid, 방향)
       · setDesign({ theme, presets, presetCur, bg? }) · resetBg() · upload(칸 이름, 그림) → Promise<'ok'|'failed'|'conflict'|'stale'|'locked'|'busy'|'full'|'uploadFailed'|'gone'|'invalid'>('invalid' = setDesign 에 data: 그림)(upload 는 { status, url? })
     flush() → Promise — 저장 중이면 그 끝을, 못 올린 고침이 있으면 한 번 올린다(로그아웃 올리기 · 앱 끄기) · reset() — 계정을 놓을 때
     LOAD · MSG · STICKER_MAX
   }
   ⚠️ 서버 상한(스티커 5)은 TwMyHomeApi.LIMITS 하나를 쓴다. 스티커 w · h 는 정수(서버 Int) · 저장 때 늘 판(version)을 싣는다.
   ⚠️ 받은 판이 없으면(모양이 틀린 답) 받기 실패로 본다 — 판 없이 쓰지 않는다. */
(function(){
'use strict';

const LOAD = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', FAILED: 'failed' });
const MSG = Object.freeze({
  merged: '다른 기기에서 바꾼 내용을 받아왔어요',
  loading: '불러오는 중이에요',
  uploading: '그림을 올리는 중이에요',
});
const GUIDE_MSG = Object.freeze({
  MYHOME_STICKER_FULL: '스티커는 최대 5개까지만 붙일 수 있어요',
  MYHOME_BOOKSHELF_FULL: '책장이 가득 찼어요',
  MYHOME_INVALID_BGM: '유튜브 링크를 인식하지 못했어요',
});
const TEXT_FIELDS = Object.freeze(['bio', 'post', 'postTitle']);
const PAGE_FIELDS = Object.freeze(['avatar', 'bio', 'postTitle', 'post', 'bgm', 'bg', 'stickers']);
const SETTABLE = Object.freeze(['bio', 'postTitle', 'post', 'bgm', 'bg']);   // 화면이 setField 로 바꾸는 칸(사진 · 스티커는 전용 동작)
const STICKER_KEYS = Object.freeze(['x', 'y', 'w', 'h', 'size', 'rot', 'locked', 'link', 'anim', 'animSpeed']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && isFinite(v);
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const cnt = (v) => typeof v === 'number' && isFinite(v) && v >= 0 && Math.floor(v) === v;
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
function deepFreeze(o){
  if(o && typeof o === 'object' && !Object.isFrozen(o)){ Object.freeze(o); for(const k of Object.keys(o)) deepFreeze(o[k]); }
  return o;
}
const frozen = (v) => deepFreeze(clone(v));
const emptyPage = () => ({ avatar: null, bio: '', postTitle: '', post: '', bgm: null, bg: null, stickers: {}, theme: null, themePresets: null, themePresetCur: null });
const emptyDesktop = () => ({ bg: null, hideFolders: false, folderPos: {} });

/** @param {{
 *   api: { fetchMine: Function, fetchOf: Function, patchPage: Function, putDesign: Function, uploadImage: Function, reset: Function },
 *   lib: { failOf: Function, KIND: Record<string, string>, ERRORS: object, LIMITS: { STICKERS: number } },
 *   errs: object, apiErrors: { notify: Function }, notifyError: (code: string, err?: any) => boolean, toast: (msg: string) => void,
 *   previewOn: () => boolean, rules: { nextZ: Function, move: Function },
 * }} deps */
function createMyHomeStore(deps){
  const api = deps.api;
  const lib = deps.lib;
  const errs = deps.errs;
  const apiErrors = deps.apiErrors;
  const notifyError = deps.notifyError;
  const toast = deps.toast;
  const previewOn = deps.previewOn;
  const rules = deps.rules;
  const KIND = lib.KIND;
  const STICKER_MAX = lib.LIMITS.STICKERS;

  const subs = [];
  let gen = 0;   // reset 마다 오른다 — 앞 계정의 늦은 답이 새 계정 상태를 고치지 않게
  const mineSt = { load: LOAD.IDLE, page: frozen(emptyPage()), pageVersion: undefined, desktop: frozen(emptyDesktop()), desktopVersion: undefined };
  const viewSt = { owner: null, load: LOAD.IDLE, page: null, desktop: null, name: null, gen: 0 };
  let base = {};                 // 칸 이름 → 내가 마지막으로 보낸(또는 받은) 값의 글 — «바뀜» 판단의 기준
  const dirty = new Map();       // 못 보낸 칸 → 고친 차례(rev) — 칸: PAGE_FIELDS · 'clearTheme' · 'design' · 'designBg'
  let rev = 0;
  let saving = false, saveP = null, pullP = null;
  const failing = { page: false, design: false };
  const busy = new Set();        // 올리는 중인 칸

  function emit(){
    for(const fn of subs.slice()){ try{ fn(); }catch(err){ console.warn('[마이홈] 받는 쪽 처리 실패', err); } }
  }
  const failOf = (e) => lib.failOf(e, errs);

  /* 그 자리 번호 — 부르는 곳마다 하나(번호는 글자 그대로 — sim-error-codes 가 찾는다). quiet 는 덤으로 읽는 값이라 번호 없음 */
  const SITE = Object.freeze({
    load: (e) => notifyError('E-MH-20', e),     // 내 홈 받기(열기 · 다시 시도)
    view: (e) => notifyError('E-MH-21', e),     // 친구 홈 구경
    save: (e) => notifyError('E-MH-22', e),     // 페이지 PATCH
    design: (e) => notifyError('E-MH-23', e),   // PUT design
    upload: (e) => notifyError('E-MH-24', e),   // 그림 올리기
    quiet: () => true,
  });
  /* 실패 하나를 알린다 — 계정이 바뀌는 중(stale)은 조용히 · 공통 code 는 공통 번호 · 그 밖은 그 자리 번호 */
  function report(e, site){
    const f = failOf(e);
    if(f.kind === KIND.STALE) return f;
    if(f.kind === KIND.GUIDE){ toast(GUIDE_MSG[f.code] || GUIDE_MSG.MYHOME_STICKER_FULL); return f; }   // 안내(번호 없음 · 지금 앱 문구)
    if(f.kind === KIND.COMMON) apiErrors.notify(e, lib.ERRORS);
    else SITE[site](e);
    return f;
  }

  /* ── 상태 바꾸기 ── */
  function setPage(p){ mineSt.page = frozen(p); }
  function baseFrom(page){
    const b = {};
    for(const k of PAGE_FIELDS) b[k] = JSON.stringify(page[k]);
    b.theme = JSON.stringify(page.theme);
    b.themePresets = JSON.stringify(page.themePresets);
    b.themePresetCur = JSON.stringify(page.themePresetCur);
    return b;
  }
  const baseOf = (k) => base[k];
  const sameBase = (k, v) => JSON.stringify(v) === baseOf(k);
  function mark(key, isDirty){ if(isDirty) dirty.set(key, ++rev); else dirty.delete(key); }
  function markField(k){ mark(k, !sameBase(k, mineSt.page[k])); }
  function markDesign(){
    const p = mineSt.page;
    mark('design', !(sameBase('theme', p.theme) && sameBase('themePresets', p.themePresets) && sameBase('themePresetCur', p.themePresetCur)));
  }

  /* 받은 홈을 내 홈으로 — keep 이 true 면 못 보낸 칸은 내 값을 남긴다(받는 사이 올리기가 끝난 칸) */
  function adopt(got, keep){
    const kept = keep ? Object.assign({}, ...[...dirty.keys()].filter((k) => PAGE_FIELDS.indexOf(k) >= 0).map((k) => ({ [k]: mineSt.page[k] }))) : {};
    const keepDesign = keep && dirty.has('design') ? { theme: mineSt.page.theme, themePresets: mineSt.page.themePresets, themePresetCur: mineSt.page.themePresetCur } : {};
    const keepClear = keep && dirty.has('clearTheme');
    const keepDesignBg = keep && dirty.has('designBg') ? { bg: mineSt.page.bg } : {};
    base = baseFrom(got.page);
    const next = Object.assign({}, got.page, kept, keepDesign, keepDesignBg);
    if(keepClear) next.theme = null;
    mineSt.pageVersion = got.pageVersion;
    mineSt.desktop = frozen(got.desktop);
    mineSt.desktopVersion = got.desktopVersion;
    dirty.clear();
    setPage(next);
    for(const k of PAGE_FIELDS) if(own(kept, k)) markField(k);
    if(keepClear){ base.theme = JSON.stringify(null); dirty.set('clearTheme', ++rev); }
    if(own(keepDesign, 'theme') && !keepClear){ markDesign(); }
    if(own(keepDesignBg, 'bg')){ mark('designBg', !sameBase('bg', mineSt.page.bg)); }
  }

  /* ── 내 홈 받기 ── */
  function pullMine(opts){
    const site = (opts && opts.site) || 'load';
    if(mineSt.load === LOAD.READY && (saving || dirty.size || failing.page || failing.design)) return Promise.resolve(true);   // 고친 칸이 서버보다 새것이다 — 덮지 않는다
    if(pullP) return pullP;
    pullP = runPull(site).finally(() => { pullP = null; });
    return pullP;
  }
  function ensureMine(opts){ return mineSt.load === LOAD.READY ? Promise.resolve(true) : pullMine(opts); }
  async function fetchChecked(){
    const got = await api.fetchMine();
    if(!got || !cnt(got.pageVersion)){ throw Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' }); }   // 판 없이는 쓰지 않는다
    return got;
  }
  async function runPull(site){
    const g = gen;
    mineSt.load = LOAD.LOADING;
    emit();
    let got;
    try{ got = await fetchChecked(); }
    catch(e){
      if(g !== gen) return false;
      mineSt.load = LOAD.FAILED;
      report(e, site);
      emit();
      return false;
    }
    if(g !== gen) return false;
    adopt(got, true);
    mineSt.load = LOAD.READY;
    emit();
    if(nextJob()) kick();   // 받는 사이 올리기가 끝난 칸
    return true;
  }

  /* ── 보고 있는 집 ── */
  async function openView(code, nameHint){
    const vg = ++viewSt.gen;
    const g = gen;
    let got;
    try{ got = await api.fetchOf(code); }
    catch(e){
      if(g !== gen || vg !== viewSt.gen) return 'stale';
      const f = failOf(e);
      if(f.kind === KIND.MISSING){ toast(f.message || '그 사용자를 찾을 수 없어요'); return 'missing'; }   // 서버 문구 안내(번호 없음)
      report(e, 'view');
      return 'failed';
    }
    if(g !== gen || vg !== viewSt.gen) return 'stale';
    viewSt.owner = code; viewSt.load = LOAD.READY; viewSt.page = frozen(got.page); viewSt.desktop = frozen(got.desktop);
    viewSt.name = (typeof nameHint === 'string' && nameHint.trim()) ? nameHint.trim() : null;
    emit();
    return 'ok';
  }
  function closeView(){
    viewSt.gen++;
    const was = viewSt.owner;
    viewSt.owner = null; viewSt.load = LOAD.IDLE; viewSt.page = null; viewSt.desktop = null; viewSt.name = null;
    if(was) emit();
  }

  /* ── 고치기 ── 받은 뒤에만 · 구경 중 · 미리보기 중엔 안 한다(판단은 여기 한 곳) */
  const canEdit = () => mineSt.load === LOAD.READY && !viewSt.owner && !previewOn();
  function guard(){
    if(viewSt.owner || previewOn()) return 'locked';
    if(mineSt.load === LOAD.LOADING){ toast(MSG.loading); return 'locked'; }
    if(mineSt.load !== LOAD.READY) return 'locked';
    return null;
  }
  const locked = () => Promise.resolve('locked');

  function change(patch){
    setPage(Object.assign({}, mineSt.page, patch));
    emit();
  }

  function setFields(map){
    if(guard()) return locked();
    const patch = {};
    for(const k of Object.keys(map || {})){
      if(SETTABLE.indexOf(k) < 0) continue;
      let v = map[k];
      if(TEXT_FIELDS.indexOf(k) >= 0) v = typeof v === 'string' ? v : '';
      if(k === 'bgm') v = isObj(v) ? { url: String(v.url || ''), title: String(v.title || '') } : null;
      if(k === 'bg') v = isObj(v) && (v.img || v.color) ? (v.img ? { img: String(v.img) } : { color: String(v.color) }) : null;
      if(k === 'bg' && v && v.img && /^data:/i.test(v.img)) continue;   // 그림은 올린 뒤 주소로만(upload)
      patch[k] = v;
    }
    if(!Object.keys(patch).length) return Promise.resolve('ok');
    change(patch);
    for(const k of Object.keys(patch)) markField(k);
    return kick();
  }
  const setField = (k, v) => setFields({ [k]: v });

  /* ── 그림 올리기 — 같은 칸에 올리는 중 또 고르면 busy ── */
  async function upload(key, dataUrl){
    const r = guard(); if(r) return { status: r };
    if(busy.has(key)){ toast(MSG.uploading); return { status: 'busy' }; }
    busy.add(key); emit();
    const g = gen;
    let url;
    try{ url = await api.uploadImage(dataUrl); }
    catch(e){
      if(g !== gen) return { status: 'stale' };
      busy.delete(key);
      report(e, 'upload');
      emit();
      return { status: 'uploadFailed' };
    }
    if(g !== gen) return { status: 'stale' };
    busy.delete(key);
    emit();
    return { status: 'ok', url };
  }

  async function setAvatar(dataUrl){
    const r = guard(); if(r) return r;
    if(busy.has('avatar')){ toast(MSG.uploading); return 'busy'; }
    const prev = mineSt.page.avatar;
    change({ avatar: dataUrl });   // 고르자마자 미리 그린다(저장에는 싣지 않는다 — 올린 주소만)
    const got = await upload('avatar', dataUrl);
    if(got.status !== 'ok'){
      if(got.status === 'uploadFailed' && mineSt.page.avatar === dataUrl) change({ avatar: prev });   // 예전 사진으로 되돌림
      return got.status;
    }
    change({ avatar: got.url });
    markField('avatar');
    return kick();
  }

  /* ── 스티커 — 화면 {sid: {img, link, x, y, w, h, size, rot, z, locked, anim, animSpeed}} ── */
  const stickersNow = () => clone(mineSt.page.stickers) || {};
  function normSticker(o){
    const s = Object.assign({}, o);
    if('w' in s) s.w = Math.max(1, Math.min(400, Math.round(Number(s.w) || 1)));
    if('h' in s) s.h = Math.max(1, Math.min(32767, Math.round(Number(s.h) || 1)));
    if('size' in s && fin(s.size)) s.size = Math.max(0.3, Math.min(8, s.size));
    for(const k of ['x', 'y', 'rot', 'z']) if(k in s && !fin(s[k])) delete s[k];
    if('link' in s && !s.link) delete s.link;
    for(const k of ['anim', 'animSpeed']) if(k in s && !s[k]) delete s[k];
    if('locked' in s && s.locked !== true) delete s.locked;
    return s;
  }
  function putStickers(map){
    change({ stickers: map });
    markField('stickers');
    return kick();
  }
  async function addSticker(dataUrl, opts){
    const r = guard(); if(r) return { status: r };
    if(Object.keys(mineSt.page.stickers).length >= STICKER_MAX) return { status: 'full' };
    const o = opts || {};
    const got = await upload('sticker', dataUrl);
    if(got.status !== 'ok') return { status: got.status };
    const list = stickersNow();
    if(Object.keys(list).length >= STICKER_MAX) return { status: 'full' };   // 올리는 사이 다른 스티커가 붙어 가득 찼다 — 올린 그림은 쓰지 않고 남는다
    let sid = 's' + Date.now().toString(36);
    while(own(list, sid)) sid += 'x';
    list[sid] = normSticker({ img: got.url, link: o.link, x: o.x, y: o.y, w: o.w, h: o.h, size: fin(o.size) ? o.size : 1, z: rules.nextZ(list) });
    const status = await putStickers(list);
    return { status, sid };
  }
  /* 올리기 · 다른 동작 뒤에는 sid 로 다시 찾는다 — 없으면 버림 */
  function editStickers(map){
    const r = guard(); if(r) return locked();
    const list = stickersNow();
    let n = 0;
    for(const sid of Object.keys(map || {})){
      if(!own(list, sid)) continue;
      const patch = map[sid] || {};
      const next = Object.assign({}, list[sid]);
      for(const k of STICKER_KEYS) if(own(patch, k)) next[k] = patch[k];
      list[sid] = normSticker(next);
      n++;
    }
    return n ? putStickers(list) : Promise.resolve('gone');
  }
  const editSticker = (sid, patch) => editStickers({ [sid]: patch });
  function removeSticker(sid){
    const r = guard(); if(r) return locked();
    const list = stickersNow();
    if(!own(list, sid)) return Promise.resolve('gone');
    delete list[sid];
    return putStickers(list);
  }
  function moveSticker(sid, dir){
    const r = guard(); if(r) return locked();
    const list = stickersNow();
    if(!rules.move(list, sid, dir)) return Promise.resolve('gone');
    return putStickers(list);
  }

  /* ── 디자인 · 배경 ── */
  function setDesign(d){
    const r = guard(); if(r) return locked();
    const o = d || {};
    const now = mineSt.page;
    const rawTheme = own(o, 'theme') ? o.theme : now.theme;   // 안 넘긴 열쇠는 지금 값 — 프리셋을 모르고 지우지 않게
    const theme = isObj(rawTheme) && Object.keys(rawTheme).length ? clone(rawTheme) : null;
    const patch = { theme, themePresets: Array.isArray(o.presets) ? clone(o.presets) : now.themePresets, themePresetCur: cnt(o.presetCur) ? o.presetCur : now.themePresetCur };
    const hasBg = own(o, 'bg');
    if(hasBg) patch.bg = isObj(o.bg) && (o.bg.img || o.bg.color) ? clone(o.bg) : null;
    if(hasBg && patch.bg && patch.bg.img && /^data:/i.test(patch.bg.img)) return Promise.resolve('invalid');   // 그림은 올린 뒤 주소로만
    change(patch);
    markDesign();
    if(hasBg) mark('designBg', !sameBase('bg', mineSt.page.bg));
    if(dirty.has('clearTheme') && theme) dirty.delete('clearTheme');   // 디자인으로 테마를 새로 정했다 — 지우기는 필요 없다
    return kick();
  }
  /* 배경 메뉴 [초기화] — 배경 · 남은 테마를 지운다(프리미엄이 끝난 사람도 · 프리셋은 건드리지 않는다) */
  function resetBg(){
    const r = guard(); if(r) return locked();
    change({ bg: null, theme: null });
    markField('bg');
    base.theme = JSON.stringify(null);   // 테마는 아래 clearTheme 가 지운다 — 디자인(PUT) 쪽에서 바뀐 칸으로 보지 않는다
    markDesign();   // 테마는 지우기로 가고 프리셋 · 고른 칸의 못 보낸 고침은 남는다
    dirty.set('clearTheme', ++rev);
    return kick();
  }

  /* ── 저장 줄 — 한 번에 하나 ── */
  function nextJob(){
    if(dirty.has('design') || dirty.has('designBg')) return 'design';
    for(const k of PAGE_FIELDS) if(dirty.has(k)) return 'page';
    if(dirty.has('clearTheme')) return 'page';
    return null;
  }
  function kick(){
    if(mineSt.load !== LOAD.READY || !nextJob()) return saveP || Promise.resolve('ok');
    if(saving) return saveP;   // 보내는 중 — 고친 칸은 dirty 에 쌓였고 끝난 뒤 한 번에 간다
    saving = true; emit();
    const g = gen;
    saveP = drain(g).finally(() => { if(g === gen){ saving = false; saveP = null; emit(); } });
    return saveP;
  }
  async function drain(g){
    let outcome = 'ok', textRetry = false;
    while(g === gen){
      const job = nextJob();
      if(!job) break;
      const r = await send(job, g);
      if(g !== gen) return 'stale';
      if(r === 'ok') continue;
      if(r === 'conflict'){
        const keepText = !textRetry;   // 어느 요청이 409 를 받았든 내가 고친 글 칸은 새 판에 한 번 얹는다(Q1)
        textRetry = textRetry || keepText;
        const done = await resolveConflict(keepText, g);
        if(done !== 'ok') return done;
        outcome = 'conflict';
        continue;
      }
      return r;   // 'failed' | 'stale'
    }
    return outcome;
  }
  async function send(job, g){
    const version = mineSt.pageVersion;
    const p = mineSt.page;
    const sent = {};     // 보낸 dirty 칸 → 고친 차례
    const vals = {};     // 칸 → 보낸 값
    let kind, call;
    if(job === 'design'){
      kind = 'design';
      const d = { theme: p.theme, presets: p.themePresets, presetCur: p.themePresetCur };
      sent.design = dirty.get('design');
      if(dirty.has('designBg')){ d.bg = p.bg; sent.designBg = dirty.get('designBg'); vals.bg = p.bg; }
      Object.assign(vals, { theme: p.theme, themePresets: p.themePresets, themePresetCur: p.themePresetCur });
      call = () => api.putDesign(version, d);
    }else{
      kind = 'page';
      const f = {};
      for(const k of PAGE_FIELDS) if(dirty.has(k)){ f[k] = p[k]; sent[k] = dirty.get(k); vals[k] = p[k]; }
      if(dirty.has('clearTheme')){ f.clearTheme = true; sent.clearTheme = dirty.get('clearTheme'); }
      call = () => api.patchPage(version, f);
    }
    let v;
    try{ v = await call(); }
    catch(e){
      if(g !== gen) return 'stale';
      const f = failOf(e);
      if(f.kind === KIND.STALE) return 'stale';
      if(f.kind === KIND.CONFLICT) return 'conflict';
      if(!failing[kind]){ failing[kind] = true; report(e, kind === 'design' ? 'design' : 'save'); }
      return 'failed';
    }
    if(g !== gen) return 'stale';
    failing[kind] = false;
    mineSt.pageVersion = v;
    for(const k of Object.keys(sent)) if(dirty.get(k) === sent[k]) dirty.delete(k);
    for(const k of Object.keys(vals)) base[k] = JSON.stringify(vals[k]);
    if(job === 'design'){
      markDesign();
      if(own(vals, 'bg')){ mark('designBg', !sameBase('bg', mineSt.page.bg)); }
      markField('bg');
    }else{
      for(const k of PAGE_FIELDS) if(own(vals, k)) markField(k);
    }
    return 'ok';
  }
  /* 409 — 고치기를 잠그고 서버 것을 받는다. keepText 면 내가 고친 글 칸만 새 판에 얹어 한 번 더 보낸다(나머지는 받은 값) */
  async function resolveConflict(keepText, g){
    const texts = {};
    let dropped = false;
    for(const k of dirty.keys()){
      if(keepText && TEXT_FIELDS.indexOf(k) >= 0) texts[k] = mineSt.page[k];
      else dropped = true;
    }
    mineSt.load = LOAD.LOADING; emit();
    let got;
    try{ got = await fetchChecked(); }
    catch(e){
      if(g !== gen) return 'stale';
      for(const k of [...dirty.keys()]) if(TEXT_FIELDS.indexOf(k) < 0) dirty.delete(k);   // 글 칸만 남긴다 — 다시 시도하면 받은 판 위에 얹는다
      mineSt.load = LOAD.FAILED;
      report(e, 'load');
      emit();
      return 'failed';
    }
    if(g !== gen) return 'stale';
    failing.page = false; failing.design = false;
    adopt(got, false);
    if(Object.keys(texts).length){
      change(texts);
      for(const k of Object.keys(texts)) markField(k);
    }
    mineSt.load = LOAD.READY;
    emit();
    if(dropped || !Object.keys(texts).length) toast(MSG.merged);
    return 'ok';
  }

  /* 로그아웃 올리기 · 앱 끄기 — 저장 중이면 그 끝을, 못 올린 고침이 있으면 한 번 올린다 */
  async function flush(){
    if(saveP){ try{ await saveP; }catch(_){} }
    if(mineSt.load === LOAD.READY && nextJob()){ failing.page = false; failing.design = false; try{ await kick(); }catch(_){} }
  }

  function reset(){
    gen++;
    viewSt.gen++;
    mineSt.load = LOAD.IDLE; mineSt.page = frozen(emptyPage()); mineSt.pageVersion = undefined;
    mineSt.desktop = frozen(emptyDesktop()); mineSt.desktopVersion = undefined;
    viewSt.owner = null; viewSt.load = LOAD.IDLE; viewSt.page = null; viewSt.desktop = null; viewSt.name = null;
    base = {}; dirty.clear(); busy.clear();
    saving = false; saveP = null; pullP = null; failing.page = false; failing.design = false;
    try{ api.reset(); }catch(_){}
    emit();
  }

  return {
    mine: () => ({ load: mineSt.load, page: mineSt.page, pageVersion: mineSt.pageVersion, desktop: mineSt.desktop, desktopVersion: mineSt.desktopVersion, saving, uploading: busy.size > 0 }),
    page: () => (viewSt.owner && viewSt.page ? viewSt.page : mineSt.page),
    desktop: () => (viewSt.owner && viewSt.desktop ? viewSt.desktop : mineSt.desktop),
    canEdit,
    avatar: () => (mineSt.load === LOAD.READY ? mineSt.page.avatar : null),
    view: () => ({ owner: viewSt.owner, load: viewSt.load, page: viewSt.page, desktop: viewSt.desktop, name: viewSt.name }),
    viewing: () => viewSt.owner,
    viewName: () => viewSt.name,
    setViewName: (n) => { if(viewSt.owner){ viewSt.name = (typeof n === 'string' && n.trim()) ? n.trim() : null; } },
    onChange: (fn) => { subs.push(fn); return () => { const i = subs.indexOf(fn); if(i >= 0) subs.splice(i, 1); }; },
    pullMine, ensureMine, openView, closeView,
    setField, setFields, setAvatar, addSticker, editSticker, editStickers, removeSticker, moveSticker, setDesign, resetBg, upload,
    save: kick, flush, reset,
    LOAD, MSG, STICKER_MAX,
  };
}

const api = { createMyHomeStore, LOAD, MSG };
if(typeof window !== 'undefined') window.TwMyHomeStore = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
