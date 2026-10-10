/* ═══ 👑 sim-weekly-challenge.js — 달성표 모듈 (2026-10-10 신설 · 앱 FSD 2번) ═══════════════════
   app.js 의 두 구역(👑 달성표 — 주간 규칙 · 기록 / 화면)을 parts/weekly-challenge.js 로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 셈 — ISO 주 이름(오전 6시 경계 · 연말연시) · 페이즈 · 칸 번호 · 보상 횟수 · 선지급 키 · 규칙 줄 · 보상 문구 · 조건 이름 · 판정 키 · 숫자 칸
   ・2절: 만들 때 — 로컬 기록 읽기(옛 기록은 주중) · 부팅 동기화 4.4초 · 20초 tick · beforeunload · 버튼 연결 · 프리미엄 게이트 · 뽀모 서랍 닫기 · DOM 없으면 조용히
   ・3절: 📋규칙 트랙 — 진행 화면 · 오늘 항목 체크 → 달성 · 3일째 선지급(서버 tag) · 두 번 안 줌
   ・4절: 정산 — 토요일 06:00 에 주중 트랙을 닫는다 · 남은 날 ✗ · 박제(arcWd) · 선지급분을 뺀 나머지 · 팝업 · 기록 보기
   ・5절: 🎯집중 · 🔁반복 — 판정 키 · 다른 플랫폼 조건은 안 셈 · keyAlt · 반복 알림 팝업 · 못 채우는 날 확정
   ・6절: 로그아웃 지우기(resetMemory) · 서버 동기화(ts 최신 승 · 읽기 실패면 아무것도 안 함)
   ・7절: app.js 배선 — 정의는 모듈에만 · createWeeklyChallenge 는 원래 자리 · 부르는 곳은 weeklyChal.이름 · CHAL_KEY 는 app.js · html 순서 · 전역 이름
   [실행] weekly-challenge.js · app.js · pomodoro.js · desk-companion-prototype.html 이 있는 폴더에서.
   ※ 🍅 뽀모 서랍은 parts/pomodoro.js 로 옮겼다(앱 FSD 6번) — 뽀모 쪽이 weeklyChal.open(false) 를 부르는 곳은 그 파일에서 본다. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['weekly-challenge.js', 'app.js', 'desk-companion-prototype.html', 'pomodoro.js'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = SRC['app.js'], HTML = SRC['desk-companion-prototype.html'], MOD = SRC['weekly-challenge.js'], POMO = SRC['pomodoro.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const flush = async (n = 6) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

/* app.js 의 하루 경계 · 글자 도구를 **실제 글**에서 떼어 온다 — 여기 다시 적으면 그쪽이 바뀔 때 검사가 조용히 낡는다 */
const grab = (re) => { const m = APP.match(re); return m ? m[0] : null; };
const HELP = [
  grab(/const DAY_START_HOUR = \d+;\nfunction _dayShifted\(when\)\{[\s\S]*?\n\}\nfunction _focusDayStr\(when\)\{[^\n]*\}/),
  grab(/function escHtml\(s\)\{[\s\S]*?\n\}/),
  grab(/function formatHMS\(sec\)\{[\s\S]*?return h\+':'\+m\+':'\+s; \}/),
];
if(HELP.some(h => !h)){ say('  ? app.js 에서 _dayShifted · escHtml · formatHMS 를 못 떼어 옴'); process.exit(2); }

/* ── 가짜 DOM — 모듈이 쓰는 만큼만 ── */
function mkEl(tag, id){
  const L = {}, cls = new Set(), attrs = {};
  const o = {
    tagName: tag, id: id || '', children: [], style: {}, value: '', disabled: false, title: '', onclick: null,
    _text: '', _html: '',
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)),
      toggle: (c, f) => { const on = (f === undefined) ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; },
      contains: c => cls.has(c) },
    get className(){ return Array.from(cls).join(' '); },
    set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); },
    get textContent(){ return o._text; }, set textContent(v){ o._text = String(v); o._html = ''; },
    get innerHTML(){ return o._html; }, set innerHTML(v){ o._html = String(v); o._text = String(v).replace(/<[^>]*>/g, ''); o._kids = null; },
    getAttribute: k => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); },
    appendChild(c){ o.children.push(c); return c; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    fire(t, ev){ (L[t] || []).forEach(fn => fn(Object.assign({ preventDefault(){}, target: o }, ev || {}))); },
    click(){ if(o.onclick) return o.onclick({}); },
    closest: () => o, remove(){ o.removed = true; }, blur(){},
    /* 팝업 버튼 — innerHTML 의 data-a 를 버튼으로 */
    querySelectorAll(sel){
      if(sel !== '[data-a]') return [];
      if(!o._kids) o._kids = [...o._html.matchAll(/data-a="(\w+)"/g)].map(m => { const b = mkEl('button'); b.setAttribute('data-a', m[1]); return b; });
      return o._kids;
    },
    querySelector: () => null,
  };
  return o;
}
const target = (attr, v) => { const t = mkEl('div'); t.setAttribute(attr, v); return t; };

