/* focus-progress.js — ⏱ 포커스 진척(레벨 · 회차 · 별 색)은 서버 값, 이 PC 는 «아직 못 올린 초» 만 (검사 sim-focus-progress.js)
   책임: 시작할 때 서버 진척을 한 번 받고(GET /v1/me/focus), 집중한 초를 미전송분(pendingSec)으로 쌓아 정해진 때 한 번에 올리고(POST …/accruals),
     별 색을 바꾼다(PATCH). 레벨 · 회차 · 별 색은 서버가 준 값 그대로 — 앱이 누적에서 다시 세지 않는다(화면의 «다음 레벨까지» 막대만 shownTotalSec()).
   상태: load = idle | loading | ready | failed. ready 가 아니면 레벨 · 경험치 바는 비운다(깜빡이는 레벨 1 을 그리지 않는다 — D5-Q5).
   올리는 때(주기 타이머 없음 · 실패해도 혼자 다시 보내지 않는다): ① 미전송분이 600초 칸을 넘을 때 ② 더해서 다음 레벨(3600초 경계)을 넘을 때
     ③ 집중이 끝날 때(미전송분 60초 이상) ④ 시작 · 로그아웃 올리기 · 앱 끄기. 실패하면 다음 때까지 기다린다.
   한 줄(busy/again): 올리는 중에 또 올릴 일이 생기면 again 만 켠다. 보낼 때 sent 를 잡고 답이 오면 pendingSec -= sent —
     그 사이 쌓인 몫은 남고, 서버가 받아 주지 않은 몫(sent - acceptedSec)은 그대로 버려진다(서버 상한이 원본).
   계정 바뀜: startFocus 가 session.onReset(reset) 을 건다 — reset 이 gen 을 올려 늦게 온 답은 아무것도 바꾸지 못한다. 쓰기는 읽은 토큰의 주인(expectOwner)과 묶인다(focus-api.js).
   실패 알림: E-FOCUS-01(사용자가 연 창에서 다시 받다 실패) · E-FOCUS-02(올리기 실패 — 이어지면 한 번, 성공하면 풀림) · E-FOCUS-03(별 색 실패 — 이전 색으로 되돌림).
   deps: focusApi(focus-api.js createFocusApi) · focusStore(계정 칸 get/set/remove) · 오류 알림 함수(notifyError) · setServerDay(today) · addQuitListener(fn) · now 없음(시간으로 판단하는 것 없음)
   내놓는 것: startFocus(code, me, session) · progress() · isReady() · getFocusLevel() · myFocusShow() · getStarColor() · setStarColor(hex) · shownTotalSec() · unsentSec() ·
     addSeconds(sec) · focusEnded() · flushPending() · reload(userOpened) · refreshDay() · legacyAccrue(sec) · onChange(fn)
   ⚠️ 전역 이름은 TwFocusProgress. 만들 때는 요청 · 구독 · 타이머를 하지 않는다 — 시작은 startFocus 한 번(app-boot).
   검사: checks/sim-focus-progress.js */
