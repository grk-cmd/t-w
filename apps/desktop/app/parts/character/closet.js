/* closet.js — 🧬 옷장(슬롯 5칸 · 보관함 · 휴지통) — 서버 원본 (검사 sim-closet.js)
   책임: 화면의 슬롯 캐릭터(slots[])를 서버 옷장과 이어 준다 — 시작할 때 서버에서 받아 앉히고, 캐릭터를 고치면 3초 묶음으로 서버에 쓰고,
     슬롯 ↔ 보관함 · 휴지통 · 되살리기는 동작 하나에 서버 요청 하나로 한다. 보관함 목록 · 휴지통 목록은 서버가 준 머리(섬네일)로 그리고 def 는 올릴 때만 받는다.
   서버가 원본이다: 이 PC 에 캐릭터 저장본 · 보관함 사본 · 고친 시각 · 백업 · 충돌 판정이 없다(0.12 의 slot-sync.js · chars.js 의 맞추기 장치는 걷었다).
     올릴 칸 수 · 보관함 20 · 휴지통 기한 · 같이 고친 충돌(낡은 판이어도 받고 앞 모습은 서버 휴지통 «연동 교체» 10일)은 서버가 정한다.
   받는 때: 시작할 때(startCloset — 계정 확인 뒤 app-boot) · 서버 신호 `avatars` · 사용자가 «다시 시도» 를 누를 때. 주기도 대기 타이머도 없고 실패 뒤 혼자 되풀이하지 않는다.
   쓰는 때: saveSlots 가 «달라졌다» 고 알린 뒤 3초 묶음 1회(바뀐 칸만 — 새 칸은 만들기 · 있는 칸은 고치기) · 슬롯 ↔ 보관함 · 휴지통 · 되살리기는 누른 즉시.
     받기 전(idle · loading · failed)에는 아무것도 쓰지 않는다. 지우는 것은 명시한 동작(휴지통 이동)뿐 — 화면에서 칸이 비었다고 서버 캐릭터를 지우지 않는다.
   서버 일은 한 줄(lane)로 하나씩: 받기 · 쓰기 · 옮기기 · 휴지통 · 되살리기 · 첫 실행 올리기는 앞 일이 끝난 뒤에 돈다 — 받는 사이 칸이 당겨지거나 쓰는 사이 받은 판이 바뀌는 엇갈림이 없다.
     일마다 시작할 때의 gen 을 쥐고, 계정을 놓으면(gen 이 바뀜) 그 일은 아무것도 적지 않고 끝난다. 계정을 놓으면 줄도 새로 시작한다.
     같이 고친 충돌은 409 가 아니다 — 받은 판(known.version)을 실어 보내면 서버가 받는다.
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
let started = false, gen = 0;
let saveTimer = null, saveFailShown = false, busy = false;
const changeFns = [];
/* 서버 일 한 줄 — 앞 일이 끝난 뒤에 다음 일을 돌린다(실패해도 줄은 이어진다) */
let laneTail = Promise.resolve();
function inLane(job){ const p = laneTail.then(job); laneTail = p.catch(() => {}); return p; }
const waitFlush = () => laneTail;   // 줄에 선 일(쓰기 포함)이 다 끝나기를 기다린다 — 로그아웃 올리기가 쓴다
let queuedPull = null, queuedNotify = false;   // 줄에 서서 아직 시작하지 않은 받기 — 그 사이 또 부르면 그 받기 하나로 합친다
let pullRunning = false, pullAgain = false, againNotify = false;   // 받는 중에 또 부르면 끝난 뒤 한 번 더(실패 뒤엔 사용자가 누른 받기만)
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
async function applyCloset(c, g){
  if(g !== gen) return false;
  if(creatorOpen()){ heads = c.avatars; return false; }            // 생성기가 열려 있으면 이번 판의 칸 갈아 끼우기는 건너뛴다(편집 중인 칸을 뺏지 않는다) — 다음 받기에 앉힌다
  const which = new Set(), objs = new Array(CHAR_SLOT_MAX).fill(null), skipRelink = new Set();
  const dropped = [];
  // 새 서버 판은 모아 두었다가 다 앉힌 뒤 한 번에 적는다 — 한 칸 그림이라도 못 받으면 아무 칸의 판도 바꾸지 않는다(다시 받기에서 그 칸을 건너뛰거나 옛 모습을 새 판으로 올리지 않게)
  const nextKnown = new Map();
  for(let i = 0; i < CHAR_SLOT_MAX; i++){
    const id = c.slots[i], k = known[i], here = !!slots[i];
    if(!id){
      if(k){ which.add(i); nextKnown.set(i, null); dropped.push(i); skipRelink.add(i); }    // 다른 기기에서 지웠다 — 이 칸도 비운다
      continue;                                                                      // k 가 없고 here 면 아직 못 올린 새 캐릭터 — 그대로 둔다
    }
    const head = c.avatars.find(h => h.avatarId === id);
    if(k && k.avatarId === id && k.version >= head.version) continue;                // 같은 판 · 늦게 온 낮은 판(방금 올린 고침보다 옛것) — 할 일 없음
    if(k && k.avatarId === id && isDirty(i)) continue;                               // 내 고침이 아직 안 올라갔다 — 덮지 않는다(올릴 때 서버가 앞 모습을 남긴다)
    if(!k && here && !taken.has(i)) continue;                                        // 이 칸에 아직 못 올린 새 캐릭터가 있다 — 올릴 때 칸이 차 있으면 서버가 거절한다(그때는 taken — 서버 것으로 앉힌다)
    try{ objs[i] = await objOf(c.defs[id]); }
    catch(e){ console.warn('[옷장] ' + (i + 1) + '번 칸 그림을 받지 못했어요', e); throw e; }
    which.add(i);
    if(!(k && k.avatarId === id)) skipRelink.add(i);                                 // 다른 캐릭터가 됐다 — 책상 위 좌석은 다음 실행에 바뀐다
    nextKnown.set(i, { avatarId: id, version: head.version, sig: sigOf(objs[i]) });   // 받은 모양으로 적는다 — 앉히는 중 onLoaded(가챠 회수 등)가 고친 칸은 «고침» 으로 남아 올라간다
  }
  if(g !== gen) return false;                                      // 그림을 받는 사이 계정을 놓았다 — 옛 계정 캐릭터를 앉히지 않는다
  heads = c.avatars;
  if(!which.size) return false;
  for(const [i, v] of nextKnown){ known[i] = v; taken.delete(i); }   // SLOT_TAKEN 표시도 다 받은 뒤에 지운다(못 받으면 다음 받기에서 서버 것으로 다시 앉힌다)
  const oldSlots = slots.slice();
  await slotSave.applySlotObjs(objs, which);
  slotSave._relinkSeatsToSlots(oldSlots, skipRelink);
  return true;
}

