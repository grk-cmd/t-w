/* input-diag.js — 🩺 한글 씹힘 진단 — 진단 기록(tw-mouse-diag.log)에 남길 줄을 만든다
   ・createImeWatch(deps) — 렌더러: 한글 조합 중에 입력칸이 포커스를 잃거나 칸이 사라지면 한 줄. 친 글자는 적지 않는다(조합 길이만).
   ・createLagWatch(deps) — main: 메인 스레드 멈춤 · 활성 창 조회 시간을 모아 REPORT_MS 마다 한 줄(느린 것이 있을 때만).
   [왜] 개발 PC 에서는 씹힘이 재현되지 않았고, «조합 중 포커스를 잃으면 글자가 깨진다» 만 3/3 재현됐다. 맥 전역 키 훅은
     키마다 main 스레드에 묻고 기다리므로, main 이 멈춰도 키가 밀린다. 제보자 PC 에서 둘 중 무엇이 나는지 이 줄로 가른다.
   ⚠️ 줄 수 상한(MAX_LINES) — 이 진단이 클릭고착 · 포커스 기록을 밀어내지 않게(파일은 256KB 에서 회전).
   ⚠️ 조합이 끝나는 것(compositionend)과 포커스를 잃는 것(focusout · blur)의 순서는 크로미움 · 입력기마다 다를 수 있다 —
     어느 쪽이 먼저 와도 한 줄이 남게 END_GRACE_MS 안의 포커스 잃음은 «방금 끝난 조합» 으로 본다.
   검사: checks/sim-input-diag.js */
