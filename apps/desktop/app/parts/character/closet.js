/* closet.js — 🧬 옷장(슬롯 5칸 · 보관함 · 휴지통) — 서버 원본 (검사 sim-closet.js)
   책임: 화면의 슬롯 캐릭터(slots[])를 서버 옷장과 이어 준다 — 시작할 때 서버에서 받아 앉히고, 캐릭터를 고치면 3초 묶음으로 서버에 쓰고,
     슬롯 ↔ 보관함 · 휴지통 · 되살리기는 동작 하나에 서버 요청 하나로 한다. 보관함 목록 · 휴지통 목록은 서버가 준 머리(섬네일)로 그리고 def 는 올릴 때만 받는다.
   서버가 원본이다: 이 PC 에 캐릭터 저장본 · 보관함 사본 · 고친 시각 · 백업 · 충돌 판정이 없다(0.12 의 slot-sync.js · chars.js 의 맞추기 장치는 걷었다).
     올릴 칸 수 · 보관함 20 · 휴지통 기한 · 같이 고친 충돌(낡은 판이어도 받고 앞 모습은 서버 휴지통 «연동 교체» 10일)은 서버가 정한다.
   받는 때: 시작할 때(startCloset — 계정 확인 뒤 app-boot) · 서버 신호 `avatars` · 사용자가 «다시 시도» 를 누를 때. 주기도 대기 타이머도 없고 실패 뒤 혼자 되풀이하지 않는다.
   쓰는 때: saveSlots 가 «달라졌다» 고 알린 뒤 3초 묶음 1회(바뀐 칸만 — 새 칸은 만들기 · 있는 칸은 고치기) · 슬롯 ↔ 보관함 · 휴지통 · 되살리기는 누른 즉시.
     받기 전(idle · loading · failed)에는 아무것도 쓰지 않는다. 지우는 것은 명시한 동작(휴지통 이동)뿐 — 화면에서 칸이 비었다고 서버 캐릭터를 지우지 않는다.
   저장 한 번에 하나: 올리는 중에 또 고치면 끝난 뒤 최신으로 한 번 더. 같이 고친 충돌은 409 가 아니다 — 받은 판(known.version)을 실어 보내면 서버가 받는다.
     받기 중 내가 아직 못 올린 고침이 있는 칸은 덮지 않는다(그 칸은 올릴 때 서버가 앞 모습을 휴지통에 남긴다).
   실패(저장 · 옮기기 · 받기)는 오류 번호로 한 번만 알린다(E-CHAR-16~19) — 이어지는 같은 실패는 다시 안 띄운다.
   deps: closetApi · codec(slot-codec.js) · roomFaceCache{ load, save } · slots · CHAR_SLOT_MAX · slotSave{ applySlotObjs, lastOut, onSaved, pullForward, _relinkSeatsToSlots, slotsReplaced } ·
         getMyUserId · rtOn · toast · notifyError · renderLauncher · creatorOpen(읽는 함수) · migrate 에 쓰는 storage(localStorage)
   내놓는 것: startCloset · pullCloset(notify) · state() · boxItems() · boxCount() · boxFull() · moveToBox(i) · boxToSlot(avatarId) · trashSlot(i) · trashBox(ids) ·
     trashRows() · restore(trashId) · onChange(fn) · resetCloset() · legacyStep() · unsavedCount() · flushSlots() · waitFlush() · requireReady() · BOX_MAX · deleteWords() · reportFail(r)
   ⚠️ 전역 이름은 TwCloset. 만들 때는 요청 · 구독 · 타이머를 하지 않는다 — 시작은 startCloset 한 번(app-boot).
   검사: checks/sim-closet.js */
