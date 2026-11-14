/* mallang-store.js — 🧸 말랑이 칸 상태 주인 — 내 칸(받기 · 등록 · 켜고 끄기 · 지우기 · 저장) · 보고 있는 집 칸 (검사 sim-mallang-store.js)
   책임: 말랑이 칸의 «원본은 서버» — 앱은 받아서 보여 주고, 고치면 통째로 저장한다(PUT 판 version). 화면(mallang.js)은 값을 직접 고치지 않고
     add(그림) · toggle(i) · remove(i) 를 부른다. 칸 차례 = 화면 차례 — 저장할 때 provider 가 0부터 다시 매기고(지우면 뒤 칸이 당겨진다),
     저장이 끝나면 서버가 돌려준 칸(slot 번호 포함)을 그대로 다시 받는다(앱이 칸 번호를 따로 기억해 어긋나지 않게).
     보고 있는 집: 내 집이면 내 칸을 가리키고(사본 없음), 남의 집이면 그 집 칸을 받는다. 집을 옮길 때마다 gen 이 올라 늦게 온 앞 집 답은 버린다.
   저장 규칙: 한 번에 하나 — 저장 중에 또 고치면(again) 끝난 뒤 최신으로 한 번 더(같은 판으로 두 번 보내면 두 번째가 409 다).
     409 CONCURRENT_UPDATE 는 다른 기기가 먼저 고친 것 — 내 고침은 버리고, 고치기를 잠근 채 서버 것을 받아 그리고 알린다.
     실패는 고친 화면을 그대로 두고 E-GIFT-03 을 한 번(이어지는 실패는 한 번 · 성공하면 풂). 혼자 다시 보내지 않는다 — 다음 고침 · 로그아웃 올리기(flush) · 앱 끄기가 한 번.
     저장 중이거나 못 올린 고침이 있을 때 내 칸 받기는 요청하지 않는다(받은 판이 고친 칸을 덮지 않게).
   deps: api — createGiftApi 가 돌려준 것(gift-api.js — fetchMine · fetchOf · uploadImage · saveMallangs · reset)
         giftLib — TwGiftApi(failOf · KIND · ERRORS · LIMITS) · errs — TwApiErrors(failOf 의 공통 code 표)
         apiErrors — TwApiErrors.store(공통 code 번호 알림 — notify(err, 표)) · notifyError — TwErrorCodes.notify · toast(msg)
   내보냄: createMallangStore(deps) → {
     mine() → { load, slots:[{ slot?, imageUrl, enabled }], version, saving, uploading } (복사본) · view() → { owner, mine(내 집인가), load, slots }
     onChange(fn) → 해제 함수 · pullMine({ site }?) → Promise<boolean>(지금 내 칸이 ready 인가 — 실패 번호 자리 site: 'load'(E-GIFT-01 · 기본) | 'sendOpen'(E-GIFT-07))
     openView(code, isMine) → Promise<boolean>(답이 왔을 때 아직 그 집인가) · closeView()
     add(dataUrl) · toggle(i) · remove(i) → Promise<'ok'|'failed'|'conflict'|'stale'|'locked'|'busy'|'full'|'uploadFailed'>
     flush() → Promise — 저장 중이면 그 끝을, 못 올린 고침이 있으면 한 번 올린다(로그아웃 올리기 · 앱 끄기) · reset() — 계정을 놓을 때
     LOAD · MSG · SLOTS(칸 상한 — giftLib.LIMITS.SLOTS 그대로)
   }
   ⚠️ 서버 상한(칸 4개)은 TwGiftApi.LIMITS.SLOTS 하나를 쓴다 — 여기 다시 적지 않는다. */
