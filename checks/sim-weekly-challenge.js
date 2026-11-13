/* ═══ 👑 sim-weekly-challenge.js — 달성표 화면 모듈 (앱 FSD 2번 · 0.13 D5-4 에서 서버 한 벌 위로) ═══════════════════
   weekly-challenge.js 는 상태(chal-store.js)를 그리고 사용자 누름을 store 동작으로 넘긴다. 여기서는 가짜 store · 가짜 DOM 위에서 화면 쪽만 본다(store 쪽은 sim-chal-store.js).
   ・1절: 셈 — 보상 문구 · 조건 이름 · 판정 키 · 숫자 칸
   ・2절: 만들 때 — 요청 0 · DOM 없어도 던지지 않음 · 서랍 열기(프리미엄 게이트 · 잠김 · store.openDrawer) · 뽀모 서랍 닫기
   ・3절: 화면 — 불러오는 중 · 못 불러옴 [다시 시도] · 잠김 → 서랍 대신 상태 줄 · 진행 중 표 · 선지급 표식 · 종류 고르기(쉬는 중 문구 · 자동 버튼) · 지난 기록
   ・4절: 누름 → store — 시작 · 수정 · 포기 · 자동 · 체크 · [다시 적기] · [보상 받기] · 실패하면 초안을 남긴다
   ・5절: 이벤트 → 알림 — 오늘 달성 · 반복 못 채움 · 보상 받음(선지급 토스트 · 정산 팝업) · 409 알림 · reset
   ・6절: 🎯집중 쌓기 — 판정 키가 맞을 때만 store 에 더한다 · 다른 플랫폼 조건 · keyAlt
   ・7절: 배선 — app.js(저장소를 만들어 넘김 · 하루 경계 연결 · 시작은 app-boot 한 곳) · html 순서 · 옛 장치(firebaseAPI · 앱 날짜 셈 · ts 최신 승)가 없음 */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['weekly-challenge.js', 'chal-store.js', 'app.js', 'desk-companion-prototype.html', 'pomodoro.js', 'smoke.js', 'app-boot.js'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = SRC['app.js'], HTML = SRC['desktop-companion-prototype.html'] || SRC['desk-companion-prototype.html'], MOD = SRC['weekly-challenge.js'], STORE = SRC['chal-store.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const flush = async (n = 6) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

function mkEl(tag, id){
  const L = {}, cls = new Set(), attrs = {};
  const o = {
    tagName: tag, id: id || '', children: [], style: {}, value: '', disabled: false, title: '', onclick: null, _text: '', _html: '',
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)),
      toggle: (c, f) => { const on = (f === undefined) ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; }, contains: c => cls.has(c) },
    get textContent(){ return o._text; }, set textContent(v){ o._text = String(v); o._html = ''; },
    get innerHTML(){ return o._html; }, set innerHTML(v){ o._html = String(v); o._text = String(v).replace(/<[^>]*>/g, ''); o._kids = null; },
    getAttribute: k => (k in attrs ? attrs[k] : null), setAttribute: (k, v) => { attrs[k] = String(v); },
    appendChild(c){ o.children.push(c); return c; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    fire(t, ev){ (L[t] || []).forEach(fn => fn(Object.assign({ preventDefault(){}, target: o }, ev || {}))); },
    click(){ return o.onclick ? o.onclick({}) : undefined; },
    closest: () => o, remove(){ o.removed = true; }, blur(){}, querySelector: () => null,
    querySelectorAll(sel){
      if(sel !== '[data-a]') return [];
      if(!o._kids) o._kids = [...o._html.matchAll(/data-a="(\w+)"/g)].map(m => { const b = mkEl('button'); b.setAttribute('data-a', m[1]); return b; });
      return o._kids;
    },
  };
  return o;
}