/* ── 받기 ── */
/* 서버 옷장 받기 — 시작 · 서버 신호 · 다시 시도. notify=true(사용자가 누른 받기)면 실패에 오류 번호를 띄운다.
   줄에 서서 돈다. 이미 줄에 선(아직 시작 안 한) 받기가 있으면 그 하나로 합친다 — 받는 중에 또 부르면 바로 'skipped' 이고 끝난 뒤 한 번 더 받는다.
   @return 'ready' | 'failed' | 'skipped' */
function pullCloset(notify){
  if(!getMyUserId()) return Promise.resolve('skipped');
  if(queuedPull){ if(notify) queuedNotify = true; return queuedPull; }
  if(pullRunning){ pullAgain = true; if(notify) againNotify = true; return Promise.resolve('skipped'); }
  if(notify) queuedNotify = true;
  if(load !== 'ready'){ load = 'loading'; changed(); }
  const g = gen;
  queuedPull = inLane(async () => {
    const n = queuedNotify;
    queuedPull = null; queuedNotify = false;
    if(g !== gen) return 'skipped';
    pullRunning = true;
    let res = 'failed';
    try{ res = await pullNow(n, g); return res; }
    finally{
      if(g === gen){
        pullRunning = false;
        const again = pullAgain, an = againNotify; pullAgain = false; againNotify = false;
        if(again && (res !== 'failed' || an)) pullCloset(an);   // 실패 뒤 혼자 되풀이하지 않는다 — 그 사이 사용자가 «다시 시도» 를 눌렀으면 그 받기는 돈다
      }
    }
  });
  return queuedPull;
}
async function pullNow(notify, g){
  const failed = (e) => {
    if(g !== gen) return 'skipped';
    if(load === 'loading') load = 'failed';
    if(notify) notifyError('E-CHAR-16', e);
    changed();
    return 'failed';
  };
  let c;
  try{ c = await closetApi.load(); }
  catch(e){ console.warn('[옷장] 서버에서 받기 실패', e && (e.code || e.kind)); return failed(e); }
  if(g !== gen) return 'skipped';                                   // 받는 사이 계정을 놓았다 — 이 답은 옛 계정
  const wasReady = load === 'ready';
  let did = false;
  try{ did = await applyCloset(c, g); }
  catch(e){ return failed(e); }
  if(g !== gen) return 'skipped';
  load = 'ready';
  if(did && !wasReady){ for(let i = 0; i < CHAR_SLOT_MAX; i++) if(isDirty(i)){ scheduleSave(); break; } }   // 첫 받기 중의 고침은 그때 저장 예약이 물러났다 — 받은 뒤 한 번
  if(did){
    try{ renderLauncher(); }catch(_){}
    try{ slotSave.slotsReplaced(); }catch(_){}
    if(wasReady) try{ toast('☁️ 다른 기기에서 바꾼 캐릭터를 받아왔어요 — 책상 위 캐릭터는 앱을 다시 실행하면 바뀌어요'); }catch(_){}
  }
  changed();
  return 'ready';
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
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; flushSlots(); }, SAVE_DEBOUNCE_MS);
}
/* 바뀐 칸만 올린다. 빈 칸은 지우지 않는다(지우기는 휴지통 이동뿐). 이미지 복원에 실패한 칸은 건너뛴다(빈 그림이 서버에 굳지 않게).
   줄에 서서 돈다 — 옮기기 · 받기와 엇갈리지 않는다. @return 못 올린 칸이 있었나 */
