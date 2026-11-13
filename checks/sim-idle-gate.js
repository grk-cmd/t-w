/* ═══ 😴 sim-idle-gate.js — 할 일 없을 때 반복 재우기 (shared/idle-gate.js) · 포커스 누적 저장은 바뀐 칸만 ═══════════════
   ・1절: rafWhile — 꺼져 있으면 rAF 를 안 건다 · 켜지면 wake 로 다음 rAF · 꺼진 것을 본 틱에 sleep 한 번 · 두 벌 안 됨 · 그린 장 수가 예전 반복과 같다
   ・2절: intervalWhile — idle 인 틱에 타이머를 지운다 · wake 는 자고 있을 때만 새로 걸고 깨웠는지 돌려준다
   ・3절: onClassChange — class 만 지켜본다 · 요소가 없으면 아무것도 안 건다
   ・4절: 포커스 누적 저장(focus-level.js addFocusSeconds — 활성 앱 상태 0.5초마다) — 저장된 글과 같은 칸은 안 쓴다 ·
          남는 값은 예전(세 칸 늘 쓰기)과 같다 · 지워졌으면 다시 쓴다
   ・5절: 일부러 깨 보기
   쓰는 곳의 동작(런처 · 꾸미기 미리보기 · 플레이리스트 폴링)은 각 모듈 검사가 본다:
     sim-launcher-preview 5절 · sim-wardrobe 5절 · sim-playlist 7-2절 · 게임패드는 idle-gate 를 안 쓰고 sim-gamepad-activity 1-2절
   [실행] idle-gate.js · focus-level.js 가 있는 폴더에서(러너 스테이징). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (n, dir) => [n, 'parts/' + dir + '/' + n, 'app/parts/' + dir + '/' + n].map(read).find(Boolean);
const GATE = pick('idle-gate.js', 'shared'), FL = pick('focus-level.js', 'focus');
if(!GATE || !FL){ say('  ? 원본 못 찾음 — idle-gate.js · focus-level.js'); process.exit(2); }

const loadGate = (src, MO) => { const w = { MutationObserver: MO }; new Function('window', 'module', src)(w, undefined); return w.TwIdleGate; };

function judgeGate(src){
  const r = [], t = (ok, msg) => r.push([!!ok, msg]);
  let G;
  try{ G = loadGate(src, class {}); }catch(e){ t(false, '싣기 — ' + e.message); return r; }
  t(G && ['rafWhile', 'intervalWhile', 'onClassChange'].every(n => typeof G[n] === 'function'), '싣기만 하면 window.TwIdleGate — rafWhile · intervalWhile · onClassChange');

  /* 1절 — 가짜 rAF 줄. «예전 반복» = 늘 다시 걸고 켜졌을 때만 그리는 것 */
  {
    const st = { q: [], on: false, frames: [], sleeps: 0 };
    const raf = (f) => { st.q.push(f); };
    const L = G.rafWhile({ isOn: () => st.on, frame: (n) => st.frames.push(n), sleep: () => { st.sleeps++; }, raf });
    const old = { q: [], frames: [] };
    const oldLoop = (n) => { if(st.on) old.frames.push(n); old.q.push(oldLoop); };
    old.q.push(oldLoop);
    let wakes = 0;   // 예전 반복이 깨어난 수
    const step = (n, now) => { for(let i = 0; i < n; i++){ now.t += 16; const q = st.q; st.q = []; q.forEach(f => f(now.t)); const oq = old.q; old.q = []; wakes += oq.length; oq.forEach(f => f(now.t)); } };
    const clock = { t: 0 };
    L.wake();
    t(st.q.length === 0 && !L.running(), '꺼진 채 wake — rAF 를 안 건다');
    step(100, clock);
    t(st.frames.length === 0 && st.q.length === 0 && wakes === 100, '★ 꺼진 100장 — 새 반복은 한 번도 안 깨고 예전 반복은 100번 깼다(클래스만 보고)');
    st.on = true; L.wake(); L.wake();
    t(st.q.length === 1 && L.running(), '★ 켜고 wake — 다음 rAF 하나(두 번 불러도 하나)');
    step(30, clock);
    t(st.frames.length === 30 && JSON.stringify(st.frames) === JSON.stringify(old.frames), '  켜진 30장 — 그린 장과 시각이 예전 반복과 같다');
    st.on = false; step(1, clock);
    t(st.q.length === 0 && st.sleeps === 1 && !L.running(), '★ 꺼진 것을 본 틱에서 sleep 한 번 · 더 안 건다');
    step(10, clock);
    t(st.sleeps === 1, '  자는 동안 sleep 을 또 부르지 않는다');
    st.on = true; L.wake(); st.on = false; st.on = true; L.wake();
    t(st.q.length === 1, '  깨운 뒤 틱 전에 여닫아도 한 벌');
    step(5, clock);
    t(JSON.stringify(st.frames) === JSON.stringify(old.frames), '  다시 켠 뒤에도 그린 장이 예전과 같다(첫 장이 늦지 않다)');
  }

  /* 2절 — 가짜 타이머 */
  {
    const tm = new Map(); let id = 0, steps = 0, idle = false;
    const I = G.intervalWhile({ idle: () => idle, step: () => { steps++; }, ms: 300,
      setInterval: (f, ms) => { tm.set(++id, { f, ms }); return id; }, clearInterval: (k) => { tm.delete(k); } });
    const tick = () => [...tm.values()].forEach(x => x.f());
    t(I.wake() === true && tm.size === 1 && [...tm.values()][0].ms === 300, 'wake — 타이머 하나(주기 그대로) · 깨웠다고 돌려준다');
    t(I.wake() === false && tm.size === 1, '  돌고 있으면 새로 안 건다 · false');
    tick(); tick();
    t(steps === 2, '  idle 이 아니면 틱마다 step');
    idle = true; tick();
    t(tm.size === 0 && steps === 2 && !I.running(), '★ idle 인 틱에서 타이머를 지운다(step 안 함)');
    idle = false;
    t(I.wake() === true && tm.size === 1, '★ 다시 wake — 새 타이머');
  }

  /* 3절 */
  {
    const seen = [];
    const MO = class { constructor(fn){ this.fn = fn; } observe(el, o){ seen.push([el, o, this.fn]); } };
    const G2 = loadGate(src, MO);
    const el = {}; let n = 0;
    G2.onClassChange(el, () => { n++; });
    t(seen.length === 1 && seen[0][0] === el && seen[0][1].attributes === true && JSON.stringify(seen[0][1].attributeFilter) === '["class"]', 'class 만 지켜본다(attributeFilter)');
    seen[0][2]([{}]);
    t(n === 1, '  바뀌면 부른다');
    t(G2.onClassChange(null, () => {}) === null && seen.length === 1, '  요소가 없으면 아무것도 안 건다');
  }
  return r;
}

