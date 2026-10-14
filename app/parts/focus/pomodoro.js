/* pomodoro.js — 🍅 뽀모도로(포커스 기록창 안쪽 서랍 · 집중 / 휴식 타이머 · 미니미 줄 · 머리 위 «🍅 집중 18분»)
   app.js 의 «🍅 뽀모도로» 구역 앞머리(상태 · 구간 넘기기 · 서랍 그리기 · 버튼 연결, 176줄)를 그대로 옮긴 모듈이다
   (앱 FSD 6번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다. 같은 구역 뒤쪽에 섞여 있던 myHomeOpen · applyDesktopRunClass ·
   데스크탑 모드(실행 화면 입력 판정 · 클릭 통과)는 뽀모가 아니라 app.js 에 남겼다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도, 이름을 읽는 방법도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     받는 넷(toast · _focusShowPush · weeklyChal · _pomoSnd)은 같은 이름의 const 로 받는다. weeklyChal · _pomoSnd 는
     app.js 에서 이 모듈을 만드는 줄보다 **앞에** 선언되고 다시 대입되지 않는 const 라 값으로 받는다.
   ★ 밖으로 내놓는 이름은 window._pomoShowText 하나다 — 부르는 곳(app.js 📊 오늘 기록 전시의 _focusShowConf)은
     **이 모듈을 만드는 줄보다 먼저**(bindFocusShow, 스크립트 로드 중) 불리므로 반환값(const)을 볼 수 없다(TDZ).
     그래서 예전처럼 typeof _pomoShowText 가드로 window 고리를 본다 — 만들기 전에는 고리가 없어 '' (예전에도 그때는
     _pomoRun 이 아직 undefined 라 '' 였다). createPomodoro 는 같은 함수를 반환값으로도 내놓는다(검사용).
     본문 머리의 «⚠️ 상태 변수는 var» 는 app.js 맨 앞 칸에 있을 때의 이야기다 — 지금은 createPomodoro 안이라 TDZ 가 없지만
     글자 그대로 두었다.
   ★ createPomodoro 는 app.js 의 원래 자리(👑 달성표 연결 바로 뒤)에서 부른다. 만들 때 바로 도는 것(tw.pomo · tw.pomoRun 읽기 ·
     🍅 버튼 · 서랍 버튼 연결 · 첫 그리기 · 1초 tick)이 예전과 같은 순서 · 같은 때에 돈다.
   ⚠️ document · localStorage · window._focusLogClamp 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwPomodoro — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-pomodoro-module.js — 만들 때 배선 · 시작 · 일시정지 · 건너뛰기 · 멈춤 · 한 사이클 · 서랍 열고 닫기(👑 달성표와 하나만) ·
         재시작 이어짐 · 머리 위 고리 · app.js 배선 · html 순서. 마크업 · 구간 셈은 sim-pomodoro 가 이 파일을 읽어 본다. */
