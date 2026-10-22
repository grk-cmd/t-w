/* presence-lock.js — 🔒 친구 탭 온라인 고정 (검사 sim-presence-lock.js)
   친구 탭 하단 «■ 온라인» 토글 · 옆 🔒 버튼 · 앱을 켤 때 처음 접속 표시.
   ★ 🔒 를 켜 두면 고른 온라인 · 오프라인을 계정에 기억해(presencePref/{uid}) 다음 실행 · 다른 PC 에서도 그 값으로 시작한다.
     끄면 예전처럼 늘 온라인으로 시작한다.
   ★ 처음 접속 표시는 고정값을 읽은 뒤에 쓴다 — 오프라인 고정인데 켜는 순간 «온라인» 이 한 번 보이지 않게
     (startOnlineFor 가 돌려주는 Promise 를 firebase-init setMyPresenceOnline 이 첫 쓰기 앞에서 기다린다).
     서버를 못 읽으면 이 PC 에 남긴 값(CACHE_KEY · 계정과 묶음), 그것도 없으면 온라인.
   ⚠️ 다른 PC 에서 바꾼 고정값은 이미 켜져 있는 PC 에 바로 오지 않는다(다음 실행부터).
   만드는 곳은 app.js(마이홈 처음 준비보다 먼저) · 처음 온라인 여부는 myhome-init.js 가 startOnlineFor(uid) 로 묻는다. */
(function(){
'use strict';

const CACHE_KEY = 'tw.presencePref';   // { u, lock, online } — 서버를 못 읽을 때만 쓴다
const LOAD_WAIT_MS = 5000;   // 첫 접속 쓰기 · 재접속 복구가 이 읽기를 기다린다 — 멈추면 이만큼 뒤 이 PC 값으로

/* 서버 · 이 PC 에서 읽은 값 → { lock, online }(모르는 칸 · 틀린 모양은 «고정 없음 · 온라인») */
function normalize(v){
  if(!v || typeof v !== 'object') return { lock: false, online: true };
  return { lock: v.lock === true, online: v.online !== false };
}
/* 앱을 켤 때 처음 접속 표시 — 고정했을 때만 고른 값 */
function startOnline(p){ return !(p && p.lock === true && p.online === false); }

/** @param {{
 *   getMyUserId: () => string,
 *   toast: (msg: string) => void,
 *   notifyError: (code: string, err: unknown) => void,
 *   loadPref: (uid: string) => Promise<object | null>,   // 비어 있으면 {} · 못 읽으면 null
 *   savePref: (uid: string, p: { lock: boolean, online: boolean }) => Promise<unknown>,
 *   setPresence: (uid: string, online: boolean) => unknown,
 *   storage: { getItem: (k: string) => string | null, setItem: (k: string, v: string) => void },
 *   setTimer: (fn: () => void, ms: number) => unknown,
 * }} deps */
function createPresenceLock(deps){
  const getMyUserId = deps.getMyUserId;
  const toast = deps.toast;
  let pref = { lock: false, online: true };
  let online = true;
  let touched = false;   // 고정값을 읽기 전에 사용자가 누름 — 읽은 값으로 덮지 않는다
  const tog = document.getElementById('mhPresenceToggle');
  const lockBtn = document.getElementById('mhPresenceLock');

  function readCache(uid){
    try{
      const o = JSON.parse(deps.storage.getItem(CACHE_KEY) || 'null');
      return (o && o.u === uid) ? normalize(o) : null;
    }catch(_){ return null; }
  }
  function writeCache(uid){
    try{ deps.storage.setItem(CACHE_KEY, JSON.stringify({ u: uid, lock: pref.lock, online: pref.online })); }catch(_){}
  }
  function paint(){
    if(tog) tog.innerHTML = online
      ? '<span class="mh-fdot on"></span> 온라인 <small>(누르면 오프라인)</small>'
      : '<span class="mh-fdot off"></span> 오프라인 <small>(누르면 온라인)</small>';
    if(lockBtn){
      lockBtn.textContent = pref.lock ? '🔒' : '🔓';
      lockBtn.classList.toggle('on', pref.lock);
      lockBtn.setAttribute('aria-pressed', pref.lock ? 'true' : 'false');
      lockBtn.title = pref.lock ? '고정됨 — 다음에 켤 때도 이 상태로 시작해요(누르면 풀기)' : '누르면 지금 상태로 고정 — 다음에 켤 때도 이 상태로 시작해요';
    }
  }
  function save(uid){
    writeCache(uid);
    Promise.resolve().then(() => deps.savePref(uid, { lock: pref.lock, online: pref.online }))
      .catch(err => deps.notifyError('E-MH-02', err));
  }
  /* 읽은 고정값을 받는다 — fromServer 면 이 PC 값도 맞춘다 */
  function adopt(uid, p, fromServer){
    if(touched){
      // 읽기 전에 눌렀다 — 누른 값은 지키되 고정 여부는 읽은 값을 따른다(고정이면 누른 값이 새 고정값)
      pref = { lock: p.lock, online };
      if(p.lock && p.online !== online) save(uid); else if(fromServer) writeCache(uid);
    } else {
      pref = p; online = startOnline(p);
      if(fromServer) writeCache(uid);
    }
    paint();
  }
  /* 앱을 켤 때 한 번 — 고정값을 읽고 처음 온라인 여부를 돌려준다(던지지 않는다) */
  async function startOnlineFor(uid){
    if(!uid) return online;
    const TIMEOUT = {};
    const load = (async () => deps.loadPref(uid))().catch(() => null);   // 던져도 «못 읽음»
    const got = await Promise.race([load, new Promise(r => deps.setTimer(() => r(TIMEOUT), LOAD_WAIT_MS))]);
    if(got === TIMEOUT){
      // 늦게 온 서버 값도 받는다 — 이미 쓴 접속 표시와 다르면 바로잡는다(로그인 복원이 느린 새 PC 가 고정을 놓치지 않게)
      load.then(v => {
        if(!v) return;
        const before = online;
        adopt(uid, normalize(v), true);
        if(online !== before){ try{ deps.setPresence(uid, online); }catch(_){} }
      });
      const c = readCache(uid);
      if(c) adopt(uid, c, false); else paint();
      return online;
    }
    const p = got ? normalize(got) : readCache(uid);
    if(p) adopt(uid, p, !!got); else paint();
    return online;
  }

  if(tog) tog.addEventListener('click', ()=>{
    const uid = getMyUserId();
    online = !online;
    touched = true;
    try{ deps.setPresence(uid, online); }catch(_){}
    if(uid && pref.lock){ pref = { lock: true, online }; save(uid); }
    paint();
    toast(online ? '이제 친구들에게 온라인으로 보여요' : '이제 친구들에게 오프라인으로 보여요');
  });
  if(lockBtn) lockBtn.addEventListener('click', ()=>{
    const uid = getMyUserId();
    if(!uid){ toast('로그인한 뒤에 쓸 수 있어요'); return; }
    pref = { lock: !pref.lock, online };
    save(uid);
    paint();
    toast(pref.lock
      ? '🔒 다음에 켤 때도 «' + (online ? '온라인' : '오프라인') + '» 으로 시작해요'
      : '🔓 고정을 풀었어요 — 다음에 켤 때는 온라인으로 시작해요');
  });
  paint();

  return { startOnlineFor };
}

window.TwPresenceLock = { CACHE_KEY, LOAD_WAIT_MS, normalize, startOnline, createPresenceLock };
})();