/* 시계 — 모듈과 떼어 온 도우미가 같은 vm 안에서 이 Date 를 쓴다 */
const RealDate = Date;
const at = (y, mo, d, h, mi) => new RealDate(y, mo - 1, d, h, mi || 0).getTime();   // 로컬 시각
function mkEnv(opt){
  opt = opt || {};
  const env = { now: opt.now || at(2026, 10, 14, 10), premium: opt.premium !== false, toasts: [], timers: [], intervals: [],
    winL: {}, ls: new Map(), saved: [], paidTags: new Set(), bonusCalls: [], bonus: 0, bonusLocal: [], popups: [],
    srv: opt.srv === undefined ? {} : opt.srv, focusApps: opt.focusApps || [{ key: 'win:chrome.exe', name: 'chrome.exe', title: '크롬' }],
    appMode: opt.appMode || 'run', loadChalCalls: 0 };
  if(opt.rec) env.ls.set('tw.chal', JSON.stringify(opt.rec));
  const els = new Proxy({}, { get: (t, k) => (typeof k === "string" ? (t[k] || (t[k] = mkEl("div", k))) : undefined) });
  const getEl = id => (opt.noDom ? null : (els[id] || (els[id] = mkEl('div', id))));
  const FD = class extends RealDate { constructor(...a){ if(a.length === 0) super(env.now); else super(...a); } static now(){ return env.now; } };
  const document = {
    getElementById: getEl, createElement: t => mkEl(t), activeElement: null,
    body: { appendChild(c){ env.popups.push(c); return c; } },
  };
  const ctx = {
    Date: FD, Math, JSON, String, Number, Array, Object, Promise, isFinite, parseInt, console: { warn(){}, log(){} },
    document,
    localStorage: { getItem: k => env.ls.has(k) ? env.ls.get(k) : null, setItem: (k, v) => env.ls.set(k, String(v)), removeItem: k => env.ls.delete(k) },
    setTimeout: (fn, ms) => { env.timers.push({ fn, ms }); return env.timers.length; },
    setInterval: (fn, ms) => { env.intervals.push({ fn, ms }); return env.intervals.length; },
    companion: { getFocusApps: async () => { env.focusAppsCalls = (env.focusAppsCalls || 0) + 1; return env.focusApps; } },
    firebaseAPI: opt.noApi ? undefined : {
      loadChal: async () => { env.loadChalCalls++; return env.srv; },
      saveChal: async (uid, rec) => { env.saved.push(JSON.parse(JSON.stringify(rec))); },
      addChalBonus: async (uid, n, tag) => { env.bonusCalls.push({ uid, n, tag });
        if(env.paidTags.has(tag)) return { ok: true, dup: true }; env.paidTags.add(tag); env.bonus += n; return { ok: true, bonus: env.bonus }; },
      loadChalBonus: async () => env.bonus,
    },
  };
  ctx.window = ctx;
  ctx.addEventListener = (t, fn) => { (env.winL[t] = env.winL[t] || []).push(fn); };
  vm.createContext(ctx);
  vm.runInContext(HELP.join('\n') + '\nthis.__help = { _dayShifted, _focusDayStr, escHtml, formatHMS, DAY_START_HOUR };', ctx);
  vm.runInContext(MOD, ctx, { filename: 'weekly-challenge.js' });
  const H = ctx.__help;
  env.ctx = ctx; env.els = els; env.H = H;
  env.mk = () => ctx.TwWeeklyChallenge.createWeeklyChallenge({
    getMyUserId: () => 'uA',
    toast: (m) => env.toasts.push(m),
    escHtml: (...a) => H.escHtml(...a),
    formatHMS: (...a) => H.formatHMS(...a),
    premiumOn: () => env.premium,
    dayShifted: (...a) => H._dayShifted(...a),
    focusDayStr: (...a) => H._focusDayStr(...a),
    dayStartHour: H.DAY_START_HOUR,
    setGachaBonusLocal: (n) => env.bonusLocal.push(n),
    renderGachaInv: () => { env.gachaInv = (env.gachaInv || 0) + 1; },
    gachaBonus: () => 0,
    appMode: () => env.appMode,
    storageKey: 'tw.chal',
  });
  return env;
}
/* 섹션마다 따로 — 옛 코드(모듈 없음)에 대면 멈추지 않고 그 절을 빨강 하나로 센다 */
const sec = async (title, fn) => { say(title); try{ await fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + (e && e.stack || e)); } };