(function(){
'use strict';

const PENDING_KEY = 'tw.focusPendingSec';
const SEND_STEP_SEC = 600;          // 미전송분이 이 칸을 넘을 때마다 한 번(10분)
const LEVEL_SEC = 3600;             // 서버와 같은 식 — 1시간 = 1레벨
const END_MIN_SEC = 60;             // 집중이 끝났을 때 이만큼 이상 남았으면 올린다
const DELTA_MAX = 604800;           // 서버 상한(focus-api.js LIMITS.DELTA_MAX 와 같다)
const STAR_PALETTE = Object.freeze([
  ['#ffd76a', '금'],   ['#ffe066', '레몬'],  ['#ffb86b', '살구'], ['#ff9f43', '주황'],
  ['#ff8a8a', '산호'], ['#ffa3c4', '벚꽃'],  ['#ff7ad0', '분홍'], ['#e39cff', '라일락'],
  ['#c9a0ff', '라벤더'], ['#a3adff', '달빛'], ['#8fc8ff', '하늘'], ['#7fe0f0', '물빛'],
  ['#5ff0e4', '청록'], ['#6ef0a0', '민트'],  ['#b6f36a', '연두'], ['#eef3ff', '은빛'],
]);
const starColorOk = (c) => STAR_PALETTE.some((p) => p[0] === c);

/** @param {{
 *   focusApi: { fetchProgress: Function, accrue: Function, setStarColor: Function, reset: Function },   // focus-api.js createFocusApi
 *   focusStore: { get: (key: string) => (string|null), set: (key: string, v: string) => boolean, remove: (key: string) => boolean },   // 계정 칸(shared/account-store.js)
 *   notifyError: (code: string, err?: any) => unknown,       // TwErrorCodes.notify
 *   setServerDay: (today: ({ day: string, isoWeek: string, dayEndsAt: number }|null)) => void,   // 서버 «오늘»(focus-total.js)
 *   addQuitListener: (fn: () => void) => void,                // 앱 끌 때(beforeunload)
 * }} deps */
function createFocusProgress(deps){
  const focusApi = deps.focusApi;
  const focusStore = deps.focusStore;
  const notifyError = deps.notifyError;
  const setServerDay = deps.setServerDay;
  const addQuitListener = deps.addQuitListener;

  let started = false, quitBound = false;
  let gen = 0;                       // 계정이 바뀌면(reset) 올라간다 — 늦은 답은 자기 gen 과 달라 아무것도 바꾸지 못한다
  let code = null;
  let load = 'idle';                 // 'idle' | 'loading' | 'ready' | 'failed'
  let p = null;                      // 서버가 준 진척 { totalSec, level, cycle, cycleLevel, starColor }
  let pendingRaw = 0;                // 아직 못 올린 초(소수 포함) — 밖에는 정수로(unsentSec)
  let reqSeq = 0, appliedSeq = 0;    // 요청 순번 — 더 나중에 보낸 쪽의 답만 진척을 바꾼다
  let busy = false, again = false, running = null;
  let failShown = false;             // E-FOCUS-02 를 이미 띄웠다(이어지는 실패는 안 띄움 · 성공하면 풀림)
  let loadRun = null, dayRun = null;
  let starBusy = false, starAgain = false, starWant = null;   // 별 색 — 보이는 값(starWant)과 서버가 확인한 값(p.starColor)
  const changeFns = [];

  function onChange(fn){ changeFns.push(fn); }
  function changed(){ changeFns.forEach((fn) => { try{ fn(); }catch(e){ console.warn('[포커스] 알림 실패', e); } }); }

  const unsent = () => Math.floor(pendingRaw);
  function savePending(){ focusStore.set(PENDING_KEY, String(unsent())); }

  /* 서버 답을 진척으로 받는다 — 앞서 보낸 요청의 늦은 답이면 버린다 */
  function adopt(prog, seq){
    if(seq < appliedSeq){
      if(p && prog.totalSec > p.totalSec){ p.totalSec = prog.totalSec; p.level = prog.level; p.cycle = prog.cycle; p.cycleLevel = prog.cycleLevel; changed(); }   // 누적은 서버에서 줄지 않는다 — 늦게 온 답이 더 크면 그 몫은 받는다
      return false;
    }
    appliedSeq = seq;
    p = { totalSec: prog.totalSec, level: prog.level, cycle: prog.cycle, cycleLevel: prog.cycleLevel, starColor: prog.starColor };
    setServerDay(prog.today);
    return true;
  }

  /* ── 받기 ── */
  /* 서버 진척 받기 — 시작 · 사용자가 연 창. 받는 중에 또 부르면 같은 약속 */
  function loadNow(userOpened){
    if(loadRun) return loadRun;
    const g = gen, seq = ++reqSeq;
    load = 'loading'; changed();
    loadRun = (async () => {
      let res = 'failed';
      try{
        const prog = await focusApi.fetchProgress(code);
        if(g !== gen) return 'skipped';
        adopt(prog, seq);
        load = 'ready'; res = 'ready';
      }catch(e){
        if(g !== gen) return 'skipped';
        load = 'failed';
        if(userOpened) notifyError('E-FOCUS-01', e);   // 시작할 때의 실패는 번호 없이 조용히 — 사용자가 연 것이 아니다
      }finally{
        if(g === gen){ loadRun = null; changed(); }
      }
      if(res === 'ready' && unsent() > 0) send();   // 못 올린 몫이 남아 있으면(켜기 · 다시 받기 뒤) 올린다
      return res;
    })();
    return loadRun;
  }
  /* 하루가 바뀐 때(focus-total.js) — 새 날을 한 번 받는다. 받은 뒤에만(그 전엔 시작 받기가 새 날을 준다).
     실패하면 failed 로만 두고 되풀이하지 않는다(설계 7절) — 번호 알림 없음 · 다음에 창을 열 때 다시 받는다 */
  function refreshDay(){
    if(!started || load !== 'ready' || dayRun) return dayRun || Promise.resolve();
    const g = gen, seq = ++reqSeq;
    dayRun = (async () => {
      try{
        const prog = await focusApi.fetchProgress(code);
        if(g === gen && adopt(prog, seq)) changed();
      }catch(e){
        if(g === gen){ load = 'failed'; changed(); }
      }finally{
        if(g === gen) dayRun = null;
      }
    })();
    return dayRun;
  }
  /* 내 정보 · 포커스 기록창을 열 때 — 못 받은 상태일 때만 다시 받는다(번호 알림 있음) */
  function reload(userOpened){
    if(!started || load === 'ready' || load === 'loading') return Promise.resolve(load);
    return loadNow(userOpened === true);
  }

  /* ── 올리기 ── */
  /* 줄에 서서 올린다 — 올리는 중이면 again 만 켜고 지금 도는 약속을 돌려준다 */
  function send(){
    if(!started || load !== 'ready') return Promise.resolve();
    if(busy){ again = true; return running; }
    if(unsent() < 1) return Promise.resolve();
    busy = true;
    const g = gen;
    running = (async () => {
      try{
        do{
          again = false;
          const sent = Math.min(unsent(), DELTA_MAX);
          if(sent < 1) break;
          const seq = ++reqSeq;
          const r = await focusApi.accrue(code, sent);
          if(g !== gen) return;
          if(r.status === 'ok'){
            pendingRaw = Math.max(0, pendingRaw - sent);   // 서버가 받아 준 몫이든 아니든 보낸 만큼은 뺀다 — 못 받은 몫은 버린다
            savePending();
            adopt(r.progress, seq);
            failShown = false;
            changed();
          }else if(r.status === 'failed'){
            if(!failShown){ failShown = true; notifyError('E-FOCUS-02', r.err); }
            return;   // 미전송분 그대로 · 혼자 다시 보내지 않는다
          }else return;   // stale — 계정이 바뀌는 중이거나 읽기 전
        }while(again && unsent() > 0);
      }finally{
        if(g === gen){ busy = false; again = false; running = null; }
      }
    })();
    return running;
  }

  /* 집중한 초 더하기 — 시작 전(계정 칸이 닫힌 때)에는 쌓지 않는다. 올릴 때(위 ①②)가 되면 한 번 */
  function addSeconds(sec){
    if(!started || !(sec > 0)) return;
    const before = pendingRaw;
    pendingRaw += sec;
    savePending();
    if(load !== 'ready') return;
    const crossStep = Math.floor(pendingRaw / SEND_STEP_SEC) > Math.floor(before / SEND_STEP_SEC);
    const base = p.totalSec;
    const crossLevel = Math.floor((base + pendingRaw) / LEVEL_SEC) > Math.floor((base + before) / LEVEL_SEC);
    if(crossStep || crossLevel) send();
    changed();
  }
  /* 집중 → 쉼 · 자리비움으로 바뀔 때 */
  function focusEnded(){
    if(started && load === 'ready' && unsent() >= END_MIN_SEC) send();
  }
  /* 받는 중이면 끝나기를 기다리고, 못 받은 상태면 한 번 더 받는다(번호 알림 없음) */
  async function settled(){
    if(loadRun) await loadRun;
    if(load !== 'ready') await reload(false);
  }
  /* 로그아웃 올리기 — 끝난 뒤의 미전송분은 unsentSec() 로 본다. 못 올리면 그 값이 남는다(검문이 막는다) */
  async function flushPending(){
    if(!started) return;
    await settled();
    await send();
  }
  /* 0.13 첫 실행 — 옛 PC 누적의 «올리지 않은 몫» 을 한 번 올린다(first-run-013.js). 받아 주는 양은 서버가 자른다 */
  async function legacyAccrue(sec){
    if(!started) return { ok: false, reason: '시작 전' };
    const n = Math.floor(sec);
    if(!(n >= 1)) return { ok: true };
    const g = gen;
    if(running) await running.catch(() => {});
    await settled();
    if(g !== gen || load !== 'ready') return { ok: false, reason: '진척을 받지 못했다' };
    const seq = ++reqSeq;
    let off = 0;
    while(off < n){
      const part = Math.min(n - off, DELTA_MAX);
      const r = await focusApi.accrue(code, part);
      if(g !== gen) return { ok: false, reason: '계정이 바뀜' };
      if(r.status !== 'ok') return { ok: false, reason: '올리기 실패' };
      adopt(r.progress, seq);
      off += part;
    }
    changed();
    return { ok: true };
  }

  /* ── 별 색 ── */
  function getStarColor(){
    const c = starWant || (p && p.starColor);
    return starColorOk(c) ? c : STAR_PALETTE[0][0];
  }
  /* 고르면 바로 보이고(starWant) 서버에 한 줄로 쓴다. 실패하면 서버가 아는 색으로 되돌리고 번호 알림 */
  function setStarColor(hex){
    if(!started || load !== 'ready' || !starColorOk(hex)) return false;
    starWant = hex;
    if(starBusy){ starAgain = true; changed(); return true; }
    runStar();
    changed();
    return true;
  }
  async function runStar(){
    starBusy = true;
    const g = gen;
    try{
      do{
        starAgain = false;
        const want = starWant, seq = ++reqSeq;
        const r = await focusApi.setStarColor(code, want);
        if(g !== gen) return;
        if(r.status === 'ok'){
          if(!adopt(r.progress, seq) && p) p.starColor = r.progress.starColor;   // 늦게 온 답이어도 색은 이 답이 맞다(별 색 요청은 한 줄)
          if(!starAgain) starWant = null;
        }else{
          starWant = null;   // 서버가 아는 색으로 되돌린다
          if(r.status === 'failed') notifyError('E-FOCUS-03', r.err);
          starAgain = false;
        }
        changed();
      }while(starAgain);
    }finally{
      if(g === gen) starBusy = false;
    }
  }

  /* ── 읽기 ── */
  const isReady = () => load === 'ready';
  const progress = () => ({ load, totalSec: p ? p.totalSec : 0, level: p ? p.level : 0, cycle: p ? p.cycle : 0, cycleLevel: p ? p.cycleLevel : 0, starColor: getStarColor() });
  /* 해금 레벨 = 서버 레벨. 받기 전에는 1(기능 문은 잠긴 쪽) — 화면에 그릴 때는 isReady() 로 가른다 */
  const getFocusLevel = () => (load === 'ready' ? p.level : 1);
  /* 이름표 · 배지에 그리는 «이번 바퀴» 모양 — 회차가 없으면 null */
  function myFocusShow(){
    if(load !== 'ready' || !(p.cycle > 0)) return null;
    return { cyc: p.cycle, lv: p.cycleLevel, color: getStarColor() };
  }
  /* 레벨 막대용 — 서버 누적 + 아직 못 올린 몫. 받기 전에는 null(막대를 그리지 않는다) */
  const shownTotalSec = () => (load === 'ready' ? p.totalSec + unsent() : null);

  /* ── 시작 · 비우기 ── */
  function reset(){
    gen++;
    started = false; load = 'idle'; p = null; pendingRaw = 0; code = null;
    busy = false; again = false; running = null; loadRun = null; dayRun = null;
    failShown = false; starBusy = false; starAgain = false; starWant = null;
    reqSeq = 0; appliedSeq = 0;
    setServerDay(null);
    focusApi.reset();
    changed();
  }

  /* 🚀 계정 확인 뒤 한 번(launcher/app-boot.js) — 계정 칸의 못 올린 몫을 읽고 서버 진척을 받는다 */
  function startFocus(userCode, me, session){
    if(started) return;
    started = true;
    code = userCode;
    session.onReset(reset);
    pendingRaw = Math.max(0, Math.floor(parseFloat(focusStore.get(PENDING_KEY)) || 0));
    if(!quitBound){
      quitBound = true;
      addQuitListener(() => { if(started && load === 'ready' && unsent() >= 1) send(); });   // 기다리지 않는다 — 못 보낸 몫은 계정 칸에 남아 다음 켤 때 보낸다
    }
    loadNow(false);
  }

  return {
    startFocus, progress, isReady, getFocusLevel, myFocusShow, getStarColor, setStarColor, shownTotalSec,
    unsentSec: unsent, addSeconds, focusEnded, flushPending, reload, refreshDay, legacyAccrue, onChange,
    STAR_PALETTE, PENDING_KEY,
  };
}

const api = { createFocusProgress, STAR_PALETTE, PENDING_KEY, SEND_STEP_SEC, LEVEL_SEC, END_MIN_SEC };
if(typeof window !== 'undefined') window.TwFocusProgress = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