(function(){
'use strict';

const LOAD = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', FAILED: 'failed' });
const MSG = Object.freeze({ merged: '다른 기기에서 바꾼 내용을 받아왔어요' });

/** @param {{
 *   api: { fetchMine: Function, fetchOf: Function, uploadImage: Function, saveMallangs: Function, reset: Function },
 *   giftLib: { failOf: Function, KIND: Record<string, string>, ERRORS: object, LIMITS: { SLOTS: number } },
 *   errs: object, apiErrors: { notify: Function }, notifyError: (code: string, err?: any) => boolean, toast: (msg: string) => void,
 * }} deps */
function createMallangStore(deps){
  const api = deps.api;
  const giftLib = deps.giftLib;
  const errs = deps.errs;
  const apiErrors = deps.apiErrors;
  const notifyError = deps.notifyError;
  const toast = deps.toast;
  const KIND = giftLib.KIND;
  const SLOTS = giftLib.LIMITS.SLOTS;

  const subs = [];
  let gen = 0;   // reset 마다 오른다 — 앞 계정의 늦은 답이 새 계정 상태를 고치지 않게
  const mineSt = { load: LOAD.IDLE, slots: [], version: 0 };
  let saving = false, again = false, failing = false, uploading = false;
  let saveP = null, pullP = null;
  const viewSt = { owner: null, isMine: false, load: LOAD.IDLE, slots: [], gen: 0 };

  function emit(){
    for(const fn of subs.slice()){ try{ fn(); }catch(err){ console.warn('[말랑이] 받는 쪽 처리 실패', err); } }
  }
  const copySlots = (list) => list.map((s) => Object.assign({}, s));
  const failOf = (e) => giftLib.failOf(e, errs);

  /* 그 자리 번호 — 부르는 곳마다 하나(번호는 글자 그대로 — sim-error-codes 가 찾는다) */
  const SITE = Object.freeze({
    load: (e) => notifyError('E-GIFT-01', e),       // 내 칸 · 보는 집 칸 받기
    upload: (e) => notifyError('E-GIFT-02', e),     // 등록 ① 그림 올리기
    save: (e) => notifyError('E-GIFT-03', e),       // 등록 ② · 켜고 끄기 · 지우기
    sendOpen: (e) => notifyError('E-GIFT-07', e),   // 보내기 창 열기의 내 칸 받기
  });
  /* 실패 하나를 알린다 — 계정이 바뀌는 중(stale)은 조용히 · 공통 code 는 공통 번호 · 그 밖은 그 자리 번호 */
  function report(e, site){
    const f = failOf(e);
    if(f.kind === KIND.STALE) return f;
    if(f.kind === KIND.COMMON) apiErrors.notify(e, giftLib.ERRORS);
    else SITE[site](e);
    return f;
  }

  /* ── 내 칸 받기 ── */
  function pullMine(opts){
    const site = (opts && opts.site) || 'load';
    if(saving || again || failing) return Promise.resolve(mineSt.load === LOAD.READY);   // 고친 칸이 서버보다 새것이다 — 덮지 않는다
    if(pullP) return pullP;
    pullP = runPull(site, !!(opts && opts.merged)).finally(() => { pullP = null; });
    return pullP;
  }
  async function runPull(site, merged){
    const g = gen;
    mineSt.load = LOAD.LOADING;
    emit();
    let got;
    try{ got = await api.fetchMine(); }
    catch(e){
      if(g !== gen) return false;
      mineSt.load = LOAD.FAILED;
      report(e, site);
      emit();
      return false;
    }
    if(g !== gen) return false;
    mineSt.slots = got.slots; mineSt.version = got.version; mineSt.load = LOAD.READY;
    emit();
    if(merged) toast(MSG.merged);
    return true;
  }

  /* ── 보고 있는 집 ── */
  function openView(code, isMine){
    const vg = ++viewSt.gen;
    viewSt.owner = code || null; viewSt.isMine = !!isMine;
    if(isMine){ viewSt.load = LOAD.IDLE; viewSt.slots = []; return pullMine().then(() => vg === viewSt.gen); }
    viewSt.load = LOAD.LOADING; viewSt.slots = [];
    emit();
    const g = gen;
    return api.fetchOf(code).then((got) => {
      if(g !== gen || vg !== viewSt.gen) return false;
      viewSt.slots = got.slots; viewSt.load = LOAD.READY;
      emit();
      return true;
    }, (e) => {
      if(g !== gen || vg !== viewSt.gen) return false;
      const f = failOf(e);
      if(f.kind === KIND.MISSING){ viewSt.slots = []; viewSt.load = LOAD.READY; }   // 없는 사람 — «말랑이 없음»(번호 없음)
      else { viewSt.load = LOAD.FAILED; report(e, 'load'); }
      emit();
      return true;
    });
  }
  function closeView(){ viewSt.gen++; viewSt.owner = null; viewSt.isMine = false; viewSt.load = LOAD.IDLE; viewSt.slots = []; }

  /* ── 고치기 ── 받은 뒤에만(받는 중 · 못 받음 · 409 뒤 다시 받는 중은 잠김) */
  const editable = () => mineSt.load === LOAD.READY;

  function toggle(i){
    if(!editable() || !mineSt.slots[i]) return Promise.resolve('locked');
    mineSt.slots = mineSt.slots.map((s, k) => (k === i ? Object.assign({}, s, { enabled: !s.enabled }) : s));
    emit();
    return commit();
  }
  function remove(i){
    if(!editable() || !mineSt.slots[i]) return Promise.resolve('locked');
    /* 지우면 서버가 남은 칸을 0 부터 다시 매긴다 — 답이 오기 전(저장 실패 · 답 잃음 포함)에는 남은 칸의 서버 번호를 모른다. 옛 번호를 들고 있으면 보내기가 다른 그림을 보낸다 */
    mineSt.slots = mineSt.slots.filter((_, k) => k !== i).map((s) => { const c = Object.assign({}, s); delete c.slot; return c; });
    emit();
    return commit();
  }
  /* 그림 올리기 → 칸을 끝에 더하고 저장. 올리는 동안 또 누르면 busy(올린 그림이 어느 칸에 붙을지 흐려진다) */
  async function add(dataUrl){
    if(uploading) return 'busy';
    if(!editable()) return 'locked';
    if(mineSt.slots.length >= SLOTS) return 'full';
    const g = gen;
    uploading = true;
    emit();
    let url;
    try{ url = await api.uploadImage(dataUrl); }
    catch(e){
      if(g !== gen) return 'stale';
      uploading = false;
      const f = report(e, 'upload');
      emit();
      return f.kind === KIND.STALE ? 'stale' : 'uploadFailed';
    }
    if(g !== gen) return 'stale';
    uploading = false;
    if(!editable()){ emit(); return 'locked'; }   // 올리는 사이 409 로 다시 받는 중 — 그 판에 붙이지 않는다
    if(mineSt.slots.length >= SLOTS){ emit(); return 'full'; }
    mineSt.slots = mineSt.slots.concat([{ imageUrl: url, enabled: true }]);
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
      try{ got = await api.saveMallangs(mineSt.version, mineSt.slots); }
      catch(e){ fail = e; break; }
      if(g !== gen) return 'stale';
      mineSt.version = got.version;
      failing = false;
      if(!again){ mineSt.slots = got.slots; res = 'ok'; break; }   // 기다리는 사이 또 고쳤으면 화면 칸(최신)을 새 판으로 한 번 더
    }
    if(g !== gen) return 'stale';
    saving = false; again = false;
    if(fail){
      const f = failOf(fail);
      if(f.kind === KIND.STALE) res = 'stale';
      else if(f.kind === KIND.CONFLICT){
        res = 'conflict';
        failing = false;
        await pullMine({ merged: true });   // 받는 동안 load 가 loading 이라 고치기가 잠긴다
        return res;
      }else{
        if(!failing){
          if(f.kind === KIND.COMMON) apiErrors.notify(fail, giftLib.ERRORS);
          else SITE.save(fail);
        }
        failing = true;
      }
    }
    emit();
    return res;
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
    mineSt.load = LOAD.IDLE; mineSt.slots = []; mineSt.version = 0;
    saving = false; again = false; failing = false; uploading = false; saveP = null; pullP = null;
    viewSt.owner = null; viewSt.isMine = false; viewSt.load = LOAD.IDLE; viewSt.slots = [];
    emit();
  }

  return {
    mine: () => ({ load: mineSt.load, slots: copySlots(mineSt.slots), version: mineSt.version, saving: saving || again, uploading }),
    view: () => (viewSt.isMine
      ? { owner: viewSt.owner, mine: true, load: mineSt.load, slots: copySlots(mineSt.slots) }
      : { owner: viewSt.owner, mine: false, load: viewSt.load, slots: copySlots(viewSt.slots) }),
    onChange(fn){ subs.push(fn); return () => { const i = subs.indexOf(fn); if(i >= 0) subs.splice(i, 1); }; },
    pullMine, openView, closeView, add, toggle, remove, flush, reset,
    LOAD, MSG, SLOTS,
  };
}

const api = { createMallangStore, LOAD, MSG };
if(typeof window !== 'undefined') window.TwMallangStore = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