/* 가짜 store — 화면이 부르는 동작을 기록하고 view() 를 손으로 정한다 */
function mkEnv(opt){
  opt = opt || {};
  const env = { toasts: [], calls: [], popups: [], premium: opt.premium !== false, winL: {}, view: null, arcs: {}, results: {}, onChange: [], onEvent: [], idx: 4 };
  env.view = Object.assign({ load: 'ready', premium: true, day: '2026-11-13', phase: 'wd', week: {}, rec: { sec: 0, done: 0, checks: {}, fail: false, posted: false }, postFailed: false, claimFailed: false, claimable: [],
    goal: null, skipped: false, active: false, auto: false, pending: null, cells: [], s: 0, r: 0, range: '', earlyGot: false, met: false, posted: false }, opt.view || {});
  const els = new Proxy({}, { get: (t, k) => (typeof k === 'string' ? (t[k] || (t[k] = mkEl('div', k))) : undefined) });
  const getEl = id => (opt.noDom ? null : els[id]);
  const rec = (n) => (...a) => { env.calls.push([n, ...a]); return Promise.resolve(env.results[n] || { ok: true }); };
  const store = {
    view: () => env.view, arcView: (p) => env.arcs[p] || { state: 'none' }, todayIdx: () => env.idx, liveGoal: () => (env.view.active ? Object.assign({ ph: env.view.phase }, env.view.goal) : null),
    onChange: (f) => env.onChange.push(f), onEvent: (f) => env.onEvent.push(f), load: () => env.view.load,
    openDrawer: () => env.calls.push(['openDrawer']), reload: (u) => env.calls.push(['reload', u]), startChal: (...a) => env.calls.push(['startChal', ...a]), dayEnded: () => env.calls.push(['dayEnded']), flush: () => 'flushed',
    start: rec('start'), edit: rec('edit'), giveUp: rec('giveUp'), setAutoNext: rec('setAutoNext'), retryPost: rec('retryPost'), claimNow: rec('claimNow'),
    check: (...a) => { env.calls.push(['check', ...a]); return env.results.check || { ok: true }; },
    addFocusSec: (...a) => { env.calls.push(['addFocusSec', ...a]); return true; }, repeatAnswer: (...a) => { env.calls.push(['repeatAnswer', ...a]); return { ok: true }; },
  };
  const document = { getElementById: getEl, createElement: t => mkEl(t), activeElement: null, body: { appendChild(c){ env.popups.push(c); return c; } } };
  const ctx = { Math, JSON, String, Number, Array, Object, Promise, isFinite, parseInt, Set, console: { warn(){}, log(){} }, document,
    setTimeout: (fn) => { fn(); return 0; }, companion: { getFocusApps: async () => opt.apps || [{ key: 'win:chrome.exe', name: 'chrome.exe', title: '크롬' }] },
    _focusLogClamp(){ env.clamp = (env.clamp || 0) + 1; }, TwSafeHtml: globalThis.TwSafeHtml };
  ctx.window = ctx; ctx.addEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(STORE, ctx, { filename: 'chal-store.js' });
  vm.runInContext(opt.src || MOD, ctx, { filename: 'weekly-challenge.js' });
  env.ctx = ctx; env.els = els; env.store = store;
  env.mk = () => ctx.TwWeeklyChallenge.createWeeklyChallenge({
    chalStore: store, toast: (m) => env.toasts.push(m), escHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), formatHMS: (s) => 'T' + s,
    premiumOn: () => env.premium, appMode: () => 'run',
  });
  env.fire = (e) => env.onEvent.forEach(f => f(e));
  env.change = () => env.onChange.forEach(f => f());
  return env;
}
const CELL = { OK: 1, NOW: 0, WAIT: -1, FAIL: -2, SKIP: -3 };
const goalF = { kind: 'focus', cfg: { key: 'win:chrome.exe', label: 'Chrome', hours: 4 } };
const runView = (o) => Object.assign({ active: true, goal: goalF, cells: [CELL.OK, CELL.OK, CELL.OK, CELL.NOW, CELL.WAIT], s: 3, r: 2, range: '11/9 ~ 11/13', rec: { sec: 3600, done: 0, checks: {}, fail: false, posted: false } }, o || {});
const pbox = (p) => p.children[0];   // 팝업 겹판 안의 상자
const sec = async (title, fn) => { say(title); try{ await fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + (e && e.stack || e)); } };