/* 4절 — focus-level.js 를 가짜 deps 로 만들고 addFocusSeconds 를 0.5초 틱처럼 부른다 */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? undefined : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function judgeFocus(src){
  const r = [], t = (ok, msg) => r.push([!!ok, msg]);
  const any = anything();
  const st = { total: 0, today: 0, session: 0, day: '2026-11-14', store: {}, writes: [] };
  const ls = { getItem: (k) => (k in st.store ? st.store[k] : null), setItem: (k, v) => { st.writes.push(k); st.store[k] = String(v); }, removeItem: (k) => { delete st.store[k]; } };
  const deps = new Proxy({
    FOCUS_TOTAL_KEY: 'tw.focusTotalSec', FOCUS_TODAY_SEC_KEY: 'tw.focusTodaySec', FOCUS_TODAY_DATE_KEY: 'tw.focusTodayDate',
    FOCUS_TOTAL_CAP_SEC: 100, FOCUS_LEVEL_CAP_HOURS: 999, FOCUS_CYCLE_SEC: 999 * 3600, FOCUS_CYCLE_CAP: 100,
    _focusDayStr: () => st.day,
    _focusTotalSec: () => st.total, setFocusTotalSec: (v) => { st.total = v; },
    _focusTodaySec: () => st.today, setFocusTodaySec: (v) => { st.today = v; },
    _focusSessionSec: () => st.session, setFocusSessionSec: (v) => { st.session = v; },
    getMyUserId: () => null,
  }, { get: (o, k) => k in o ? o[k] : (() => any) });
  let api;
  try{
    api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'module',
      src + '\nreturn window.TwFocusLevel;')(new Proxy({}, { get: (o, k) => k in o ? o[k] : any, set: (o, k, v) => { o[k] = v; return true; } }), any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, undefined).createFocusLevel(deps);
  }catch(e){ t(false, 'focus-level.js 만들기 — ' + e.message); return r; }
  const K = (k) => st.writes.filter(w => w === k).length;
  api.addFocusSeconds(0.5);
  t(st.writes.length === 3, '처음 — 세 칸 다 쓴다(저장된 것이 없다)');
  st.writes = [];
  for(let i = 0; i < 10; i++) api.addFocusSeconds(0.5);
  t(K('tw.focusTodayDate') === 0 && K('tw.focusTotalSec') === 10 && K('tw.focusTodaySec') === 10, '★ 같은 날 0.5초 틱 10번 — 날짜는 안 쓰고 누적 · 오늘만(30 → 20번)');
  t(st.store['tw.focusTotalSec'] === String(st.total) && st.store['tw.focusTodaySec'] === String(st.today) && st.store['tw.focusTodayDate'] === st.day, '  남는 값은 예전과 같다(메모리 값 그대로)');
  st.day = '2026-11-15'; st.writes = [];
  api.addFocusSeconds(0.5);
  t(K('tw.focusTodayDate') === 1 && st.store['tw.focusTodayDate'] === '2026-11-15' && st.store['tw.focusTodaySec'] === '0.5', '  날이 바뀌면 날짜를 쓰고 오늘은 새로 센다');
  delete st.store['tw.focusTotalSec']; delete st.store['tw.focusTodayDate']; st.writes = [];
  api.addFocusSeconds(0.5);
  t(K('tw.focusTotalSec') === 1 && K('tw.focusTodayDate') === 1, '★ 밖에서 지워졌으면(계정 전환) 다시 쓴다 — 메모리 사본이 아니라 저장된 값과 견준다');
  st.total = 100; st.store['tw.focusTotalSec'] = '100'; st.writes = [];
  api.addFocusSeconds(0.5);
  t(K('tw.focusTotalSec') === 0 && st.total === 100, '  누적 상한이면 누적 칸도 안 쓴다');
  return r;
}

