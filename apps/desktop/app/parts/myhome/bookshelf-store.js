/* bookshelf-store.js — 📚 책장 상태 주인 — 내 책장(받기 · 저장) · 보고 있는 집의 공개 책 (검사 sim-bookshelf-store.js)
   책임: 책장의 «원본은 서버» — 앱은 서랍을 열 때 받아서 보여 주고, 고치면(추가 · 고치기 · 빼기 · 순서 · 👀 공개) 책 목록을 통째로 저장한다(PUT 판 version).
     화면(bookmark.js)은 값을 직접 고치지 않고 put(책 목록) 을 부른다. 순서 = 배열 차례. 저장이 끝나면 서버가 돌려준 책(서버가 지금 시각을 넣은 addedAt 포함)으로 다시 그린다.
     보고 있는 집: 집을 옮길 때(구경 시작)마다 그 집의 공개 책을 받고 gen 이 올라, 늦게 온 앞 집 답은 버린다.
   받기: 서랍을 열 때(내 집) · [다시 시도] — 사용자 동작이라 실패하면 E-MH-26 을 띄운다. 이미 받았으면(ready) 다시 받지 않는다. 모듈을 싣기만 해서는 요청도 타이머도 없다.
   저장 규칙: 한 번에 하나 — 저장 중에 또 고치면(again) 끝난 뒤 최신 목록으로 한 번 더(같은 판으로 두 번 보내면 두 번째가 409 다).
     409 CONCURRENT_UPDATE 는 다른 기기가 먼저 고친 것 — 내 고침은 버리고, 고치기를 잠근 채 서버 것을 받아 그리고 알린다.
     실패는 고친 화면을 그대로 두고 E-MH-27 을 한 번(이어지는 실패는 한 번 · 성공하면 풂). 혼자 다시 보내지 않는다 — 다음 고침 · 로그아웃 올리기(flush) · 앱 끄기가 한 번.
     저장 중이거나 못 올린 고침이 있을 때 내 책장 받기는 요청하지 않는다(받은 책이 고친 책을 덮지 않게).
   구경: 공개 책을 못 받으면 폴더는 보이고 서랍에 «못 불러왔어요 [다시 시도]»(받기 전 알림 없음 — 누른 다시 시도가 또 실패하면 E-MH-26). 없는 사람(USER_NOT_FOUND)은 'missing' — 폴더를 숨긴다.
   deps: api — createMyHomeApi 가 돌려준 것(myhome-api.js — fetchBookshelf · fetchBookshelfOf · putBookshelf · uploadImage · reset)
         lib — TwMyHomeApi(failOf · KIND · ERRORS · LIMITS) · errs — TwApiErrors(failOf 의 공통 code 표)
         apiErrors — TwApiErrors.store(공통 code 번호 알림 — notify(err, 표)) · notifyError — TwErrorCodes.notify · toast(msg)
   내보냄: createBookshelfStore(deps) → {
     mine() → { load, books, version, saving } (복사본) · view() → { owner, load, books }
     onChange(fn) → 해제 함수 · pullMine() → Promise<boolean>(지금 내 책장이 ready 인가)
     openView(code) → Promise<boolean>(답이 왔을 때 아직 그 집인가) · retryView() → Promise<boolean> · closeView()
     put(books) → Promise<'ok'|'failed'|'conflict'|'stale'|'locked'|'full'>
     uploadImage(dataUrl) → Promise<{ ok:true, url } | { ok:false, stale?:true, notified?:true }> — 올리는 것만(저장은 put). 실패 번호(E-MH-24)는 부르는 화면 몫(notified 면 공통 번호를 이미 알림)
     flush() → Promise — 저장 중이면 그 끝을, 못 올린 고침이 있으면 한 번 올린다(로그아웃 올리기 · 앱 끄기) · reset() — 계정을 놓을 때
     LOAD · MSG · BOOKS(책 상한 — lib.LIMITS.BOOKS 그대로)
   }
   ⚠️ 책 상한(50)은 TwMyHomeApi.LIMITS.BOOKS 하나를 쓴다 — 여기 다시 적지 않는다. */
