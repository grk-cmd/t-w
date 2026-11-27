/* update-recheck.js — 켜 둔 동안 새 판 다시 확인 · 설치 폴더에 쓸 수 있나 · main.js 가 쓴다 (검사 checks/sim-update-recheck.js)
   [왜] 확인이 켤 때 한 번뿐이면 며칠씩 켜 두는 사람은 새 판을 모른다.
   [어떻게] EVERY_MS + 0~JITTER_MS 마다 check() 를 부른다 — 사람마다 늦춤을 달리 둬 모두가 같은 때 GitHub 에 묻지 않게.
     창 · 물음을 새로 띄우지 않는다. 새 판이 있으면 electron-updater 가 받고(autoDownload), 다 받으면 런처 띠(desktop-run.js)가 뜬다.
   ★ 다 받았으면(downloaded) 멈춘다 — 끌 때 설치되고 다음에 켜면 다시 묻는다. 확인 · 받는 중이면 그 차례는 건너뛰되,
     BUSY_MAX_SKIPS 차례 넘게 그대로면(받기가 멈춤) 다시 묻는다 — 멈춘 받기 하나로 다시 확인이 영영 서지 않게.
   어느 플랫폼에서 start 하는지 · 끌 때 설치를 켜는지는 update-platform.js 가 정한다(윈도우 · 맥).
   createUpdateRecheck({ check, setTimeout, clearTimeout, random, everyMs, jitterMs }) →
     { start() 한 번만 · status(s) main 이 받은 업데이트 상태 · stop() 끌 때 · fromTick() 지금 답을 기다리는 확인이 이 타이머가 부른 것인가 · delay() 다음 차례까지(검사용) }
   installDirWritable({ fs, path, dir, pid }) → 설치 폴더에 파일을 만들고 지울 수 있나.
     모든 사용자(Program Files) 설치는 쓸 수 없어 끌 때 설치가 UAC 창을 띄운다 — 그런 PC 는 끌 때 설치를 켜지 않는다(사용자에게 새 물음을 만들지 않게).
     ⚠️ fs.access(W_OK) 는 윈도우에서 ACL 을 보지 않아 믿을 수 없다 — 실제로 만들어 본다. */
'use strict';

const EVERY_MS = 4 * 60 * 60 * 1000;   // 4시간
const JITTER_MS = 60 * 60 * 1000;      // 0~1시간을 더한다
const BUSY = Object.freeze(['checking', 'available', 'downloading']);
const BUSY_MAX_SKIPS = 2;              // 이만큼 건너뛴 뒤에도 그대로면 멈춘 것으로 보고 다시 묻는다
const PROBE_PREFIX = '.tw-write-probe-';

function createUpdateRecheck(deps){
  const check = deps.check;
  const setT = deps.setTimeout;
  const clearT = deps.clearTimeout;
  const random = deps.random || Math.random;
  const everyMs = deps.everyMs || EVERY_MS;
  const jitterMs = deps.jitterMs == null ? JITTER_MS : deps.jitterMs;
  let timer = null, started = false, stopped = false, last = null, skips = 0, asking = false;

  const frac = () => { const r = Number(random()); return r > 0 ? Math.min(1, r) : 0; };   // NaN · 음수 → 0
  const delay = () => everyMs + Math.floor(frac() * jitterMs);
  function arm(){
    if(stopped) return;
    timer = setT(tick, delay());
  }
  function tick(){
    timer = null;
    if(stopped) return;
    if(BUSY.includes(last) && skips < BUSY_MAX_SKIPS){ skips++; }
    else{ skips = 0; asking = true; try{ check(); }catch(_){ asking = false; } }
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
    if(s !== last) skips = 0;
    last = s;
    if(s !== 'checking') asking = false;
    if(s === 'downloaded') stop();
  }
  return { start, stop, status, delay, fromTick: () => asking };
}

function installDirWritable(deps){
  const f = deps.path.join(deps.dir, PROBE_PREFIX + deps.pid);
  try{ deps.fs.writeFileSync(f, ''); }catch(_){ return false; }
  try{ deps.fs.unlinkSync(f); }catch(_){}
  return true;
}

module.exports = { createUpdateRecheck, installDirWritable, EVERY_MS, JITTER_MS, BUSY_MAX_SKIPS };