(async () => {
await sec('── 1. 셈', () => {
  const e = mkEnv(), C = e.mk().calc;
  const rl = (s, r, ph) => C.rewardLine(s, r, ph);
  chk(/뽑기 2회<\/b> 확정/.test(rl(4, 0, 'wd').t) && /뽑기 1회<\/b> 확정/.test(rl(2, 1, 'wd').t) && /어려워요/.test(rl(0, 1, 'wd').t) && rl(0, 1, 'wd').dim === true, '보상 문구 — 주중 확정 · 어려움');
  chk(/1회는 받았고/.test(rl(4, 0, 'wd').t) && /뽑기 1회를 받았어요/.test(rl(3, 0, 'wd').t), '  3일째부터는 선지급을 받은 문구');
  chk(/1회<\/b> 확정|뽑기 2회/.test(rl(1, 0, 'we').t) || /뽑기 1회를 받았어요/.test(rl(1, 0, 'we').t), '  주말은 1일째가 선지급');
  chk(C.cfgLabel('focus', { key: 'win:chrome.exe', label: '' }) === '🎯 chrome 4시간'.replace('4', '0') || /🎯 chrome/.test(C.cfgLabel('focus', { key: 'win:chrome.exe', label: '' })), '조건 이름 — 키에서 보이는 이름을 뽑는다');
  chk(C.cfgLabel('repeat', { text: '<b>', times: 3 }).includes('&lt;b>') && C.cfgLabel('rule') === '📋 요일별 체크표', '  남의 글은 씻는다');
  chk(JSON.stringify(C.keysOf({ key: 'mac:com.x' })) === '["mac:com.x"]' && JSON.stringify(C.keysOf({ exe: 'A.EXE' })) === '["win:a.exe"]' && C.keysOf(null).length === 0, '판정 키 — 키 · 옛 실행파일 이름 승격');
  chk(C.clampNum('', 1, 12, 4) === 4 && C.clampNum('99', 1, 12, 4) === 12 && C.clampNum('0', 1, 12, 4) === 1, '숫자 칸 — 빈 칸은 원래 값 · 범위로 자른다');
  chk(JSON.stringify(C.ruleItems({ rules: [[' a ', '', 'b']] }, 0)) === '["a","b"]', '규칙 줄 — 빈 줄 뺀다');
});

await sec('── 2. 만들 때 · 서랍 열기', async () => {
  let e = mkEnv(); const W = e.mk();
  chk(e.calls.length === 0 && e.onChange.length === 1 && e.onEvent.length === 1, '만들 때는 store 를 부르지 않는다(구독 둘만)');
  chk(typeof W.startChallenge === 'function' && typeof W.dayEnded === 'function' && typeof W.flush === 'function' && W.open && W.isOpen && W.focusTick && W.setKeyPlatform, '내놓는 이름');
  W.startChallenge('uA', { userCode: 'uA' }, 'S');
  chk(e.calls[0].join() === 'startChal,uA,[object Object],S', '시작은 store.startChal 로 넘긴다');
  W.dayEnded(); chk(e.calls[1][0] === 'dayEnded' && W.flush() === 'flushed', '하루 경계 · 로그아웃 올리기도 store 로');
  e.els.chalBtn.click();
  chk(e.calls.filter(c => c[0] === 'openDrawer').length === 1 && e.els.focusLogWin.classList.contains('chal-on') && W.isOpen(), '👑 버튼 → 서랍 열림 + store.openDrawer(서버 한 벌 받기)');
  e.els.chalBtn.click(); chk(!W.isOpen(), '  다시 누르면 닫힘');
  e.els.focusLogWin.classList.add('pomo-on'); e.els.chalBtn.click();
  chk(!e.els.focusLogWin.classList.contains('pomo-on'), '  열면 🍅 서랍은 닫힌다(같은 자리 · 하나만)');
  e = mkEnv({ premium: false }); e.mk(); e.els.chalBtn.click();
  chk(!e.els.focusLogWin.classList.contains('chal-on') && e.toasts.length === 1 && /프리미엄/.test(e.toasts[0]) && !e.calls.length, '프리미엄이 아니면 열지 않고 안내(요청 0)');
  e = mkEnv({ view: { load: 'locked' } }); e.mk(); e.els.chalBtn.click();
  chk(!e.els.focusLogWin.classList.contains('chal-on') && /프리미엄/.test(e.toasts[0]), '서버가 «프리미엄 아님» 이라 한 뒤에도 같다(잠김)');
  e = mkEnv({ noDom: true }); let ok = true; try{ e.mk(); }catch(_){ ok = false; }
  chk(ok, 'DOM 이 없어도 던지지 않는다');
});

await sec('── 3. 화면', async () => {
  let e = mkEnv({ view: { load: 'loading', phase: null } }); let W = e.mk(); W.open(true);
  chk(e.els.chalState.style.display === 'block' && /불러오는 중/.test(e.els.chalStateMsg.textContent) && e.els.chalRun.style.display === 'none' && e.els.chalPick.style.display === 'none' && e.els.chalRetryBtn.style.display === 'none', '받는 중 — «불러오는 중» 만 · 서랍 화면 없음 · 다시 시도 없음');
  e = mkEnv({ view: { load: 'failed', phase: null } }); W = e.mk(); W.open(true);
  chk(/못 불러왔어요/.test(e.els.chalStateMsg.textContent) && e.els.chalRetryBtn.style.display === 'inline-block', '못 받음 — «못 불러왔어요» + [다시 시도]');
  e.els.chalRetryBtn.click(); chk(e.calls.some(c => c[0] === 'reload' && c[1] === true), '  [다시 시도] → store.reload(사용자가 누름)');
  e = mkEnv({ view: { load: 'locked', premium: false, phase: null } }); W = e.mk(); W.open(true);
  chk(/프리미엄 전용/.test(e.els.chalStateMsg.textContent) && e.els.chalRetryBtn.style.display === 'none', '잠김 — 프리미엄 안내(실패 아님 · 다시 시도 없음)');
  e = mkEnv({ view: runView({ earlyGot: true }) }); W = e.mk(); W.open(true);
  const wk = e.els.chalWeek.innerHTML;
  chk(e.els.chalState.style.display === 'none' && e.els.chalRun.style.display === 'block' && e.els.chalPick.style.display === 'none', '진행 중 — 표 화면');
  chk((wk.match(/chal-day/g) || []).length === 5 && (wk.match(/✓/g) || []).length === 3 && (wk.match(/✗/g) || []).length === 0 && /●/.test(wk) && /월<\/div>/.test(wk) && /금<\/div>/.test(wk), '  칸 5 · ✓ 3 · ● 1 · 요일 라벨');
  chk((wk.match(/chal-pay/g) || []).length === 1, '  선지급을 받았으면 세 번째 ✓ 칸에 표식 하나')
  chk(/T3600 \/ T14400/.test(e.els.chalToday.innerHTML) && /Chrome/.test(e.els.chalToday.innerHTML) && /3일 달성/.test(e.els.chalRunCount.textContent) && /11\/9 ~ 11\/13/.test(e.els.chalRunRange.innerHTML), '  🎯 오늘 카드 · 달성 일수 · 범위');
  chk(e.els.chalPostBtn.style.display === 'none' && e.els.chalClaimBtn.style.display === 'none', '  평소엔 [다시 적기] · [보상 받기] 가 안 보인다');
  e = mkEnv({ view: runView({ met: true, posted: false, postFailed: true, claimFailed: true, claimable: [{ slot: 'WEEKDAY_EARLY', amount: 1 }] }) }); W = e.mk(); W.open(true);
  chk(e.els.chalPostBtn.style.display === 'inline-block' && e.els.chalClaimBtn.style.display === 'inline-block', '서버에 못 적은 것 — [다시 적기] · [보상 받기] 가 뜬다(D5-Q3)');
  e.els.chalPostBtn.click(); e.els.chalClaimBtn.click();
  chk(e.calls.some(c => c[0] === 'retryPost') && e.calls.some(c => c[0] === 'claimNow'), '  누르면 store 로');
  e = mkEnv({ view: runView({ pending: { kind: 'focus', cfg: {} } }) }); W = e.mk(); W.open(true);
  chk(e.els.chalPendNote.style.display === 'block', '다음 날 목표가 걸려 있으면 «내일부터 적용» 줄');
  e = mkEnv({ view: { active: false, goal: null, cells: [], skipped: false } }); W = e.mk(); W.open(true);
  chk(e.els.chalPick.style.display === 'block' && e.els.chalRun.style.display === 'none' && e.els.chalAutoBtn.disabled === true, '목표 없음 — 종류 고르기 · 자동 버튼은 목표가 있어야 켜진다');
  chk(/5일/.test(e.els.chalPickLabel.textContent) && /안내|하나만/.test(e.els.chalPickHint.textContent) && e.els.chalStartWarn.style.display === 'block', '  수요일(idx 4)이면 남은 날 안내');
  e = mkEnv({ view: { active: false, goal: goalF, skipped: true, auto: true } }); W = e.mk(); W.open(true);
  chk(/쉬고 있어요/.test(e.els.chalPickHint.textContent) && e.els.chalAutoBtn.disabled === false && /자동 ✓/.test(e.els.chalAutoBtn.textContent) && e.els.chalAutoLine.style.display === 'block', '쉬는 중 — 문구 · 남은 목표로 자동 버튼 켜짐');
  e = mkEnv({ view: runView({ phase: 'we', cells: [CELL.NOW, CELL.WAIT], s: 0, r: 2 }) }); e.idx = 0; W = e.mk(); W.open(true);
  chk((e.els.chalWeek.innerHTML.match(/chal-day/g) || []).length === 2 && /토<\/div>/.test(e.els.chalWeek.innerHTML) && e.els.chalPhWe.classList.contains('on'), '주말 — 칸 2 · 토 · 일 · 세그먼트');
  e.arcs.wd = { state: 'ready', phase: 'wd', range: '11/9 ~ 11/13', kind: 'focus', cfg: goalF.cfg, cells: [1, 1, -2, -3, -3], s: 2, tickets: 1 };
  e.els.chalPhWd.click();
  chk(e.els.chalArc.style.display === 'block' && e.els.chalRun.style.display === 'none' && /2일<\/b> 달성/.test(e.els.chalArcSum.innerHTML) && /뽑기 1회/.test(e.els.chalArcSum.innerHTML) && /기록/.test(e.els.chalPhWd.textContent), '지난 기록 — 읽기 전용 화면 · 일수 · 보상');
  e.arcs.wd = { state: 'loading' }; e.change();
  chk(/불러오는 중/.test(e.els.chalArcSum.innerHTML), '  지난 주를 받는 중 문구');
  e.arcs.wd = { state: 'failed' }; e.change();
  chk(/못 불러왔어요/.test(e.els.chalArcSum.innerHTML), '  못 받음 문구');
  e.els.chalPhWe.click(); chk(e.els.chalRun.style.display === 'block', '  지금 단계 쪽을 누르면 돌아온다');
  e = mkEnv({ view: runView({ goal: { kind: 'rule', cfg: { rules: [[], [], [], [], ['a', 'b']] } }, rec: { checks: { 0: true } } }) }); e.mk().open(true);
  chk(/1 \/ 2/.test(e.els.chalToday.innerHTML.replace(/<[^>]*>/g, '')) && /☑ a/.test(e.els.chalToday.innerHTML), '📋 규칙 카드 — 오늘 항목 체크 상태');
  e.els.chalToday.fire('click', { target: Object.assign(mkEl('div'), { getAttribute: (k) => (k === 'data-i' ? '1' : null) }) });
  chk(e.calls.some(c => c[0] === 'check' && c[1] === 1), '  항목을 누르면 store.check');
  e = mkEnv({ view: runView({ goal: { kind: 'repeat', cfg: { text: 'x', times: 3, gap: 2 } }, rec: { done: 1, fail: true } }) }); e.mk().open(true);
  chk(/1 \/ 3/.test(e.els.chalToday.innerHTML) && /시간이 모자라요/.test(e.els.chalToday.innerHTML), '🔁 반복 카드 — 횟수 · 못 채움 문구');
  e = mkEnv({ view: runView() }); e.mk().open(false); chk(!e.els.focusLogWin.classList.contains('chal-on') && e.clamp >= 1, '닫기');
});

await sec('── 4. 누름 → store', async () => {
  let e = mkEnv({ view: { active: false, goal: null, cells: [] } }); let W = e.mk(); W.open(true);
  e.els.chalKindRepeat.click();
  chk(e.els.chalSetup.style.display === 'block' && e.els.chalStartBtn.textContent === '시작', '종류를 고르면 설정 화면');
  e.els.chalStartBtn.click(); await flush();
  chk(!e.calls.some(c => c[0] === 'start') && /지킬 일/.test(e.toasts.join()), '  지킬 일이 비면 시작 안 됨 · 안내');
  const rt = e.els.chalRepeatText; rt.fire('input'); rt.value = '스트레칭'; rt.fire('input');
  e.els.chalStartBtn.click(); await flush();
  const st = e.calls.find(c => c[0] === 'start');
  chk(st && st[1] === 'wd' && st[2] === 'repeat' && st[3].text === '스트레칭' && st[3].times === 3 && st[3].gap === 2 && st[4] === false && e.els.chalSetup.style.display === 'none', '  [시작] → store.start(단계 · 종류 · 설정 · 자동) · 성공하면 설정 화면 닫힘');
  e = mkEnv({ view: { active: false, goal: null, cells: [] } }); W = e.mk(); W.open(true); e.els.chalKindRepeat.click();
  e.els.chalRepeatText.value = 'a'; e.els.chalRepeatText.fire('input'); e.results.start = { ok: false, reason: 'failed' };
  e.els.chalStartBtn.click(); await flush();
  chk(e.els.chalSetup.style.display === 'block', '★ 저장이 실패하면 초안을 남긴다(다시 누를 수 있게)');
  e.results.start = { ok: false, reason: 'dayChanged' }; e.els.chalStartBtn.click(); await flush();
  chk(e.els.chalSetup.style.display === 'none' && /날이 바뀌었어요/.test(e.toasts.join()), '  날이 바뀐 때는 초안을 버리고 안내');
  e = mkEnv({ view: { active: false, goal: null, cells: [] } }); W = e.mk(); W.open(true); e.els.chalKindRepeat.click();
  e.els.chalRepeatText.value = 'a'; e.els.chalRepeatText.fire('input'); e.results.start = { ok: false, reason: 'loading' };
  e.els.chalStartBtn.click(); await flush();
  chk(/불러오는 중/.test(e.toasts.join()) && e.els.chalSetup.style.display === 'block', '  받는 중이면 «불러오는 중이에요»');
  e = mkEnv({ view: { active: false, goal: null, cells: [] } }); W = e.mk(); W.open(true); e.els.chalKindRule.click();
  e.els.chalStartBtn.click(); await flush();
  chk(!e.calls.some(c => c[0] === 'start') && /체크표가 비어/.test(e.toasts.join()), '📋 규칙 — 세는 요일이 비면 시작 안 됨');
  e = mkEnv({ view: runView({ auto: false }) }); W = e.mk(); W.open(true);
  e.els.chalEditBtn.click();
  chk(e.els.chalSetup.style.display === 'block' && e.els.chalStartBtn.textContent === '저장', '[수정] → 설정 화면(저장)');
  e.els.chalStartBtn.click(); await flush();
  const ed = e.calls.find(c => c[0] === 'edit');
  chk(ed && ed[2] === 'focus' && ed[3].hours === 4 && /내일부터/.test(e.toasts.join()), '  [저장] → store.edit · «내일부터 적용» 안내');
  e = mkEnv({ view: runView({ pending: { kind: 'focus', cfg: { key: 'win:x.exe', label: 'X', hours: 7 } } }) }); W = e.mk(); W.open(true); e.els.chalEditBtn.click();
  chk(e.els.chalFocusHours.value === '7', '  고칠 때는 걸려 있는 다음 날 목표부터 보여 준다');
  e = mkEnv({ view: runView() }); W = e.mk(); W.open(true);
  e.els.chalGiveupBtn.click();
  chk(e.popups.length === 1 && /정말 포기/.test(pbox(e.popups[0]).innerHTML) && !e.calls.some(c => c[0] === 'giveUp'), '[포기하기] → 확인 팝업(아직 안 보냄)');
  pbox(e.popups[0]).querySelectorAll('[data-a]').find(b => b.getAttribute('data-a') === 'ok').click(); await flush();
  chk(e.calls.some(c => c[0] === 'giveUp' && c[1] === 'wd'), '  확인 → store.giveUp');
  e = mkEnv({ view: runView() }); W = e.mk(); W.open(true); e.els.chalGiveupBtn.click();
  pbox(e.popups[0]).querySelectorAll('[data-a]').find(b => b.getAttribute('data-a') === 'no').click(); await flush();
  chk(!e.calls.some(c => c[0] === 'giveUp'), '  취소 → 안 보냄');
  e = mkEnv({ view: { active: false, goal: goalF, skipped: true, auto: false } }); W = e.mk(); W.open(true);
  e.els.chalAutoBtn.click(); await flush();
  chk(e.calls.some(c => c[0] === 'setAutoNext' && c[1] === 'wd' && c[2] === true), '[자동] → store.setAutoNext(지금 단계 · 반대로)');
  e = mkEnv({ view: runView() }); W = e.mk(); W.open(true); e.results.check = { ok: false, reason: 'loading' };
  e.els.chalToday.fire('click', { target: Object.assign(mkEl('div'), { getAttribute: () => '0' }) });
  chk(true, '(체크가 막히면 안내) 던지지 않는다');
});

await sec('── 5. 이벤트 → 알림', async () => {
  const e = mkEnv({ view: runView() }); const W = e.mk(); W.open(true);
  e.fire({ type: 'today', count: 3 }); chk(e.toasts.pop() === '👑 오늘 달성! 3일째', '오늘 달성 → «👑 오늘 달성! n일째»');
  e.fire({ type: 'repeatFail' }); chk(/시간이 모자라요/.test(e.toasts.pop()), '반복 못 채움 → 토스트');
  e.fire({ type: 'conflict' }); chk(e.toasts.pop() === '다른 기기에서 바꾼 내용을 받아왔어요', '409 → «다른 기기에서 바꾼 내용을 받아왔어요»');
  e.fire({ type: 'claimed', settle: false, amount: 1, phKey: 'wd', early: 0 }); chk(/뽑기 1회를 받았어요/.test(e.toasts.pop()), '선지급 받음 → 토스트');
  e.fire({ type: 'claimed', settle: true, amount: 1, early: 1, s: 4, phKey: 'wd', cells: [1, 1, 1, 1, -2] });
  chk(e.popups.length === 1 && /가챠 뽑기 1회/.test(pbox(e.popups[0]).innerHTML) && /합계 2회/.test(pbox(e.popups[0]).innerHTML) && /월·화·수·목/.test(pbox(e.popups[0]).innerHTML), '정산 받음 → 팝업(받은 양 · 먼저 받은 1회까지 합계 · 지킨 요일)');
  pbox(e.popups[0]).querySelectorAll('[data-a]')[0].click();
  const r = mkEnv({ view: runView({ goal: { kind: 'repeat', cfg: { text: 'x', times: 3, gap: 2 } }, rec: { done: 1 } }) }); r.mk().open(true);
  r.fire({ type: 'repeatDue' });
  chk(r.popups.length === 1 && /반복 알림/.test(pbox(r.popups[0]).innerHTML), '반복 시각 → 팝업(했다 · 미룬다)');
  r.fire({ type: 'repeatDue' }); chk(r.popups.length === 1, '  떠 있는 동안 또 안 띄운다');
  pbox(r.popups[0]).querySelectorAll('[data-a]').find(b => b.getAttribute('data-a') === 'ok').click(); await flush();
  chk(r.calls.some(c => c[0] === 'repeatAnswer' && c[1] === true), '  [했다] → store.repeatAnswer(true)');
  r.premium = false; r.fire({ type: 'repeatDue' }); chk(r.popups.length === 1, '프리미엄이 아니면 반복 알림도 안 띄운다(게이트)');
  e.fire({ type: 'reset' }); chk(true, 'reset 이벤트 — 던지지 않는다');
});

await sec('── 6. 🎯집중 쌓기', async () => {
  const e = mkEnv({ view: runView() }); const W = e.mk();
  const add = () => e.calls.filter(c => c[0] === 'addFocusSec');
  W.focusTick({ key: 'win:chrome.exe' }, 0.5); chk(add().length === 1 && add()[0][1] === 0.5, '판정 키가 맞으면 store 에 더한다');
  W.focusTick({ key: 'win:other.exe' }, 0.5); chk(add().length === 1, '  다른 앱이면 안 더한다');
  W.focusTick({ exeName: 'Chrome.EXE' }, 0.5); chk(add().length === 2, '  구버전 main(exeName)도 win: 으로 본다');
  W.focusTick({ key: 'win:zzz.exe', keyAlt: 'win:chrome.exe' }, 0.5); chk(add().length === 3, '  옛 규칙 키(keyAlt)가 맞아도 센다');
  W.setKeyPlatform('mac'); W.focusTick({ key: 'win:chrome.exe' }, 0.5);
  chk(add().length === 3, '★ 다른 플랫폼에서 등록한 조건은 센 척하지 않는다(안 쌓는다)');
  W.setKeyPlatform('win'); W.focusTick({ key: 'win:chrome.exe' }, 0.5); chk(add().length === 4, '  플랫폼이 맞으면 센다');
  const e2 = mkEnv({ view: { active: false, goal: null } }); e2.mk().focusTick({ key: 'win:chrome.exe' }, 1);
  chk(!e2.calls.some(c => c[0] === 'addFocusSec'), '집중 목표가 아니면 아무것도 안 한다');
  const e3 = mkEnv({ view: runView({ goal: { kind: 'repeat', cfg: { text: 'x', times: 1, gap: 1 } } }) }); e3.mk().focusTick({ key: 'win:chrome.exe' }, 1);
  chk(!e3.calls.some(c => c[0] === 'addFocusSec'), '  반복 · 규칙 목표에도 안 쌓는다');
});

await sec('── 7. 배선', () => {
  const body = (re) => { const m = APP.match(re); return m ? m[0] : ''; };
  const mk = body(/const chalStoreMod = TwChalStore\.createChalStore\(\{[\s\S]*?\n\}\);/);
  chk(/chalApi: TwFocusApi\.createFocusApi\(\{ authed: TwApi\.authed/.test(mk) && /focusPure: TwFocusApi,/.test(mk) && /chalCell: accountStoreMod,/.test(mk) && /serverDay: \(\)=>focusTotalMod\.serverDay\(\)/.test(mk) && /rolloverToday: \(\)=>focusTotalMod\._rolloverFocusToday\(\)/.test(mk) && /addQuitListener: \(fn\)=>window\.addEventListener\('beforeunload', fn\)/.test(mk), 'app.js — 저장소를 로그인 통로 · 계정 칸 · 서버 날 위에 만든다');
  chk(/const weeklyChal = TwWeeklyChallenge\.createWeeklyChallenge\(\{\n  chalStore: chalStoreMod,/.test(APP) && !/getMyUserId: \(\)=>getMyUserId\(\),\n  toast: \(\.\.\.a\)=>toast\(\.\.\.a\),\n  escHtml[\s\S]{0,200}dayShifted/.test(APP), 'app.js — 화면 모듈은 저장소를 받는다(앱 날짜 셈 · 사용자 코드 deps 없음)');
  chk(/focusTotalMod\.onDayEnd\(\(\)=>\{ weeklyChal\.dayEnded\(\); \}\);/.test(APP), 'app.js — 하루가 바뀌면 달성표도 이번 주를 다시 받는다');
  chk(/weeklyChal: \(code, me, session\)=>weeklyChal\.startChallenge\(code, me, session\),/.test(APP) && (APP.match(/\.startChallenge\(/g) || []).length === 1, 'app.js — 시작은 app-boot 표 한 곳');
  chk(!/CHAL_KEY|syncChalToServer|startChalSync|resetMemory\(\)[^;]*chal/i.test(strip(APP)), 'app.js — 옛 달성표 저장 키 · 동기화 · 부팅 타이머가 없다');
  const iS = HTML.indexOf('<script src="parts/focus/chal-store.js"></script>'), iW = HTML.indexOf('<script src="parts/focus/weekly-challenge.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iS > 0 && iS < iW && iW < iA, 'html — chal-store.js → weekly-challenge.js → app.js 순서');
  for(const id of ['chalState', 'chalStateMsg', 'chalRetryBtn', 'chalPostBtn', 'chalClaimBtn']) chk(new RegExp('id="' + id + '"').test(HTML), 'html — #' + id + ' 가 있다');
  chk(/PRELOAD\.push\('chal-store\.js'\)/.test(SRC['smoke.js']) && SRC['smoke.js'].indexOf("PRELOAD.push('chal-store.js')") < SRC['smoke.js'].indexOf("PRELOAD.push('weekly-challenge.js')"), 'smoke — 저장소를 화면 모듈보다 먼저 싣는다');
  const m = strip(MOD), s = strip(STORE);
  chk(!/firebaseAPI|localStorage|_dayShifted|_focusDayStr|DAY_START_HOUR|chalRec|syncChalToServer|(?<!session\.)setInterval|setTimeout\(/.test(m + s), '옛 장치 없음 — firebaseAPI · 로컬 저장 · 앱 날짜 셈 · ts 최신 승 · 자기 타이머');
  chk(!/document|innerHTML|window\./.test(s.replace(/typeof window/g, '').replace(/window\.TwChalStore/g, '')), '저장소는 DOM · 화면을 모른다');
  chk(/pomodoro\.js/.test(SRC['pomodoro.js']) || /weeklyChal\.open\(false\)/.test(SRC['pomodoro.js']), '뽀모 서랍이 달성표 서랍을 닫는 고리(open)가 그대로 있다');
  chk(/'weeklyChal',/.test(SRC['app-boot.js']), 'app-boot 차례 표에 weeklyChal');
});

await sec('── 8. 일부러 깨 보기', async () => {
  const probes = {
    gate: async (src) => { const e = mkEnv({ src, premium: false }); e.mk(); e.els.chalBtn.click(); return !e.els.focusLogWin.classList.contains('chal-on'); },
    foreign: async (src) => { const e = mkEnv({ src, view: runView() }); const W = e.mk(); W.setKeyPlatform('mac'); W.focusTick({ key: 'win:chrome.exe' }, 1); return !e.calls.some(c => c[0] === 'addFocusSec'); },
    keep: async (src) => { const e = mkEnv({ src, view: { active: false, goal: null, cells: [] } }); e.mk().open(true); e.els.chalKindRepeat.click(); e.els.chalRepeatText.value = 'a'; e.els.chalRepeatText.fire('input'); e.results.start = { ok: false, reason: 'failed' }; e.els.chalStartBtn.click(); await flush(); return e.els.chalSetup.style.display === 'block'; },
    notReady: async (src) => { const e = mkEnv({ src, view: { load: 'failed', phase: null } }); e.mk().open(true); return e.els.chalRun.style.display === 'none' && e.els.chalState.style.display === 'block'; },
    giveup: async (src) => { const e = mkEnv({ src, view: runView() }); e.mk().open(true); e.els.chalGiveupBtn.click(); pbox(e.popups[0]).querySelectorAll('[data-a]').find(b => b.getAttribute('data-a') === 'no').click(); await flush(); return !e.calls.some(c => c[0] === 'giveUp'); },
  };
  const BREAKS = [
    ['gate', "if(!_premiumOn()){ try{ toast('👑 달성표는 프리미엄 전용이에요'); }catch(_){} return; }", '', '프리미엄 게이트를 지움'],
    ['foreign', "if(_chalKeyForeign) return;", '', '다른 플랫폼 조건을 센 척함'],
    ['keep', "    if(r.ok){\n      /* [수정]은", "    if(true){\n      /* [수정]은", '저장 실패에도 초안을 닫음'],
    ['notReady', "const notReady = v.load !== 'ready' || !v.phase;", "const notReady = false;", '받기 전에도 서랍을 그림'],
    ['giveup', "[{a:'ok',t:'포기하기'},{a:'no',t:'취소',ghost:true}]).then(async a=>{\n      if(a !== 'ok') return;", "[{a:'ok',t:'포기하기'},{a:'no',t:'취소',ghost:true}]).then(async a=>{", '포기를 묻지 않고 보냄'],
  ];
  for(const [k, a, b, why] of BREAKS){
    if(!MOD.includes(a)){ chk(false, '깨 보기 대상 글을 못 찾음 — ' + why); continue; }
    chk(await probes[k](MOD) === true, '(원본은 통과) ' + why);
    chk(await probes[k](MOD.replace(a, b)) === false, '  깨면 빨강 — ' + why);
  }
});

console.log('');
console.log((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
})();