function flushSlots(){ return inLane(() => flushNow()); }
/* 줄 안에서만 부른다(flushSlots · 동작 안의 settleSlot) */
async function flushNow(){
  if(load !== 'ready') return false;
  const uid = getMyUserId();
  if(!uid) return false;
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
          known[i] = { avatarId: id, version: r.version, sig };
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
  await flushNow();
  return !isDirty(i) && !!known[i];
}
function guard(){
  if(load !== 'ready') return { ok: false, why: 'off' };
  if(busy) return { ok: false, why: 'busy' };                      // 앞 동작이 줄에 서 있다 — 칸 번호가 그 동작 뒤에 달라지니 받지 않는다
  return null;
}
/* 명시한 동작 하나 — 누른 때 막을 것을 보고, 줄에 서서 돈다. fn(g) 는 줄 안에서 gen 을 쥐고 돈다(계정을 놓으면 'off'). */
function action(fn, extra){
  const bad = guard(); if(bad) return Promise.resolve(Object.assign({}, extra, bad));
  busy = true;
  const g = gen;
  return inLane(async () => {
    try{
      if(g !== gen || load !== 'ready') return Object.assign({}, extra, { ok: false, why: 'off' });
      return await fn(g);
    }finally{ if(g === gen) busy = false; }
  });
}

