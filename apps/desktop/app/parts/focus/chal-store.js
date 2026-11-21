/* chal-store.js — 👑 달성표 상태 주인 — 목표 · 기록 · 보상은 서버 한 주 한 벌, 이 PC 는 «오늘 진행» 만 (검사 sim-chal-store.js)
   책임: 이번 주 한 벌을 서버에서 받고(GET …/challenges/current) · 쓰기 셋(PUT 한 벌 · POST 오늘 달성 · POST 보상 칸)을 한 줄에 세워 보내고 ·
     «오늘 목표를 채웠나» 판정(이 PC 만 아는 사실 — 앱 사용 시간 · [했다] 횟수 · 체크)을 하고 · 서버가 열어 준 보상 칸(claimable)을 받는다.
     화면(서랍 · 팝업)은 weekly-challenge.js — 이 파일은 DOM 도 토스트도 모른다(밖에는 view() 와 이벤트로).
   서버가 센다: 오늘 · 주 · 단계(평일 · 주말) · 정산이 열리는 때 · 보상 양 · 쉬는 날 · 시작일 · «안 센 날»(라이선스 없던 날) · 다음 날 목표 적용. 앱은 서버 값을 그린다(P1).
     앱 날짜 셈 대신: 날 글자(today.day)는 서버가 준 것 · 요일 · 주의 월요일은 그 글자에서만 뽑는다(PC 시계 아님).
   상태: load = idle | loading | ready | failed | locked(PREMIUM_REQUIRED — 실패가 아니라 잠긴 화면).
     받기 전(idle · loading · failed · locked)에는 아무것도 쓰지 않고 판정도 안 한다(requireReady).
   쓰기 한 줄: PUT · today · 보상이 같은 줄(lane)이다 — 앞 쓰기 답이 판(version)을 올리므로 PUT 은 줄에서 차례가 왔을 때의 최신 판을 싣는다. 409(CONCURRENT_UPDATE)는 덮지 않는다:
     잠그고(loading) → 그 주를 다시 받아 → 받은 값으로 · 이벤트 'conflict'(문구는 화면이). 다시 보내지 않는다.
   오늘 달성(POST …/today): 오늘 목표를 채운 순간 하루 한 번만 자동(posted). 실패하면 번호 한 번(E-FOCUS-06) · 혼자 다시 보내지 않고 서랍 [다시 적기](retryPost)로.
   보상(POST …/rewards/{칸}): 받은 한 벌의 claimable 을 칸마다 하나씩 — 받아 온 직후 · 오늘 달성 직후 · 하루가 바뀐 직후 · 서랍 [보상 받기](claimNow). NOT_YET · NOTHING 은 조용히, 실패는 번호 한 번(E-FOCUS-07).
     보상 양 · 뽑기 수는 서버가 센다 — 뽑기 수는 realtime collection 신호로 가챠 모듈이 다시 받는다.
   하루 경계: 서버가 준 today.dayEndsAt 이 지나면 그 주를 다시 받는다(dayEnded · 20초 틱) — 같은 경계에서 3번까지(PC 시계가 서버보다 빨라 아직 옛 날을 줄 때를 위해). 지난 주 기록은 서랍에서 눌렀을 때만 받는다.
   오늘 진행(tw.chalToday · 계정 칸): { day, sec, done, checks, anchor, fail, posted } — 날(day)이 서버 날과 달라지면 새로 시작한다.
   계정 바뀜: startChal 이 session.onReset(reset) 을 건다 — reset 이 gen 을 올려 늦은 답은 아무것도 바꾸지 못한다. 쓰기는 읽은 토큰의 주인(expectOwner)과 묶인다(focus-api.js).
   deps: chalApi(focus-api.js createFocusApi — fetchChallenge · saveChallenge · markToday · claimReward · reset) · focusPure({ failOf, KIND, editBody } — TwFocusApi 순수 함수) ·
         chalCell(계정 칸 get/set/remove) · notifyError 함수(코드 · 오류를 TwErrorCodes.notify 에 넘긴다) · premiumOn() · serverDay() · rolloverToday() · now() · appMode() · addQuitListener(fn)
   ⚠️ 전역 이름은 TwChalStore. 만들 때는 요청 · 타이머 · 계정 칸 읽기를 하지 않는다 — 시작은 startChal 한 번(app-boot → weekly-challenge.js startChallenge).
   검사: checks/sim-chal-store.js */