const rows = judgeGate(GATE);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1~3. idle-gate.js'); chk(ok, msg); });
say('── 4. 포커스 누적 저장 — 바뀐 칸만');
const rowsF = judgeFocus(FL);
rowsF.forEach(([ok, msg]) => chk(ok, msg));

say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['꺼져도 rAF 를 계속', 'G', s => s.replace("if(!o.isOn()){ on = false; o.sleep(now); return; }", 'if(!o.isOn()){ o.raf(tick); return; }')],
  ['wake 가 두 벌을 건다', 'G', s => s.replace('if(on || !o.isOn()) return;', 'if(!o.isOn()) return;')],
  ['idle 이어도 타이머를 남김', 'G', s => s.replace('if(o.idle()){ o.clearInterval(id); id = null; return; }', 'if(o.idle()) return;')],
  ['class 아닌 것도 지켜봄', 'G', s => s.replace("ob.observe(el, { attributes: true, attributeFilter: ['class'] });", 'ob.observe(el, { attributes: true });')],
  ['날짜를 늘 씀', 'F', s => s.replace('_lsSetIfChanged(FOCUS_TODAY_DATE_KEY,_focusDayStr());', 'localStorage.setItem(FOCUS_TODAY_DATE_KEY,_focusDayStr());')],
  ['메모리 사본과 견줌(지워져도 안 씀)', 'F', s => s.replace("if(localStorage.getItem(k) !== v) localStorage.setItem(k, v);", "if(_lsLast[k] !== v){ _lsLast[k] = v; localStorage.setItem(k, v); }").replace('function _lsSetIfChanged(k, v){', 'const _lsLast = {};\nfunction _lsSetIfChanged(k, v){')],
];
for(const [nm, which, f] of breaks){
  const g2 = which === 'G' ? f(GATE) : GATE, f2 = which === 'F' ? f(FL) : FL;
  const changed = g2 !== GATE || f2 !== FL;
  let r2; try{ r2 = which === 'G' ? judgeGate(g2) : judgeFocus(f2); }catch(_){ r2 = [[false, '던짐']]; }
  chk(changed && r2.some(([ok]) => !ok), nm + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