/* 누른 칸의 캐릭터를 몸으로 잡는다 — 줄에서 앞 받기가 칸을 당길 수 있으니 줄 안에서 그 캐릭터의 지금 칸을 다시 찾는다(서버 캐릭터는 id · 못 올린 새 캐릭터는 그 객체) */
function targetOf(i){ return known[i] ? { id: known[i].avatarId } : { obj: slots[i] }; }
function findTarget(t){ return t.id ? known.findIndex(k => k && k.avatarId === t.id) : slots.indexOf(t.obj); }
const validSlot = (i) => i >= 0 && i < CHAR_SLOT_MAX && !!slots[i];
function moveToBox(i){
  if(load === 'ready' && !busy){
    if(!validSlot(i)) return Promise.resolve({ ok: false, why: 'nocid' });
    if(boxCount() >= BOX_MAX) return Promise.resolve({ ok: false, why: 'full' });
  }
  const t = validSlot(i) ? targetOf(i) : null;
  return action(async (g) => {
    let at = t ? findTarget(t) : -1;
    if(at < 0) return { ok: false, why: t ? 'gone' : 'nocid' };
    if(!(await settleSlot(at))) return { ok: false, why: 'dirty' };
    if(g !== gen) return { ok: false, why: 'off' };
    const id = known[at].avatarId;
    let c;
    try{ c = await closetApi.move(id, 'BOX'); }catch(e){ return failOp(e); }
    if(g !== gen) return { ok: false, why: 'off' };
    heads = c.avatars;
    pullForward(at);
    checkLayout(c);
    changed();
    return { ok: true, slot: at };
  });
}
function trashSlot(i){
  if(load === 'ready' && !busy && !validSlot(i)) return Promise.resolve({ ok: false, why: 'nocid' });
  const t = validSlot(i) ? targetOf(i) : null;
  return action(async (g) => {
    const at = t ? findTarget(t) : -1;
    if(at < 0) return { ok: false, why: t ? 'gone' : 'nocid' };
    const k = known[at];
    if(k){
      let r;
      try{ r = await closetApi.trash([k.avatarId]); }catch(e){ return failOp(e); }
      if(g !== gen) return { ok: false, why: 'off' };
      if(!r.length || (!r[0].ok && r[0].code !== 'AVATAR_NOT_FOUND')) return { ok: false, why: 'err' };   // 이미 없다면 같은 결과(이 칸을 비운다)
      heads = heads.filter(h => h.avatarId !== k.avatarId);
    }
    pullForward(at);                                                 // 서버에 올린 적 없는 새 캐릭터는 화면에서만 지운다
    changed();
    return { ok: true, slot: at };
  });
}
const hasUnsentNew = () => slots.some((s, k) => s && !known[k] && !s._imgBroken);
function boxToSlot(avatarId){
  if(load === 'ready' && !busy){
    if(!boxHeads().some(h => h.avatarId === avatarId)) return Promise.resolve({ ok: false, why: 'gone' });
    if(slots.every(s => s)) return Promise.resolve({ ok: false, why: 'slotsfull' });
  }
  return action(async (g) => {
    if(!boxHeads().some(h => h.avatarId === avatarId)) return { ok: false, why: 'gone' };
    if(slots.every(s => s)) return { ok: false, why: 'slotsfull' };
    /* 아직 못 올린 새 캐릭터가 있으면 먼저 올린다 — 서버는 자기 배치의 첫 빈 칸에 넣는데, 그 칸이 화면의 새 캐릭터 칸일 수 있다 */
    if(hasUnsentNew()){
      if(saveTimer){ clearTimeout(saveTimer); saveTimer = null; }
      await flushNow();
      if(g !== gen) return { ok: false, why: 'off' };
      if(hasUnsentNew()) return { ok: false, why: 'dirty' };
    }
    let c;
    try{ c = await closetApi.move(avatarId, 'SLOT'); }catch(e){ return failOp(e); }
    if(g !== gen) return { ok: false, why: 'off' };
    const at = c.slots.indexOf(avatarId);
    if(at < 0) return { ok: false, why: 'err' };
    let obj;
    try{ obj = await objOf(c.defs[avatarId]); }catch(e){ pullCloset(false); return { ok: false, why: 'img' }; }   // 서버에서는 옮겨졌다 — 그림만 못 받았다
    if(g !== gen) return { ok: false, why: 'off' };
    heads = c.avatars;
    const objs = new Array(CHAR_SLOT_MAX).fill(null); objs[at] = obj;
    const head = heads.find(h => h.avatarId === avatarId);
    known[at] = { avatarId, version: head.version, sig: sigOf(obj) };
    await slotSave.applySlotObjs(objs, new Set([at]));
    try{ renderLauncher(); }catch(_){}
    try{ slotSave.slotsReplaced(); }catch(_){}
    checkLayout(c);
    changed();
    return { ok: true, slot: at };
  });
}
/* 보관함 캐릭터 여러 개를 한 번에 휴지통으로 — 요청 하나(25개까지) */
function trashBox(ids){
  const pick = () => (Array.isArray(ids) ? ids : []).filter(id => boxHeads().some(h => h.avatarId === id));
  if(load === 'ready' && !busy && !pick().length) return Promise.resolve({ ok: false, why: 'gone', n: 0, fail: 0 });
  return action(async (g) => {
    const list = pick();
    if(!list.length) return { ok: false, why: 'gone', n: 0, fail: 0 };
    let r;
    try{ r = await closetApi.trash(list); }catch(e){ return Object.assign({ n: 0, fail: list.length }, failOp(e)); }
    if(g !== gen) return { ok: false, why: 'off', n: 0, fail: 0 };
    const okIds = new Set(r.filter(x => x.ok || x.code === 'AVATAR_NOT_FOUND').map(x => x.id));
    heads = heads.filter(h => !okIds.has(h.avatarId));
    changed();
    return { ok: okIds.size > 0, n: okIds.size, fail: list.length - okIds.size };
  }, { n: 0, fail: 0 });
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
function restore(trashId){
  if(load === 'ready' && !busy && boxCount() >= BOX_MAX) return Promise.resolve({ ok: false, why: 'full' });
  return action(async (g) => {
    if(boxCount() >= BOX_MAX) return { ok: false, why: 'full' };
    let r;
    try{ r = await closetApi.restore(trashId); }catch(e){ return failOp(e); }
    if(g !== gen) return { ok: false, why: 'off' };
    /* 서버가 옷장을 같이 돌려주면 그대로 앉히고, avatarId 만 주는 모양이면 옷장을 한 번 다시 받는다 — 판 · 시각을 앱이 지어 넣지 않는다 */
    if(r.closet){ heads = r.closet.avatars; checkLayout(r.closet); changed(); }
    else pullCloset(false);
    return { ok: true, avatarId: r.avatarId };
  });
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
  saveFailShown = false; started = false; busy = false;
  laneTail = Promise.resolve(); queuedPull = null; queuedNotify = false; pullRunning = false; pullAgain = false; againNotify = false;   // 옛 계정 일은 gen 이 달라 스스로 끝난다 — 새 계정 일은 그것을 기다리지 않는다
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
  const g = gen;
  if(!uc) return { ok: false, reason: '내 코드 없음' };
  if(storage.getItem(LEGACY_DONE_KEY) === uc) return { ok: true, wipe: legacyKeys() };
  const wipe = legacyKeys();
  const rawSlots = readJson(LEGACY_SLOTS_KEY, []);
  const box = readJson(LEGACY_BOX_KEY, {});
  const desk = readJson(LEGACY_DESK_KEY, []);
  const hasSlots = Array.isArray(rawSlots) && rawSlots.some(Boolean);
  const hasBox = !!box && typeof box === 'object' && Object.keys(box).some(c => box[c] && typeof box[c].def === 'string');
  if(!hasSlots && !hasBox){ try{ storage.setItem(LEGACY_DONE_KEY, uc); }catch(_){} return { ok: true, wipe }; }
  return inLane(() => legacyNow(uc, g, wipe, rawSlots, box, desk));   // 켜는 차례의 받기 뒤에 줄을 선다 — 받기가 끝난 뒤에 올린다
}
async function legacyNow(uc, g, wipe, rawSlots, box, desk){
  const moved = () => g !== gen || getMyUserId() !== uc;           // 올리는 사이 계정을 놓았다 — 다른 계정 옷장에 넣지 않는다
  if(moved()) return { ok: false, reason: '계정 바뀜' };
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
    if(moved()) return { ok: false, reason: '계정 바뀜' };
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
  if(moved()) return { ok: false, reason: '계정 바뀜' };
  try{ c = await closetApi.legacySync(items); }
  catch(e){
    if(moved()) return { ok: false, reason: '계정 바뀜' };
    if(e && e.code === 'AVATAR_LEGACY_SYNC_DONE'){ try{ storage.setItem(LEGACY_DONE_KEY, uc); }catch(_){} return { ok: true, wipe }; }
    return { ok: false, reason: String((e && (e.code || e.message)) || e) };
  }
  if(moved()) return { ok: false, reason: '계정 바뀜' };
  try{ storage.setItem(LEGACY_DONE_KEY, uc); }catch(_){}
  try{ await applyCloset(c, g); renderLauncher(); slotSave.slotsReplaced(); changed(); }catch(e){ console.warn('[옷장] 올린 뒤 받아 앉히기 실패', e); }
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