(function(){
'use strict';

const TODAY_KEY = 'tw.chalToday';
const TICK_MS = 20 * 1000;          // 판정 · 반복 알림 · 하루 경계를 훑는 주기(요청을 되풀이하지 않는다 — 요청은 일이 생길 때 한 번)
const RULE_MAX = 10;                // 📋규칙 한 요일당 최대 줄 수(서버 상한과 같다)
const BOUNDARY_TRIES = 3;           // 같은 하루 경계에서 그 주를 다시 받아 보는 최대 횟수
const DAY_MS = 86400000;
/* days 값의 뜻 — 화면 칸 하나에 대응한다. 1 달성(✓) · 0 오늘 진행 중(●) · -1 아직 안 온 날(·) · -2 실패(✗) · -3 안 세는 날(·) */
const CELL = Object.freeze({ OK: 1, NOW: 0, WAIT: -1, FAIL: -2, SKIP: -3 });
/* 단계 표 — 요일 라벨 · 칸 수 · 보상 임계 · 선지급 지점이 여기 한 곳에서 나온다(보상 양을 정하는 것은 서버 — 이 표는 문구용).
   ⚠️ 요일 라벨이나 칸 수를 다른 곳에 또 적지 말 것. 라벨 길이와 칸 수가 갈리면 표가 조용히 어긋난다. */
const PHASE = Object.freeze({
  wd: Object.freeze({ key: 'wd', name: '주중', label: Object.freeze(['월', '화', '수', '목', '금']), n: 5, first: 0, need1: 2, need2: 4, early: 3, dueLabel: '토요일 아침',
    server: 'WEEKDAY', days: Object.freeze(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']), earlySlot: 'WEEKDAY_EARLY', settleSlot: 'WEEKDAY_SETTLE' }),
  we: Object.freeze({ key: 'we', name: '주말', label: Object.freeze(['토', '일']), n: 2, first: 5, need1: 1, need2: 2, early: 1, dueLabel: '월요일 아침',
    server: 'WEEKEND', days: Object.freeze(['SATURDAY', 'SUNDAY']), earlySlot: 'WEEKEND_EARLY', settleSlot: 'WEEKEND_SETTLE' }),
});
const KIND_OF_SERVER = Object.freeze({ FOCUS: 'focus', REPEAT: 'repeat', RULE: 'rule' });

/* ── 순수 셈 — 서버가 준 날 글자('2026-11-13')와 주 이름('2026-W46')에서만 뽑는다(PC 시계를 보지 않는다) ── */
const pad = (n) => String(n).padStart(2, '0');
function parseDay(s){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
function fmtDay(ms){ const d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function addDays(s, n){ const t = parseDay(s); return isFinite(t) ? fmtDay(t + n * DAY_MS) : null; }
function dowOf(s){ const t = parseDay(s); return isFinite(t) ? new Date(t).getUTCDay() : -1; }   // 0 = 일
/* 그날이 속한 단계 — 월~금 'wd' · 토 · 일 'we' */
function phaseOf(s){ const w = dowOf(s); return w < 0 ? null : (w >= 1 && w <= 5 ? 'wd' : 'we'); }
/* 그 단계 안에서 그날이 몇 번째 칸인가. 단계가 다르면 -1 */
function dayIdx(s, ph){
  const w = dowOf(s);
  if(w < 0) return -1;
  if(ph === 'wd') return (w >= 1 && w <= 5) ? w - 1 : -1;
  return w === 6 ? 0 : (w === 0 ? 1 : -1);
}
/* ISO 주 이름의 월요일 — 1월 4일이 든 주가 1주 */
function mondayOf(iso){
  const m = /^(\d{4})-W(\d{2})$/.exec(String(iso || ''));
  if(!m) return null;
  const jan4 = Date.UTC(+m[1], 0, 4), w = new Date(jan4).getUTCDay() || 7;
  return fmtDay(jan4 - (w - 1) * DAY_MS + (+m[2] - 1) * 7 * DAY_MS);
}
function isoWeekOfDay(s){
  const t = parseDay(s);
  if(!isFinite(t)) return null;
  const w = new Date(t).getUTCDay() || 7, thu = t + (4 - w) * DAY_MS, y = new Date(thu).getUTCFullYear();
  return y + '-W' + pad(1 + Math.floor((thu - Date.UTC(y, 0, 1)) / DAY_MS / 7));
}
function weekBefore(iso){ const mon = mondayOf(iso); return mon ? isoWeekOfDay(addDays(mon, -7)) : null; }
/* 0.12 이 적은 날 글자('2026-11-4')를 서버 글자('2026-11-04')로 */
function normDay(v){
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(v || ''));
  return m ? m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]) : null;
}
/* 그 주 그 단계가 덮는 날짜 범위 글 — '11/9 ~ 11/13' */
function rangeLabel(iso, phKey){
  const mon = mondayOf(iso), ph = PHASE[phKey];
  if(!mon || !ph) return '';
  const a = addDays(mon, ph.first), b = addDays(mon, ph.first + ph.n - 1);
  const md = (s) => (+s.slice(5, 7)) + '/' + (+s.slice(8, 10));
  return md(a) + ' ~ ' + md(b);
}
const clampInt = (raw, lo, hi, fallback) => {
  const n = parseInt(String(raw == null ? '' : raw).replace(/[^0-9]/g, ''), 10);
  return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};
function ruleItems(cfg, dayIdx0){
  const rows = ((cfg && cfg.rules) || [])[dayIdx0] || [];
  return rows.map((x) => String(x || '').trim()).filter(Boolean).slice(0, RULE_MAX);
}
const keyOfApp = (a) => { const s = String(a || ''); return !s ? '' : (s.includes(':') ? s : 'win:' + s.toLowerCase()); };   // 옛 기록은 실행파일 이름만 — 판정 키로 올린다

/* 서버 목표 → 화면 { kind, cfg }. cfg 모양은 설정 화면이 쓰는 것: focus { key, label, hours } · repeat { text, times, gap } · rule { rules: [[줄…]…] }(그 단계 칸 수만큼) */
function uiGoal(g, phKey){
  if(!g || typeof g !== 'object') return null;
  const kind = KIND_OF_SERVER[g.kind];
  if(kind === 'focus') return { kind, cfg: { key: keyOfApp(g.app), label: String(g.label || ''), hours: g.hours | 0 } };
  if(kind === 'repeat') return { kind, cfg: { text: String(g.text || ''), times: g.times | 0, gap: g.intervalHours | 0 } };
  if(kind === 'rule'){
    const rules = PHASE[phKey].days.map((d) => (Array.isArray((g.rules || {})[d]) ? g.rules[d] : []).map(String).slice(0, RULE_MAX));
    return { kind, cfg: { rules } };
  }
  return null;
}
/* 화면 { kind, cfg } → 서버 목표. 서버가 범위를 다시 본다(1~12시간 · 1~10번 · 1~8시간 간격 · 줄 24자) — 여기서는 길이만 자른다 */
function serverGoal(kind, cfg, phKey){
  const c = cfg || {};
  if(kind === 'focus') return { kind: 'FOCUS', hours: clampInt(c.hours, 1, 12, 4), app: String(c.key || '').slice(0, 100), label: String(c.label || '').slice(0, 40) };
  if(kind === 'repeat') return { kind: 'REPEAT', times: clampInt(c.times, 1, 10, 3), intervalHours: clampInt(c.gap, 1, 8, 2), text: String(c.text || '').trim().slice(0, 30) };
  const rules = {};
  PHASE[phKey].days.forEach((d, i) => { const rows = ruleItems(c, i).map((x) => x.slice(0, 24)); if(rows.length) rules[d] = rows; });
  return { kind: 'RULE', rules };
}
function canon(v){
  if(Array.isArray(v)) return v.map(canon);
  if(v && typeof v === 'object'){ const o = {}; for(const k of Object.keys(v).sort()) if(v[k] !== null && v[k] !== undefined) o[k] = canon(v[k]); return o; }
  return v;
}
const sameGoal = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/* 한 주의 단계 값 읽기 · 쓰기 이름 */
const goalOfWeek = (w, ph) => (ph === 'wd' ? w.weekdayGoal : w.weekendGoal);
const skippedOf = (w, ph) => (ph === 'wd' ? w.skippedWeekday : w.skippedWeekend);
const autoOf = (w, ph) => (ph === 'wd' ? w.autoNext : w.autoNextWeekend);
const startedOf = (w, ph) => (ph === 'wd' ? w.weekdayStartedOn : w.weekendStartedOn);
const slotAmount = (w, slot) => { const r = (w.rewards || []).find((x) => x.slot === slot); return r ? r.amount : 0; };

/* 그 단계의 칸들 — nowDay = 서버 «오늘» 글자(이 주의 어디쯤인지). todayFail = 오늘 칸을 ✗ 로(🔁 오늘은 못 채움)
   · 달성한 날 ✓ · 오늘 ● · 아직 안 온 날 · · 지난 날은 목표가 있고 쉬지 않았고 시작일 이후이고 «안 센 날» 이 아니면 ✗, 아니면 · */
function cellsOf(w, phKey, nowDay, todayFail){
  const ph = PHASE[phKey], mon = mondayOf(w.isoWeek);
  if(!mon) return [];
  const done = new Set((w.days || []).filter((d) => d.done).map((d) => d.date));
  const unc = new Set(w.uncountedDays || []);
  const started = startedOf(w, phKey), counted = !!goalOfWeek(w, phKey) && !skippedOf(w, phKey) && !!started;
  const out = [];
  for(let i = 0; i < ph.n; i++){
    const date = addDays(mon, ph.first + i);
    if(done.has(date)) out.push(CELL.OK);
    else if(date === nowDay) out.push(todayFail ? CELL.FAIL : CELL.NOW);
    else if(nowDay && date > nowDay) out.push(CELL.WAIT);
    else out.push(counted && date >= started && !unc.has(date) ? CELL.FAIL : CELL.SKIP);
  }
  return out;
}
const countOf = (cells, v) => cells.filter((x) => x === v).length;

function createChalStore(deps){
  const api = deps.chalApi;
  const { failOf, KIND, editBody } = deps.focusPure;
  const cell = deps.chalCell;
  const notifyError = deps.notifyError;
  const premiumOn = deps.premiumOn;
  const serverDay = deps.serverDay;
  const rolloverToday = deps.rolloverToday;
  const now = deps.now || (() => Date.now());
  const appMode = deps.appMode || (() => 'run');
  const addQuitListener = deps.addQuitListener;

  let started = false, quitBound = false;
  let gen = 0;                       // 계정이 바뀌면(reset) 올라간다 — 늦은 답은 자기 gen 과 달라 아무것도 바꾸지 못한다
  let code = null;
  let load = 'idle';                 // 'idle' | 'loading' | 'ready' | 'failed' | 'locked'
  let week = null;                   // 서버가 준 이번 주 한 벌(challengeOf 모양)
  let rec = null;                    // 오늘 진행 { day, sec, done, checks, anchor, fail, posted }
  let dirty = false;
  let loadRun = null;
  let lane = Promise.resolve();      // 쓰기 한 줄 — PUT · 오늘 달성 · 보상
  let posting = false, postFailed = false, postShown = false;
  let claiming = false, claimFailed = false, claimShown = false;
  let boundary = { key: 0, tries: 0 };
  let prevClaimIso = '';             // 지난 주 보상을 이미 살펴본 «이번 주» — 같은 주에서는 한 번만
  let prevMode = null;               // 🔁 실행 화면에 «들어간 때» 를 알아채는 직전 모드
  let prev = { iso: '', load: 'idle', week: null, run: null };   // 지난 주(서랍에서 지난 주말 기록을 볼 때만)
  const changeFns = [], eventFns = [];

  function onChange(fn){ changeFns.push(fn); }
  function onEvent(fn){ eventFns.push(fn); }
  function changed(){ changeFns.forEach((fn) => { try{ fn(); }catch(e){ console.warn('[달성표] 알림 실패', e); } }); }
  function emit(e){ eventFns.forEach((fn) => { try{ fn(e); }catch(err){ console.warn('[달성표] 이벤트 실패', err); } }); }

  /* ── 서버 «오늘» — 진척 쪽(focus-total) 것과 이 주 답의 것 중 나중 것. 경계가 지났으면 null(새 날을 받기 전에는 판정하지 않는다) ── */
  function curDay(){
    const a = serverDay(), b = week && week.today;
    const t = (a && b) ? (b.dayEndsAt > a.dayEndsAt ? b : a) : (a || b || null);
    return (t && now() < t.dayEndsAt) ? t : null;
  }
  const phaseNow = () => { const d = curDay(); return d ? phaseOf(d.day) : null; };

  /* ── 오늘 진행 ── */
  const freshRec = (day) => ({ day, sec: 0, done: 0, checks: {}, anchor: 0, fail: false, posted: false });
  function saveRec(){
    dirty = false;
    if(!rec) return;
    try{ cell.set(TODAY_KEY, JSON.stringify(rec)); }catch(_){}
  }
  function readRec(){
    try{
      const o = JSON.parse(cell.get(TODAY_KEY) || 'null');
      const day = o && normDay(o.day);
      if(!day) return null;
      return { day, sec: Math.max(0, +o.sec || 0), done: Math.max(0, o.done | 0), checks: (o.checks && typeof o.checks === 'object') ? o.checks : {}, anchor: +o.anchor || 0, fail: o.fail === true, posted: o.posted === true };
    }catch(_){ return null; }
  }
  /* 서버 날이 달라졌으면 새 하루로 — 어제 진행은 버린다 */
  function syncDay(){
    const d = curDay();
    if(!d) return;
    if(!rec || rec.day !== d.day){ rec = freshRec(d.day); postFailed = false; postShown = false; saveRec(); }
    if(week && !rec.posted && (week.days || []).some((x) => x.done && x.date === rec.day)){ rec.posted = true; saveRec(); }   // 서버에 이미 적혀 있다
  }

  /* ── 이번 주 받아 쓰기 ── */
  function adopt(w){
    if(week){
      if(w.isoWeek < week.isoWeek) return false;
      if(w.isoWeek === week.isoWeek){
        if(w.version < week.version) return false;
        if(w.version === week.version && w.today.dayEndsAt < week.today.dayEndsAt) return false;
      }
    }
    week = w;
    syncDay();
    return true;
  }
  async function fetchInto(g, userOpened){
    try{
      const w = await api.fetchChallenge(code);
      if(g !== gen) return 'skipped';
      adopt(w);
      load = 'ready';
      return 'ready';
    }catch(e){
      if(g !== gen) return 'skipped';
      if(failOf(e).kind === KIND.PREMIUM){ load = 'locked'; return 'locked'; }
      load = 'failed';
      if(userOpened) notifyError('E-FOCUS-04', e);   // 시작 · 하루 경계의 실패는 번호 없이 조용히 — 사용자가 연 것이 아니다
      return 'failed';
    }
  }
  /* 서버에서 이번 주 받기 — 받는 중에 또 부르면 같은 약속 */
  function loadNow(userOpened){
    if(loadRun) return loadRun;
    const g = gen;
    if(load !== 'ready') load = 'loading';
    changed();
    loadRun = (async () => {
      let res;
      try{ res = await fetchInto(g, userOpened); }
      finally{ if(g === gen) loadRun = null; }
      if(g !== gen) return 'skipped';
      if(res === 'ready'){ judge(); claimAll(); claimPrevWeek(); }
      changed();
      return res;
    })();
    return loadRun;
  }
  /* 서랍을 열 때 — 못 받은 상태면 한 번 받는다(사용자가 연 것이라 번호 알림 있음) */
  function openDrawer(){
    if(!started || !premiumOn()) return;
    if(load === 'idle' || load === 'failed' || load === 'locked') loadNow(true);
    else if(load === 'ready'){ syncDay(); boundaryCheck(); }
  }
  const reload = (userOpened) => (started && load !== 'loading' && load !== 'ready' ? loadNow(userOpened === true) : Promise.resolve(load));
  /* 하루 경계 — 새 날을 알게 됐거나 날이 지났으면 그 주를 다시 받는다(같은 경계에서 3번까지) */
  function boundaryCheck(){
    if(!started || load !== 'ready' || !week || loadRun) return;
    const d = curDay();
    if(d && d.dayEndsAt <= week.today.dayEndsAt) return;   // 이 주 답이 지금 날과 같다
    const key = d ? d.dayEndsAt : week.today.dayEndsAt;
    if(boundary.key !== key) boundary = { key, tries: 0 };
    if(boundary.tries >= BOUNDARY_TRIES) return;
    boundary.tries++;
    loadNow(false);
  }
  /* 앱이 «하루가 바뀌었다» 고 알릴 때(focus-total onDayEnd) */
  function dayEnded(){ if(started) boundaryCheck(); }

  /* ── 쓰기 한 줄 ── */
  function enqueue(job){
    const g = gen;
    const p = lane.then(() => (g === gen ? job(g) : { ok: false, reason: 'stale' }));
    lane = p.then(() => {}, (e) => { console.warn('[달성표] 쓰기 줄 오류', e); });
    return p;
  }
  function gate(){
    if(!started) return { ok: false, reason: 'idle' };
    if(load === 'locked') return { ok: false, reason: 'premium' };
    if(load !== 'ready' || !week) return { ok: false, reason: load };   // loading → «불러오는 중이에요» · failed → 서랍의 [다시 시도]
    return null;
  }
  function lockPremium(){ load = 'locked'; changed(); }
  /* 409 — 덮지 않는다. 잠그고 그 주를 다시 받아 받은 값으로 */
  async function conflicted(g){
    load = 'loading'; changed();
    await fetchInto(g, false);
    if(g !== gen) return;
    emit({ type: 'conflict' });
    changed();
  }
  const draftOf = (w) => ({
    weekdayGoal: w.weekdayGoal, weekendGoal: w.weekendGoal, pendingGoal: w.pendingGoal, pendingPhase: w.pendingPhase,
    autoNext: w.autoNext, autoNextWeekend: w.autoNextWeekend, skippedWeekday: w.skippedWeekday, skippedWeekend: w.skippedWeekend,
  });
  const setGoal = (d, ph, g) => { if(ph === 'wd') d.weekdayGoal = g; else d.weekendGoal = g; };
  const setSkipped = (d, ph, v) => { if(ph === 'wd') d.skippedWeekday = v; else d.skippedWeekend = v; };
  const setAuto = (d, ph, v) => { if(ph === 'wd') d.autoNext = v; else d.autoNextWeekend = v; };
  const clearPending = (d, ph) => { if(d.pendingGoal && d.pendingPhase === PHASE[ph].server){ d.pendingGoal = null; d.pendingPhase = null; } };

  /* 한 벌 저장 — 줄에서 차례가 왔을 때의 최신 판 위에 mutate 를 얹어 보낸다 */
  function put(ph, mutate){
    const closed = gate();
    if(closed) return Promise.resolve(closed);
    if(phaseNow() !== ph) return Promise.resolve({ ok: false, reason: 'dayChanged' });
    return enqueue(async (g) => {
      if(load !== 'ready' || !week) return { ok: false, reason: load };
      const w = week, d = draftOf(w);
      mutate(d, w);
      const r = await api.saveChallenge(code, w.isoWeek, editBody(w.version, d));
      if(g !== gen) return { ok: false, reason: 'stale' };
      if(r.status === 'ok'){ adopt(r.challenge); changed(); return { ok: true }; }
      if(r.status !== 'failed') return { ok: false, reason: 'stale' };
      const f = failOf(r.err);
      if(f.kind === KIND.CONFLICT){ await conflicted(g); return { ok: false, reason: 'conflict' }; }
      if(f.kind === KIND.PREMIUM){ lockPremium(); return { ok: false, reason: 'premium' }; }
      notifyError('E-FOCUS-05', r.err);
      return { ok: false, reason: 'failed' };
    });
  }
  /* 시작 — 그 단계 목표를 정하고 쉬기를 푼다 */
  const start = (ph, kind, cfg, auto) => put(ph, (d) => {
    setGoal(d, ph, serverGoal(kind, cfg, ph)); setSkipped(d, ph, false); setAuto(d, ph, auto === true); clearPending(d, ph);
  });
  /* 수정 — 목표는 내일부터(다음 날 목표 · 서버가 그날 06:00 에 적용) · 자동은 바로. 지금 목표와 같으면 다음 날 목표를 지운다 */
  const edit = (ph, kind, cfg, auto) => put(ph, (d, w) => {
    const g = serverGoal(kind, cfg, ph);
    setAuto(d, ph, auto === true);
    if(sameGoal(g, goalOfWeek(w, ph))) clearPending(d, ph);
    else{ d.pendingGoal = g; d.pendingPhase = PHASE[ph].server; }
  });
  const setAutoNext = (ph, auto) => put(ph, (d) => { setAuto(d, ph, auto === true); });
  /* 포기 — 이번 주 그 단계를 쉰다(목표는 남겨 다음 주 자동 시작이 이어받는다) */
  const giveUp = (ph) => put(ph, (d) => { setSkipped(d, ph, true); clearPending(d, ph); });

  /* ── 오늘 판정 ── */
  /* 지금 달리는 단계의 목표 — 목표가 있고 쉬지 않을 때만. { ph, kind, cfg } */
  function liveGoal(){
    const d = curDay();
    if(!d || !week) return null;
    const ph = phaseOf(d.day);
    if(!ph || skippedOf(week, ph)) return null;
    const g = uiGoal(goalOfWeek(week, ph), ph);
    return g ? { ph, kind: g.kind, cfg: g.cfg } : null;
  }
  function isMet(g, d){
    if(!rec) return false;
    const c = g.cfg;
    if(g.kind === 'focus') return (rec.sec | 0) >= (c.hours | 0) * 3600;
    if(g.kind === 'repeat') return (rec.done | 0) >= (c.times | 0);
    const idx = dayIdx(d.day, g.ph);
    const items = idx < 0 ? [] : ruleItems(c, idx);
    return items.length > 0 && items.every((_, i) => !!(rec.checks || {})[i]);
  }
  /* 오늘 목표를 채웠으면 하루 한 번 서버에 적는다 */
  function judge(){
    if(!started || load !== 'ready' || !week || !rec) return;
    const d = curDay();
    if(!d || rec.day !== d.day || rec.posted || posting || postFailed) return;
    const g = liveGoal();
    if(g && isMet(g, d)) postToday();
  }
  function postToday(){
    posting = true;
    return enqueue(async (g) => {
      try{
        const d = curDay(), live = liveGoal();
        if(load !== 'ready' || !week || !rec || !d || rec.day !== d.day || rec.posted || !live || !isMet(live, d)) return { ok: false, reason: 'skipped' };
        const r = await api.markToday(code);
        if(g !== gen) return { ok: false, reason: 'stale' };
        if(r.status === 'ok'){
          adopt(r.challenge);
          if(rec) rec.posted = true;
          postFailed = false; postShown = false;
          saveRec();
          emit({ type: 'today', count: week.days.filter((x) => x.done).length - doneOutside(week, live.ph) });
          claimAll();
          changed();
          return { ok: true };
        }
        if(r.status !== 'failed') return { ok: false, reason: 'stale' };
        const f = failOf(r.err);
        postFailed = true;
        if(f.kind === KIND.PREMIUM){ lockPremium(); return { ok: false, reason: 'premium' }; }
        if(f.kind === KIND.NOT_STARTED || f.kind === KIND.SKIPPED){ postShown = true; fetchInto(g, false).then(() => { if(g === gen) changed(); }); return { ok: false, reason: f.kind }; }   // 조용히 — 서버가 아는 모양으로 다시 받는다
        if(!postShown){ postShown = true; notifyError('E-FOCUS-06', r.err); }
        changed();
        return { ok: false, reason: 'failed' };
      }finally{ posting = false; }
    });
  }
  /* 오늘 달성 «일째» — 지금 단계의 달성 일수 */
  function doneOutside(w, ph){
    const mine = new Set(cellsOf(w, ph, w.today.day, false).map((v, i) => (v === CELL.OK ? addDays(mondayOf(w.isoWeek), PHASE[ph].first + i) : null)).filter(Boolean));
    return (w.days || []).filter((x) => x.done && !mine.has(x.date)).length;
  }
  /* 서랍 [다시 적기] */
  function retryPost(){
    const closed = gate();
    if(closed) return Promise.resolve(closed);
    postFailed = false; postShown = false;
    changed();
    return postToday();
  }

  /* ── 보상 받기 — 서버가 열어 준 칸(claimable)을 칸마다 하나씩 ── */
  const pairEarly = (slot) => slot.replace(/_SETTLE$/, '_EARLY');
  function applyClaim(slot, amount){
    if(!week) return;
    week.rewards = (week.rewards || []).filter((x) => x.slot !== slot).concat({ slot, amount });
    const settle = /_SETTLE$/.test(slot);
    week.claimable = (week.claimable || []).filter((x) => x.slot !== slot && !(settle && x.slot === pairEarly(slot)));
  }
  /* 지난 주 보상 — 주말 정산은 다음 주 월 06:00 에 열리고, 토 · 일에 앱을 안 켠 사람의 평일 정산도 새 주에 가서야 받는다.
     서버 claimable 은 물은 주 것만 담으므로 새 주를 받은 뒤 지난 주를 한 번 받아 열린 칸을 받는다(받은 칸은 서버가 같은 답 — 되풀이해도 두 번 주지 않는다).
     지난 주를 못 받으면 조용히 넘어간다(다음 새 주 · 다음 켤 때 다시). 0.12 에서 못 받고 남은 보상도 이 길로 받는다 */
  function claimPrevWeek(){
    if(!started || load !== 'ready' || !week) return;
    const iso = weekBefore(week.isoWeek);
    if(!iso || prevClaimIso === week.isoWeek) return;
    prevClaimIso = week.isoWeek;
    enqueue(async (g) => {
      const w = await ensurePrev(false);
      if(g !== gen) return { ok: false, reason: 'stale' };
      if(!w){ prevClaimIso = ''; return { ok: false, reason: 'failed' }; }
      for(const c of (w.claimable || []).slice()){
        if(!(w.claimable || []).some((x) => x.slot === c.slot)) continue;
        const r = await api.claimReward(code, iso, c.slot);
        if(g !== gen) return { ok: false, reason: 'stale' };
        if(r.status === 'ok'){
          const phKey = c.slot.startsWith('WEEKDAY') ? 'wd' : 'we', settle = /_SETTLE$/.test(c.slot);
          w.rewards = (w.rewards || []).filter((x) => x.slot !== c.slot).concat({ slot: c.slot, amount: r.amount });
          w.claimable = (w.claimable || []).filter((x) => x.slot !== c.slot && !(settle && x.slot === pairEarly(c.slot)));
          emit({ type: 'claimed', slot: c.slot, phKey, amount: r.amount, settle, early: 0, s: countOf(cellsOf(w, phKey, w.today.day, false), CELL.OK), cells: cellsOf(w, phKey, w.today.day, false), prev: true });
        }else if(r.status === 'failed'){
          const f = failOf(r.err);
          if(f.kind === KIND.NOT_YET || f.kind === KIND.NOTHING) continue;
          if(f.kind === KIND.PREMIUM){ lockPremium(); return { ok: false, reason: 'premium' }; }
          if(!claimShown){ claimShown = true; notifyError('E-FOCUS-07', r.err); }
          prevClaimIso = '';
          return { ok: false, reason: 'failed' };
        }else return { ok: false, reason: 'stale' };
      }
      return { ok: true };
    });
  }
  function claimAll(){
    if(!started || claiming || load !== 'ready' || !week || !(week.claimable || []).length) return Promise.resolve();
    claiming = true;
    return enqueue(async (g) => {
      try{
        for(const c of ((week && week.claimable) || []).slice()){
          const w = week;
          if(!w) return { ok: false };
          if(!(w.claimable || []).some((x) => x.slot === c.slot)) continue;   // 앞 칸을 받으며 닫힌 짝 칸
          const r = await api.claimReward(code, w.isoWeek, c.slot);
          if(g !== gen) return { ok: false, reason: 'stale' };
          if(r.status === 'ok'){
            applyClaim(c.slot, r.amount);
            claimFailed = false; claimShown = false;
            const phKey = c.slot.startsWith('WEEKDAY') ? 'wd' : 'we';
            const early = slotAmount(week, PHASE[phKey].earlySlot);
            emit({ type: 'claimed', slot: c.slot, phKey, amount: r.amount, settle: /_SETTLE$/.test(c.slot), early: /_SETTLE$/.test(c.slot) ? early : 0,
              s: countOf(cellsOf(week, phKey, week.today.day, false), CELL.OK), cells: cellsOf(week, phKey, week.today.day, false) });
            changed();
          }else if(r.status === 'failed'){
            const f = failOf(r.err);
            if(f.kind === KIND.NOT_YET || f.kind === KIND.NOTHING){ week.claimable = week.claimable.filter((x) => x.slot !== c.slot); continue; }   // 조용히
            if(f.kind === KIND.PREMIUM){ lockPremium(); return { ok: false, reason: 'premium' }; }
            claimFailed = true;
            if(!claimShown){ claimShown = true; notifyError('E-FOCUS-07', r.err); }
            changed();
            return { ok: false, reason: 'failed' };
          }else return { ok: false, reason: 'stale' };
        }
        return { ok: true };
      }finally{ claiming = false; }
    });
  }
  /* 서랍 [보상 받기] — 실패 뒤 사용자가 누를 때 */
  function claimNow(){
    const closed = gate();
    if(closed) return Promise.resolve(closed);
    claimShown = false;
    return claimAll();
  }

  /* ── 오늘 진행 쌓기 ── */
  /* 🎯 집중 — 활성 앱을 쓴 초(weekly-challenge.js focusTick 이 판정 키를 맞춘 뒤 부른다) */
  function addFocusSec(dt){
    if(!started || load !== 'ready' || !rec || !(dt > 0)) return false;
    const d = curDay(), g = liveGoal();
    if(!d || rec.day !== d.day || !g || g.kind !== 'focus') return false;
    rec.sec += dt; dirty = true;
    return true;
  }
  function ruleLive(){ const g = liveGoal(); return g && g.kind === 'rule' && rec && curDay() && rec.day === curDay().day ? g : null; }
  /* 📋 오늘 항목 체크 */
  function check(i){
    if(load !== 'ready') return { ok: false, reason: load };
    if(!ruleLive()) return { ok: false, reason: 'idle' };
    rec.checks = rec.checks || {};
    rec.checks[i] = !rec.checks[i];
    saveRec(); judge(); changed();
    return { ok: true };
  }
  /* 🔁 [했다] · [미룬다] — 눌렀든 미뤘든 여기서부터 간격을 다시 잰다 */
  function repeatAnswer(yes){
    const g = liveGoal();
    if(load !== 'ready' || !rec || !g || g.kind !== 'repeat') return { ok: false, reason: 'idle' };
    if(yes) rec.done = (rec.done | 0) + 1;
    rec.anchor = now();
    saveRec(); judge(); changed();
    return { ok: true };
  }
  /* 🔁 알림 시각 · «오늘은 못 채운다» 확정 */
  function repeatTick(){
    const d = curDay(), g = liveGoal();
    if(!d || !g || g.kind !== 'repeat' || !rec || rec.day !== d.day || rec.fail) return;
    const c = g.cfg;
    if((rec.done | 0) >= (c.times | 0)) return;
    const runNow = appMode() === 'run';
    /* 실행 화면에 «들어간 때» 부터 간격을 잰다 — 이미 실행 화면인 채로 시작해도 anchor 가 비었으면 잡는다 */
    if(runNow && (prevMode !== 'run' || !rec.anchor)){ rec.anchor = now(); dirty = true; }
    prevMode = runNow ? 'run' : 'other';
    if(!runNow || !rec.anchor) return;
    const gapMs = Math.max(1, c.gap | 0) * 3600000, need = (c.times | 0) - (rec.done | 0), nextDue = rec.anchor + gapMs;
    if(nextDue + (need - 1) * gapMs > d.dayEndsAt){   // 남은 시간으로 횟수를 채울 수 없다 — 그 자리에서 알린다
      rec.fail = true; saveRec();
      emit({ type: 'repeatFail' });
      return;
    }
    if(now() >= nextDue) emit({ type: 'repeatDue' });
  }

  /* ── 20초 틱 — 요청을 되풀이하지 않는다(일이 생겼을 때 한 번) ── */
  function tick(){
    if(!started) return;
    try{ rolloverToday(); }catch(_){}   // 하루 경계를 넘었으면 onDayEnd 가 불린다
    if(!premiumOn()){ changed(); return; }
    if(load === 'idle'){ loadNow(false); return; }   // 시작 때는 프리미엄이 아니었다가 켜졌다
    if(load !== 'ready') return;
    boundaryCheck();
    syncDay();
    repeatTick();
    judge();
    if(dirty) saveRec();
    changed();
  }

  /* ── 지난 주 — 서랍에서 지난 주말 기록을 눌렀을 때만 ── */
  /* 지난 주 받기 — 한 번 받은 것은 같은 주 동안 들고 있고(서랍의 지난 주말 기록 · 지난 주 보상이 같이 쓴다) 받는 중에는 같은 약속을 돌려준다 */
  function ensurePrev(userOpened){
    if(!started || !week) return Promise.resolve(null);
    const iso = weekBefore(week.isoWeek);
    if(!iso) return Promise.resolve(null);
    if(prev.iso === iso && prev.load === 'ready') return Promise.resolve(prev.week);
    if(prev.iso === iso && prev.load === 'loading') return prev.run;
    const g = gen;
    const mine = { iso, load: 'loading', week: null, run: null };
    mine.run = api.fetchChallenge(code, iso).then((w) => {
      if(g !== gen || prev !== mine) return null;
      mine.week = w; mine.load = 'ready'; changed();
      return w;
    }, (e) => {
      if(g !== gen || prev !== mine) return null;
      mine.load = 'failed';
      if(userOpened) notifyError('E-FOCUS-04', e);
      changed();
      return null;
    });
    prev = mine;
    changed();
    return mine.run;
  }
  const loadPrev = (userOpened) => { ensurePrev(userOpened); };
  /* 지난 주 [다시 시도] — 사용자가 누를 때만. 못 받은 상태일 때 한 번 다시 받는다 */
  const retryPrev = () => { if(prev.load === 'failed') loadPrev(true); };

  /* ── 읽기 — 화면이 그리는 한 벌 ── */
  function view(){
    const d = curDay(), ph = d ? phaseOf(d.day) : null;
    const v = {
      load, premium: premiumOn() && load !== 'locked', day: d ? d.day : null, phase: ph, week, rec,
      postFailed, claimFailed, claimable: week ? (week.claimable || []).slice() : [],
      goal: null, skipped: false, active: false, auto: false, pending: null, cells: [], s: 0, r: 0, range: '', earlyGot: false, met: false, posted: !!(rec && rec.posted),
    };
    if(load !== 'ready' || !week || !ph) return v;
    const g = uiGoal(goalOfWeek(week, ph), ph);
    v.goal = g;
    v.skipped = skippedOf(week, ph);
    v.active = !!g && !v.skipped;
    v.auto = autoOf(week, ph);
    v.pending = (week.pendingGoal && week.pendingPhase === PHASE[ph].server) ? uiGoal(week.pendingGoal, ph) : null;
    v.cells = cellsOf(week, ph, d.day, !!(rec && rec.day === d.day && rec.fail));
    v.s = countOf(v.cells, CELL.OK);
    v.r = countOf(v.cells, CELL.NOW) + countOf(v.cells, CELL.WAIT);
    v.range = rangeLabel(week.isoWeek, ph);
    v.earlyGot = slotAmount(week, PHASE[ph].earlySlot) > 0;
    const live = liveGoal();
    v.met = !!(live && d && rec && rec.day === d.day && isMet(live, d));
    return v;
  }
  /* 지금 단계가 아닌 쪽의 지난 기록 — 지금이 주말이면 같은 주 주중 · 주중이면 지난 주 주말. { state: 'ready'|'loading'|'failed' , … } */
  function arcView(phKey){
    const live = phaseNow();
    if(!week || !live || phKey === live) return { state: 'none' };
    let w = null;
    if(live === 'we' && phKey === 'wd') w = week;
    else{
      if(prev.iso !== weekBefore(week.isoWeek) || prev.load === 'idle') loadPrev(true);   // 못 받은(failed) 뒤에는 그리기가 다시 받지 않는다(P3) — [다시 시도] 의 retryPrev 만
      if(prev.load !== 'ready') return { state: prev.load === 'failed' ? 'failed' : 'loading' };
      w = prev.week;
    }
    const cells = cellsOf(w, phKey, w.today.day, false), g = uiGoal(goalOfWeek(w, phKey), phKey), ph = PHASE[phKey];
    return { state: 'ready', phase: phKey, range: rangeLabel(w.isoWeek, phKey), kind: g ? g.kind : '', cfg: g ? g.cfg : null, cells, s: countOf(cells, CELL.OK),
      tickets: slotAmount(w, ph.earlySlot) + slotAmount(w, ph.settleSlot) };
  }
  /* 오늘이 그 단계의 몇 번째 칸인가(없으면 -1) */
  const todayIdx = (ph) => { const d = curDay(); return d ? dayIdx(d.day, ph) : -1; };

  /* ── 시작 · 비우기 ── */
  function reset(){
    gen++;
    started = false; code = null; load = 'idle'; week = null; rec = null; dirty = false; loadRun = null; lane = Promise.resolve();
    posting = false; postFailed = false; postShown = false; claiming = false; claimFailed = false; claimShown = false;
    boundary = { key: 0, tries: 0 }; prevClaimIso = ''; prevMode = null; prev = { iso: '', load: 'idle', week: null, run: null };
    api.reset();
    emit({ type: 'reset' });
    changed();
  }
  /* 🚀 계정 확인 뒤 한 번(launcher/app-boot.js) — 계정 칸에서 오늘 진행을 읽고, 프리미엄이면 이번 주를 받는다 */
  function startChal(userCode, me, session){
    if(started) return;
    started = true;
    code = userCode;
    session.onReset(reset);
    rec = readRec();
    session.setInterval(tick, TICK_MS);
    if(!quitBound){
      quitBound = true;
      addQuitListener(() => { if(started && dirty) saveRec(); });
    }
    if(premiumOn()) loadNow(false);
  }
  /* 0.13 첫 실행 — 0.12 기록(tw.chal)의 «오늘 진행» 을 새 칸으로 옮긴다(first-run-013.js). 그날이 서버 날과 다르면 다음 틱이 버린다 */
  function adoptLegacyToday(old){
    if(!started) return { ok: false, reason: '시작 전' };
    const day = old && normDay(old.date);
    if(!day) return { ok: true };
    if(rec && rec.day === day && (rec.sec || 0) >= (+old.sec || 0)) return { ok: true };   // 새 칸이 더 많이 쌓았다
    rec = { day, sec: Math.max(0, +old.sec || 0), done: Math.max(0, old.done | 0), checks: (old.checks && typeof old.checks === 'object') ? old.checks : {}, anchor: +old.anchor || 0, fail: old.fail === true, posted: false };
    saveRec();
    syncDay();
    return { ok: true };
  }
  /* 로그아웃 올리기 — 도는 쓰기 줄이 끝나기를 기다린다 */
  function flush(){ return started ? lane : Promise.resolve(); }

  return {
    startChal, onChange, onEvent, view, arcView, todayIdx, liveGoal,
    openDrawer, reload, dayEnded, tick, loadPrev, retryPrev,
    start, edit, setAutoNext, giveUp, retryPost, claimNow,
    addFocusSec, check, repeatAnswer,
    adoptLegacyToday, flush,
    load: () => load, isReady: () => load === 'ready',
  };
}

const api = {
  createChalStore, TODAY_KEY, TICK_MS, RULE_MAX, CELL, PHASE,
  phaseOf, dayIdx, dowOf, addDays, mondayOf, isoWeekOfDay, weekBefore, normDay, rangeLabel, ruleItems, uiGoal, serverGoal, sameGoal, cellsOf, clampInt,
};
if(typeof window !== 'undefined') window.TwChalStore = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