(function(){

function createPomodoro(deps){
const toast = deps.toast;
const _focusShowPush = deps.focusShowPush;   // 📊 머리 위 «🍅 집중 18분» 즉시 갱신 — app.js(오늘 기록 전시)
const weeklyChal = deps.weeklyChal;          // 👑 달성표 — 뽀모 서랍을 열면 달성표 서랍을 닫는다(같은 자리 · 하나만)
const _pomoSnd = deps.pomoSnd;               // 🔔 알림음 풀 — app.js 효과음 공장(자동재생 잠금 해제 등록보다 앞에서 만든다)

/* ═══ 🍅 뽀모도로 (2026-10-02 · 시안 A안 확정 · 포커스 기록창 안쪽 서랍) ════════════════════════════════════
   [누적기록][🍅 뽀모][👑 달성표] — 🍅 를 누르면 달성표와 같은 자리에 서랍이 열린다(둘 중 하나만 · _chalOpen 이 이쪽을 닫는다).
   ★ 포커스 기록(addFocusSeconds)은 **건드리지 않는다.** 기록은 지금처럼 포커싱 앱 사용 시간으로 쌓이고,
     뽀모는 시간을 재고 알려 주기만 한다 — 둘을 섞으면 같은 시간이 두 번 쌓이거나 레벨·달성표 판정이 바뀐다.
   ★ 시간은 끝나는 시각(endAt, 벽시계)으로 잰다 — 창이 가려져 타이머가 늦게 돌아도 남은 시간이 밀리지 않는다.
     재시작해도 이어지도록 진행 상태를 tw.pomoRun 에 남긴다(설정은 tw.pomo).
   ★ 머리 위 표시는 새 배관이 없다 — 🕒(오늘 기록 보여주기)가 켜져 있을 때 _focusShowConf 가 «🍅 18분» 으로 바꿔 싣는다.
   ★ 무료 기능(왕관 없음).
   ⚠️ 상태 변수는 var — _focusShowConf 가 이 블록보다 **먼저**(bindFocusShow, 스크립트 로드 중) 불린다. let 이면 TDZ 로 앱이 안 켜진다. */
var POMO_KEY = 'tw.pomo', POMO_RUN_KEY = 'tw.pomoRun';
var POMO_PRESETS = { '25': { f:25, s:5, l:15 }, '50': { f:50, s:10, l:20 } };
var _pomoCfg = { preset:'25', f:25, s:5, l:15, every:4, auto:true, sound:true };
var _pomoRun = null;   // { phase:'focus'|'short'|'long', endAt, left(일시정지 중 남은 ms), paused, done(이번 사이클에 끝낸 집중 수), total(이 구간 길이 ms) }
try{ const c = JSON.parse(localStorage.getItem(POMO_KEY) || 'null'); if(c && typeof c === 'object') Object.assign(_pomoCfg, c); }catch(_){}
try{ const r = JSON.parse(localStorage.getItem(POMO_RUN_KEY) || 'null'); if(r && r.phase && r.total > 0) _pomoRun = r; }catch(_){}
function _pomoClampMin(v, lo, hi, d){ const n = parseInt(v, 10); return (n >= lo && n <= hi) ? n : d; }
function _pomoSaveCfg(){ try{ localStorage.setItem(POMO_KEY, JSON.stringify(_pomoCfg)); }catch(_){} }
function _pomoSaveRun(){ try{ if(_pomoRun) localStorage.setItem(POMO_RUN_KEY, JSON.stringify(_pomoRun)); else localStorage.removeItem(POMO_RUN_KEY); }catch(_){} }
function _pomoPhaseMs(phase){ return 60 * 1000 * (phase === 'focus' ? _pomoCfg.f : phase === 'long' ? _pomoCfg.l : _pomoCfg.s); }
function _pomoLeftMs(now){
  if(!_pomoRun) return 0;
  return _pomoRun.paused ? Math.max(0, _pomoRun.left || 0) : Math.max(0, _pomoRun.endAt - (now || Date.now()));
}
function _pomoFmt(ms){ const s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
/* 머리 위(🕒 켜짐일 때) 문구 — 1분에 한 번 나가므로 **분**만. 12자 안. */
function _pomoShowText(){
  if(!_pomoRun) return '';
  if(_pomoRun.paused) return '🍅 일시정지';
  const min = Math.max(1, Math.ceil(_pomoLeftMs() / 60000));
  return (_pomoRun.phase === 'focus' ? '🍅 집중 ' : '☕ 휴식 ') + min + '분';
}
function _pomoStartPhase(phase, paused){
  const total = _pomoPhaseMs(phase);
  const done = _pomoRun ? (_pomoRun.done || 0) : 0;
  _pomoRun = { phase, total, done, paused: !!paused, left: total, endAt: Date.now() + total };
  _pomoSaveRun();
}
function _pomoChime(){
  if(!_pomoCfg.sound) return;
  try{ _pomoSnd.play(); }catch(_){}   // 지정 알림음 파일(parts/pomodoro-alarm.mp3) — 위 _mkSndPool 참고
}
/* 한 구간이 끝났다 — 집중 → 휴식(4바퀴마다 긴 휴식), 휴식 → 다음 집중(자동 시작이 꺼져 있으면 멈춘 채로 대기). */
function _pomoAdvance(){
  if(!_pomoRun) return;
  if(_pomoRun.phase === 'focus'){
    _pomoRun.done = (_pomoRun.done || 0) + 1;
    const long = (_pomoRun.done % _pomoCfg.every) === 0;
    _pomoChime();
    try{ toast(long ? '🍅 ' + _pomoCfg.every + '바퀴 완료! 긴 휴식 ' + _pomoCfg.l + '분' : '🍅 집중 끝! 휴식 ' + _pomoCfg.s + '분'); }catch(_){}
    _pomoStartPhase(long ? 'long' : 'short', false);
  }else{
    if(_pomoRun.phase === 'long') _pomoRun.done = 0;   // 긴 휴식이 끝나면 새 사이클
    _pomoChime();
    try{ toast(_pomoCfg.auto ? '☕ 휴식 끝! 다음 집중을 시작해요' : '☕ 휴식 끝! ▶ 를 누르면 다음 집중이 시작돼요'); }catch(_){}
    _pomoStartPhase('focus', !_pomoCfg.auto);
  }
  try{ _focusShowPush(true); }catch(_){}
}
function _pomoOpen(on){
  const win = document.getElementById('focusLogWin'); if(!win) return;
  if(on){ try{ weeklyChal.open(false); }catch(_){} }
  win.classList.toggle('pomo-on', !!on);
  _pomoRender();
  try{ if(typeof window._focusLogClamp === 'function') window._focusLogClamp(); }catch(_){}
}
function _pomoRender(){
  const $ = id => document.getElementById(id);
  const win = $('focusLogWin'); if(!win) return;
  const btn = $('pomoBtn'), run = _pomoRun, left = _pomoLeftMs();
  const rest = !!(run && run.phase !== 'focus');
  if(btn){
    /* 서랍을 닫아 둬도 돌고 있다는 걸 버튼이 알려 준다(남은 시간). */
    btn.textContent = (run && !win.classList.contains('pomo-on')) ? ((rest ? '☕ ' : '🍅 ') + _pomoFmt(left)) : '🍅 뽀모';
    btn.classList.toggle('run', !!run);
  }
  const mini = $('pomoMiniRow');
  if(mini){
    mini.style.display = run ? 'flex' : 'none';   // 일반 크기에서는 CSS 가 숨긴다(미니미에서만 보임)
    mini.classList.toggle('rest', rest);
    const ml = $('pomoMiniLbl'), mt = $('pomoMiniTime');
    if(ml) ml.textContent = rest ? '☕ 휴식' : ('🍅 ' + Math.min((run ? run.done : 0) + 1, _pomoCfg.every) + '/' + _pomoCfg.every);
    if(mt) mt.textContent = _pomoFmt(left);
  }
  if(!win.classList.contains('pomo-on')) return;
  const setup = $('pomoSetup'), runEl = $('pomoRun');
  if(setup) setup.style.display = run ? 'none' : 'block';
  if(runEl) runEl.style.display = run ? 'block' : 'none';
  if(!run){
    const seg = $('pomoPresetSeg');
    if(seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === _pomoCfg.preset));
    const custom = (_pomoCfg.preset === 'custom');
    [['pomoInFocus','f'],['pomoInShort','s'],['pomoInLong','l'],['pomoInEvery','every']].forEach(([id, k]) => {
      const el = $(id); if(!el) return;
      if(document.activeElement !== el) el.value = String(_pomoCfg[k]);
      el.disabled = !custom && k !== 'every';
    });
    const a = $('pomoChkAuto'), s = $('pomoChkSound');
    if(a) a.classList.toggle('on', !!_pomoCfg.auto);
    if(s) s.classList.toggle('on', !!_pomoCfg.sound);
    return;
  }
  const ph = $('pomoPhase'), big = $('pomoBig'), bar = $('pomoBar'), fill = $('pomoBarFill'), dots = $('pomoDots'), pause = $('pomoPause');
  const n = Math.min((run.done || 0) + (run.phase === 'focus' ? 1 : 0), _pomoCfg.every);
  if(ph){
    ph.textContent = run.phase === 'focus' ? ('🍅 집중 ' + n + ' / ' + _pomoCfg.every) : (run.phase === 'long' ? '☕ 긴 휴식' : '☕ 휴식');
    if(run.paused) ph.textContent += ' · 멈춤';
    ph.classList.toggle('rest', rest); ph.classList.toggle('paused', !!run.paused);
  }
  if(big) big.textContent = _pomoFmt(left);
  if(bar) bar.classList.toggle('rest', rest);
  if(fill) fill.style.width = Math.max(0, Math.min(100, 100 * (1 - left / run.total))).toFixed(1) + '%';
  if(dots){ let t = ''; for(let i = 0; i < _pomoCfg.every; i++) t += (i < (run.done || 0)) ? '🍅' : '⚪'; dots.textContent = t; }
  if(pause) pause.textContent = run.paused ? '▶ 계속' : '⏸ 일시정지';
}
function _pomoTick(){
  if(_pomoRun && !_pomoRun.paused){
    /* 오래 꺼져 있다 켜진 경우 — 지난 구간을 한꺼번에 소리 내며 몰아서 넘기지 않는다. 한 번만 넘기고,
       그 다음 구간도 이미 지났으면 그냥 멈춘 채로 새 집중을 기다린다. */
    if(Date.now() >= _pomoRun.endAt){
      const late = Date.now() - _pomoRun.endAt;
      _pomoAdvance();
      if(_pomoRun && !_pomoRun.paused && late > _pomoRun.total){ _pomoRun.done = 0; _pomoStartPhase('focus', true); }
    }
  }
  _pomoRender();
}
(function bindPomo(){
  const $ = id => document.getElementById(id);
  const btn = $('pomoBtn'); if(!btn) return;
  btn.onclick = () => { const w = $('focusLogWin'); _pomoOpen(!(w && w.classList.contains('pomo-on'))); };
  const seg = $('pomoPresetSeg');
  if(seg) seg.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button[data-p]'); if(!b) return;
    _pomoCfg.preset = b.dataset.p;
    if(POMO_PRESETS[b.dataset.p]) Object.assign(_pomoCfg, POMO_PRESETS[b.dataset.p]);
    _pomoSaveCfg(); _pomoRender();
  });
  const bindIn = (id, k, lo, hi) => {
    const el = $(id); if(!el) return;
    el.addEventListener('change', () => { _pomoCfg[k] = _pomoClampMin(el.value, lo, hi, _pomoCfg[k]); el.value = String(_pomoCfg[k]); _pomoSaveCfg(); });
    el.addEventListener('keydown', e => e.stopPropagation());   // 단축키(F1~)·채팅 입력이 숫자 칸을 가로채지 않게
  };
  bindIn('pomoInFocus', 'f', 1, 180); bindIn('pomoInShort', 's', 1, 60); bindIn('pomoInLong', 'l', 1, 90); bindIn('pomoInEvery', 'every', 1, 8);
  const tog = (id, k) => { const el = $(id); if(el) el.onclick = () => { _pomoCfg[k] = !_pomoCfg[k]; _pomoSaveCfg(); _pomoRender(); }; };
  tog('pomoChkAuto', 'auto'); tog('pomoChkSound', 'sound');
  const st = $('pomoStart');
  if(st) st.onclick = () => {
    /* 입력 중인 칸이 change 를 아직 안 쐈을 수 있다 — 시작 전에 한 번 읽는다. */
    [['pomoInFocus','f',1,180],['pomoInShort','s',1,60],['pomoInLong','l',1,90],['pomoInEvery','every',1,8]].forEach(([id,k,lo,hi]) => { const el = $(id); if(el && !el.disabled) _pomoCfg[k] = _pomoClampMin(el.value, lo, hi, _pomoCfg[k]); });
    _pomoSaveCfg();
    _pomoRun = null; _pomoStartPhase('focus', false);
    try{ _pomoSnd.prime(); }catch(_){}   // 시작 버튼 = 사용자 제스처 — 여기서 잠금을 풀어 둔다
    try{ _focusShowPush(true); }catch(_){}
    _pomoRender();
  };
  const pz = $('pomoPause');
  if(pz) pz.onclick = () => {
    if(!_pomoRun) return;
    if(_pomoRun.paused){ _pomoRun.paused = false; _pomoRun.endAt = Date.now() + (_pomoRun.left || 0); }
    else { _pomoRun.left = _pomoLeftMs(); _pomoRun.paused = true; }
    _pomoSaveRun(); try{ _focusShowPush(true); }catch(_){} _pomoRender();
  };
  const sk = $('pomoSkip');
  if(sk) sk.onclick = () => {
    if(!_pomoRun) return;
    /* 건너뛰기는 소리·알림 없이 다음 구간으로. 집중을 건너뛰면 그 바퀴는 센다(사람이 끝냈다고 본 것). */
    const snd = _pomoCfg.sound; _pomoCfg.sound = false;
    try{ _pomoAdvance(); } finally { _pomoCfg.sound = snd; }
    if(_pomoRun && _pomoRun.paused && _pomoRun.phase === 'focus'){ /* 자동 시작 꺼짐 — 건너뛰기는 사람이 누른 것이니 바로 돈다 */ _pomoRun.paused = false; _pomoRun.endAt = Date.now() + _pomoRun.total; _pomoSaveRun(); }
    _pomoRender();
  };
  const sp = $('pomoStop');
  if(sp) sp.onclick = () => { _pomoRun = null; _pomoSaveRun(); try{ _focusShowPush(true); }catch(_){} _pomoRender(); };
  _pomoRender();
  setInterval(_pomoTick, 1000);
})();

/* 📊 _focusShowConf(app.js)가 typeof 로 보는 고리 — 위 머리 주석(만드는 줄보다 먼저 불린다). */
window._pomoShowText = _pomoShowText;

return {
  showText: _pomoShowText,   // 머리 위 문구(window._pomoShowText 와 같은 함수)
  open: _pomoOpen,           // 서랍 열기 · 닫기(🍅 버튼과 같은 함수)
  render: _pomoRender,       // 검사용
  tick: _pomoTick,           // 1초 tick(검사용 — 만들 때 setInterval 에 건 것과 같은 함수)
  cfg: ()=>_pomoCfg,         // 검사용
  run: ()=>_pomoRun,         // 검사용
};
}

const api = { createPomodoro };
if(typeof window !== 'undefined') window.TwPomodoro = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
