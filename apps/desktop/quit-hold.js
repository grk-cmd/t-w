/* quit-hold.js — 🚪 앱을 끄기 전 렌더러가 못 올린 저장을 끝내기를 기다린다 · main.js 가 쓴다 (검사 checks/sim-leave-flush.js)
   [왜] 캐릭터는 서버가 원본이고 3초 묶음으로 올린다 — 고친 직후 끄면 그 고침이 사라졌다. 끄는 길이 여럿(제목줄 × · 내 정보 · 다른 기기 안내 ·
     Cmd+Q · 재시작 · 메인 창 닫기 · 업데이트 설치)이라 부르는 곳마다 기다리지 않고, 모두 지나는 before-quit 한 곳에서 한 번 붙잡는다.
   순서: 붙잡고 렌더러에 묻는다(ASK) → 렌더러(app/parts/shared/leave-flush.js)가 올릴 것만 올리고(상한 8초 · 없으면 바로) 답한다(DONE)
     → 이어서 끈다. 렌더러가 답하지 못하면 GUARD_MS 에 끈다.
   ★ 렌더러가 «답할 수 있다»(READY — leave-flush.js 가 실리며 듣기를 걸 때)고 알린 뒤에만 붙잡는다. 창이 없거나 · 렌더러가 죽었거나 ·
     화면을 새로 불러오는 중(rendererReset 뒤 READY 전)이면 붙잡지 않는다 — 답할 상대 없이 9초를 기다리지 않게.
   ⚠️ OS 세션 종료 · _exitNow(app.exit)는 before-quit 를 거치지 않는다 — 기다리지 않고 바로 끈다(OS 종료를 막지 않게).
   ⚠️ 채널 이름은 preload.js(onQuitFlush · quitFlushDone)와 같아야 한다 — 검사가 견준다.
   createQuitHold({ getWindow, ipcMain, quit, setTimeout, clearTimeout }) →
     { beforeQuit(e) → 붙잡았나(app 'before-quit' 맨 앞 — 붙잡았으면 훅 · 타이머 정리를 건너뛴다) · windowClose(e)(메인 창 'close' 를 끄기로 모은다) ·
       flushThen(fn)(업데이트 설치처럼 app.quit 이 아닌 끄기 앞에) · rendererReset()(메인 창이 새 화면으로 옮겨 가거나 렌더러가 죽을 때) · stage() } */
'use strict';

const CH = Object.freeze({ READY: 'companion:quitFlushReady', ASK: 'companion:quitFlush', DONE: 'companion:quitFlushDone' });
const GUARD_MS = 9000;   // 렌더러 상한(8초)보다 길게 — 렌더러가 멈춰 답하지 못할 때만 걸린다

function createQuitHold(deps){
  const getWindow = deps.getWindow;
  const ipcMain = deps.ipcMain;
  const quit = deps.quit;
  const setT = deps.setTimeout;
  const clearT = deps.clearTimeout;
  let stage = 'idle';   // 'idle' | 'asking' | 'done'
  let next = null, timer = null;
  let ready = false;   // 지금 화면의 렌더러가 답할 수 있다고 알렸나

  /* 물을 수 있는 렌더러 — 창이 없거나 · 닫혔거나 · 죽었으면 null(기다릴 상대가 없다) */
  function liveWin(){
    const w = getWindow();
    if(!w || !ready) return null;
    try{
      if(w.isDestroyed()) return null;
      const wc = w.webContents;
      if(!wc || wc.isDestroyed() || wc.isCrashed()) return null;
    }catch(_){ return null; }
    return w;
  }
  function finish(){
    if(stage !== 'asking') return;
    stage = 'done';
    clearT(timer); timer = null;
    const fn = next; next = null;
    fn();
  }
  ipcMain.on(CH.DONE, finish);
  ipcMain.on(CH.READY, (e) => { const w = getWindow(); if(w && e && e.sender === w.webContents) ready = true; });   // 메인 창이 보낸 것만
  function rendererReset(){ ready = false; }
  /* 렌더러에 묻는다. 물을 상대가 없으면 done 으로 두고 false — 부르는 쪽이 그대로 끈다 */
  function ask(fn){
    const w = liveWin();
    if(w){
      try{ w.webContents.send(CH.ASK); }catch(_){ stage = 'done'; return false; }
      stage = 'asking'; next = fn;
      timer = setT(finish, GUARD_MS);
      return true;
    }
    stage = 'done';
    return false;
  }
  function beforeQuit(e){
    if(stage === 'done') return false;
    if(stage === 'idle' && !ask(quit)) return false;
    e.preventDefault();
    return true;
  }
  function windowClose(e){
    if(stage === 'done') return;
    e.preventDefault();
    quit();
  }
  function flushThen(fn){
    if(stage === 'asking'){ next = fn; return; }   // 끄기를 묻는 중 — 답이 오면 이것으로 끈다
    if(stage === 'done' || !ask(fn)) fn();
  }
  return { beforeQuit, windowClose, flushThen, rendererReset, stage: () => stage };
}

module.exports = { createQuitHold, CH, GUARD_MS };
