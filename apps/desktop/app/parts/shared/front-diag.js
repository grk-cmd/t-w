/* ═══ 🩺 front-diag.js — 앞 창 진단(1분 [프레임] 줄 끝에 «앞 창 · 전체화면 비율») ══════════════════════
   «앱을 켜 두면 게임 · 영상이 버벅인다» 제보를 로그 한 장으로 가르려는 진단이다 — 그 1분 동안 앞에 무엇이 있었고
   그 창이 실행 화면 모니터를 꽉 채웠는지(게임 · 전체화면 영상)를 렌더러의 [프레임] 줄(그린 장 수)과 한 줄에 둔다.
   main 만 싣는다(렌더러는 앞 창을 모른다). 순수 계산만 — 검사 sim-front-diag.js.
   ★ 창 제목은 적지 않는다 — 영상 제목 · 대화 상대 이름이 들어갈 수 있다. 실행 파일 이름만. */
(function(){
'use strict';

const FRAME_TAG = '[프레임]';      // frame-budget.js diagLine 의 머리 — 이 줄에만 덧붙인다
const FULL_TOL = 2;               // 창 크기 반올림(배율 나눗셈) 오차
const STALE_MS = 120000;          // 실행 화면이 아니라 [프레임] 줄이 안 오면 이보다 오래된 표본은 버린다
const EXE_MAX = 40;

/* 앞 창이 모니터를 꽉 채우는가 — 크기만 본다. 최대화 창은 작업표시줄만큼 작아서 안 걸린다.
   ⚠️ 좌표는 안 본다 — Windows 의 창 좌표는 그 창 모니터 배율로 나눈 값이라 배율이 다른 모니터가 섞이면 Electron 좌표와 안 맞는다. */
function coversDisplay(win, disp){
  if(!win || !disp) return false;
  const w = Number(win.width), h = Number(win.height), dw = Number(disp.width), dh = Number(disp.height);
  if(!(w > 0 && h > 0 && dw > 0 && dh > 0)) return false;
  return w >= dw - FULL_TOL && h >= dh - FULL_TOL;
}

function createFrontWatch(){
  let since = null, samples = 0, sized = 0, full = 0, counts = new Map();
  function reset(t){ since = t; samples = 0; sized = 0; full = 0; counts = new Map(); }
  /* 활성 창 폴링(500ms)마다. isFull: true · false · null(크기를 못 읽음 — 맥 · 실패).
     exe 를 못 읽은 표본도 비율 분모에 들고, 크기를 못 읽은 표본은 빠진다(0% 로 속이지 않게) */
  function note(t, exe, isFull){
    if(since == null || t - since > STALE_MS) reset(t);
    samples++;
    if(isFull === true || isFull === false){ sized++; if(isFull) full++; }
    const k = String(exe || '').slice(0, EXE_MAX);
    if(k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  /* [프레임] 줄이 올 때 — 지금까지의 요약을 돌려주고 새로 센다 */
  function take(t){
    let exe = '', best = 0;
    counts.forEach((n, k) => { if(n > best){ best = n; exe = k; } });
    const out = { samples, fullShare: sized > 0 ? full / sized : null, exe };
    reset(t);
    return out;
  }
  return { note, take };
}

/* 덧붙일 꼬리 — 예) « · 앞 창 Discord.exe · 전체화면 85%» · 표본이 없으면 « · 앞 창 모름» · 크기를 못 읽었으면 «전체화면 모름» */
function suffix(m){
  if(!m || !(m.samples > 0)) return ' · 앞 창 모름';
  const share = (typeof m.fullShare === 'number') ? Math.round(m.fullShare * 100) + '%' : '모름';
  return ' · 앞 창 ' + (m.exe || '모름') + ' · 전체화면 ' + share;
}
function isFrameLine(msg){ return typeof msg === 'string' && msg.indexOf(FRAME_TAG) === 0; }

const api = { FRAME_TAG, FULL_TOL, STALE_MS, EXE_MAX, coversDisplay, createFrontWatch, suffix, isFrameLine };
if(typeof window !== 'undefined') window.TwFrontDiag = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