/* ISO 주 — 검사 쪽 독립 구현(UTC 셈). 하루는 오전 6시에 바뀐다 */
function isoWeek(ms){
  const d = new RealDate(ms - 6 * 3600000);
  const t = new RealDate(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new RealDate(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 86400000 + 1) / 7)).padStart(2, '0');
}

(async () => {
await sec('── 1. 셈', () => {
  const e = mkEnv(), C = e.mk().calc;
  const cases = [at(2026,1,1,12), at(2025,12,29,7), at(2025,12,29,5), at(2027,1,3,23), at(2027,1,4,6), at(2026,10,12,5,59), at(2026,10,12,6), at(2020,12,31,12), at(2021,1,4,7)];
  const bad = cases.filter(ms => C.weekStr(ms) !== isoWeek(ms));
  chk(!bad.length, 'ISO 주 이름 — 연말연시 · 월요일 06:00 경계 9곳이 독립 셈과 같다' + (bad.length ? ' — 다름: ' + bad.map(ms => new RealDate(ms).toString() + ' ' + C.weekStr(ms)).join(' / ') : ''));
  chk(C.weekStr(at(2026,10,12,5,59)) === C.weekStr(at(2026,10,11,12)) && C.weekStr(at(2026,10,12,6)) !== C.weekStr(at(2026,10,11,12)), '월요일 05:59 는 지난주 · 06:00 부터 새 주');
  chk(C.phaseOf(at(2026,10,17,7)) === 'we' && C.phaseOf(at(2026,10,17,5)) === 'wd' && C.phaseOf(at(2026,10,19,5,59)) === 'we' && C.phaseOf(at(2026,10,14,10)) === 'wd',
    '페이즈 — 토 07시 주말 · 토 05시는 금요일(주중) · 월 05:59 는 일요일(주말) · 수요일 주중');
  chk(C.dayIdx(at(2026,10,14,10), 'wd') === 2 && C.dayIdx(at(2026,10,17,10), 'we') === 0 && C.dayIdx(at(2026,10,18,10), 'we') === 1
    && C.dayIdx(at(2026,10,17,10), 'wd') === -1 && C.dayIdx(at(2026,10,14,10), 'we') === -1 && C.dayIdx(at(2026,10,14,10)) === 2,
    '칸 번호 — 수=2 · 토=0 · 일=1 · 다른 페이즈면 -1 · 생략하면 오늘 기준');
  chk([0,1,2,3,4,5].map(s => C.ticketsFor(s, 'wd')).join('') === '001122' && [0,1,2].map(s => C.ticketsFor(s, 'we')).join('') === '012',
    '보상 횟수 — 주중 2일 1회 · 4일 2회 / 주말 1일 1회 · 2일 2회');
  chk(C.earlyKey('2026-W42', 'we') === '2026-W42-we' && C.earlyKey('2026-W42') === '2026-W42-wd' && !/[.#$\[\]\/]/.test(C.earlyKey('2026-W42', 'wd')), '선지급 키 — 주-페이즈 · RTDB 키에 못 쓰는 글자 없음');
  const many = Array.from({ length: 14 }, (_, i) => ' r' + i + ' ');
  chk(JSON.stringify(C.ruleItems({ rules: [[' 물 ', '', null, '책']] }, 0)) === '["물","책"]' && C.ruleItems({ rules: [many] }, 0).length === 10 && C.ruleItems(null, 0).length === 0,
    '규칙 줄 — 앞뒤 공백 · 빈 줄 버림 · 10줄까지');
  const rl = (s, r, p) => C.rewardLine(s, r, p);
  chk(/^앞으로 <b>4번만 더<\/b>.*최대 <b>뽑기 2회<\/b>/.test(rl(0, 5, 'wd').t) && !rl(0, 5, 'wd').dim, '보상 문구 — 시작(0일 · 5일 남음) «앞으로 4번만 더 … 최대 뽑기 2회»');
  chk(/^<b>뽑기 2회<\/b> 확정!.*남은 1회는 토요일 아침에/.test(rl(4, 1, 'wd').t), '4일 — 2회 확정 · 1회는 받았고 남은 1회는 토요일 아침에');
  chk(/^앞으로 <b>1번만 더<\/b>.*1회는 이미 받았어요/.test(rl(3, 2, 'wd').t), '3일(선지급 뒤) · 2일 남음 — 1번만 더 · 1회는 이미 받았어요');
  chk(/^<b>뽑기 1회를 받았어요<\/b>.*2회는 어려워요/.test(rl(3, 0, 'wd').t), '3일 · 남은 날 없음 — 받았어요 · 2회는 어려워요');
  chk(/^<b>뽑기 1회<\/b> 확정 · 토요일 아침에 드려요/.test(rl(2, 0, 'wd').t), '2일 · 남은 날 없음 — 1회 확정 · 토요일 아침에');
  chk(rl(0, 1, 'wd').dim === true && /보상은 어려워요/.test(rl(0, 1, 'wd').t), '0일 · 1일 남음(주중) — 어려워요 · 흐리게');
  chk(/^<b>뽑기 1회를 받았어요<\/b>/.test(rl(1, 0, 'we').t) && /월요일 아침/.test(rl(2, 0, 'we').t), '주말 — 1일이면 이미 받았어요 · 2일 확정 문구는 월요일 아침');
  chk(C.cfgLabel('focus', { exe: 'Chrome.exe', hours: 4 }) === '🎯 Chrome 4시간' && C.cfgLabel('repeat', { text: '<물>', times: 3 }) === '🔁 &lt;물&gt; 하루 3회'
    && C.cfgLabel('rule', {}) === '📋 요일별 체크표' && C.cfgLabel('', {}) === '', '조건 이름 — .exe 뗌 · 글자는 escHtml');
  chk(JSON.stringify([C.keysOf({ keys: ['mac:a', '', 'win:b'] }), C.keysOf({ key: 'mac:com.google.chrome' }), C.keysOf({ exe: 'Chrome.EXE' }), C.keysOf({ name: 'Code.exe' }), C.keysOf(null)])
    === '[["mac:a","win:b"],["mac:com.google.chrome"],["win:chrome.exe"],["win:code.exe"],[]]', '판정 키 — keys > key > exe > name · 승격은 win: 고정 · 소문자');
  chk(C.clampNum('', 1, 12, 4) === 4 && C.clampNum('99', 1, 12, 4) === 12 && C.clampNum('a5', 1, 12, 4) === 5 && C.clampNum('0', 1, 8, 2) === 1, '숫자 칸 — 빈 칸은 원래 값 · 범위로 자름 · 숫자만');
});

await sec('── 2. 만들 때', async () => {
  let e = mkEnv({ rec: { ts: 5, week: '', auto: true } });
  let W = e.mk();
  chk(W.state().phase === 'wd' && W.state().auto === true && W.state().ts === 5 && W.state().autoWe === false, '로컬 기록을 읽는다 — 옛 기록(phase 없음)은 주중 · 빠진 칸은 빈 값');
  chk(e.timers.length === 1 && e.timers[0].ms === 4400 && e.intervals.length === 1 && e.intervals[0].ms === 20000, '부팅 동기화 4.4초 한 번 · 20초 tick');
  chk((e.winL.beforeunload || []).length === 1, 'beforeunload 하나 — 쌓인 🎯 초를 내려 쓴다');
  const btn = e.els.chalBtn;
  chk(typeof (btn && btn.onclick) === 'function', '[👑 달성표] 버튼 연결');
  e.premium = false; btn.click();
  chk(e.toasts.includes('👑 달성표는 프리미엄 전용이에요') && !e.els.focusLogWin.classList.contains('chal-on'), '게이트 ① — 프리미엄이 아니면 안 열고 알린다');
  e.premium = true; e.els.focusLogWin.classList.add('pomo-on'); btn.click(); await flush();
  chk(e.els.focusLogWin.classList.contains('chal-on') && !e.els.focusLogWin.classList.contains('pomo-on') && W.isOpen(), '열면 서랍 chal-on · 🍅 뽀모 서랍은 닫힌다');
  chk(e.focusAppsCalls === 1 && e.els.chalPick.style.display === 'block' && e.els.chalRun.style.display === 'none', '열 때 포커싱 어플 목록을 다시 읽고 · 트랙이 없으면 종류 고르기');
  chk(/무엇을 5일 동안/.test(e.els.chalPickLabel.textContent) && /오늘은 수요일이라 이번 주중은 <b>3일\(수·목·금\)<\/b>/.test(e.els.chalStartWarn.innerHTML), '고르기 화면 — 5일 · 수요일 시작 안내(3일)');
  W.open(false);
  chk(!W.isOpen(), 'open(false) 로 닫힌다(뽀모 서랍을 열 때)');
  e = mkEnv({ noDom: true });
  let ok = true; try{ W = e.mk(); W.tick(); }catch(_){ ok = false; }
  chk(ok, 'DOM 이 없어도 조용히 만든다');
});

await sec('── 3. 📋규칙 트랙 — 체크 · 달성 · 3일째 선지급', async () => {
  const now = at(2026, 10, 14, 10);   // 수요일
  const e0 = mkEnv({ now });
  const H = e0.H;
  const wk = isoWeek(now);
  const rec = { ts: 1, phase: 'wd', week: wk, kind: 'rule', cfg: { rules: [['a'], ['b'], ['물 마시기', '책 읽기'], ['c'], ['d']] },
    days: [1, 1, 0, -1, -1], today: { date: H._focusDayStr(now), dateMs: now, sec: 0, done: 0, checks: {}, anchor: 0, fail: false } };
  const e = mkEnv({ now, rec });
  const W = e.mk();
  W.tick();
  chk(e.els.chalRun.style.display === 'block' && (e.els.chalWeek.innerHTML.match(/class="chal-day/g) || []).length === 5, '진행 화면 — 요일 5칸');
  chk(/class="chal-cell now">●/.test(e.els.chalWeek.innerHTML) && (e.els.chalWeek.innerHTML.match(/✓/g) || []).length === 2, '오늘 ● · 달성 ✓ 둘');
  chk(/📋 오늘 0 \/ 2/.test(e.els.chalToday.innerHTML) && /☐ 물 마시기/.test(e.els.chalToday.innerHTML), '오늘 항목 0/2');
  chk(e.els.chalRunCount.textContent === '2일 달성' && /^이번 주중 · \d+\/\d+ ~ \d+\/\d+$/.test(e.els.chalRunRange.innerHTML), '달성 일수 · 이번 주중 날짜 범위');
  e.els.chalToday.fire('click', { target: target('data-i', '0') }); await flush();
  chk(W.state().today.checks[0] === true && W.state().days[2] === 0, '항목 하나 체크 — 아직 달성 아님');
  chk(e.saved.length >= 1 && e.loadChalCalls >= 1, '체크는 판정이 바뀌는 순간이라 서버에 쓴다');
  e.els.chalToday.fire('click', { target: target('data-i', '1') }); await flush();
  chk(W.state().days[2] === 1 && e.toasts.includes('👑 오늘 달성! 3일째'), '둘 다 체크 → 오늘 ✓ · «오늘 달성! 3일째»');
  const key = wk + '-wd';
  /* ⚠️ 옛 동작 그대로 — 선지급은 대기줄(due)에 먼저 적고 바로 지급하는데, 같은 tick 의 _chalRetryDue 가 ts:0 인 그 줄을 곧장 한 번 더
       두드린다. 서버가 같은 tag 를 dup 으로 막아 **한 번만** 나간다(그래서 여기서는 «서버 호출 수» 가 아니라 «나간 횟수» 를 본다). */
  chk(e.bonusCalls.length >= 1 && e.bonusCalls.every(c => c.n === 1 && c.tag === key) && e.bonus === 1 && W.state().early === key, '3일째 선지급 1회 — 서버 tag ' + key + ' · 한 번만 나감 · early 표식');
  chk(e.toasts.some(t => /뽑기 1회를 받았어요/.test(t)) && e.bonusLocal[e.bonusLocal.length - 1] === 1 && (W.state().due == null), '받았다 토스트 · 로컬 보너스 = 서버 값 · 대기줄 비움');
  chk(/<i class="chal-pay">1<\/i>/.test(e.els.chalWeek.innerHTML) && /1번만 더.*1회는 이미 받았어요/.test(e.els.chalReward.innerHTML), '선지급 칸 표시 · 보상 문구');
  W.tick(); await flush(); W.tick(); await flush();
  const nCalls = e.bonusCalls.length;
  W.tick(); await flush();
  chk(e.bonusCalls.length === nCalls && e.bonus === 1, 'tick 이 더 돌아도 두 번 주지 않는다(1차 필터 early · 대기줄 비움)');
});

await sec('── 4. 정산 — 토요일 06:00 에 주중을 닫는다', async () => {
  const wed = at(2026, 10, 14, 10), wk = isoWeek(wed);
  const H = mkEnv({ now: wed }).H;
  const mkRec = (days, early) => ({ ts: 1, phase: 'wd', week: wk, kind: 'repeat', cfg: { text: '물', times: 1, gap: 1 }, early: early ? wk + '-wd' : '',
    days, today: { date: H._focusDayStr(wed), dateMs: wed, sec: 0, done: 1, checks: {}, anchor: 0, fail: false } });
  /* (a) 3일 달성 · 선지급 받음 → 남은 것 0 */
  let e = mkEnv({ now: at(2026, 10, 17, 7), rec: mkRec([1, 1, 1, -1, -1], true) });
  let W = e.mk(); W.tick(); await flush();
  const arc = W.state().arcWd;
  chk(W.state().week === '' && W.state().paid === wk, '트랙을 닫고 paid = 이번 주');
  chk(arc && JSON.stringify(arc.days) === '[1,1,1,-2,-2]' && arc.s === 3 && arc.tickets === 1 && /^\d+\/\d+ ~ \d+\/\d+$/.test(arc.range),
    '박제 — 월 · 화 · 수 ✓ · 앱을 안 켠 목 · 금 ✗ · 3일 · 1회 · 날짜 범위를 굳힘');
  chk(e.bonusCalls.length === 0, '선지급으로 이미 1회 — 정산에서 더 안 준다');
  const pop = e.popups[0];
  chk(pop && /🏅 이번 주중 달성표/.test(pop.children[0]._html) && /월·화·수 <b>3일<\/b>을 지켰어요.*보상 <b>1회<\/b>는 이미 받았어요/.test(pop.children[0]._html), '정산 팝업 — 지킨 요일 · 이미 받았어요');
  chk(W.state().last && W.state().last.kind === 'repeat', '지난 조건을 기억한다(자동 시작용)');
  pop.children[0].querySelectorAll('[data-a]')[0].click(); await flush();
  chk(pop.removed === true, '[확인] 으로 닫힌다');
  e.els.chalPhWd.click();
  chk(e.els.chalArc.style.display === 'block' && /<b>3일<\/b> 달성/.test(e.els.chalArcSum.innerHTML) && /주중 · 월~금 기록/.test(e.els.chalPhWd.textContent), '[주중 기록] — 박제 화면(읽기 전용)');
  /* (b) 4일 달성 · 선지급 없음 → 정산에서 2회 */
  e = mkEnv({ now: at(2026, 10, 17, 7), rec: mkRec([1, 1, 1, 1, 0], false) });
  W = e.mk(); W.tick(); await flush();
  chk(e.bonusCalls.length === 1 && e.bonusCalls[0].n === 1 + 1 && e.bonusCalls[0].tag === wk + '-wd-s', '4일 · 선지급 없음 → 정산에서 2회 · tag …-wd-s (오늘 칸 ● 은 ✗ 로 닫힘)');
  W.tick(); await flush();
  chk(e.bonusCalls.length === 1, '이미 정산한 주 — 다시 안 준다');
  /* (c) 서버가 실패하면 대기줄에 남는다 */
  e = mkEnv({ now: at(2026, 10, 17, 7), rec: mkRec([1, 1, 1, 1, 0], false) });
  e.ctx.firebaseAPI.addChalBonus = async () => { throw new Error('offline'); };
  W = e.mk(); W.tick(); await flush();
  chk(Array.isArray(W.state().due) && W.state().due.length === 1 && W.state().due[0].tag === wk + '-wd-s' && W.state().due[0].n === 2, '지급 실패 → 대기줄에 남는다(로컬에 얹지 않음)');
});

await sec('── 5. 🎯집중 · 🔁반복', async () => {
  const now = at(2026, 10, 14, 10), wk = isoWeek(now);
  const H = mkEnv({ now }).H;
  const today = () => ({ date: H._focusDayStr(now), dateMs: now, sec: 0, done: 0, checks: {}, anchor: 0, fail: false });
  let e = mkEnv({ now, rec: { ts: 1, phase: 'wd', week: wk, kind: 'focus', cfg: { key: 'win:chrome.exe', exe: 'chrome.exe', label: 'chrome', hours: 1 }, days: [-3, -3, 0, -1, -1], today: today() } });
  let W = e.mk();
  W.setKeyPlatform('win');
  W.focusTick({ key: 'win:chrome.exe' }, 2); W.focusTick({ key: 'win:notepad.exe' }, 5); W.focusTick({ key: 'win:x', keyAlt: 'win:chrome.exe' }, 3);
  chk(W.state().today.sec === 5, '조건 앱일 때만 센다 · keyAlt(옛 키)도 인정 — 2+3초');
  W.setKeyPlatform('mac'); W.focusTick({ key: 'win:chrome.exe' }, 7);
  chk(W.state().today.sec === 5, '다른 플랫폼에서 건 조건은 안 센다');
  W.setKeyPlatform('win'); W.focusTick({ key: 'win:chrome.exe' }, 3600); W.tick(); await flush();
  chk(W.state().days[2] === 1 && e.toasts.includes('👑 오늘 달성! 1일째'), '1시간 채우면 오늘 ✓ (수요일 시작 · 1일째)');
  chk(/오늘 01:00:05 \/ 01:00:00/.test(e.els.chalToday.innerHTML) && /width:100%/.test(e.els.chalToday.innerHTML) && /🎯 chrome · 하루 1시간/.test(e.els.chalToday.innerHTML), '🎯 진행 줄 — 오늘 시간 / 목표 · 막대 100%');
  W.focusTick({ key: 'win:chrome.exe' }, 1);
  (e.winL.beforeunload || []).forEach(f => f());
  chk(JSON.parse(e.ls.get('tw.chal')).today.sec === W.state().today.sec, 'beforeunload — 쌓인 초를 로컬에 내려 쓴다');
  /* 🔁 반복 — 실행 화면 · 간격 지나면 알림 */
  e = mkEnv({ now, appMode: 'run', rec: { ts: 1, phase: 'wd', week: wk, kind: 'repeat', cfg: { text: '물', times: 3, gap: 1 }, days: [-3, -3, 0, -1, -1], today: Object.assign(today(), { anchor: now - 3600000 - 1000 }) } });
  W = e.mk(); W.tick(); await flush();
  chk(e.popups.length === 0 && W.state().today.anchor === now, '실행 화면에 들어간 때부터 다시 잰다 — 첫 tick 은 기준만 잡고 알림 없음');
  e.now = now + 3600000 + 1000; W.tick(); W.tick(); await flush();
  chk(e.popups.length === 1 && /🔁 반복 알림/.test(e.popups[0].children[0]._html) && /<b>물<\/b>를 해야 해요/.test(e.popups[0].children[0]._html), '간격이 지나면 반복 알림 팝업 하나(열려 있는 동안 또 안 띄움)');
  e.popups[0].children[0].querySelectorAll('[data-a]')[0].click(); await flush();
  chk(W.state().today.done === 1 && W.state().today.anchor === now + 3600000 + 1000, '[했다] → 1회 · 여기서부터 다시 잰다');
  e.appMode = 'other'; e.now = now + 3 * 3600000; W.tick(); await flush();
  chk(e.popups.length === 1, '실행 화면이 아니면 알림 없음');
  /* 오늘 안에 못 채우는 게 확정 — 밤 11시 · 남은 2회 · 간격 4시간 */
  const late = at(2026, 10, 14, 23);
  e = mkEnv({ now: late, appMode: 'run', rec: { ts: 1, phase: 'wd', week: wk, kind: 'repeat', cfg: { text: '물', times: 3, gap: 4 }, days: [-3, -3, 0, -1, -1], today: Object.assign(today(), { done: 1 }) } });
  W = e.mk(); W.tick(); await flush();
  chk(W.state().today.fail === true && W.state().days[2] === -2 && e.toasts.includes('오늘은 시간이 모자라요 — 내일 다시'), '오전 6시 전까지 못 채우면 그 자리에서 ✗ · 알림');
});

await sec('── 6. 로그아웃 지우기 · 서버 동기화', async () => {
  const now = at(2026, 10, 14, 10);
  const H = mkEnv({ now }).H;
  let e = mkEnv({ now, rec: { ts: 9, phase: 'wd', week: isoWeek(now), kind: 'focus', cfg: { key: 'win:a.exe', hours: 1 }, days: [-3, -3, 0, -1, -1],
    today: { date: H._focusDayStr(now), dateMs: now, sec: 0, done: 0, checks: {}, anchor: 0, fail: false } } });
  let W = e.mk();
  W.setKeyPlatform('win'); W.focusTick({ key: 'win:a.exe' }, 4);   // 🎯 초가 쌓여 dirty 인 채로
  e.ls.delete('tw.chal');
  W.resetMemory();
  chk(W.state().ts === 0 && W.state().week === '' && W.state().kind === '', 'resetMemory — 빈 기록');
  (e.winL.beforeunload || []).forEach(f => f());
  chk(!e.ls.has('tw.chal'), 'dirty=false — beforeunload 가 지운 키를 도로 안 쓴다');
  e = mkEnv({ now, rec: { ts: 5, auto: true }, srv: { ts: 9, autoWe: true } });
  W = e.mk(); await W.syncChalToServer('boot');
  chk(W.state().ts === 9 && W.state().autoWe === true && W.state().auto === false && JSON.parse(e.ls.get('tw.chal')).ts === 9, '서버가 새것 — 통째로 받고 받은 시각을 그대로(핑퐁 없음)');
  chk(e.bonusLocal.length === 1, 'boot 에는 보상 합계도 한 번 읽는다');
  e = mkEnv({ now, rec: { ts: 12, auto: true }, srv: { ts: 9 } });
  W = e.mk(); await W.syncChalToServer('check');
  chk(e.saved.length === 1 && e.saved[0].ts === 12 && e.bonusLocal.length === 0, '내 것이 새것 — 올린다 · check 에는 보상 합계를 안 읽는다');
  e = mkEnv({ now, rec: { ts: 12 }, srv: null });
  W = e.mk(); await W.syncChalToServer('check');
  chk(e.saved.length === 0 && W.state().ts === 12, '읽기 실패(null) — 아무것도 안 한다');
  e = mkEnv({ now, rec: { ts: 3 }, srv: {} });
  W = e.mk(); await W.syncChalToServer('launcher', 'pull');
  chk(e.saved.length === 1, 'pull · 서버가 비었으면 올린다');
});

await sec('── 7. app.js 배선', () => {
  const code = strip(APP);
  chk(!/function _chal\w+\(|\blet chalRec\b|const CHAL_PHASE\b|function syncChalToServer\(/.test(code), '달성표 정의는 app.js 에 없다(모듈에만)');
  chk(/function _chalTick\(/.test(MOD) && /function syncChalToServer\(/.test(MOD) && /window\.TwWeeklyChallenge = api/.test(MOD), '모듈이 정의 · window.TwWeeklyChallenge');
  chk((code.match(/TwWeeklyChallenge\.createWeeklyChallenge\(/g) || []).length === 1, 'createWeeklyChallenge 는 한 곳');
  const iMk = code.indexOf('TwWeeklyChallenge.createWeeklyChallenge('), iAct = code.indexOf('function _applyActiveAppState('), iPomo = APP.indexOf('TwPomodoro.createPomodoro(');   // 🍅 뽀모도로는 pomodoro.js 로(앱 FSD 6번) — 그 자리의 연결 줄
  chk(iAct > 0 && iMk > iAct && strip(APP.slice(0, iPomo)).length >= iMk, '원래 자리 — 활성 앱 판정 뒤 · 🍅 뽀모도로 앞');
  chk(/const CHAL_KEY = 'tw\.chal';/.test(APP) && !/'tw\.chal'/.test(strip(MOD)) && /storageKey: CHAL_KEY/.test(APP), 'CHAL_KEY 는 app.js(계정 전환 지움 목록) — 모듈은 deps 로');
  chk(/weeklyChal\.syncChalToServer\('launcher'\)/.test(code) && /call\(weeklyChal\.syncChalToServer, 'logout'\)/.test(code) && /weeklyChal\.resetMemory\(\)/.test(code)
    && /!pcNotFocusing\) weeklyChal\.focusTick\(state, dt\)/.test(code) && /weeklyChal\.setKeyPlatform\(/.test(code) && /weeklyChal\.open\(false\)/.test(strip(POMO)) && /weeklyChal: weeklyChal,/.test(code),
    '부르는 곳 — 런처 동기화 · 로그아웃 flush · 메모리 지우기 · 🎯 초 · 플랫폼 · 뽀모 서랍(pomodoro.js — weeklyChal 을 deps 로)');
  const off = (APP.match(/const WEEKLY_CHAL_OFF = \{([^\n]*)\};/) || [])[1] || '';
  const used = [...new Set((code.match(/weeklyChal\.(\w+)/g) || []).map(s => s.split('.')[1]))];
  chk(off && used.every(n => new RegExp('\\b' + n + '\\b').test(off)), '빈 껍데기 WEEKLY_CHAL_OFF 가 부르는 이름을 다 갖는다 (' + used.join(' · ') + ')');
  const call = (APP.match(/TwWeeklyChallenge\.createWeeklyChallenge\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  chk(deps.length === 13 && deps.every(l => /^\w+: (\(\)=>|\(\.\.\.a\)=>|[A-Z_]+,$)/.test(l)), 'deps 13개 — 함수는 화살표로 감싼다(부를 때 찾게) · 값은 상수만');
  chk(/appMode: \(\)=>appMode,/.test(call) && /gachaBonus: \(\)=>_gachaBonus,/.test(call), '다시 대입되는 let(appMode · _gachaBonus)은 읽는 함수로');
  const iW = HTML.indexOf('<script src="parts/weekly-challenge.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iW > 0 && iW < iA, 'html — weekly-challenge.js 를 app.js 앞에 싣는다');
  /* #103 교훈 — 크로미움 내장 전역(Scheduler 등)과 겹치면 typeof 가드가 늘 통과한다. 접두사로 피한다(헤드리스 크로미움에서 typeof 확인) */
  chk(/^Tw[A-Z]/.test('TwWeeklyChallenge') && !/window\.(WeeklyChallenge|Challenge)\s*=/.test(MOD), '전역 이름은 Tw 접두사 — 내장 전역과 안 겹침');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
})();