(function(){
'use strict';

const LAG_TICK_MS = 100;            // 멈춤을 재는 간격
const LAG_SLOW_MS = 100;            // 이만큼 늦으면 «멈춤» — 키 하나가 이만큼 밀리면 글자가 밀린다
const LAG_SLEEP_MS = 10 * 1000;     // 이보다 길면 절전 · 잠자기로 보고 세지 않는다
const AW_SLOW_MS = 50;              // 활성 창 조회가 이만큼 걸리면 «느림»
const REPORT_MS = 60 * 1000;        // 모아서 남기는 주기
const END_GRACE_MS = 50;            // 조합이 끝난 뒤 이 안에 포커스를 잃으면 «포커스를 잃어 끝난 조합»
const IME_MIN_GAP_MS = 2000;        // 연달아 나면 한 줄만
const MAX_LINES = 300;

/* 입력칸 이름 — 어느 칸이었는지만(글 내용은 적지 않는다) */
function describe(el){
  if(!el || !el.tagName) return '?';
  let s = String(el.tagName).toLowerCase();
  if(el.id) s += '#' + el.id;
  else if(el.classList && el.classList.length) s += '.' + el.classList[0];
  if(el.isContentEditable) s += '[편집]';
  return s;
}

/* 줄 수 상한 — 상한에 닿는 줄은 «이후 생략» 으로 바꿔 남긴다 */
function createLimiter(write){
  let lines = 0;
  return (msg)=>{
    if(lines >= MAX_LINES) return false;
    lines++;
    write(lines === MAX_LINES ? msg.split(' ')[0] + ' 기록 상한 — 이후 생략' : msg);
    return true;
  };
}

/** 렌더러 — 한글 조합이 포커스 잃음 · 칸 사라짐으로 끊기는 순간
 * @param {{ note: (msg: string) => void, now: () => number }} deps */
function createImeWatch(deps){
  const now = deps.now;
  const emit = createLimiter(deps.note);
  let comp = null;      // 조합 중 { el, at, len }
  let ended = null;     // 방금 끝난 조합 { el, at, len, endAt }
  let lastAt = -Infinity;

  function say(msg){
    const t = now();
    if(t - lastAt < IME_MIN_GAP_MS) return;
    if(emit(msg)) lastAt = t;
  }
  function line(why, c, docFocused){
    say('[한글] 조합 중 ' + why + ' — 칸=' + describe(c.el) + ' 조합 ' + c.len + '글자 · 시작 뒤 ' + (now() - c.at) + 'ms'
      + ' · 창 포커스=' + (docFocused ? '있음' : '없음'));
  }
  function onStart(e){ comp = { el: e.target, at: now(), len: 0 }; ended = null; }
  function onUpdate(e){ if(comp) comp.len = String((e && e.data) || '').length; }
  function onEnd(e, docFocused){
    if(!comp) return;
    const c = comp;
    comp = null;
    if(c.el && c.el.isConnected === false){ line('입력칸이 사라짐', c, docFocused); return; }
    ended = Object.assign({}, c, { endAt: now() });
  }
  /* 포커스를 잃음 — why: '칸 포커스 잃음'(focusout) · '창 포커스 잃음'(window blur) */
  function onLost(why, el, docFocused){
    if(comp && (!el || el === comp.el)){ const c = comp; comp = null; line(why, c, docFocused); return; }
    if(ended && now() - ended.endAt <= END_GRACE_MS && (!el || el === ended.el)){ const c = ended; ended = null; line(why, c, docFocused); }
  }
  function attach(doc, win){
    if(!doc || doc.__twImeWatch) return;
    doc.__twImeWatch = true;
    const focused = ()=>{ try{ return !!doc.hasFocus(); }catch(_){ return false; } };
    doc.addEventListener('compositionstart', onStart, true);
    doc.addEventListener('compositionupdate', onUpdate, true);
    doc.addEventListener('compositionend', (e)=> onEnd(e, focused()), true);
    doc.addEventListener('focusout', (e)=> onLost('칸 포커스 잃음', e.target, focused()), true);
    if(win) win.addEventListener('blur', ()=> onLost('창 포커스 잃음', null, false));
  }
  return { attach, onStart, onUpdate, onEnd, onLost };
}

/** main — 메인 스레드 멈춤 · 활성 창 조회 시간을 모아 한 줄
 * @param {{ now: () => number, log: (msg: string) => void, front: () => string }} deps  front: 지금 앞에 있는 앱 이름 */
function createLagWatch(deps){
  const now = deps.now, front = deps.front;
  const emit = createLimiter(deps.log);
  let expect = 0, since = 0;
  let lag, aw;
  function reset(t){ since = t; lag = { n: 0, max: 0, front: '' }; aw = { n: 0, slow: 0, max: 0 }; }
  reset(0);

  /* LAG_TICK_MS 마다 부른다 — 늦게 불린 만큼이 그동안 main 이 멈춘 시간 */
  function tick(){
    const t = now();
    if(!since){ reset(t); expect = t + LAG_TICK_MS; return; }
    const late = t - expect;
    if(late >= LAG_SLOW_MS && late < LAG_SLEEP_MS){
      lag.n++;
      if(late > lag.max){ lag.max = late; lag.front = front() || '?'; }
    }
    expect = t + LAG_TICK_MS;
    if(t - since >= REPORT_MS) report(t);
  }
  /* 활성 창 조회 한 번이 끝날 때 걸린 ms 를 넘긴다 */
  function activeWinDone(ms){
    aw.n++;
    if(ms >= AW_SLOW_MS) aw.slow++;
    if(ms > aw.max) aw.max = ms;
  }
  function report(t){
    if(lag.n || aw.slow){
      emit('[입력지연] ' + Math.round((t - since) / 1000) + '초 — 메인 멈춤(' + LAG_SLOW_MS + 'ms+) ' + lag.n + '번'
        + (lag.n ? ' · 최대 ' + lag.max + 'ms(앞창=' + lag.front + ')' : '')
        + ' | 활성 창 조회 ' + aw.n + '번 · 느림(' + AW_SLOW_MS + 'ms+) ' + aw.slow + '번 · 최대 ' + aw.max + 'ms');
    }
    reset(t);
  }
  return { tick, activeWinDone };
}

const api = { createImeWatch, createLagWatch, describe,
  LAG_TICK_MS, LAG_SLOW_MS, LAG_SLEEP_MS, AW_SLOW_MS, REPORT_MS, END_GRACE_MS, IME_MIN_GAP_MS, MAX_LINES };
if(typeof window !== 'undefined') window.TwInputDiag = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
