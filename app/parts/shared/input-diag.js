/* input-diag.js — 🩺 한글 씹힘 진단 — 진단 기록(tw-mouse-diag.log)에 남길 줄을 만든다
   ・createImeWatch(deps) — 렌더러: 한글 조합이 포커스 뺏김 · 창 잃음 · 칸 사라짐으로 끊기면 한 줄. 친 글자는 적지 않는다(조합 길이만).
   ・createLagWatch(deps) — main: 메인 스레드 멈춤 · 활성 창 조회 시간을 모아 REPORT_MS 마다 한 줄(느린 것이 있을 때만).
   [왜] 개발 PC 에서는 씹힘이 재현되지 않았고, «조합 중 포커스를 잃으면 글자가 깨진다» 만 재현됐다. 맥 전역 키 훅은
     키마다 main 스레드에 묻고 기다리므로, main 이 멈춰도 키가 밀린다. 제보자 PC 에서 둘 중 무엇이 나는지 이 줄로 가른다.
   ⚠️ 줄 수 상한(MAX_LINES) — 이 진단이 클릭고착 · 포커스 기록을 밀어내지 않게(파일은 256KB 에서 회전).
   ⚠️ 사람이 누르기 · Tab · Enter · Esc 로 칸을 옮겨 조합이 끝나는 것은 평소 입력이라 남기지 않는다(맥은 끝 글자가 늘 조합 중이다).
   ⚠️ 못 보는 것: 조합 중 칸을 display:none 으로 숨기면 크로미움이 focusout · compositionend 를 둘 다 안 보낸다.
   검사: checks/sim-input-diag.js */
(function(){
'use strict';

const LAG_TICK_MS = 100;            // 멈춤을 재는 간격
const LAG_SLOW_MS = 100;            // 이만큼 늦으면 «멈춤» — 키 하나가 이만큼 밀리면 글자가 밀린다
const LAG_SLEEP_MS = 10 * 1000;     // 이보다 길면 절전 · 잠자기로 보고 세지 않는다
const AW_SLOW_MS = 50;              // 활성 창 조회가 이만큼 걸리면 «느림»
const REPORT_MS = 60 * 1000;        // 모아서 남기는 주기
const END_GRACE_MS = 50;            // 조합이 끝난 뒤 이 안에 포커스를 잃으면 «포커스가 옮겨 가 끝난 조합»
const USER_MOVE_MS = 300;           // 이 안에 누르기 · 아래 키가 있었으면 사람이 옮긴 것 — 기록하지 않는다(평소 입력)
const USER_MOVE_KEYS = new Set(['Tab', 'Enter', 'Escape']);   // Enter · Esc 에 blur 하는 칸이 있다(닉네임 · 제목) — 맥은 조합 중인 채 Enter 를 보낸다
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

/** 렌더러 — 한글 조합이 포커스 뺏김 · 창 잃음 · 칸 사라짐으로 끊기는 순간
 * @param {{ note: (msg: string) => void, now: () => number, defer: (fn: () => void) => void }} deps  defer: 이벤트가 다 끝난 뒤 한 번(setTimeout 0)
 * 크로미움(Electron 44 실측) 순서 — 칸을 옮기면 compositionend → blur → focusout(같은 틱), 다른 앱이 앞으로 오면
 * focusout(창 포커스 없음) → window blur → compositionend, 칸을 다시 그리면 compositionend 없이 focusout(그때는 아직 붙어 있음). */
function createImeWatch(deps){
  const now = deps.now, defer = deps.defer;
  const emit = createLimiter(deps.note);
  let comp = null;      // 조합 중 { el, at, len }
  let ended = null;     // 방금 끝난 조합 { el, at, len, endAt }
  let userMoveAt = -Infinity;   // 마지막 누르기 · Tab — 사람이 칸을 옮긴 것
  const lastAt = new Map();   // 갈래(why)마다 — 다른 갈래가 바로 뒤에 나도 버리지 않게

  function say(why, msg){
    const t = now();
    if(t - (lastAt.has(why) ? lastAt.get(why) : -Infinity) < IME_MIN_GAP_MS) return;
    if(emit(msg)) lastAt.set(why, t);
  }
  function line(why, c, docFocused){
    say(why, '[한글] 조합 중 ' + why + ' — 칸=' + describe(c.el) + ' 조합 ' + c.len + '글자 · 시작 뒤 ' + (now() - c.at) + 'ms'
      + ' · 창 포커스=' + (docFocused ? '있음' : '없음'));
  }
  function onStart(e){ comp = { el: e.target, at: now(), len: 0 }; ended = null; }
  function onUpdate(e){ if(comp) comp.len = String((e && e.data) || '').length; }
  function onEnd(){ if(!comp) return; ended = Object.assign({}, comp, { endAt: now() }); comp = null; }
  function onUserMove(){ userMoveAt = now(); }
  /* 칸 focusout — 조합이 아직 살아 있으면 «창을 잃음» 이나 «칸이 사라짐», 방금 끝났는데 사람이 옮긴 게 아니면 «뺏김» */
  function onFocusOut(el, docFocused){
    if(comp && el === comp.el){
      const c = comp;
      comp = null;
      if(!docFocused){ line('창 포커스 잃음', c, false); return; }
      defer(()=> line(c.el && c.el.isConnected === false ? '입력칸이 사라짐' : '칸 포커스 잃음', c, true));
      return;
    }
    if(ended && el === ended.el && now() - ended.endAt <= END_GRACE_MS){
      const c = ended;
      ended = null;
      if(now() - userMoveAt > USER_MOVE_MS) line('포커스 뺏김(누르기 · 키 없음)', c, docFocused);
    }
  }
  /* 창 blur — focusout 없이 창만 잃는 경우의 몫 */
  function onWinBlur(){ if(comp){ const c = comp; comp = null; line('창 포커스 잃음', c, false); } }
  function attach(doc, win){
    if(!doc || doc.__twImeWatch) return;
    doc.__twImeWatch = true;
    const focused = ()=>{ try{ return !!doc.hasFocus(); }catch(_){ return false; } };
    doc.addEventListener('compositionstart', onStart, true);
    doc.addEventListener('compositionupdate', onUpdate, true);
    doc.addEventListener('compositionend', onEnd, true);
    doc.addEventListener('pointerdown', onUserMove, true);
    doc.addEventListener('keydown', (e)=>{ if(e && USER_MOVE_KEYS.has(e.key)) onUserMove(); }, true);
    doc.addEventListener('focusout', (e)=> onFocusOut(e.target, focused()), true);
    if(win) win.addEventListener('blur', onWinBlur);
  }
  return { attach };
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
  USER_MOVE_MS, USER_MOVE_KEYS, LAG_TICK_MS, LAG_SLOW_MS, LAG_SLEEP_MS, AW_SLOW_MS, REPORT_MS, END_GRACE_MS, IME_MIN_GAP_MS, MAX_LINES };
if(typeof window !== 'undefined') window.TwInputDiag = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