(function(){

function createCloset(deps){
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const closetApi = deps.closetApi;
const codec = deps.codec;
const roomFaceCache = deps.roomFaceCache;
const slots = deps.slots;
const slotSave = deps.slotSave;
const getMyUserId = deps.getMyUserId;
const rtOn = deps.rtOn;
const toast = deps.toast;
const notifyError = deps.notifyError;
const renderLauncher = deps.renderLauncher;
const creatorOpen = deps.creatorOpen;
const storage = deps.storage;

const BOX_MAX = 20;                    // 서버 규격(슬롯 밖 캐릭터) — 화면 문구 «보관함 (n/20)»
const SAVE_DEBOUNCE_MS = 3000;
const TRASH_PAGES_MAX = 4;             // 휴지통은 쪽을 이어 받되 상한이 있다(서버 쪽 크기 50)
const LEGACY_DONE_KEY = 'tw.legacyCloset013';   // 이 PC 에서 옛 캐릭터를 이 계정에 올렸다는 표시(값 = 계정 코드) — 다음 켤 때 건너뛴다
const DELETE_WORDS = Object.freeze({ btn: '휴지통 이동', ask: '휴지통으로 옮길까요? 3일 뒤 사라져요', done: '휴지통으로 옮겼어요', gear: '보관함 이동 / 캐릭터 수정 / 휴지통 이동' });

let heads = [];                                          // 서버 머리 전부(슬롯 + 보관함)
const known = new Array(CHAR_SLOT_MAX).fill(null);       // 칸마다 마지막으로 서버와 맞춘 { avatarId, version, sig }
let load = 'idle';                                       // 'idle' | 'loading' | 'ready' | 'failed'
const taken = new Set();   // 새 캐릭터를 올리려다 «그 칸에 이미 있다»(AVATAR_SLOT_TAKEN)고 거절당한 칸 — 다음 받기가 서버 캐릭터로 앉힌다
let unsubRt = null;   // 서버 신호 구독 해제 함수 — 계정이 바뀌면 풀어 구독이 겹치지 않게
let started = false, pulling = false, pullAgain = false, gen = 0;
let saveTimer = null, flushing = false, flushAgain = false, saveFailShown = false, busy = false;
const changeFns = [];
let pullWaiters = [];   // 도는 받기가 끝나기를 기다리는 약속들(첫 실행 올리기가 받기 뒤에 도는 데 쓴다)
let idleWaiters = [];   // 옮기기 · 휴지통 같은 동작이 끝나기를 기다리는 약속들(쓰기가 칸 번호가 당겨지는 동안 돌지 않게)
const waitIdle = () => (busy ? new Promise(res => { idleWaiters.push(res); }) : Promise.resolve());
function endBusy(){ busy = false; const w = idleWaiters; idleWaiters = []; w.forEach(fn => fn()); }
let flushWaiters = [];   // 도는 쓰기가 끝나기를 기다리는 약속들(보관함 이동이 고침을 먼저 올릴 때)
const waitFlush = () => (flushing ? new Promise(res => { flushWaiters.push(res); }) : Promise.resolve());
const quiet = async () => { while(flushing) await waitFlush(); };   // 칸 번호가 바뀌는 동작은 도는 쓰기가 끝난 뒤에 시작한다
const waitPull = () => (pulling ? new Promise(res => { pullWaiters.push(res); }) : Promise.resolve());
function onChange(fn){ changeFns.push(fn); }
function changed(){ changeFns.forEach(fn => { try{ fn(); }catch(e){ console.warn('[옷장] 알림 실패', e); } }); }

const sigOf = (o) => { try{ return JSON.stringify(o); }catch(_){ return null; } };
const isDirty = (i) => { const o = slotSave.lastOut()[i]; if(!o) return false; const k = known[i]; return !k || k.sig !== sigOf(o); };

function boxHeads(){ return heads.filter(h => h.place === 'BOX').sort((a, b) => b.updatedAt - a.updatedAt); }
function boxItems(){ return load === 'ready' ? boxHeads().map(h => ({ avatarId: h.avatarId, mtime: h.updatedAt, thumbUrl: h.thumbUrl, faceUrl: h.faceUrl })) : null; }
function boxCount(){ return boxHeads().length; }
/* 20 문턱 — 보관함에 넣는 자리(보관함 이동 · 복원 · 새 캐릭터)마다 먼저 묻는다. 막으면 true. 받기 전에는 막지 않는다(서버가 거절한다). */
function boxFull(){
  if(load !== 'ready') return false;
  const n = boxCount();
  if(n < BOX_MAX) return false;
  try{ toast('보관함이 가득 찼어요 (' + n + '/' + BOX_MAX + ')'); }catch(_){}
  return true;
}

/* ── 서버 캐릭터 → 화면 칸 ── */
async function objOf(def){ return codec._slotFromServerObj(def); }

/* 받은 옷장을 화면 slots[] 에 앉힌다. 같은 캐릭터 · 같은 판이면 그대로 두고, 내가 못 올린 고침이 있는 칸은 덮지 않는다.
   @return 화면이 바뀌었나 */
async function applyCloset(c){
  while(flushing) await waitFlush();                               // 도는 쓰기가 끝난 뒤 앉힌다(칸 번호 · 받은 판이 쓰기와 엇갈리지 않게)
  heads = c.avatars;
  if(creatorOpen()) return false;                                  // 생성기가 열려 있으면 이번 판의 칸 갈아 끼우기는 건너뛴다(편집 중인 칸을 뺏지 않는다) — 다음 받기에 앉힌다
  const which = new Set(), objs = new Array(CHAR_SLOT_MAX).fill(null), skipRelink = new Set();
  const dropped = [];
  for(let i = 0; i < CHAR_SLOT_MAX; i++){
    const id = c.slots[i], k = known[i], here = !!slots[i];
    if(!id){
      if(k){ which.add(i); known[i] = null; dropped.push(i); skipRelink.add(i); }    // 다른 기기에서 지웠다 — 이 칸도 비운다
      continue;                                                                      // k 가 없고 here 면 아직 못 올린 새 캐릭터 — 그대로 둔다
    }
    const head = heads.find(h => h.avatarId === id);
    if(k && k.avatarId === id && k.version >= head.version) continue;                // 같은 판 · 늦게 온 낮은 판(방금 올린 고침보다 옛것) — 할 일 없음
    if(k && k.avatarId === id && isDirty(i)) continue;                               // 내 고침이 아직 안 올라갔다 — 덮지 않는다(올릴 때 서버가 앞 모습을 남긴다)
    if(!k && here && !taken.has(i)) continue;                                        // 이 칸에 아직 못 올린 새 캐릭터가 있다 — 올릴 때 칸이 차 있으면 서버가 거절한다(그때는 taken — 서버 것으로 앉힌다)
    taken.delete(i);
    try{ objs[i] = await objOf(c.defs[id]); }
    catch(e){ console.warn('[옷장] ' + (i + 1) + '번 칸 그림을 받지 못했어요', e); throw e; }
    which.add(i);
    if(!(k && k.avatarId === id)) skipRelink.add(i);                                 // 다른 캐릭터가 됐다 — 책상 위 좌석은 다음 실행에 바뀐다
    known[i] = { avatarId: id, version: head.version, sig: null };
  }
  if(!which.size) return false;
  const oldSlots = slots.slice();
  await slotSave.applySlotObjs(objs, which);
  // 서버 판은 받은 모양으로 적는다 — 앉히는 중 onLoaded(가챠 회수 등)가 칸을 고쳤으면 그 칸은 «고침» 으로 남아 올라간다
  for(const i of which) if(known[i]) known[i].sig = sigOf(objs[i]);
  slotSave._relinkSeatsToSlots(oldSlots, skipRelink);
  return true;
}

/* ── 받기 ── */
/* 서버 옷장 받기 — 시작 · 서버 신호 · 다시 시도. notify=true(사용자가 누른 받기)면 실패에 오류 번호를 띄운다.
   @return 'ready' | 'failed' | 'skipped' */
async function pullCloset(notify){
  if(!getMyUserId()) return 'skipped';
  if(pulling){ pullAgain = true; return 'skipped'; }
  pulling = true;
  if(load !== 'ready'){ load = 'loading'; changed(); }
  let res = 'failed';
  try{
    const g = gen;
    let c;
    try{ c = await closetApi.load(); }
    catch(e){
      console.warn('[옷장] 서버에서 받기 실패', e && (e.code || e.kind));
      if(load === 'loading') load = 'failed';
      if(notify) notifyError('E-CHAR-16', e);
      return res;
    }
    if(g !== gen){ res = 'skipped'; return res; }                 // 받는 사이 옮기기 · 비우기가 끝났다 — 이 답은 옛 상태
    const wasReady = load === 'ready';
    let did = false;
    try{ did = await applyCloset(c); }
    catch(e){ if(load === 'loading') load = 'failed'; if(notify) notifyError('E-CHAR-16', e); return res; }
    load = 'ready';
    res = 'ready';
    if(did && !wasReady){ for(let i = 0; i < CHAR_SLOT_MAX; i++) if(isDirty(i)){ scheduleSave(); break; } }   // 첫 받기 중의 고침은 그때 저장 예약이 물러났다 — 받은 뒤 한 번
    if(did){
      try{ renderLauncher(); }catch(_){}
      try{ slotSave.slotsReplaced(); }catch(_){}
      if(wasReady) try{ toast('☁️ 다른 기기에서 바꾼 캐릭터를 받아왔어요 — 책상 위 캐릭터는 앱을 다시 실행하면 바뀌어요'); }catch(_){}
    }
    return res;
  }finally{
    pulling = false;
    changed();
    const ws = pullWaiters; pullWaiters = []; ws.forEach(fn => fn());
    const again = pullAgain; pullAgain = false;
    if(again && res !== 'failed') pullCloset(false);                // 실패 뒤에는 되풀이하지 않는다
  }
}

/* 서버에 아직 못 올린 고침이 있는 캐릭터 수 — 로그아웃 검문이 센다. 받기 전이면 쓴 것이 없어 0. 이미지 복원에 실패한 칸은 올리지 않으니 세지 않는다. */
function unsavedCount(){
  if(load !== 'ready') return 0;
  let n = 0;
  for(let i = 0; i < CHAR_SLOT_MAX; i++) if(!(slots[i] && slots[i]._imgBroken) && isDirty(i)) n++;
  return n;
}

/* ── 쓰기 (고친 칸 → 서버) ── */
function failNotice(e, onceKey){
  const code = e && e.code;
  if(code === 'OWNER_CHANGED') return;                              // 계정이 바뀌는 중 — 조용히 버린다
  if(saveFailShown) return;                                         // 이어지는 같은 실패는 한 번만
  saveFailShown = true;
  if(code === 'AVATAR_ITEM_NOT_USABLE') notifyError('E-CHAR-19', e);
  else if(code === 'AVATAR_DEF_TOO_LARGE' || onceKey === 'size') notifyError('E-CHAR-18', e);
  else notifyError('E-CHAR-17', e);
}
function scheduleSave(){
  if(load !== 'ready') return;
  if(flushing){ flushAgain = true; return; }
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; flushSlots(); }, SAVE_DEBOUNCE_MS);
}
/* 바뀐 칸만 올린다. 빈 칸은 지우지 않는다(지우기는 휴지통 이동뿐). 이미지 복원에 실패한 칸은 건너뛴다(빈 그림이 서버에 굳지 않게).
   @return 못 올린 칸이 있었나 */
async function flushSlots(inner){
  if(load !== 'ready') return false;
  /* 옮기기 · 휴지통 · 받아 앉히기가 도는 동안은 기다린다 — 칸 번호가 당겨지는 중에 쓰면 엉뚱한 칸에 적힌다. 그 동작 안에서 부르는 길(inner)은 기다리지 않는다 */
  if(!inner) while(busy || pulling){ if(busy) await waitIdle(); else await waitPull(); }
  if(load !== 'ready') return false;
  if(flushing){ flushAgain = true; return false; }
  const uid = getMyUserId();
  if(!uid) return false;
  flushing = true;
  let failed = false, needPull = false;
  try{
    const g = gen;
    for(let i = 0; i < CHAR_SLOT_MAX; i++){
      if(g !== gen) return failed;                                    // 계정이 바뀌었다 — 멈춘다
      const o = slotSave.lastOut()[i];
      if(!o || (slots[i] && slots[i]._imgBroken)) continue;
      const sig = sigOf(o), k = known[i];
      if(sig === null || (k && k.sig === sig)) continue;
      const faceSt = roomFaceCache.load(), glbSt = codec._slotGlbCacheLoad();
      let so = null;
      try{ so = await codec._slotToServerObj(uid, o, faceSt, glbSt); }catch(e){ so = null; }
      roomFaceCache.save(faceSt); codec._slotGlbCacheSave(glbSt);      // 올린 만큼은 실패해도 기억해 둔다
      if(!so){ failed = true; failNotice(Object.assign(new Error('그림 올리기 실패'), { code: 'IMAGE_UPLOAD' })); continue; }
      let len = 0; try{ len = JSON.stringify(so).length; }catch(_){ len = Infinity; }
      if(len > codec.SLOT_JSON_MAX){ failed = true; failNotice(new Error('너무 큼'), 'size'); continue; }
      if(g !== gen) return failed;
      try{
        if(!k){
          const r = await closetApi.create(i, so);
          if(g !== gen) return failed;
          known[i] = { avatarId: r.avatarId, version: r.version, sig };
          heads = heads.filter(h => h.avatarId !== r.avatarId).concat([{ avatarId: r.avatarId, place: 'SLOT', slot: i, version: r.version, thumbUrl: so.thumbUrl || null, faceUrl: so.faceUrl || null, updatedAt: Date.now(), legacyCid: null }]);
        }else{
          const id = k.avatarId;
          const r = await closetApi.update(id, k.version, so);
          if(g !== gen) return failed;
          const at = known.findIndex(x => x && x.avatarId === id);   // 기다리는 사이 칸이 당겨졌어도 캐릭터(id)로 자리를 다시 찾아 적는다
          if(at < 0){ needPull = true; continue; }                  // 그 캐릭터가 이 옷장에서 빠졌다 — 적지 않고 다시 받는다
          known[at] = { avatarId: id, version: r.version, sig };
        }
        saveFailShown = false;
      }catch(e){
        failed = true;
        console.warn('[옷장] ' + (i + 1) + '번 칸 저장 실패', e && (e.code || e.kind));
        if(e && e.code === 'AVATAR_SLOT_TAKEN'){ taken.add(i); needPull = true; if(!saveFailShown){ saveFailShown = true; notifyError('E-CHAR-23', e); } }   // 다른 기기가 먼저 그 칸을 채웠다 — 서버 것을 받아 앉힌다
        else failNotice(e);
      }
    }
    if(needPull) pullCloset(false);
    return failed;
  }finally{
    flushing = false;
    const fw = flushWaiters; flushWaiters = []; fw.forEach(fn => fn());
    const again = flushAgain; flushAgain = false;
    if(again && !failed) scheduleSave();                              // 올리는 중에 또 고쳤다 — 최신으로 한 번 더
    changed();
  }
}
slotSave.onSaved((out, didChange) => { if(didChange) scheduleSave(); });

/* ── 명시한 동작 (슬롯 ↔ 보관함 · 휴지통 · 되살리기) — 동작 하나 = 서버 요청 하나 ── */
const WHY_BY_CODE = { AVATAR_BOX_FULL: 'full', AVATAR_SLOTS_FULL: 'slotsfull', AVATAR_NOT_FOUND: 'gone', AVATAR_TRASH_NOT_FOUND: 'gone' };
/* 동작 실패 → { ok:false, why } — «이미 없다» 면 다른 기기가 먼저 바꾼 것이니 목록을 한 번 다시 받는다 */
function failOp(e){ const why = whyOf(e); if(why === 'gone') pullCloset(false); return { ok: false, why, err: e && e.code }; }
function whyOf(e){ const code = e && e.code; return WHY_BY_CODE[code] || (e && (e.kind === 'unavailable' || e.kind === 'notReady') ? 'net' : 'err'); }

/* 칸 i 를 비우고 뒤 칸을 당긴다 — 서버가 같은 규칙으로 당긴다(옛 앱 · 런처의 «삭제 후 당기기» 와 같다) */
function pullForward(i){
  slotSave.pullForward(i);
  for(let k = i; k < CHAR_SLOT_MAX - 1; k++) known[k] = known[k + 1];
  known[CHAR_SLOT_MAX - 1] = null;
}
/* 서버가 돌려준 칸 배치와 우리 배치가 다르면 한 번 다시 받는다(다른 기기가 사이에 바꿨다) */
function checkLayout(c){
  const same = c.slots.every((id, k) => (known[k] ? known[k].avatarId : null) === id);
  if(!same) pullCloset(false);
}
/* 올리지 못한 고침이 있으면 먼저 올린다 — 슬롯에서 내리면 그 고침이 이 화면에서 사라진다. 못 올리면 false. */
async function settleSlot(i){
  if(!isDirty(i)) return true;
  if(saveTimer){ clearTimeout(saveTimer); saveTimer = null; }
  if(flushing) await waitFlush();
  await flushSlots(true);
  return !isDirty(i) && !!known[i];
}
function guard(){
  if(load !== 'ready') return { ok: false, why: 'off' };
  if(busy) return { ok: false, why: 'busy' };
  return null;
}

async function moveToBox(i){
  await quiet();
  const g = guard(); if(g) return g;
  if(!(i >= 0 && i < CHAR_SLOT_MAX) || !slots[i]) return { ok: false, why: 'nocid' };
  if(boxCount() >= BOX_MAX) return { ok: false, why: 'full' };
  busy = true;
  try{
    if(!(await settleSlot(i))) return { ok: false, why: 'dirty' };
    const id = known[i].avatarId, gg = gen;
    let c;
    try{ c = await closetApi.move(id, 'BOX'); }catch(e){ return failOp(e); }
    if(gg !== gen) return { ok: false, why: 'off' };
    heads = c.avatars;
    pullForward(i);
    checkLayout(c);
    changed();
    return { ok: true, slot: i };
  }finally{ endBusy(); }
}
async function trashSlot(i){
  await quiet();
  const g = guard(); if(g) return g;
  if(!(i >= 0 && i < CHAR_SLOT_MAX) || !slots[i]) return { ok: false, why: 'nocid' };
  busy = true;
  try{
    const k = known[i];
    if(k){
      let r;
      try{ r = await closetApi.trash([k.avatarId]); }catch(e){ return failOp(e); }
      if(!r.length || (!r[0].ok && r[0].code !== 'AVATAR_NOT_FOUND')) return { ok: false, why: 'err' };   // 이미 없다면 같은 결과(이 칸을 비운다)
      heads = heads.filter(h => h.avatarId !== k.avatarId);
    }
    pullForward(i);                                                  // 서버에 올린 적 없는 새 캐릭터는 화면에서만 지운다
    changed();
    return { ok: true, slot: i };
  }finally{ endBusy(); }
}
async function boxToSlot(avatarId){
  await quiet();
  const g = guard(); if(g) return g;
  if(!boxHeads().some(h => h.avatarId === avatarId)) return { ok: false, why: 'gone' };
  if(slots.every(s => s)) return { ok: false, why: 'slotsfull' };
  busy = true;
  try{
    const gg = gen;
    let c;
    try{ c = await closetApi.move(avatarId, 'SLOT'); }catch(e){ return failOp(e); }
    if(gg !== gen) return { ok: false, why: 'off' };
    const at = c.slots.indexOf(avatarId);
    if(at < 0) return { ok: false, why: 'err' };
    let obj;
    try{ obj = await objOf(c.defs[avatarId]); }catch(e){ pullCloset(false); return { ok: false, why: 'img' }; }   // 서버에서는 옮겨졌다 — 그림만 못 받았다
    heads = c.avatars;
    const objs = new Array(CHAR_SLOT_MAX).fill(null); objs[at] = obj;
    const head = heads.find(h => h.avatarId === avatarId);
    known[at] = { avatarId, version: head.version, sig: null };
    await slotSave.applySlotObjs(objs, new Set([at]));
    known[at].sig = sigOf(slotSave.lastOut()[at]);
    try{ renderLauncher(); }catch(_){}
    try{ slotSave.slotsReplaced(); }catch(_){}
    checkLayout(c);
    changed();
    return { ok: true, slot: at };
  }finally{ endBusy(); }
}
/* 보관함 캐릭터 여러 개를 한 번에 휴지통으로 — 요청 하나(25개까지) */
async function trashBox(ids){
  await quiet();
  const g = guard(); if(g) return Object.assign({ n: 0, fail: 0 }, g);
  const list = (Array.isArray(ids) ? ids : []).filter(id => boxHeads().some(h => h.avatarId === id));
  if(!list.length) return { ok: false, why: 'gone', n: 0, fail: 0 };
  busy = true;
  try{
    let r;
    try{ r = await closetApi.trash(list); }catch(e){ return Object.assign({ n: 0, fail: list.length }, failOp(e)); }
    const okIds = new Set(r.filter(x => x.ok || x.code === 'AVATAR_NOT_FOUND').map(x => x.id));
    heads = heads.filter(h => !okIds.has(h.avatarId));
    changed();
    return { ok: okIds.size > 0, n: okIds.size, fail: list.length - okIds.size };
  }finally{ endBusy(); }
}
/* 휴지통 목록 — 쪽을 이어 받는다(상한 TRASH_PAGES_MAX). 못 받으면 던진다(빈 휴지통 ≠ 못 읽음). */
async function trashRows(){
  let cursor = null; const rows = [];
  for(let p = 0; p < TRASH_PAGES_MAX; p++){
    const r = await closetApi.trashPage({ cursor, limit: 50 });
    rows.push(...r.items);
    if(!r.nextCursor) break;
    cursor = r.nextCursor;
  }
  return rows;
}
async function restore(trashId){
  await quiet();
  const g = guard(); if(g) return g;
  if(boxCount() >= BOX_MAX) return { ok: false, why: 'full' };
  busy = true;
  try{
    let r;
    try{ r = await closetApi.restore(trashId); }catch(e){ return failOp(e); }
    /* 서버가 옷장을 같이 돌려주면 그대로 앉히고, avatarId 만 주는 모양이면 옷장을 한 번 다시 받는다 — 판 · 시각을 앱이 지어 넣지 않는다 */
    if(r.closet){ heads = r.closet.avatars; checkLayout(r.closet); changed(); }
    else pullCloset(false);
    return { ok: true, avatarId: r.avatarId };
  }finally{ endBusy(); }
}

/* 동작 실패 알림 한 곳 — 런처 톱니와 [내 정보]가 같이 쓴다.
   · 사용자가 할 수 있는 안내(받기 전 · 앞 동작 도는 중 · 보관함/슬롯 가득 · 못 올린 고침 · 이미 바뀜)는 토스트 그대로.
   · 요청이 실패한 것(서버에 닿지 못함 E-CHAR-20 · 서버가 못 함 E-CHAR-21 · 그림 받기 E-CHAR-22)은 오류 번호로. */
const MSG = Object.freeze({
  off: '보관함을 아직 불러오지 못했어요 — 잠시 뒤 다시 눌러 주세요',
  busy: '앞의 옮기기가 끝나는 중이에요 — 잠시만요',
  full: '보관함이 가득 찼어요 (' + BOX_MAX + '/' + BOX_MAX + ')',
  dirty: '방금 고친 모습을 계정에 올리지 못했어요 — 잠시 뒤 다시 눌러 주세요',
  slotsfull: '슬롯이 꽉 차서 이동할 수 없어요. 슬롯을 먼저 비워 주세요 — 런처 톱니 [보관함 이동]',
  gone: '이미 다른 곳에서 바뀌었거나 기한이 지났어요 — 목록을 새로 받아 올게요',
  nocid: '옮길 캐릭터를 찾지 못했어요',
});
function reportFail(r){
  const w = r && r.why;
  if(MSG[w]){ toast(MSG[w]); return; }
  if(w === 'net') notifyError('E-CHAR-20', r);
  else if(w === 'img') notifyError('E-CHAR-22', r);
  else notifyError('E-CHAR-21', r);
}

/* 만들기 · 편집 앞에서 — 옷장을 받은 뒤(ready)에만 연다. 받기 전이면 «불러오는 중» 을 알리고, 못 받았으면(failed · idle) 이 누름이 «다시 시도» 라 다시 받는다(실패하면 오류 번호).
   받기 전에 만든 새 캐릭터는 저장 자리를 몰라 영영 저장되지 않는다 — 막는 것이 서버 값을 지키는 길이다. */
function requireReady(){
  if(load === 'ready') return true;
  if(load === 'loading'){ try{ toast('캐릭터를 불러오는 중이에요 — 잠시 뒤 다시 눌러 주세요'); }catch(_){} return false; }
  pullCloset(true);
  return false;
}

/* ── 시작 · 비우기 ── */
/* 🚀 계정 확인 뒤 한 번(launcher/app-boot.js) — 서버에서 받고 서버 신호(avatars)를 듣는다. 두 번 불려도 구독은 한 번. */
function startCloset(){
  if(started) return;
  started = true;
  unsubRt = rtOn('avatars', () => { pullCloset(false); });
  pullCloset(false);
}
/* 로그아웃 · 계정 바뀜 — 메모리를 비운다(이 PC 에 남는 캐릭터 저장본은 없다). 구독은 여기서 푼다. */
function resetCloset(){
  if(saveTimer){ clearTimeout(saveTimer); saveTimer = null; }
  taken.clear(); heads = []; known.fill(null); load = 'idle'; gen++;
  pullAgain = false; flushAgain = false; saveFailShown = false; started = false; endBusy();
  if(unsubRt){ unsubRt(); unsubRt = null; }
  closetApi.reset();
  changed();
}

/* ── 0.13 첫 실행 — 이 PC 에 남은 옛 캐릭터(슬롯 5칸 · 보관함)를 이 계정 옷장에 한 번 올린다 (first-run-013.js 의 legacySync 단계) ──
   서버가 «이미 받았다»(AVATAR_LEGACY_SYNC_DONE)고 하면 같은 결과다 — 다시 해도 같게. 올린 뒤에야 옛 키를 지워도 된다고 알린다(wipe). */
const LEGACY_SLOTS_KEY = 'deskFriends.slots.v1';
const LEGACY_BOX_KEY = 'deskFriends.chars.v1';
const LEGACY_DESK_KEY = 'deskFriends.chars.desk';
const LEGACY_TS_KEY = 'deskFriends.slots.ts';
const LEGACY_KEY_PREFIXES = Object.freeze(['deskFriends.slots.', 'deskFriends.chars.', 'tw.charsLinked', 'tw.charsMoveFails']);   // 캐릭터 몫만 — 가챠 옛 키는 first-run-013.js 의 gacha 단계가 맡는다
function readJson(k, dflt){ try{ const v = JSON.parse(storage.getItem(k) || 'null'); return v == null ? dflt : v; }catch(_){ return dflt; } }
function legacyKeys(){
  const out = [];
  try{ for(let i = 0; i < storage.length; i++){ const k = storage.key(i); if(k && LEGACY_KEY_PREFIXES.some(p => k.indexOf(p) === 0)) out.push(k); } }catch(_){}
  return out;
}
async function legacyStep(){
  const uc = getMyUserId();
  if(!uc) return { ok: false, reason: '내 코드 없음' };
  if(storage.getItem(LEGACY_DONE_KEY) === uc) return { ok: true, wipe: legacyKeys() };
  const wipe = legacyKeys();
  const rawSlots = readJson(LEGACY_SLOTS_KEY, []);
  const box = readJson(LEGACY_BOX_KEY, {});
  const desk = readJson(LEGACY_DESK_KEY, []);
  const hasSlots = Array.isArray(rawSlots) && rawSlots.some(Boolean);
  const hasBox = !!box && typeof box === 'object' && Object.keys(box).some(c => box[c] && typeof box[c].def === 'string');
  if(!hasSlots && !hasBox){ try{ storage.setItem(LEGACY_DONE_KEY, uc); }catch(_){} return { ok: true, wipe }; }
  if(load !== 'ready') await waitPull();   // 켜는 차례에서 받기와 같이 시작한다 — 받기가 끝난 뒤에 올린다
  if(load !== 'ready') return { ok: false, reason: '옷장을 받기 전' };
  const slotTs = Number(storage.getItem(LEGACY_TS_KEY)) || 0;
  const faceSt = roomFaceCache.load(), glbSt = codec._slotGlbCacheLoad();
  const items = [];
  const onDesk = new Set();
  for(let i = 0; i < CHAR_SLOT_MAX; i++){
    const o = Array.isArray(rawSlots) ? rawSlots[i] : null;
    if(!o) continue;
    const so = await codec._slotToServerObj(uc, o, faceSt, glbSt);
    roomFaceCache.save(faceSt); codec._slotGlbCacheSave(glbSt);
    if(!so) return { ok: false, reason: (i + 1) + '번 칸 그림을 올리지 못했다' };
    const cid = (Array.isArray(desk) && typeof desk[i] === 'string') ? desk[i] : null;
    if(cid) onDesk.add(cid);
    items.push({ legacyCid: cid, def: so, editedAt: slotTs || Date.now(), slot: i });
  }
  const boxRows = [];
  for(const cid in box){
    const e = box[cid];
    if(!e || typeof e.def !== 'string' || onDesk.has(cid)) continue;     // 묘비(def 없음) · 슬롯에도 있는 것은 위에서 올렸다
    let def = null; try{ def = JSON.parse(e.def); }catch(_){ def = null; }
    if(def && typeof def === 'object') boxRows.push({ legacyCid: cid, def, editedAt: Number(e.mtime) || slotTs || Date.now(), slot: null });
  }
  boxRows.sort((a, b) => b.editedAt - a.editedAt);
  for(const r of boxRows){ if(items.length >= 25) break; items.push(r); }
  let c = null;
  try{ c = await closetApi.legacySync(items); }
  catch(e){
    if(e && e.code === 'AVATAR_LEGACY_SYNC_DONE'){ try{ storage.setItem(LEGACY_DONE_KEY, uc); }catch(_){} return { ok: true, wipe }; }
    return { ok: false, reason: String((e && (e.code || e.message)) || e) };
  }
  try{ storage.setItem(LEGACY_DONE_KEY, uc); }catch(_){}
  try{ await applyCloset(c); renderLauncher(); slotSave.slotsReplaced(); changed(); }catch(e){ console.warn('[옷장] 올린 뒤 받아 앉히기 실패', e); }
  return { ok: true, wipe };
}

return {
  startCloset, pullCloset, resetCloset, onChange,
  state: () => load,
  boxItems, boxCount, boxFull, BOX_MAX,
  moveToBox, boxToSlot, trashSlot, trashBox, trashRows, restore, reportFail,
  deleteWords: () => DELETE_WORDS,
  legacyStep, flushSlots, waitFlush, unsavedCount, requireReady,
  test: { known: () => known.slice(), heads: () => heads.slice(), isDirty },
};
}

const api = { createCloset };
if(typeof window !== 'undefined') window.TwCloset = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
