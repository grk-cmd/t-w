/* update-recheck.js — 🔄 켜 둔 동안 새 판을 다시 확인한다(윈도우만) · main.js 가 쓴다 (검사 checks/sim-update-recheck.js)
   [왜] 확인이 켤 때 한 번뿐이라, 며칠씩 켜 두는 사람은 새 판이 나와도 모른 채 옛 판을 썼다(11-25 «자동업데이트는 ㅇㅇ 반영»).
   [어떻게] EVERY_MS + 0~JITTER_MS 마다 check() 를 부른다 — 사람마다 늦춤을 달리 둬 모두가 같은 때 GitHub 에 묻지 않게.
     조용히: 창 · 물음을 새로 띄우지 않는다. 새 판이 있으면 electron-updater 가 받고(autoDownload), 다 받으면 런처 띠(desktop-run.js)가 예전처럼 뜬다.
   ★ 다 받았으면(downloaded) 멈춘다 — 끌 때 설치되고(main.js autoInstallOnAppQuit) 다음에 켜면 다시 묻는다. 확인 · 받는 중이면 이번 차례는 건너뛴다.
   ⚠️ 맥은 부르지 않는다(main.js 가 윈도우에서만 start) — 맥은 켤 때 릴리스 태그만 한 번 읽는다(sim-mac-update).
   createUpdateRecheck({ check, setTimeout, clearTimeout, random, everyMs, jitterMs }) →
     { start() 한 번만 · status(s) main 이 받은 업데이트 상태 · stop() 끌 때 · delay() 다음 차례까지(검사용) } */
'use strict';

const EVERY_MS = 4 * 60 * 60 * 1000;   // 4시간
const JITTER_MS = 60 * 60 * 1000;      // 0~1시간을 더한다
const BUSY = Object.freeze(['checking', 'available', 'downloading']);

function createUpdateRecheck(deps){
  const check = deps.check;
  const setT = deps.setTimeout;
  const clearT = deps.clearTimeout;
  const random = deps.random || Math.random;
  const everyMs = deps.everyMs || EVERY_MS;
  const jitterMs = deps.jitterMs == null ? JITTER_MS : deps.jitterMs;
  let timer = null, started = false, stopped = false, last = null;

  const frac = () => { const r = Number(random()); return r > 0 ? Math.min(1, r) : 0; };   // NaN · 음수 → 0
  const delay = () => everyMs + Math.floor(frac() * jitterMs);
  function arm(){
    if(stopped) return;
    timer = setT(tick, delay());
  }
  function tick(){
    timer = null;
    if(stopped) return;
    if(!BUSY.includes(last)){ try{ check(); }catch(_){} }
    arm();
  }
  function start(){
    if(started || stopped) return;
    started = true;
    arm();
  }
  function stop(){
    stopped = true;
    if(timer != null){ clearT(timer); timer = null; }
  }
  function status(s){
    last = s;
    if(s === 'downloaded') stop();
  }
  return { start, stop, status, delay };
}

module.exports = { createUpdateRecheck, EVERY_MS, JITTER_MS };