(function(){
'use strict';

const LOAD = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', FAILED: 'failed', MISSING: 'missing' });
const MSG = Object.freeze({ merged: '다른 기기에서 바꾼 내용을 받아왔어요' });

/** @param {{
 *   api: { fetchBookshelf: Function, fetchBookshelfOf: Function, putBookshelf: Function, uploadImage: Function, reset: Function },
 *   lib: { failOf: Function, KIND: Record<string, string>, ERRORS: object, LIMITS: { BOOKS: number } },
 *   errs: object, apiErrors: { notify: Function }, notifyError: (code: string, err?: any) => boolean, toast: (msg: string) => void,
 * }} deps */
function createBookshelfStore(deps){
  const api = deps.api;
  const lib = deps.lib;
  const errs = deps.errs;
  const apiErrors = deps.apiErrors;
  const notifyError = deps.notifyError;
  const toast = deps.toast;
  const KIND = lib.KIND;
  const BOOKS = lib.LIMITS.BOOKS;

  const subs = [];
  let gen = 0;   // reset 마다 오른다 — 앞 계정의 늦은 답이 새 계정 상태를 고치지 않게
  const mineSt = { load: LOAD.IDLE, books: [], version: 0 };
  let saving = false, again = false, failing = false;
  let saveP = null, pullP = null;
  const viewSt = { owner: null, load: LOAD.IDLE, books: [], gen: 0 };

  function emit(){
    for(const fn of subs.slice()){ try{ fn(); }catch(err){ console.warn('[책장] 받는 쪽 처리 실패', err); } }
  }
  const copyBooks = (list) => list.map((b) => Object.assign({}, b));
  const failOf = (e) => lib.failOf(e, errs);

  /* 그 자리 번호 — 부르는 곳마다 하나(번호는 글자 그대로 — sim-error-codes 가 찾는다) */
  const SITE = Object.freeze({
    load: (e) => notifyError('E-MH-26', e),   // 내 책장 · 구경 중 다시 시도 받기
    save: (e) => notifyError('E-MH-27', e),   // 책장 저장
  });
  /* 실패 하나를 알린다 — 계정이 바뀌는 중(stale)은 조용히 · 공통 code 는 공통 번호 · 그 밖은 그 자리 번호 */
  function report(e, site){
    const f = failOf(e);
    if(f.kind === KIND.STALE) return f;
    if(f.kind === KIND.COMMON) apiErrors.notify(e, lib.ERRORS);
    else SITE[site](e);
    return f;
  }

  /* ── 내 책장 받기 ── 서랍을 여는 누름 · [다시 시도] 에서만 부른다 */
  function pullMine(opts){
    /* 이미 받았다(ready) — 다시 열어도 요청 0. 저장 중이거나 못 올린 고침이 있을 때도 ready 라 받지 않는다(받은 책이 고친 책을 덮지 않게) */
    if(mineSt.load === LOAD.READY && !(opts && opts.merged)) return Promise.resolve(true);
    if(pullP) return pullP;
    pullP = runPull(!!(opts && opts.merged)).finally(() => { pullP = null; });
    return pullP;
  }
  async function runPull(merged){
    const g = gen;
    mineSt.load = LOAD.LOADING;
    emit();
    let got;
    try{ got = await api.fetchBookshelf(); }
    catch(e){
      if(g !== gen) return false;
      mineSt.load = LOAD.FAILED;
      report(e, 'load');
      emit();
      return false;
    }
    if(g !== gen) return false;
    mineSt.books = got.books; mineSt.version = got.version; mineSt.load = LOAD.READY;
    emit();
    if(merged) toast(MSG.merged);
    return true;
  }

  /* ── 보고 있는 집의 공개 책 ── */
  async function runView(code, vg, numbered){
    const g = gen;
    viewSt.load = LOAD.LOADING; viewSt.books = [];
    emit();
    let got;
    try{ got = await api.fetchBookshelfOf(code); }
    catch(e){
      if(g !== gen || vg !== viewSt.gen) return false;
      const f = failOf(e);
      if(f.kind === KIND.MISSING){ viewSt.load = LOAD.MISSING; viewSt.books = []; }   // 없는 사람 — 폴더를 숨긴다(번호 없음)
      else{
        viewSt.load = LOAD.FAILED;
        if(numbered) report(e, 'load');   // 구경을 시작하며 받다 실패하면 조용히 — 누른 [다시 시도] 가 또 실패할 때만 번호
      }
      emit();
      return true;
    }
    if(g !== gen || vg !== viewSt.gen) return false;
    viewSt.books = got.books; viewSt.load = LOAD.READY;
    emit();
    return true;
  }
  function openView(code){
    const vg = ++viewSt.gen;
    viewSt.owner = code || null;
    if(!code){ viewSt.load = LOAD.IDLE; viewSt.books = []; emit(); return Promise.resolve(false); }
    return runView(code, vg, false);
  }
  function retryView(){
    if(!viewSt.owner || viewSt.load === LOAD.LOADING) return Promise.resolve(false);
    const vg = ++viewSt.gen;
    return runView(viewSt.owner, vg, true);
  }
  function closeView(){ viewSt.gen++; viewSt.owner = null; viewSt.load = LOAD.IDLE; viewSt.books = []; }

  /* ── 고치기 ── 받은 뒤에만(받는 중 · 못 받음 · 409 뒤 다시 받는 중은 잠김) */
  const editable = () => mineSt.load === LOAD.READY;

  /* 책 목록 통째로 바꾸고 저장한다. 새 책이 늘어 상한을 넘으면 요청 없이 'full'(옛 홈이 이미 넘었으면 빼기 · 순서는 된다) */
  function put(books){
    if(!editable() || !Array.isArray(books)) return Promise.resolve('locked');
    if(books.length > BOOKS && books.length > mineSt.books.length) return Promise.resolve('full');
    mineSt.books = copyBooks(books);
    emit();
    return commit();
  }

  /* ── 저장 ── 한 번에 하나 · 저장 중 고침은 끝난 뒤 최신으로 한 번 */
  function commit(){
    if(saving){ again = true; return saveP; }
    saveP = runSave();
    return saveP;
  }
  async function runSave(){
    const g = gen;
    saving = true;
    let res = 'failed';
    let fail = null;
    for(;;){
      again = false;
      let got;
      try{ got = await api.putBookshelf(mineSt.version, mineSt.books); }
      catch(e){ fail = e; break; }
      if(g !== gen) return 'stale';
      mineSt.version = got.version;
      failing = false;
      if(!again){ mineSt.books = got.books; res = 'ok'; break; }   // 기다리는 사이 또 고쳤으면 화면 책(최신)을 새 판으로 한 번 더
    }
    if(g !== gen) return 'stale';
    saving = false; again = false;
    if(fail){
      const f = failOf(fail);
      if(f.kind === KIND.STALE) res = 'stale';
      else if(f.kind === KIND.CONFLICT){
        res = 'conflict';
        failing = false;
        mineSt.load = LOAD.FAILED;   // 받는 동안 고치기가 잠긴다 — 못 받으면 서랍의 [다시 시도]
        await pullMine({ merged: true });
        return res;
      }else{
        if(!failing){
          if(f.kind === KIND.COMMON) apiErrors.notify(fail, lib.ERRORS);
          else SITE.save(fail);
        }
        failing = true;
      }
    }
    emit();
    return res;
  }

  /* 그림 올리기 — 주소만 돌려준다(저장은 put). 올리는 동안 계정이 바뀌면 stale */
  async function uploadImage(dataUrl){
    const g = gen;
    try{
      const url = await api.uploadImage(dataUrl);
      if(g !== gen) return { ok: false, stale: true };
      return { ok: true, url };
    }catch(e){
      if(g !== gen) return { ok: false, stale: true };
      const f = failOf(e);
      if(f.kind === KIND.STALE) return { ok: false, stale: true };
      if(f.kind === KIND.COMMON){ apiErrors.notify(e, lib.ERRORS); return { ok: false, notified: true }; }   // 공통 번호는 알렸다 — 화면이 그 자리 번호(E-MH-24)를 또 띄우지 않게
      return { ok: false };
    }
  }

  /* 못 올린 고침을 한 번 — 저장 중이면 그 끝(+ 그 사이 고침 한 번)을 기다린다. 되풀이 없음 */
  function flush(){
    if(saving) return saveP;
    if(failing && editable()) return commit();
    return Promise.resolve('none');
  }

  function reset(){
    gen++;
    viewSt.gen++;
    api.reset();
    mineSt.load = LOAD.IDLE; mineSt.books = []; mineSt.version = 0;
    saving = false; again = false; failing = false; saveP = null; pullP = null;
    viewSt.owner = null; viewSt.load = LOAD.IDLE; viewSt.books = [];
    emit();
  }

  return {
    mine: () => ({ load: mineSt.load, books: copyBooks(mineSt.books), version: mineSt.version, saving: saving || again }),
    view: () => ({ owner: viewSt.owner, load: viewSt.load, books: copyBooks(viewSt.books) }),
    onChange(fn){ subs.push(fn); return () => { const i = subs.indexOf(fn); if(i >= 0) subs.splice(i, 1); }; },
    pullMine, openView, retryView, closeView, put, uploadImage, flush, reset,
    LOAD, MSG, BOOKS,
  };
}

const api = { createBookshelfStore, LOAD, MSG };
if(typeof window !== 'undefined') window.TwBookshelfStore = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
