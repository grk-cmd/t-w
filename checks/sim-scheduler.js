/* ═══ 📅 sim-scheduler.js — 스케줄러 · 🔔 일정 알림 모듈 (앱 FSD 1번 · 0.13 앱 묶음 D6 — 원본은 서버) ═══════════════════
   일정 · 디데이 보드 · 친구 태그 알림은 서버가 원본이다(schedule-api.js 가 /v1 로 읽고 쓴다). 진짜 provider 를 가짜 authed 위에 얹고
   scheduler.js 를 가짜 DOM 에서 실제로 돌려, 받는 상태 · 잠금 · 저장 줄 세우기 · 409 · 계정 바뀜을 입력 → 출력으로 판정한다.
   ・1절: 셈 — 날짜 차이 · «그날이 1일» · 카드 글자(D-3 · D-day · 100일) · 이정표(당일 · 50 · 100 단위)
   ・2절: 만들 때 — 오늘 일정 · 태그 알림 받기 · 서버 알림 두 종류 걸기 · 1분 타이머 · ESC 창 등록 · window._closeBellWin
   ・2-2절: 내 코드 없음 — 요청 0
   ・3절: 🔔 뱃지 · 알림 목록 — 오늘 일정 · 100일째 기념일 · 친구 태그(토스트) · 창을 열면 읽음 → 뱃지 · 알림 지우기 · 서버 알림이 오면 다시 받기
   ・4절: 달력 — 받는 중 · 못 받음(다시 시도) · 빈 달 ≠ 못 받음 · 받기 전 잠금 · 일정 쓰기 · 태그 · 지우기 · 409 · 늦게 온 앞 달 답 버림
   ・5절: 기념일 · D-day — 받는 상태 · 잠금 · 저장(통째, 새 장 · 태그) · 저장 줄 세우기 · 409 다시 받기 · 계정 바뀜 조용히 · 서버가 바뀌었다고 알리면 다시 받기
   ・6절: 👀 관람 — 친구 것(서버가 공개한 것만) · 편집 막음 · 늦게 온 친구 답 버림 · 끝나면 내 것
   ・7절: reset — 앞 계정 값 비움 · 늦게 온 앞 계정 답 버림
   ・8절: app.js 배선 · html
   ・9절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['scheduler.js', 'schedule-api.js', 'api-errors.js', 'app.js', 'desk-companion-prototype.html', 'net-ready.js', 'account.js', 'myhome-init.js', 'myhome-visit.js'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = _joinRenderer(SRC['app.js']), HTML = SRC['desk-companion-prototype.html'], MOD = SRC['scheduler.js'];
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sec = async (title, fn) => { say(title); try{ await fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + (e && e.stack || e)); } };

/* ── 가짜 DOM — 모듈이 쓰는 만큼만 ── */
function mkEl(tag, id){
  const L = {};
  const cls = new Set();
  const o = {
    tagName: tag, id: id || '', children: [], style: {}, dataset: {}, value: '', checked: false, title: '', disabled: false,
    _text: '', _html: '', clientWidth: 240, clientHeight: 240, offsetWidth: 280, offsetHeight: 120,
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)),
      toggle: (c, f) => { const on = (f === undefined) ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; },
      contains: c => cls.has(c) },
    get className(){ return Array.from(cls).join(' '); },
    set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); },
    get textContent(){ return o._text + o.children.map(c => c.textContent).join(''); },
    set textContent(v){ o._text = String(v); o.children = []; },
    get innerHTML(){ return o._html; },
    set innerHTML(v){ o._html = String(v); o._text = String(v).replace(/<[^>]*>/g, ''); o.children = []; },
    appendChild(c){ o.children.push(c); return c; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    fire(t, ev){ (L[t] || []).forEach(fn => fn(Object.assign({ preventDefault(){}, stopPropagation(){}, button: 0, target: null }, ev || {}))); },
    click(){ if(o.onclick) o.onclick({ stopPropagation(){} }); o.fire('click'); },
    focus(){}, remove(){},
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 80, height: 80 }),
  };
  return o;
}
const tick = async (n) => { for(let i = 0; i < (n || 12); i++) await new Promise(r => setImmediate(r)); };
const deferred = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : 'request' });
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const NOW = new Date(), TODAY = ymd(NOW), YM = TODAY.slice(0, 7), DD = TODAY.slice(8, 10);
const nextYM = (() => { const d = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); })();
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222', U3 = '33333333-3333-4333-8333-333333333333', U4 = '44444444-4444-4444-8444-444444444444';
const card = (id, text, date, over) => Object.assign({ ddayId: id, text, date, visibility: 'PRIVATE', notify: false, countFromOne: true, bgColor: null, bgImage: null, createdAt: '2026-10-01T00:00:00Z' }, over || {});
const BOARD = (over) => Object.assign({ version: 5, cards: [card(U1, '만난 날', daysAgo(10)), card(U2, '졸업', daysAgo(20), { countFromOne: false })], banners: [card(U3, '시험', '2999-01-01', { countFromOne: false })] }, over || {});
const item = (id, date, text, vis, ver, at) => ({ id, date, text, visibility: vis || 'PRIVATE', version: ver == null ? 1 : ver, createdAt: new Date(at == null ? Date.now() - 60000 : at).toISOString() });
const bell = (id, fromName, text, date, at) => ({ id, kind: 'SCHEDULE_TAG', section: 'BELL', title: '', body: text, payload: { date, from: 'u-' + id, fromName }, createdAt: new Date(at).toISOString() });

/* 가짜 authed — 길(routes)마다 답(값 · 던질 Error · 함수 · Promise)을 정한다. 쓰기는 실제 api-client 처럼 expectOwner 를 견준다 */
function fakeAuthed(routes, st){
  const log = [];
  const run = async (method, path, body, opts) => {
    if(method !== 'GET' && opts && opts.expectOwner && opts.expectOwner !== st.who) throw Object.assign(new Error('owner'), { code: 'OWNER_CHANGED', kind: 'auth' });   // 요청이 나가기 전에 끝난다(요청 0)
    log.push({ method, path, body, opts });
    if(method === 'GET' && opts && opts.onOwner) opts.onOwner(st.who);
    const key = method + ' ' + path.split('?')[0].replace(/\/v1\/me\/schedules\/[^/]+$/, '/v1/me/schedules/:id').replace(/\/v1\/me\/notifications\/[^/]+$/, '/v1/me/notifications/:id');
    if(!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = routes[key];
    const v = typeof r === 'function' ? r(body, path) : r;
    const w = await v;
    if(w instanceof Error) throw w;
    return w;
  };
  return { log, get: (p, o) => run('GET', p, undefined, o), post: (p, b, o) => run('POST', p, b, o), put: (p, b, o) => run('PUT', p, b, o), del: (p, o) => run('DELETE', p, undefined, o) };
}
const monthOfPath = (path) => (/month=([\d-]+)/.exec(path) || [])[1];

function mkEnv(opt){
  opt = opt || {};
  const st = { who: 'tokenA' };
  /* 기본 길 — 이번 달에 일정 없음 · 보드 비어 있음 · 알림 없음. 판정마다 덮는다 */
  const routes = Object.assign({
    'GET /v1/me/schedules': [], 'GET /v1/me/ddays': { version: 0, cards: [], banners: [] },
    'GET /v1/me/notifications': { items: [], nextCursor: null },
  }, opt.routes || {});
  const authed = fakeAuthed(routes, st);
  const els = {};
  els.bellWin = mkEl('div', 'bellWin'); els.bellWin.style.display = 'none';
  const ls = new Map();
  const timers = [], toasts = [], errs = [], escWins = [], winListeners = {}, rt = {};
  const win = {
    firebaseAPI: opt.noApi ? undefined : {},
    addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); },
  };
  const document = {
    getElementById: id => (opt.only && !opt.only.includes(id)) ? null : (els[id] = els[id] || mkEl('div', id)),
    createElement: tag => mkEl(tag),
    querySelector: (q) => (opt.qs && opt.qs[q]) || null, querySelectorAll: () => [],
    addEventListener(){}, removeEventListener(){},
    body: mkEl('body'),
  };
  const localStorage = { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) };
  const setInterval = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  const setTimeoutF = opt.nowTimers ? (fn) => { fn(); return 0; } : setTimeout;
  const noop = () => {};
  new Function('window', 'module', 'document', 'localStorage', 'setInterval', 'requestAnimationFrame', 'innerWidth', 'innerHeight', 'setTimeout',
    'TwSafeHtml', SRC['net-ready.js'] + '\nvar TwNetReady = window.TwNetReady;\n' + (opt.src || MOD))
    (win, undefined, document, localStorage, setInterval, noop, 1280, 800, setTimeoutF, { cssUrl: (u) => 'url(' + u + ')' });
  const apiMod = {}; new Function('window', 'module', opt.apiSrc || SRC['schedule-api.js'])(apiMod, undefined);
  const scheduleApi = apiMod.TwScheduleApi.createScheduleApi({
    authed, newId: () => 'req-abcdefgh-' + authed.log.length,
    warn: noop,
  });
  const errMod = {}; new Function('window', 'module', SRC['api-errors.js'])(errMod, undefined);
  const apiErrors = errMod.TwApiErrors.createApiErrors({ notifyError: (code) => { errs.push(code); return true; } });
  const g = { viewing: null, friends: opt.friends || {} };
  const S = win.MhScheduler.createScheduler({
    scheduleApi, apiErrors, notifyError: (code) => { errs.push(code); return true; },
    rtOn: (kind, fn) => { (rt[kind] = rt[kind] || []).push(fn); return noop; },
    getMyUserId: () => ('uid' in opt ? opt.uid : 'me1'),
    viewingUserId: () => g.viewing, myHomeFriends: () => g.friends,
    toast: m => toasts.push(m),
    uiIconEl: (name) => { const e = mkEl('img'); e.dataset.icon = name; return e; },
    escRegisterWindow: w => escWins.push(w),
    closeChipPopups: () => {}, positionInputBelowChar: () => {},
    inboxUnreadCount: () => opt.inbox || 0, refreshFriendTabBadge: () => { g.friendBadge = (g.friendBadge || 0) + 1; },
    bellSeenKey: 'tw.bellSeenTs',
    twNav: opt.twNav || { go(){}, NAV: {} },
  });
  const calls = (m, re) => authed.log.filter(x => x.method === m && re.test(x.path));
  return { S, scheduleApi, win, els, ls, timers, toasts, errs, escWins, winListeners, g, st, routes, authed, rt, calls, el: id => document.getElementById(id) };
}
const gridCards = (E) => E.el('mhDdayGrid').children.filter(c => c.classList.contains('mh-dcard') && !c.classList.contains('add'));
const dayCells = (E) => E.el('mhSchedGrid').children.filter(c => !c.classList.contains('out'));
const pickAll = (E, list) => { list.querySelectorAll = () => list.children.map(l => { l.children[0].checked = true; return l.children[0]; }); };

(async () => {

/* 계정이 바뀌는 사이 늦게 온 🔔 · 오늘 일정 답 — reset 뒤에 풀어 줘도 화면에 안 앉는다. asserts=true 면 chk 로 판정 */
async function staleBell(src, asserts){
  const dN = deferred(), dM = deferred();
  const E = mkEnv({ src, routes: { 'GET /v1/me/notifications': () => dN.p, 'GET /v1/me/schedules': () => dM.p, 'DELETE /v1/me/notifications/:id': null, 'POST /v1/me/schedules': item('n1', TODAY, 'x') } });
  await tick();
  E.S.reset();
  dN.res({ items: [bell('n1', '앞 계정 친구', '앞 계정 점심', TODAY, Date.now() + 5000)], nextCursor: null });
  dM.res([item('t1', TODAY, '앞 계정 오늘 일정')]);
  await tick(20);
  E.el('myBellBtn').fire('click');
  const ok1 = E.el('myBellBadge').textContent === '0' && E.el('bellList').textContent.includes('오늘 예정된 일정이 없어요') && !E.toasts.some(m => m.startsWith('🔔 '));
  const e1 = await rej(E.scheduleApi.deleteBell('me1', 'n1'));
  const e2 = await rej(E.scheduleApi.createItem('me1', { date: TODAY, text: 'x' }));
  const ok2 = e1 && e1.code === 'NOT_RECEIVED' && e2 && e2.code === 'NOT_RECEIVED' && E.calls('DELETE', /./).length === 0 && E.calls('POST', /./).length === 0;
  chk(ok1, '계정이 바뀌는 사이 늦게 온 🔔 · 오늘 일정 답은 버린다 — 뱃지 0 · 알림 목록 빈 칸 · 토스트 0');
  chk(ok2, '  reset 뒤 읽기 없이는 알림 지우기 · 일정 쓰기가 NOT_RECEIVED(요청 0) — 늦게 끝난 읽기도 «받음» 기억을 되살리지 않는다');
}
async function rej(p){ try{ await p; return null; }catch(e){ return e; } }

await sec('── 1. 셈', async () => {
  const C = mkEnv().S.calc;
  chk(C.daysBetween('2026-03-01', '2026-03-31') === 30 && C.daysBetween('2026-03-08', '2026-03-09') === 1, '날짜 차이 — 서머타임 · 시간대와 무관하게 하루 = 1');
  chk(C.ddayBase1({ kind: 'anniv', base1: true }) === true, '«그날이 1일» — 서버가 준 값이 켜진 기념일');
  chk(C.ddayBase1({ kind: 'anniv', base1: false }) === false && C.ddayBase1({ kind: 'dday', base1: true }) === false && C.ddayBase1(null) === false,
      '  끈 기념일 · ⏳ 배너 · 빈 값은 꺼진 것');
  const L = (d, b) => C.ddayCountLabel(d, b).txt;
  chk(L(3, false) === 'D-3' && L(3, true) === 'D-3', '미래는 셈법과 무관 — D-3 (켜도 D-4 가 아니다)');
  chk(L(0, false) === 'D-day' && C.ddayCountLabel(0, false).today, '당일 — D-day');
  chk(L(0, true) === '1일' && C.ddayCountLabel(0, true).today, '  «그날이 1일» 의 당일 — 1일');
  chk(L(-99, true) === '100일' && L(-99, false) === '99일', '지난 날 — 켜면 100일 · 끄면 99일 (제보 «하루씩 부족»)');
  chk(C.ddayShownDays({ kind: 'anniv', date: daysAgo(99), base1: true }, TODAY) === 100, '화면 숫자 — 99일 전 기념일은 100');
  const M = C.ddayMilestoneDays;
  chk(M(0, 1) && M(49, 50) && M(99, 100) && M(199, 200), '이정표 — 당일(raw 0) · 50 · 100 단위');
  chk(!M(-1, 0) && !M(98, 99) && !M(149, 150), '  아직 안 온 날 · 99 · 150 은 아님');
});

await sec('── 2. 만들 때', async () => {
  const E = mkEnv({ routes: { 'GET /v1/me/schedules': [item('t1', TODAY, '병원')], 'GET /v1/me/notifications': { items: [bell('n1', '친구A', '점심', TODAY, Date.now() + 1000)], nextCursor: null } } });
  await tick();
  chk(E.calls('GET', /^\/v1\/me\/notifications\?section=BELL/).length === 1 && E.calls('GET', new RegExp('^/v1/me/schedules\\?month=' + YM + '$')).length === 1,
      '네트워크가 준비돼 있으면 바로 — 🔔 태그 알림(BELL 칸)과 이번 달 일정을 한 번씩 받는다(스케줄러 탭을 안 열어도)');
  chk(E.calls('GET', /ddays/).length === 0, '  디데이 보드는 로그인 뒤 받는다(loadBoard) — 만들 때는 안 받는다');
  chk((E.rt.schedule || []).length === 1 && (E.rt.notification || []).length === 1, '서버 알림 두 종류를 한 번씩 건다 — schedule(내 일정 · 보드) · notification(알림함)');
  chk(E.timers.some(x => x.ms === 60 * 1000), '자정 넘김 — 1분마다 날짜를 본다');
  chk(E.escWins.length === 1 && E.escWins[0].key === 'bell' && E.escWins[0].el === E.el('bellWin'), 'ESC 로 닫히는 창에 🔔 알림창 등록');
  chk(typeof E.win._closeBellWin === 'function', 'window._closeBellWin — 칩 팝업 닫기가 부른다');
  chk(Array.isArray(E.win.__winPosResetters) && E.win.__winPosResetters.length === 1, '🪟 창 위치 초기화 목록에 🔔 자리');
  const L = mkEnv({ noApi: true });
  await tick();
  chk(L.authed.log.length === 0 && (L.winListeners['firebase-ready'] || []).length === 1, '네트워크가 아직이면 firebase-ready 를 기다린다 — 그 전엔 요청 0');
  const N = mkEnv({ only: [] });
  await tick();
  chk(N.authed.log.length === 0 && N.timers.length === 0 && N.escWins.length === 0 && !N.rt.schedule, 'DOM 이 없으면(창 요소 없음) 아무것도 걸지 않는다 — 예전처럼 조용히');
});

await sec('── 2-2. 내 코드 없음 — 요청 0', async () => {
  const noUid = async (src) => {
    /* 서버 길(provider)에도 «내 코드 없음 → 던짐» 이 있다 — 모듈 쪽 확인만 보려고 그것은 걷고 돌린다 */
    const apiSrc = SRC['schedule-api.js'].replace(/\n *if\(!uid\) throw codeError\('NO_USER'[^\n]*/g, '');
    const E = mkEnv({ uid: null, src, apiSrc });
    E.S.renderSchedCalendar(); E.S.loadBoard(); E.S.loadMine();
    E.timers.forEach(x => { if(x.ms === 60 * 1000) x.fn(); });
    (E.rt.schedule || []).forEach(fn => fn({ kind: 'schedule' })); (E.rt.notification || []).forEach(fn => fn({ kind: 'notification', section: 'BELL' }));
    await tick();
    return E.authed.log.length === 0;
  };
  chk(await noUid(), '내 코드 없음 → 달력 · 보드 · 오늘 일정 · 태그 알림 · 서버 알림 받기 모두 요청 0');
  const m2 = MOD.replace(/\n *if\(!me\) return;[^\n]*/g, '').replace(/\n *if\(!getMyUserId\(\)\) return;[^\n]*/g, '').replace(/\n *if\(!owner \|\| !_schedYM\) return;[^\n]*/, '');
  chk(m2 !== MOD && !(await noUid(m2)), '  깨 보기 — 내 코드 확인을 빼면 빨강');
});

await sec('── 3. 🔔 뱃지 · 알림 목록', async () => {
  const now = Date.now();
  const E = mkEnv({ inbox: 1, routes: {
    'GET /v1/me/schedules': [item('t1', TODAY, '병원')],
    'GET /v1/me/notifications': { items: [bell('n1', '친구A', '같이 점심', TODAY, now + 5000), bell('n0', '친구B', '지난 일정', '2020-01-01', now + 5000)], nextCursor: null },
    'GET /v1/me/ddays': BOARD({ cards: [card(U1, '만난 날', daysAgo(99), { notify: true }), card(U2, '조용', daysAgo(99), { notify: false })], banners: [] }),
    'DELETE /v1/me/notifications/:id': null,
  } });
  await E.S.loadBoard(); await tick();
  const badge = E.el('myBellBadge'), list = E.el('bellList');
  chk(badge.textContent === '5' && badge.classList.contains('on'), '뱃지 = 수령함 1 + 오늘 일정 1 + 알림 켠 기념일(오늘 100일) 1 + 친구 태그 알림 2(끈 기념일은 안 셈)');
  chk(E.toasts.filter(m => m.startsWith('🔔 ')).length === 2 && E.toasts.includes('🔔 친구A 님이 일정에 태그했어요'), '  새 태그 알림은 토스트');
  chk(E.g.friendBadge > 0, '  친구 탭 보상 뱃지도 같이 갱신');
  E.el('myBellBtn').fire('click');
  chk(E.el('bellWin').style.display === 'block' && E.S.isBellOpen(), '🔔 버튼 → 알림창이 열린다');
  const txt = list.textContent;
  chk(txt.includes('병원') && txt.includes('만난 날 100일째 되는 날!') && txt.includes('같이 점심') && txt.includes('친구A 님이 태그함'), '  목록 — 오늘 일정 · 100일째 기념일 · 친구 태그');
  chk(!txt.includes('조용') && !txt.includes('지난 일정'), '  알림을 끈 기념일 · 오늘이 아닌 태그는 안 뜬다');
  chk(txt.includes('알림함 확인') && txt.includes('NEW 1'), '  아래 [📪 알림함 확인] · 안 읽은 수');
  chk(Number(E.ls.get('tw.bellSeenTs')) > 0, '  열면 읽음 시각을 tw.bellSeenTs 에 적는다');
  /* 오늘 일정 · 태그 알림은 만든 시각이 읽음 시각보다 뒤인 것만, 기념일은 «오늘 열어 봤는가» 로 센다 */
  chk(badge.textContent === '3', '  열고 나면 오늘 일정(1분 전에 만든 것) · 기념일은 본 것으로 빠진다(수령함 1 + 아직 안 읽은 시각의 태그 2)');
  chk(!/toISOString\(\)\.slice\(0,\s*10\)/.test(MOD) && /const seenDay = seen \? _localYMD\(seen\)/.test(MOD), '  본 날은 이 기기 시간대 날짜(_localYMD) — UTC 로 자르지 않는다');
  const x = list.children.find(c => c.className === 'bell-row today' && c.textContent.includes('같이 점심')).children.find(c => c.className === 'bx');
  x.click(); await tick();
  const del = E.calls('DELETE', /notifications\/n1$/);
  chk(del.length === 1 && del[0].opts.expectOwner === 'tokenA' && !E.el('bellList').textContent.includes('같이 점심'), '× → 서버에서 지우고(expectOwner) 목록에서도 뺀다');
  E.routes['GET /v1/me/notifications'] = { items: [bell('n2', '친구C', '저녁', TODAY, now + 9000)], nextCursor: null };
  const before = E.calls('GET', /notifications/).length;
  E.rt.notification[0]({ kind: 'notification', section: 'MAIL' });
  await tick();
  chk(E.calls('GET', /notifications/).length === before, '서버 알림 — 우편(MAIL)이 왔다는 알림에는 다시 받지 않는다');
  E.rt.notification[0]({ kind: 'notification', section: 'BELL' });
  await tick();
  chk(E.calls('GET', /notifications/).length === before + 1 && E.el('bellList').textContent.includes('저녁'), '  🔔(BELL)이 왔다는 알림 → 다시 받아 열린 창에 바로 그린다');
  E.rt.notification[0]({ kind: 'notification', resync: true }); await tick();
  chk(E.calls('GET', /notifications/).length === before + 2, '  오래 끊겼다 붙은 뒤(resync)에도 다시 받는다');
  E.el('bellClose').fire('click');
  chk(E.el('bellWin').style.display === 'none' && !E.S.isBellOpen(), '✕ → 닫힌다');
  E.el('myBellBtn').fire('click');
  const inboxBtn = list.children.find(c => c.className === 'bell-inbox-btn');
  try{ inboxBtn.onclick(); }catch(_){}
  chk(!!inboxBtn && E.el('bellWin').style.display === 'none' && !E.S.isBellOpen(), '[📪 알림함 확인] → 알림창이 닫힌다');
  const clicked = [], navs = [];
  const tab = (n) => { const t = mkEl('button'); t.onclick = () => clicked.push(n); return t; };
  const E3 = mkEnv({ inbox: 1, nowTimers: true, twNav: { go: (k) => navs.push(k), NAV: { MY_HOME: 'myHome' } },
    qs: { '.mh-tab[data-tab="mail"]': tab('mail'), '#mhInboxTabs .mh-ibx-tab[data-tag="all"]': tab('all') } });
  E3.S.renderBellList();
  E3.el('bellList').children.find(c => c.className === 'bell-inbox-btn').onclick();
  chk(navs.join() === 'myHome' && clicked.join() === 'mail,all', '★ [📪 알림함 확인] — 마이홈 → 우편함 탭 → 소식 종류 «전체» (고른 종류에 새 공지가 가리지 않게)');
  const E2 = mkEnv(); await tick();
  E2.S.renderBellList();
  chk(E2.el('bellList').textContent.includes('오늘 예정된 일정이 없어요'), '아무것도 없으면 «오늘 예정된 일정이 없어요»');
  const F = mkEnv({ routes: { 'GET /v1/me/schedules': apiErr(503, 'X'), 'GET /v1/me/notifications': apiErr(503, 'X') } }); await tick();
  chk(F.errs.filter(c => c === 'E-MH-04').length === 1 && F.errs.length === 1, '오늘 일정 · 알림을 못 받으면 오류 번호 E-MH-04 — 두 가지가 같이 실패해도 한 번만');
});

await sec('── 4. 달력', async () => {
  const d = deferred();
  let hold = false;
  const E = mkEnv({ routes: { 'GET /v1/me/schedules': (b, p) => (hold ? d.p : [item('a', YM + '-' + DD, '회의', 'PUBLIC', 3)]) } });
  await tick();
  hold = true;
  E.S.renderSchedCalendar();
  const day = E.el('mhSchedDayList');
  chk(day.textContent.includes('불러오는 중이에요') && !day.textContent.includes('회의') && !day.textContent.includes('등록된 일정이 없어요'), '받는 중 — «불러오는 중이에요» (빈 목록 문구가 아니다)');
  E.el('mhSchedInput').value = '지금 쓴 일정'; E.el('mhSchedAddBtn').fire('click'); await tick();
  chk(E.calls('POST', /./).length === 0 && E.toasts.some(m => m.includes('불러오는 중')), '  받기 전에는 일정을 쓰지 못한다(잠금) — 요청 0 · 안내');
  hold = false; d.res([item('a', YM + '-' + DD, '회의', 'PUBLIC', 3)]); await tick();
  chk(day.textContent.includes('회의') && day.textContent.includes('공개'), '받으면 목록 — 일정 · 공개 표시');
  const cells = dayCells(E);
  chk(cells[Number(DD) - 1].classList.contains('today') && cells[Number(DD) - 1].classList.contains('sel') && cells[Number(DD) - 1].children.length === 2, '  오늘 칸 — today · 선택 · 일정 점');
  chk(E.el('mhSchedTitle').textContent === NOW.getFullYear() + '년 ' + (NOW.getMonth() + 1) + '월', '  제목 «YYYY년 M월»');
  E.routes['GET /v1/me/schedules'] = [];
  E.el('mhSchedToday').fire('click'); await tick();
  chk(day.textContent.includes('등록된 일정이 없어요') && !day.textContent.includes('불러오지'), '일정이 없는 달은 «등록된 일정이 없어요» — 못 받음 문구가 아니다');
  E.routes['GET /v1/me/schedules'] = apiErr(503, 'X');
  E.el('mhSchedToday').fire('click'); await tick();
  chk(day.textContent.includes('불러오지 못했어요') && E.errs.includes('E-MH-04'), '못 받음 — «불러오지 못했어요 — 눌러서 다시 시도» · E-MH-04');
  const n0 = E.calls('GET', /schedules\?month/).length;
  E.routes['GET /v1/me/schedules'] = [item('b', YM + '-' + DD, '복구', 'PRIVATE', 1)];
  day.children[0].onclick(); await tick();
  chk(E.calls('GET', /schedules\?month/).length === n0 + 1 && day.textContent.includes('복구'), '  그 글자를 누르면 다시 받는다');
  let nid = 0;
  E.routes['POST /v1/me/schedules'] = (b) => item('n' + (++nid), b.date, b.text, b.visibility, 1);
  E.el('mhSchedInput').value = '치과'; E.el('mhSchedAddBtn').fire('click'); await tick();
  const p = E.calls('POST', /./)[0];
  chk(p.path === '/v1/me/schedules' && p.body.date === YM + '-' + DD && p.body.text === '치과' && p.body.visibility === 'PRIVATE' && p.opts.expectOwner === 'tokenA', '일정 쓰기 — POST { date · text · visibility } · expectOwner');
  chk(day.textContent.includes('치과') && E.el('mhSchedInput').value === '' && E.toasts.includes('일정을 추가했어요'), '  서버가 돌려준 일정이 목록에 얹히고 입력칸이 비워진다 · 토스트');
  chk(E.calls('GET', /schedules\?month/).length === n0 + 1, '  쓰고 나서 달 전체를 다시 받지 않는다(돌려받은 일정을 얹는다)');
  E.g.friends = { f1: { name: '친구A' }, f2: { name: '친구B' } };
  E.el('mhSchedTagBtn').fire('click');
  chk(E.el('mhSchedTagList').children.length === 2, '태그 — 친구 목록이 뜬다');
  pickAll(E, E.el('mhSchedTagList'));
  E.el('mhSchedTagOk').fire('click');
  const pub = E.el('mhSchedPublic'), hint = E.el('mhSchedPublicHint');
  chk(pub.checked === true && pub.disabled === true && hint.textContent === '태그한 친구가 볼 수 있게 공개돼요', '  태그하면 «공개» 를 켜고 잠그고 까닭을 옆에 보인다(앱이 몰래 바꾸지 않는다)');
  E.el('mhSchedTagBtn').fire('click'); E.el('mhSchedTagList').querySelectorAll = () => []; E.el('mhSchedTagOk').fire('click');
  chk(pub.checked === false && pub.disabled === false && hint.textContent === '', '  태그를 다 빼면 원래 값(꺼짐)으로 돌리고 잠금 · 까닭을 걷는다');
  pub.checked = true;
  E.el('mhSchedTagBtn').fire('click'); pickAll(E, E.el('mhSchedTagList')); E.el('mhSchedTagOk').fire('click');
  E.el('mhSchedTagBtn').fire('click'); E.el('mhSchedTagList').querySelectorAll = () => []; E.el('mhSchedTagOk').fire('click');
  chk(pub.checked === true && pub.disabled === false, '  원래 켜 둔 공개는 태그를 빼도 켜진 채');
  pub.checked = false;
  E.el('mhSchedTagBtn').fire('click'); pickAll(E, E.el('mhSchedTagList')); E.el('mhSchedTagOk').fire('click');
  E.el('mhSchedInput').value = '회식'; E.el('mhSchedAddBtn').fire('click'); await tick();
  const p2 = E.calls('POST', /./)[1];
  chk(eq(p2.body.tagFriends, ['f1', 'f2']) && p2.body.visibility === 'PUBLIC' && E.toasts.includes('일정을 추가하고 친구 2명에게 알렸어요'), '  같은 요청에 tagFriends(알림까지) — 화면이 켠 공개 그대로 PUBLIC · 토스트 «친구 2명에게 알렸어요»');
  chk(pub.checked === false && pub.disabled === false && hint.textContent === '', '  쓰고 나면 태그가 비워지며 공개 체크는 태그 전 값으로 돌아오고 잠금이 풀린다');
  E.routes['POST /v1/me/schedules'] = apiErr(403, 'SCHEDULE_TAG_NOT_FRIEND');
  E.el('mhSchedTagBtn').fire('click'); pickAll(E, E.el('mhSchedTagList')); E.el('mhSchedTagOk').fire('click');
  E.el('mhSchedInput').value = '실패할 일정'; const errs0 = E.errs.length, toasts0 = E.toasts.length; E.el('mhSchedAddBtn').fire('click'); await tick();
  chk(E.errs.length === errs0 && E.toasts.slice(toasts0).filter(m => m === '친구가 아닌 사람은 태그할 수 없어요').length === 1 && E.el('mhSchedInput').value === '실패할 일정' && !day.textContent.includes('실패할 일정'),
      '친구가 아닌 사람을 태그 → 오류 번호 0 · 안내 토스트 1 · 일정은 만들어지지 않는다 · 입력칸은 그대로(다시 누르면 됨)');
  E.routes['POST /v1/me/schedules'] = apiErr(403, 'SCHEDULE_TAG_SELF');
  const toasts1 = E.toasts.length; E.el('mhSchedAddBtn').fire('click'); await tick();
  chk(E.errs.includes('E-MH-06') && !E.toasts.slice(toasts1).includes('친구가 아닌 사람은 태그할 수 없어요'), '자기 자신을 태그 → 그대로 E-MH-06 (친구 아님 안내 토스트는 안 뜬다)');
  const slow = deferred();
  E.routes['POST /v1/me/schedules'] = () => slow.p;
  const before = E.calls('POST', /./).length;
  E.el('mhSchedInput').value = '두 번 누름';
  E.el('mhSchedAddBtn').fire('click'); E.el('mhSchedAddBtn').fire('click'); await tick();
  chk(E.calls('POST', /./).length === before + 1, '보내는 중에 또 눌러도 요청은 하나');
  slow.res(item('n10', YM + '-' + DD, '두 번 누름', 'PRIVATE', 1)); await tick();
  E.routes['DELETE /v1/me/schedules/:id'] = null;
  day.children.find(r => r.textContent.includes('복구')).children.find(c => c.className === 'x').onclick(); await tick();
  const dl = E.calls('DELETE', /schedules\/b/)[0];
  chk(dl && dl.path === '/v1/me/schedules/b?version=1' && !day.textContent.includes('복구'), '× → DELETE /v1/me/schedules/{id}?version= 후 목록에서 뺀다');
  E.routes['DELETE /v1/me/schedules/:id'] = apiErr(409, 'CONCURRENT_UPDATE');
  const g0 = E.calls('GET', /schedules\?month/).length;
  day.children.find(r => r.textContent.includes('치과')).children.find(c => c.className === 'x').onclick(); await tick();
  chk(E.errs.includes('E-NET-05') && E.calls('GET', /schedules\?month/).length === g0 + 1, '지울 때 409 → 지우지 않고 알린 뒤 달을 다시 받는다');
  /* 늦게 온 앞 달 답 */
  const dA = deferred();
  E.routes['GET /v1/me/schedules'] = (b, p) => (monthOfPath(p) === YM ? dA.p : [item('z', nextYM + '-05', '다음 달 일정', 'PRIVATE', 1)]);
  E.el('mhSchedToday').fire('click');          // 이번 달 — 느린 답
  E.el('mhSchedNext').fire('click');           // 다음 달 — 빠른 답
  await tick();
  dA.res([item('late', YM + '-05', '늦게 온 앞 달', 'PRIVATE', 1)]); await tick();
  chk(E.el('mhSchedTitle').textContent.includes(Number(nextYM.slice(5)) + '월'), '달을 옮겼다 — 제목은 다음 달');
  dayCells(E)[4].click(); await tick();
  chk(E.el('mhSchedDayList').textContent.includes('다음 달 일정') && !E.el('mhSchedDayList').textContent.includes('늦게 온'), '  늦게 온 앞 달 답은 버린다 — 다음 달 5일에는 다음 달 일정만');
  const k0 = E.calls('GET', /schedules\?month=/).length;
  E.routes['GET /v1/me/schedules'] = () => [item('z', nextYM + '-05', '다른 기기에서 고침', 'PRIVATE', 2)];
  E.rt.schedule[0]({ kind: 'schedule' }); await tick();
  chk(E.calls('GET', /schedules\?month=/).length >= k0 + 1 && E.el('mhSchedDayList').textContent.includes('다른 기기에서 고침'), '서버 알림(schedule) → 보는 달을 조용히 다시 받아 그린다');
});

await sec('── 5. 기념일 · D-day', async () => {
  const d = deferred();
  let hold = true;
  const E = mkEnv({ routes: { 'GET /v1/me/ddays': () => (hold ? d.p : BOARD()) } });
  E.S.renderSchedCalendar();
  const grid = E.el('mhDdayGrid'), banners = E.el('mhDdayBanners');
  E.S.renderDdays();
  chk(grid.textContent.includes('불러오는 중이에요') && banners.textContent.includes('불러오는 중이에요') && !grid.children.some(c => c.classList.contains('add')), '받는 중 — 기념일 · 배너 자리에 «불러오는 중이에요» · [+] 카드는 안 보인다(잠금)');
  dayCells(E)[3].fire('contextmenu'); await tick();
  chk(E.el('mhDdayEdit').style.display !== 'block' && E.toasts.some(m => m.includes('불러오는 중')), '  받기 전에는 편집창이 안 열린다(우클릭 → D-day 추가 막힘)');
  hold = false; d.res(BOARD()); await tick(30);
  chk(gridCards(E).length === 2 && banners.children.length === 1 && grid.children[grid.children.length - 1].classList.contains('add'), '받으면 기념일 카드 2 + [+] 카드 · ⏳ 배너 1');
  chk(gridCards(E)[0].textContent.includes('만난 날') && gridCards(E)[0].textContent.includes('11일') && gridCards(E)[1].textContent.includes('20일'), '  서버 순서대로 · 셈법 반영(10일 전 «그날이 1일» = 11일 · 끄면 20일)');
  const Z = mkEnv(); Z.S.renderSchedCalendar(); await tick(20);
  chk(gridCards(Z).length === 0 && Z.el('mhDdayGrid').children.some(c => c.classList.contains('add')) && Z.el('mhDdayBanners').textContent.includes('날짜를 우클릭'), '빈 보드는 [+] 카드와 안내 — «못 불러옴» 이 아니다');
  const Fl = mkEnv({ routes: { 'GET /v1/me/ddays': apiErr(503, 'X') } });
  Fl.S.renderSchedCalendar(); await tick(20);
  chk(Fl.el('mhDdayGrid').textContent.includes('불러오지 못했어요') && Fl.el('mhDdayBanners').textContent.includes('불러오지 못했어요') && Fl.errs.includes('E-MH-04'), '못 받음 — 두 자리 모두 «불러오지 못했어요 — 눌러서 다시 시도» · E-MH-04');
  chk(Fl.errs.filter(c => c === 'E-MH-04').length === 1, '  이어지는 실패는 오류 번호를 한 번만');
  const nGet = Fl.calls('GET', /ddays/).length;
  Fl.routes['GET /v1/me/ddays'] = BOARD();
  Fl.el('mhDdayBanners').children[0].onclick(); await tick(20);
  chk(Fl.calls('GET', /ddays/).length === nGet + 1 && gridCards(Fl).length === 2, '  눌러서 다시 받으면 보인다');
  const Fl2 = mkEnv({ routes: { 'GET /v1/me/ddays': apiErr(503, 'X') } });
  Fl2.S.renderSchedCalendar(); await tick(20);
  Fl2.routes['GET /v1/me/ddays'] = BOARD();
  Fl2.S.renderSchedCalendar(); await tick(20);
  chk(gridCards(Fl2).length === 2, '  탭을 다시 열어도 못 받았던 것을 다시 받는다');

  /* 새 기념일 저장(통째) */
  const P = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
  P.S.renderSchedCalendar(); await tick(20);
  P.routes['PUT /v1/me/ddays'] = (b) => BOARD({ version: 6, cards: b.cards.map((c) => card(c.ddayId || U4, c.text, c.date, { visibility: c.visibility, notify: c.notify, countFromOne: c.countFromOne, bgColor: c.bgColor || null, bgImage: c.bgImage || null })), banners: BOARD().banners });
  P.el('mhDdayGrid').children.find(c => c.classList.contains('add')).onclick();
  chk(P.el('mhDdayEdit').style.display === 'block' && P.el('mhDdayEditTitle').textContent === '📌 기념일 추가' && P.el('mhDdayBase1').checked === true, '[+] → «📌 기념일 추가» · «그날이 1일» 은 켜진 채로 연다');
  P.el('mhDdayText').value = '100일'; P.el('mhDdayY').value = '2027'; P.el('mhDdayM').value = '03'; P.el('mhDdayD').value = '04';
  P.el('mhDdayNotify').checked = true; P.el('mhDdayColor').value = '#ff0000';
  P.el('mhDdaySaveBtn').fire('click'); await tick(30);
  const put = P.calls('PUT', /ddays/)[0];
  chk(put && put.body.version === 5 && put.body.cards.length === 3 && put.opts.expectOwner === 'tokenA', '저장 — 보드 통째 PUT /v1/me/ddays (읽은 판 5 · 카드 3) · expectOwner');
  const nc = put.body.cards[2];
  chk(!('ddayId' in nc) && nc.text === '100일' && nc.date === '2027-03-04' && nc.notify === true && nc.countFromOne === true && nc.bgColor === '#ff0000' && nc.visibility === 'PRIVATE', '  새 장 — ddayId 없음 · 글 · 날짜 · 알림 · 셈법 · 배경색 · 비공개');
  chk(P.el('mhDdayEdit').style.display === 'none' && P.toasts.includes('기념일을 추가했어요'), '  끝나면 편집창이 닫히고 토스트');
  chk(gridCards(P).length === 3, '  화면은 서버가 돌려준 보드로 바뀐다');
  gridCards(P)[1].fire('contextmenu');
  chk(P.el('mhDdayEditTitle').textContent === '📌 기념일 수정' && P.el('mhDdayText').value === '졸업' && P.el('mhDdayBase1').checked === false, '카드 우클릭 → 수정창이 서버 값으로 열린다(셈법 꺼진 채)');
  P.el('mhDdayText').value = '졸업식';
  P.el('mhDdaySaveBtn').fire('click'); await tick(30);
  const put2 = P.calls('PUT', /ddays/)[1];
  chk(put2.body.version === 6 && put2.body.cards[1].ddayId === U2 && put2.body.cards[1].text === '졸업식' && put2.body.cards[1].countFromOne === false, '수정 — 같은 id · 같은 자리 · 새 판(6)');
  P.routes['PUT /v1/me/ddays'] = (b) => BOARD({ version: 7, cards: BOARD().cards.filter(c => b.cards.some(x => x.ddayId === c.ddayId)), banners: BOARD().banners.filter(c => b.banners.some(x => x.ddayId === c.ddayId)) });
  P.el('mhDdayBanners').children[0].children.find(c => c.className === 'db-x').onclick({ stopPropagation(){} }); await tick(30);
  const put3 = P.calls('PUT', /ddays/)[2];
  chk(put3.body.banners.length === 0 && P.toasts.includes('D-day를 삭제했어요') && P.el('mhDdayBanners').textContent.includes('날짜를 우클릭'), '배너 × → 그 장을 뺀 보드를 저장 · 토스트 · 화면에서 빠짐');

  /* 409 — 덮어쓰지 않고 다시 받는다 */
  const C = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
  C.S.renderSchedCalendar(); await tick(20);
  C.routes['PUT /v1/me/ddays'] = apiErr(409, 'CONCURRENT_UPDATE');
  C.routes['GET /v1/me/ddays'] = BOARD({ version: 8, cards: [card(U1, '다른 기기에서 바뀜', daysAgo(1))], banners: [] });
  gridCards(C)[0].fire('contextmenu');
  C.el('mhDdayText').value = '내가 고친 이름';
  C.el('mhDdaySaveBtn').fire('click'); await tick(30);
  chk(C.errs.includes('E-NET-05') && C.calls('PUT', /ddays/).length === 1, '저장이 409 → 알리고(E-NET-05) 다시 보내지 않는다(남의 고침을 덮지 않는다)');
  chk(gridCards(C).length === 1 && gridCards(C)[0].textContent.includes('다른 기기에서 바뀜'), '  서버 값을 다시 받아 그 값으로 그린다');
  gridCards(C)[0].fire('contextmenu');
  C.el('mhDdaySaveBtn').fire('click'); await tick(30);
  chk(C.calls('PUT', /ddays/)[1] && C.calls('PUT', /ddays/)[1].body.version === 8, '  다시 받은 뒤의 저장은 새 판(8)으로');

  /* 이미 지운 것을 고치려 함 */
  const G = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
  G.S.renderSchedCalendar(); await tick(20);
  gridCards(G)[0].fire('contextmenu');
  G.routes['GET /v1/me/ddays'] = BOARD({ cards: [], banners: [] });
  G.rt.schedule[0]({ kind: 'schedule' }); await tick(30);
  G.el('mhDdaySaveBtn').fire('click'); await tick(30);
  chk(G.calls('PUT', /ddays/).length === 0 && G.el('mhDdayEditMsg').textContent.includes('이미 지워진'), '다른 기기에서 이미 지운 기념일을 고치려 하면 보내지 않는다 — 안내');

  /* 태그 · 상한 */
  const T = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
  T.S.renderSchedCalendar(); await tick(20);
  T.routes['PUT /v1/me/ddays'] = () => BOARD({ version: 6 });
  T.g.friends = { f1: { name: 'A' } };
  dayCells(T)[4].fire('contextmenu');
  T.el('mhDdayText').value = '친구와'; T.el('mhDdayTagBtn').fire('click');
  pickAll(T, T.el('mhSchedTagList'));
  T.el('mhSchedTagOk').fire('click');
  T.el('mhDdaySaveBtn').fire('click'); await tick(30);
  const tp = T.calls('PUT', /ddays/)[0];
  chk(tp.body.tagFriends && tp.body.tagFriends.kind === 'BANNER' && tp.body.tagFriends.index === 1 && eq(tp.body.tagFriends.userCodes, ['f1']) && T.toasts.includes('D-day를 저장하고 친구 1명에게 알렸어요'), '친구 태그 — 같은 PUT 에 tagFriends(저장한 배너가 두 번째) · 토스트');
  chk(T.el('mhDdayPublic').checked === true && T.el('mhDdayPublic').disabled === true && T.el('mhDdayPublicHint').textContent === '태그한 친구가 볼 수 있게 공개돼요' && tp.body.banners[1].visibility === 'PUBLIC', '  태그하면 «공개» 를 켜고 잠그고 까닭을 보인다 — 보내는 값도 PUBLIC');
  T.routes['PUT /v1/me/ddays'] = apiErr(409, 'SCHEDULE_DDAY_FULL');
  dayCells(T)[4].fire('contextmenu');
  chk(T.el('mhDdayPublic').disabled === false && T.el('mhDdayPublic').checked === false && T.el('mhDdayPublicHint').textContent === '', '  편집창을 새로 열면 앞의 태그 잠금이 풀려 있다');
  T.el('mhDdayText').value = '또'; T.el('mhDdaySaveBtn').fire('click'); await tick(30);
  chk(T.errs.includes('E-MH-07') && !T.errs.includes('E-NET-05'), '서버가 상한(SCHEDULE_DDAY_FULL)을 거절 → E-MH-07 (409 다시 받기와 다른 길)');

  /* 저장 줄 세우기 */
  const S1 = deferred();
  const Q = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
  Q.S.renderSchedCalendar(); await tick(20);
  let n = 0;
  Q.routes['PUT /v1/me/ddays'] = () => { n++; return n === 1 ? S1.p : BOARD({ version: 7 }); };
  gridCards(Q)[0].fire('contextmenu'); Q.el('mhDdayText').value = '첫째'; Q.el('mhDdaySaveBtn').fire('click'); await tick();
  Q.el('mhDdayBanners').children[0].children.find(c => c.className === 'db-x').onclick({ stopPropagation(){} }); await tick();
  chk(Q.calls('PUT', /ddays/).length === 1, '저장을 보내는 동안 또 고쳐도 둘째는 기다린다 — 요청은 하나씩');
  S1.res(BOARD({ version: 6, cards: [card(U1, '첫째', daysAgo(10)), card(U2, '졸업', daysAgo(20))], banners: BOARD().banners })); await tick(30);
  const q2 = Q.calls('PUT', /ddays/)[1];
  chk(q2 && q2.body.version === 6 && q2.body.cards[0].text === '첫째' && q2.body.banners.length === 0, '  끝나면 최신 값(첫째 저장의 결과 · 새 판 6)에서 이어 보낸다');

  /* 순서 바꾸기 */
  const R = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
  R.S.renderSchedCalendar(); await tick(20);
  R.routes['PUT /v1/me/ddays'] = () => BOARD({ version: 6, cards: [card(U2, '졸업', daysAgo(20)), card(U1, '만난 날', daysAgo(10))], banners: BOARD().banners });
  const cs = gridCards(R);
  cs[1].fire('dragstart', { dataTransfer: { setData(){} } });
  cs[0].fire('dragover'); cs[0].fire('drop'); await tick(30);
  const rp = R.calls('PUT', /ddays/)[0];
  chk(rp && eq(rp.body.cards.map(c => c.ddayId), [U2, U1]), '끌어 순서 바꾸기 → 바뀐 순서로 통째 저장(목록 순서가 곧 순서)');
  chk(gridCards(R)[0].textContent.includes('졸업'), '  화면도 그 순서');
  R.routes['PUT /v1/me/ddays'] = apiErr(503, 'X');
  const g0 = R.calls('GET', /ddays/).length;
  const cs2 = gridCards(R);
  cs2[0].fire('dragstart', { dataTransfer: { setData(){} } }); cs2[1].fire('dragover'); cs2[1].fire('drop'); await tick(30);
  chk(R.calls('GET', /ddays/).length === g0 + 1 && R.errs.length > 0, '순서 저장이 실패하면 먼저 그린 순서를 서버 것으로 되돌린다 · 알림');

  { /* 저장도 다시 받기도 못 하면 받아 둔 사본으로 되돌린다 */
    const R2 = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
    R2.S.renderSchedCalendar(); await tick(20);
    R2.routes['PUT /v1/me/ddays'] = apiErr(503, 'X');
    R2.routes['GET /v1/me/ddays'] = apiErr(503, 'X');
    const c2 = gridCards(R2);
    c2[1].fire('dragstart', { dataTransfer: { setData(){} } }); c2[0].fire('dragover'); c2[0].fire('drop'); await tick(30);
    chk(gridCards(R2)[0].textContent.includes('만난 날') && gridCards(R2)[1].textContent.includes('졸업'), '순서 저장도 다시 받기도 못 하면 먼저 바꾼 순서를 받아 둔 사본(원래 순서)으로 되돌린다');
  }
  { /* 편집창이 열린 채 받기 상태가 아니면 말없이 끝나지 않는다 */
    const K = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
    K.S.renderSchedCalendar(); await tick(20);
    gridCards(K)[0].fire('contextmenu');
    K.routes['GET /v1/me/ddays'] = () => new Promise(() => {});
    K.S.reset(); K.S.loadBoard();
    K.el('mhDdaySaveBtn').fire('click'); await tick(20);
    chk(K.el('mhDdayEditMsg').textContent.includes('불러오는 중이에요') && K.calls('PUT', /./).length === 0, '편집창이 열린 채 reset 돼 다시 받는 중이면 «불러오는 중이에요» 를 편집창에 보이고 보내지 않는다');
    for(const [label, getRoute, want] of [['받는 중', () => new Promise(() => {}), '불러오는 중이에요']]){
      const K3 = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
      K3.S.renderSchedCalendar(); await tick(20);
      const hold = deferred();
      K3.routes['PUT /v1/me/ddays'] = () => hold.p;
      gridCards(K3)[0].fire('contextmenu');
      K3.el('mhDdaySaveBtn').fire('click'); await tick();
      K3.routes['GET /v1/me/ddays'] = getRoute;
      K3.S.reset(); K3.S.loadBoard(); await tick(20);
      hold.res(BOARD({ version: 6 })); await tick(30);
      chk(K3.el('mhDdayEditMsg').textContent.includes(want), '  보내는 중에 reset 돼 보낸 저장이 버려지면 «' + want + '» 를 보인다(' + label + ')');
    }
    const K2 = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
    K2.S.renderSchedCalendar(); await tick(20);
    gridCards(K2)[0].fire('contextmenu');
    K2.routes['GET /v1/me/ddays'] = apiErr(503, 'X');
    K2.S.reset(); K2.S.loadBoard(); await tick(20);
    K2.el('mhDdaySaveBtn').fire('click'); await tick(20);
    chk(K2.el('mhDdayEditMsg').textContent.includes('불러오지 못했어요') && K2.calls('PUT', /./).length === 0, '  못 받은 상태면 «불러오지 못했어요» 를 보인다');
  }

  /* 못 받은 보드 */
  const Lk = mkEnv({ routes: { 'GET /v1/me/ddays': apiErr(503, 'X') } });
  Lk.S.renderSchedCalendar(); await tick(20);
  dayCells(Lk)[3].fire('contextmenu');
  chk(Lk.calls('PUT', /./).length === 0 && gridCards(Lk).length === 0 && Lk.el('mhDdayEdit').style.display !== 'block', '못 받은 보드는 카드도 없고 편집창도 안 열린다(요청 0)');

  /* 계정 바뀜 */
  const O = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': BOARD() } });
  O.S.renderSchedCalendar(); await tick(20);
  O.st.who = 'tokenB';
  gridCards(O)[0].fire('contextmenu'); O.el('mhDdayText').value = '남의 토큰'; O.el('mhDdaySaveBtn').fire('click'); await tick(30);
  chk(O.calls('PUT', /ddays/).length === 0 && O.errs.length === 0, '읽은 뒤 로그인한 사람이 바뀌면 보내지 않고 조용히 — 오류 번호도 없다');

  /* 서버 알림 */
  const W = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
  W.S.renderSchedCalendar(); await tick(20);
  const dq = deferred();
  W.routes['GET /v1/me/ddays'] = () => dq.p;
  W.rt.schedule[0]({ kind: 'schedule' }); await tick();
  chk(gridCards(W).length === 2 && !W.el('mhDdayGrid').textContent.includes('불러오는 중'), '서버 알림(schedule) → 조용히 다시 받는 동안 화면을 비우지 않는다');
  dq.res(BOARD({ version: 9, cards: [card(U1, '다른 기기', daysAgo(5))], banners: [] })); await tick(30);
  chk(gridCards(W).length === 1 && gridCards(W)[0].textContent.includes('다른 기기'), '  받으면 바뀐다');
  W.routes['GET /v1/me/ddays'] = apiErr(503, 'X');
  W.rt.schedule[0]({ kind: 'schedule', resync: true }); await tick(30);
  chk(gridCards(W).length === 1 && W.errs.length === 0, '  조용히 다시 받다 못 받으면 있던 값을 두고 알리지 않는다');
});

await sec('── 6. 👀 관람', async () => {
  const E = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD(),
    'GET /v1/schedules/f1': [item('p', YM + '-' + DD, '공개 일정', 'PUBLIC', 1)],
    'GET /v1/ddays/f1': { cards: [card(U4, '친구 기념', daysAgo(3), { visibility: 'PUBLIC' })], banners: [] } } });
  E.S.renderSchedCalendar(); await tick(20);
  E.g.viewing = 'f1';
  E.S.startVisit('f1'); await tick(30);
  chk(E.calls('GET', /^\/v1\/schedules\/f1\?month=/).length === 1 && E.calls('GET', /^\/v1\/ddays\/f1$/).length === 1, '구경 시작 — 친구의 달력(GET /v1/schedules/{코드}) · 보드(GET /v1/ddays/{코드})를 받는다');
  const grid = E.el('mhDdayGrid');
  chk(grid.children.length === 1 && grid.children[0].textContent.includes('친구 기념') && E.el('mhSchedDayList').textContent.includes('공개 일정'), '  친구 기념일만 · [+] 카드 없음 · 친구의 공개 일정');
  E.el('mhDdayEdit').style.display = 'none';
  grid.children[0].fire('contextmenu');
  chk(E.el('mhDdayEdit').style.display === 'none' && E.calls('PUT', /./).length === 0, '  우클릭해도 편집창이 안 열린다 · 쓰기 요청 0');
  E.g.viewing = null; E.S.endVisit(); await tick(30);
  chk(grid.children.length === 3 && grid.children[0].textContent.includes('만난 날'), '구경 끝 — 내 기념일로 돌아온다');
  chk(E.calls('GET', /^\/v1\/me\/ddays$/).length === 1, '  내 보드는 다시 받지 않는다');
  grid.children[0].fire('contextmenu');
  chk(E.el('mhDdayEdit').style.display === 'block' && E.el('mhDdayEditTitle').textContent === '📌 기념일 수정', '  내 것은 우클릭 → «📌 기념일 수정»');
  const dl = deferred();
  E.routes['GET /v1/ddays/f1'] = () => dl.p;
  E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick();
  chk(grid.textContent.includes('불러오는 중이에요'), '친구 보드를 받는 중 — «불러오는 중이에요»');
  E.g.viewing = null; E.S.endVisit(); await tick();
  dl.res({ cards: [card(U4, '늦게 온 친구', daysAgo(3), { visibility: 'PUBLIC' })], banners: [] }); await tick(30);
  chk(!grid.textContent.includes('늦게 온 친구') && gridCards(E).length === 2, '구경을 끝낸 뒤 늦게 온 친구 답은 버린다');
  E.routes['GET /v1/ddays/f1'] = apiErr(404, 'USER_NOT_FOUND');
  E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick(30);
  chk(grid.textContent.includes('불러오지 못했어요') && E.errs.includes('E-MH-04'), '친구 것을 못 받으면 «불러오지 못했어요» · E-MH-04 (빈 보드가 아니다)');
});

await sec('── 6-2. 👀 구경 중 친구 일정 알림 — friendSchedule', async () => {
  const mk = (src) => mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD(),
    'GET /v1/schedules/f1': [item('p', YM + '-' + DD, '공개 일정', 'PUBLIC', 1)],
    'GET /v1/ddays/f1': { cards: [card(U4, '친구 기념', daysAgo(3), { visibility: 'PUBLIC' })], banners: [] } } });
  const sig = (E, subject) => (E.rt.friendSchedule || []).forEach(fn => fn({ kind: 'friendSchedule', subject, section: null, resync: false }));
  const cnt = (E, f) => E.calls('GET', new RegExp('^/v1/(schedules|ddays)/' + f + '(\\?|$)')).length;
  const E = mk();
  E.S.renderSchedCalendar(); await tick(20);
  chk((E.rt.friendSchedule || []).length === 1, '알림 종류 friendSchedule 을 한 번 건다');
  sig(E, 'f1'); await tick(20);
  chk(cnt(E, 'f1') === 0, '구경 중이 아니면 요청 0');
  E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick(30);
  const base = cnt(E, 'f1');
  sig(E, 'f2'); await tick(20);
  chk(cnt(E, 'f1') === base && cnt(E, 'f2') === 0, '다른 친구 알림은 요청 0');
  E.routes['GET /v1/ddays/f1'] = { cards: [card(U4, '바뀐 친구 기념', daysAgo(3), { visibility: 'PUBLIC' })], banners: [] };
  E.routes['GET /v1/schedules/f1'] = [item('p2', YM + '-' + DD, '새 공개 일정', 'PUBLIC', 2)];
  sig(E, 'f1'); await tick(30);
  chk(cnt(E, 'f1') === base + 2, '같은 친구 알림 — 보는 달 · 보드를 한 번씩 다시 받는다(GET 2)');
  chk(E.el('mhDdayGrid').textContent.includes('바뀐 친구 기념') && E.el('mhSchedDayList').textContent.includes('새 공개 일정'), '  화면이 새 값으로');
  chk(E.errs.length === 0, '  오류 번호 0');
  /* 오래 끊겼다 붙음(resync) — 친구 없이 오는 신호. 지금 구경 중인 친구를 한 번 다시 받는다 */
  const rsig = (E2) => (E2.rt.friendSchedule || []).forEach(fn => fn({ kind: 'friendSchedule', subject: null, section: null, resync: true }));
  const b1 = cnt(E, 'f1');
  rsig(E); await tick(30);
  chk(cnt(E, 'f1') === b1 + 2 && E.errs.length === 0, '오래 끊겼다 붙으면(resync) 구경 중인 친구의 달력 · 보드를 한 번씩 다시 받는다(GET 2 · 오류 번호 0)');
  {
    const Q = mk(); Q.S.renderSchedCalendar(); await tick(20);
    const q0 = Q.authed.log.length;
    rsig(Q); await tick(20);
    chk(Q.authed.log.length === q0, '  구경 중이 아니면 resync 에도 요청 0');
  }
  /* 겹친 신호 — 받는 중 여러 번 와도 끝난 뒤 한 바퀴만 더 */
  const dl = deferred(); let n = 0;
  E.routes['GET /v1/ddays/f1'] = () => { n++; return n === 1 ? dl.p : { cards: [], banners: [] }; };
  const b0 = E.calls('GET', /^\/v1\/ddays\/f1$/).length;
  sig(E, 'f1'); sig(E, 'f1'); sig(E, 'f1'); await tick(20);
  chk(E.calls('GET', /^\/v1\/ddays\/f1$/).length === b0 + 1, '받는 중 겹친 신호는 새 요청을 만들지 않는다');
  dl.res({ cards: [], banners: [] }); await tick(40);
  chk(E.calls('GET', /^\/v1\/ddays\/f1$/).length === b0 + 2, '  끝난 뒤 한 번만 더(세 신호 → 두 바퀴)');
  /* 실패 — 번호 없이 지금 화면 유지 */
  E.routes['GET /v1/ddays/f1'] = { cards: [card(U4, '남을 기념', daysAgo(3), { visibility: 'PUBLIC' })], banners: [] };
  E.g.viewing = null; E.S.endVisit(); await tick(20);
  E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick(30);
  E.routes['GET /v1/ddays/f1'] = apiErr(503, 'X'); E.routes['GET /v1/schedules/f1'] = apiErr(503, 'X');
  sig(E, 'f1'); await tick(30);
  chk(E.errs.length === 0 && E.el('mhDdayGrid').textContent.includes('남을 기념') && E.el('mhSchedDayList').textContent.includes('새 공개 일정'), '다시 받기가 실패하면 오류 번호 0 · 지금 화면 그대로');
  /* 늦은 응답 — 구경을 끝낸 뒤 */
  const dl2 = deferred();
  E.routes['GET /v1/ddays/f1'] = () => dl2.p; E.routes['GET /v1/schedules/f1'] = [];
  E.routes['GET /v1/schedules/f2'] = []; E.routes['GET /v1/ddays/f2'] = { cards: [card(U4, 'f2 기념', daysAgo(3), { visibility: 'PUBLIC' })], banners: [] };
  sig(E, 'f1'); await tick(10);
  E.g.viewing = 'f2'; E.S.startVisit('f2'); await tick(30);
  dl2.res({ cards: [card(U4, '늦게 온 갱신', daysAgo(3), { visibility: 'PUBLIC' })], banners: [] }); await tick(30);
  chk(!E.el('mhDdayGrid').textContent.includes('늦게 온 갱신') && E.el('mhDdayGrid').textContent.includes('f2 기념'), '다른 친구로 옮긴 뒤 늦게 온 갱신 답은 버린다');
  E.g.viewing = 'f1'; E.routes['GET /v1/ddays/f1'] = () => dl2.p; E.S.startVisit('f1'); await tick(10);
  sig(E, 'f2'); await tick(10);
  chk(cnt(E, 'f2') === 2, '  옮긴 뒤엔 새 친구(f2) 알림만 받는다(옛 친구 신호는 요청 0)');
  E.g.viewing = null; E.S.endVisit(); await tick(20);
  /* 계정 바뀜(reset) 뒤에도 요청 0 */
  E.g.viewing = 'f1'; E.routes['GET /v1/ddays/f1'] = { cards: [], banners: [] }; E.S.startVisit('f1'); await tick(30);
  E.S.reset(); const c1 = cnt(E, 'f1'); sig(E, 'f1'); await tick(20);
  chk(cnt(E, 'f1') === c1, 'reset 뒤 알림은 요청 0');
});

await sec('── 7. reset — 계정을 놓을 때', async () => {
  const dOld = deferred();
  const E = mkEnv({ routes: { 'GET /v1/me/ddays': BOARD() } });
  E.S.renderSchedCalendar(); await tick(20);
  E.routes['GET /v1/me/ddays'] = () => dOld.p;
  E.S.loadBoard(); await tick();
  E.S.reset();
  chk(gridCards(E).length === 0 && E.el('mhDdayGrid').textContent.includes('불러오는 중'), 'reset — 앞 계정 기념일을 비우고 받기 전으로');
  dOld.res(BOARD({ cards: [card(U1, '앞 계정 것', daysAgo(1))], banners: [] })); await tick(30);
  chk(!E.el('mhDdayGrid').textContent.includes('앞 계정 것') && gridCards(E).length === 0, '  늦게 온 앞 계정 답은 버린다');
  E.routes['GET /v1/me/ddays'] = BOARD({ cards: [card(U4, '새 계정', daysAgo(1))], banners: [] });
  const n0 = E.calls('GET', /./).length;
  E.S.loadMine(); await tick(30);
  chk(E.calls('GET', /./).length > n0 && gridCards(E).length === 1 && gridCards(E)[0].textContent.includes('새 계정'), 'loadMine — 새 계정 것을 서버에서 받아 앉힌다(보드 · 오늘 일정 · 태그 알림)');
  await staleBell(MOD, true);
  const M = mkEnv({ routes: { 'GET /v1/me/schedules': [item('a', YM + '-' + DD, '앞 계정 일정', 'PRIVATE', 1)] } });
  M.S.renderSchedCalendar(); await tick(20);
  M.S.reset();
  chk(!M.el('mhSchedDayList').textContent.includes('앞 계정 일정') && M.el('mhSchedGrid').children.length === 0, '달력도 비운다 — 탭을 다시 열면 이번 달부터 새로 받는다');
});

await sec('── 8. app.js 배선 · html', async () => {
  const NAMES = ['renderSchedCalendar', 'renderSchedGrid', 'renderSchedDay', 'renderDdays', 'renderAnnivCards', 'renderDdayBanners',
    '_ddayOpenEdit', '_ddayCloseEdit', 'loadMonth', 'refreshBellBadge', 'renderBellList', '_bellWinOpen', '_bellLoadToday', '_bellLoadNotices',
    '_ddayMilestoneDays', '_ddayBase1', '_ddayCountLabel', '_daysBetween', '_todayYMD', '_boardSave', '_boardLoad'];
  const left = NAMES.filter(n => new RegExp('function ' + n + '\\(').test(APP));
  chk(left.length === 0, '정의는 모듈에만 — app.js 에 같은 이름의 함수가 없다' + (left.length ? ' (남음: ' + left.join(' ') + ')' : ''));
  chk(NAMES.every(n => new RegExp('function ' + n + '\\(').test(MOD)), '  모듈에 다 있다');
  chk(!/═+ 📅 스케줄러|═+ 🔔 일정 알림/.test(APP) && /═+ 📅 스케줄러/.test(MOD) && /═+ 🔔 일정 알림/.test(MOD), '구역 머리 둘이 모듈로 옮겨 갔다');
  const iC = APP.indexOf('MhScheduler.createScheduler('), iV = APP.indexOf('let _mhViewingUserId'), iB = APP.indexOf('TwFriendManage.createFriendManage(');
  chk(iC > 0 && iC < iB && iC < iV, 'createScheduler 는 원래 자리(👥 친구 관리 연결 바로 앞)에서 부른다');
  chk(/^const mhScheduler = MhScheduler\.createScheduler\(\{/m.test(APP) && !/\bSCHEDULER_OFF\b/.test(APP), '  빈 껍데기 없이 만든다');
  chk(/viewingUserId: \(\)=>(?:mhStateMod\.)?_mhViewingUserId/.test(APP) && /myHomeFriends: \(\)=>_myHomeFriends/.test(APP), '  다시 대입되는 값은 읽는 함수로 넘긴다');
  const mk = (APP.match(/const mhScheduler = MhScheduler\.createScheduler\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  chk(/scheduleApi: scheduleApiMod/.test(mk) && /apiErrors: TwApiErrors\.store/.test(mk) && /rtOn: \(kind, fn\)=>TwRtHub\.store\.on\(kind, fn\)/.test(mk) && /notifyError: /.test(mk), '  provider · 오류 번역 · 서버 알림 길 · 오류 번호 알림을 deps 로 받는다');
  chk(/TwScheduleApi\.createScheduleApi\(\{[^}]*authed: TwApi\.authed/.test(APP) && !/uploadDdayImage|uploadImage/.test(APP), 'provider 는 로그인 통로(TwApi.authed)로 — 카드 그림 올리기도 같은 길(app.js 가 올리기 함수를 따로 넘기지 않는다)');
  chk(!/firebaseAPI/.test(strip(MOD)), '모듈은 firebaseAPI 를 직접 부르지 않는다');
  chk(/const BELL_SEEN_KEY = 'tw\.bellSeenTs';/.test(APP) && /bellSeenKey: BELL_SEEN_KEY/.test(APP) && !/'tw\.bellSeenTs';/.test(MOD.replace(/\/\/.*$/gm, '')),
      'BELL_SEEN_KEY 는 app.js 한 곳(계정 전환 지움 목록이 같이 쓴다) — 모듈은 deps 로 받는다');
  chk(/const ANNIV_H_KEY = 'tw\.annivAreaH';/.test(MOD) && /const BELL_POS_KEY = 'tw\.bellWinPos';/.test(MOD), 'localStorage 키 그대로 — tw.annivAreaH · tw.bellWinPos');
  const bare = APP.split('\n').filter(l => /(^|[^.\w])(refreshBellBadge|renderBellList|renderDdays|renderSchedCalendar|loadMonth|_bellWinOpen)\((?!\)\{\})/.test(l));
  chk(bare.length === 0, '부르는 곳은 전부 mhScheduler.이름 — 옛 전역 이름 호출이 안 남았다' + (bare.length ? ' (' + bare[0].trim().slice(0, 80) + ')' : ''));
  const INIT = strip(SRC['myhome-init.js']), VISIT = strip(SRC['myhome-visit.js']), ACC = strip(SRC['account.js']);
  chk(/mhScheduler\.loadBoard\(\)/.test(INIT) && !/subscribeDdays/.test(INIT), '로그인 뒤 — 내 보드 받기(loadBoard)');
  chk((VISIT.match(/mhScheduler\.startVisit\(friendId\)/g) || []).length === 1 && (VISIT.match(/mhScheduler\.endVisit\(\)/g) || []).length === 1 && !/subscribeDdays|_schedDdaysVisitUnsub|setDdaysVisit/.test(VISIT), '관람 시작 · 끝 → startVisit · endVisit (구독 끊기 장치 없음)');
  chk((ACC.match(/mhScheduler\.reset\(\)/g) || []).length === 2 && /mhScheduler\.loadMine\(\)/.test(ACC), '계정 — 놓을 때 reset · 이어받기는 reset 뒤 loadMine');
  chk(/if\(tab\.dataset\.tab==='scheduler'\)\{\s*mhScheduler\.renderSchedCalendar\(\); mhScheduler\.renderDdays\(\);/.test(APP), '[스케줄러] 탭 → 달력 · D-day 그리기');
  const a = HTML.indexOf('<script src="parts/myhome/scheduler.js"></script>'), b = HTML.indexOf('<script src="parts/app.js"></script>'), s = HTML.indexOf('<script src="parts/myhome/schedule-api.js"></script>');
  chk(s > 0 && s < a && a > 0 && b > a, 'html — schedule-api.js → scheduler.js → app.js 순서');
  chk(!/window\.Scheduler\s*=/.test(MOD) && !/\b(?:const|let|var)\s+scheduler\b/.test(APP) && !/typeof Scheduler\s*===/.test(APP),
      '내장 전역 이름(Scheduler · scheduler)을 안 쓴다 — window.MhScheduler · mhScheduler');
});

await sec('── 3-2. 🔔 오늘 내 일정 — 만든 시각이 읽음 시각 뒤인 것만', async () => {
  const SEEN = Date.now() - 3600 * 1000;
  const mk = (list) => { const E = mkEnv({ routes: { 'GET /v1/me/schedules': list } }); E.ls.set('tw.bellSeenTs', String(SEEN)); return E; };
  const rows = (...ats) => ats.map((at, i) => item('t' + i, TODAY, '일정' + i, 'PRIVATE', 1, at));
  const badgeOf = async (list) => { const E = mk(list); await tick(); return E.el('myBellBadge').textContent; };
  chk(await badgeOf(rows(SEEN + 1)) === '1', '읽음 시각보다 1ms 뒤에 만든 일정은 센다');
  chk(await badgeOf(rows(SEEN)) === '0', '  읽음 시각과 같은 ms 에 만든 일정은 안 센다(뒤가 아님)');
  chk(await badgeOf(rows(SEEN - 1)) === '0', '  1ms 앞에 만든 일정은 안 센다');
  chk(await badgeOf(rows(SEEN - 5000, SEEN + 5000, SEEN + 9000)) === '2', '  여러 개면 뒤에 만든 것만 센다(2)');
  const noAt = [Object.assign(item('x', TODAY, '시각 없음'), { createdAt: undefined }), Object.assign(item('y', TODAY, '깨진 시각'), { createdAt: 'not-a-date' })];
  chk(await badgeOf(noAt) === '0', '  createdAt 이 없거나 깨진 일정은 오래된 것(0)으로 보아 안 센다');
  chk(await badgeOf([item('o', YM + '-' + (DD === '01' ? '02' : '01'), '다른 날', 'PRIVATE', 1, SEEN + 5000)]) === '0', '  오늘이 아닌 날 일정은 만든 시각이 뒤여도 안 센다');
  const E = mk(rows(SEEN + 1)); await tick();
  E.el('myBellBtn').fire('click');
  chk(E.el('myBellBadge').textContent === '0', '  알림창을 열어 읽음 시각이 갱신되면 그 일정은 더 안 센다');
  E.routes['POST /v1/me/schedules'] = item('n9', TODAY, '방금 만듦', 'PRIVATE', 1, Date.now() + 10);
  E.el('mhSchedInput').value = '방금 만듦'; E.S.renderSchedCalendar(); await tick();
  E.el('mhSchedAddBtn').fire('click'); await tick();
  chk(E.el('myBellBadge').textContent === '1', '  열어 본 뒤 오늘 날짜로 새로 만든 일정은 다시 센다');
});

await sec('── 9. 일부러 깨 보기 (빨강이 나야 한다)', async () => {
  const broken = async (label, patch, scenario) => {
    const src = patch(MOD);
    if(src === MOD){ chk(false, '깨 보기 — ' + label + ' (바뀐 곳이 없다 — 판정 글자를 못 찾음)'); return; }
    quiet = true; qfail = 0;
    try{ await scenario(src); }catch(e){ qfail++; }
    quiet = false;
    chk(qfail > 0, '깨 보기 — ' + label + ' → 빨강');
  };
  await broken('다른 친구 알림도 다시 받는다', (x) => x.replace("if(friendId !== _visitFriend || viewingUserId() !== friendId) return;", ""), async (src) => {
    const E = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD(), 'GET /v1/schedules/f1': [], 'GET /v1/ddays/f1': { cards: [], banners: [] }, 'GET /v1/ddays/f2': { cards: [], banners: [] } } });
    E.S.renderSchedCalendar(); await tick(20); E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick(30);
    E.rt.friendSchedule.forEach(fn => fn({ subject: 'f2' })); await tick(20);
    chk(E.calls('GET', /f2/).length === 0, 'x');
  });
  await broken('resync 에 구경 중인 친구를 안 받는다', (x) => x.replace("const friend = n.resync ? _visitFriend : n.subject;", "const friend = n.subject;"), async (src) => {
    const E = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD(), 'GET /v1/schedules/f1': [], 'GET /v1/ddays/f1': { cards: [], banners: [] } } });
    E.S.renderSchedCalendar(); await tick(20); E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick(30);
    const c0 = E.calls('GET', /f1/).length;
    E.rt.friendSchedule.forEach(fn => fn({ kind: 'friendSchedule', subject: null, resync: true })); await tick(30);
    chk(E.calls('GET', /f1/).length === c0 + 2, 'x');
  });
  await broken('받는 중 겹친 신호를 그대로 또 요청한다', (x) => x.replace("if(_visitRefreshing){ _visitAgain = true; return; }", ""), async (src) => {
    const dl = deferred();
    const E = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD(), 'GET /v1/schedules/f1': [], 'GET /v1/ddays/f1': { cards: [], banners: [] } } });
    E.S.renderSchedCalendar(); await tick(20); E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick(30);
    E.routes['GET /v1/ddays/f1'] = () => dl.p;
    E.rt.friendSchedule.forEach(fn => { fn({ subject: 'f1' }); fn({ subject: 'f1' }); }); await tick(20);
    chk(E.calls('GET', /^\/v1\/ddays\/f1$/).length === 2, 'x');
  });
  await broken('늦은 갱신 답을 버리지 않는다', (x) => x.replace("const dd = await scheduleApi.fetchBoardOf(friendId);\n        if(seq !== _visitSeq || gen !== _gen) return;\n        _schedDdaysVisit = dd; renderDdays();", "const dd = await scheduleApi.fetchBoardOf(friendId);\n        _schedDdaysVisit = dd; renderDdays();"), async (src) => {
    const dl = deferred();
    const E = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD(), 'GET /v1/schedules/f1': [], 'GET /v1/ddays/f1': { cards: [], banners: [] }, 'GET /v1/schedules/f2': [], 'GET /v1/ddays/f2': { cards: [], banners: [] } } });
    E.S.renderSchedCalendar(); await tick(20); E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick(30);
    E.routes['GET /v1/ddays/f1'] = () => dl.p;
    E.rt.friendSchedule.forEach(fn => fn({ subject: 'f1' })); await tick(10);
    E.g.viewing = 'f2'; E.S.startVisit('f2'); await tick(30);
    dl.res({ cards: [card(U4, '늦게 온 갱신', daysAgo(3), { visibility: 'PUBLIC' })], banners: [] }); await tick(30);
    chk(!E.el('mhDdayGrid').textContent.includes('늦게 온 갱신'), 'x');
  });
  await broken('다시 받기 실패에 오류 번호를 띄운다', (x) => x.replace("}catch(_){ if(seq !== _visitSeq || gen !== _gen) return; }", "}catch(e){ if(seq !== _visitSeq || gen !== _gen) return; _loadFail(e); }"), async (src) => {
    const E = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD(), 'GET /v1/schedules/f1': [], 'GET /v1/ddays/f1': { cards: [], banners: [] } } });
    E.S.renderSchedCalendar(); await tick(20); E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick(30);
    E.routes['GET /v1/ddays/f1'] = apiErr(503, 'X');
    E.rt.friendSchedule.forEach(fn => fn({ subject: 'f1' })); await tick(30);
    chk(E.errs.length === 0, 'x');
  });
  await broken('뱃지가 만든 시각 없이 오늘 일정 개수를 센다', (x) => x.replace("_bellTodayItems.filter(it => (it.ts||0) > seen).length", "_bellTodayItems.length"), async (src) => {
    const SEEN = Date.now() - 3600 * 1000;
    const E = mkEnv({ src, routes: { 'GET /v1/me/schedules': [item('a', TODAY, 'a', 'PRIVATE', 1, SEEN - 1)] } });
    E.ls.set('tw.bellSeenTs', String(SEEN)); await tick();
    chk(E.el('myBellBadge').textContent === '0', 'x');
  });
  await broken('친구 아님도 E-MH-06 번호를 띄운다', (x) => x.replace("notice: () => toast(TAG_NOT_FRIEND_TEXT)", "notice: (notifyError, e) => notifyError('E-MH-06', e)"), async (src) => {
    const E = mkEnv({ src, routes: { 'POST /v1/me/schedules': apiErr(403, 'SCHEDULE_TAG_NOT_FRIEND') } });
    await tick(); E.S.renderSchedCalendar();
    E.el('mhSchedTagBtn').fire('click'); pickAll(E, E.el('mhSchedTagList')); E.el('mhSchedTagOk').fire('click');
    E.el('mhSchedInput').value = 'x'; E.el('mhSchedAddBtn').fire('click'); await tick();
    chk(E.errs.length === 0, 'x');
  });
  await broken('받기 전 잠금을 빼면 일정을 쓴다', (x) => x.replace("if(_monthState !== LOAD.READY){ toast(LOCK_TEXT); return; }   // 받기 전에는 고치지 못하게 잠근다\n    const isPublic", 'const isPublic'), async (src) => {
    const d = deferred();
    let hold = false;
    const E = mkEnv({ src, routes: { 'GET /v1/me/schedules': () => (hold ? d.p : []), 'POST /v1/me/schedules': item('n', YM + '-' + DD, 'x') } });
    await tick(); hold = true;   // 만들 때 오늘 일정을 한 번 받아 둔다 — 서버 길의 «받은 적 있나» 잠금은 풀려 있고, 모듈의 «이 달을 받았나» 잠금만 본다
    E.S.renderSchedCalendar(); E.el('mhSchedInput').value = 'x'; E.el('mhSchedAddBtn').fire('click'); await tick();
    chk(E.calls('POST', /./).length === 0, 'x');
  });
  await broken('보드 받기 전 잠금을 빼면 편집창이 열린다', (x) => x.replace("  if(_boardState !== LOAD.READY){ toast(LOCK_TEXT); return; }   // 받기 전에는 고치지 못하게 잠근다\n\n  _ddayEditId = id;", '\n  _ddayEditId = id;'), async (src) => {
    const d = deferred();
    const E = mkEnv({ src, routes: { 'GET /v1/me/ddays': () => d.p } });
    E.S.renderSchedCalendar(); await tick();
    dayCells(E)[3].fire('contextmenu');
    chk(E.el('mhDdayEdit').style.display !== 'block', 'x');
  });
  await broken('저장을 줄 세우지 않고 바로 보낸다', (x) => x.replace("const run = _boardChain.then(fn);", "const run = Promise.resolve().then(fn);"), async (src) => {
    const S1 = deferred();
    const Q = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD() } });
    Q.S.renderSchedCalendar(); await tick(20);
    let n = 0;
    Q.routes['PUT /v1/me/ddays'] = () => { n++; return n === 1 ? S1.p : BOARD({ version: 7 }); };
    gridCards(Q)[0].fire('contextmenu'); Q.el('mhDdaySaveBtn').fire('click'); await tick();
    Q.el('mhDdayBanners').children[0].children.find(c => c.className === 'db-x').onclick({ stopPropagation(){} }); await tick();
    chk(Q.calls('PUT', /ddays/).length === 1, 'x');
  });
  await broken('409 에도 다시 받지 않는다', (x) => x.replace("if(_writeFail(e)) await _boardFetchNow(false);", "_writeFail(e);"), async (src) => {
    const C = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD() } });
    C.S.renderSchedCalendar(); await tick(20);
    C.routes['PUT /v1/me/ddays'] = apiErr(409, 'CONCURRENT_UPDATE');
    C.routes['GET /v1/me/ddays'] = BOARD({ version: 8, cards: [card(U1, '서버 값', daysAgo(1))], banners: [] });
    gridCards(C)[0].fire('contextmenu'); C.el('mhDdaySaveBtn').fire('click'); await tick(30);
    chk(gridCards(C).length === 1 && gridCards(C)[0].textContent.includes('서버 값'), 'x');
  });
  await broken('늦게 온 앞 달 답을 버리지 않는다', (x) => x.replace("if(seq !== _monthSeq || gen !== _gen) return;\n    _schedMonthData = data;", "_schedMonthData = data;"), async (src) => {
    const dA = deferred();
    let hold = false;
    const E = mkEnv({ src, routes: { 'GET /v1/me/schedules': (b, p) => (monthOfPath(p) === YM && hold ? dA.p : []) } });
    await tick(); hold = true;
    E.S.renderSchedCalendar();
    E.el('mhSchedNext').fire('click'); await tick();
    dA.res([item('late', YM + '-' + DD, '늦게 온 앞 달', 'PRIVATE', 1)]); await tick();
    dayCells(E)[Number(DD) - 1].click();
    chk(!E.el('mhSchedDayList').textContent.includes('늦게 온'), 'x');
  });
  await broken('늦게 온 앞 계정 답을 버리지 않는다', (x) => x.replace("    if(gen !== _gen) return true;\n    _schedDdays = dd; _boardState = LOAD.READY;", "    _schedDdays = dd; _boardState = LOAD.READY;"), async (src) => {
    const dOld = deferred();
    const E = mkEnv({ src, routes: { 'GET /v1/me/ddays': () => dOld.p } });
    E.S.renderSchedCalendar(); await tick(); E.S.reset();
    dOld.res(BOARD()); await tick(30);
    chk(gridCards(E).length === 0, 'x');
  });
  await broken('빈 보드를 못 받음으로 그린다', (x) => x.replace("if(state !== LOAD.READY){\n    grid.className = 'cols3';", "if(state !== LOAD.READY || !Object.keys(_schedDdays).length){\n    grid.className = 'cols3';"), async (src) => {
    const Z = mkEnv({ src }); Z.S.renderSchedCalendar(); await tick(20);
    chk(Z.el('mhDdayGrid').children.some(c => c.classList.contains('add')), 'x');
  });
  await broken('못 받음 오류 번호를 매번 낸다', (x) => x.replace("if(_loadFailing) return;", ""), async (src) => {
    const F = mkEnv({ src, routes: { 'GET /v1/me/schedules': apiErr(503, 'X'), 'GET /v1/me/notifications': apiErr(503, 'X') } }); await tick();
    chk(F.errs.length === 1, 'x');
  });
  await broken('관람 중에도 편집창을 연다', (x) => x.replace("function _ddayOpenEdit(id, kind, prefillDate){\n  if(viewingUserId()) return;", "function _ddayOpenEdit(id, kind, prefillDate){\n  if(false) return;"), async (src) => {
    const E = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD(), 'GET /v1/schedules/f1': [], 'GET /v1/ddays/f1': { cards: [card(U4, 'f', daysAgo(3))], banners: [] } } });
    E.S.renderSchedCalendar(); await tick(20); E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick(30);
    E.el('mhDdayGrid').children[0].fire('contextmenu');
    chk(E.el('mhDdayEdit').style.display !== 'block', 'x');
  });
  await broken('계정이 바뀌어도 조용히 하지 않는다', (x) => x.replace("OWNER_CHANGED: { action: 'quiet', notice: null },", "OWNER_CHANGED: { action: 'notice', notice: (notifyError, e) => notifyError('E-MH-05', e) },"), async (src) => {
    const O = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': BOARD() } });
    O.S.renderSchedCalendar(); await tick(20); O.st.who = 'tokenB';
    gridCards(O)[0].fire('contextmenu'); O.el('mhDdaySaveBtn').fire('click'); await tick(30);
    chk(O.errs.length === 0, 'x');
  });
  const tagScenario = async (src, untag) => {
    const E = mkEnv({ src, friends: { f1: { name: 'A' } } });
    await tick();
    E.el('mhSchedTagBtn').fire('click'); pickAll(E, E.el('mhSchedTagList')); E.el('mhSchedTagOk').fire('click');
    const locked = E.el('mhSchedPublic').checked === true && E.el('mhSchedPublic').disabled === true && E.el('mhSchedPublicHint').textContent !== '';
    if(!untag){ chk(locked, 'x'); return; }
    E.el('mhSchedTagBtn').fire('click'); E.el('mhSchedTagList').querySelectorAll = () => []; E.el('mhSchedTagOk').fire('click');
    chk(E.el('mhSchedPublic').checked === false && E.el('mhSchedPublic').disabled === false, 'x');
  };
  await broken('태그해도 공개 체크를 켜고 잠그지 않는다', (x) => x.replace("chk.checked = true; chk.disabled = true;", ""), async (src) => { await tagScenario(src, false); });
  await broken('태그를 빼도 원래 값으로 안 돌린다', (x) => x.replace("chk.checked = chk.dataset.orig === '1'; ", ""), async (src) => { await tagScenario(src, true); });
  await broken('까닭 글을 안 보인다', (x) => x.replace("if(hint) hint.textContent = PUBLIC_TAG_HINT;", ""), async (src) => { await tagScenario(src, false); });
  await broken('늦게 온 🔔 알림 답의 세대 확인을 뺀다', (x) => x.replace("  if(gen !== _gen) return;\n  _loadFailing = false;\n  const prevIds", "  _loadFailing = false;\n  const prevIds"), async (src) => { await staleBell(src); });
  await broken('늦게 온 오늘 일정 답의 세대 확인을 뺀다', (x) => x.replace("    if(gen !== _gen) return;\n    const dayObj", "    const dayObj"), async (src) => { await staleBell(src); });
  await broken('reset 이 서버 길의 «받음» 기억을 안 비운다', (x) => x.replace("  scheduleApi.reset();\n", ""), async (src) => { await staleBell(src); });
  await broken('구경을 끝내도 늦게 온 친구 답을 받아 둔다', (x) => x.replace("function _visitStop(){ _visitSeq++; ", "function _visitStop(){ "), async (src) => {
    const dl = deferred();
    const E = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD(), 'GET /v1/schedules/f1': [], 'GET /v1/ddays/f1': () => dl.p } });
    E.S.renderSchedCalendar(); await tick(20);
    E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick();
    E.g.viewing = null; E.S.endVisit(); await tick();
    dl.res({ cards: [card(U4, '늦게 온 친구', daysAgo(3), { visibility: 'PUBLIC' })], banners: [] }); await tick(30);
    E.g.viewing = 'f1'; E.S.renderDdays();
    chk(!E.el('mhDdayGrid').textContent.includes('늦게 온 친구'), 'x');
  });
  await broken('쓰는 사이 구경을 시작해도 내 일정을 친구 달력에 얹는다', (x) => x.replace("if(item.date.slice(0, 7) === _schedYM && !viewingUserId()){", "if(item.date.slice(0, 7) === _schedYM){"), async (src) => {
    const slow = deferred();
    const E = mkEnv({ src, routes: { 'GET /v1/me/schedules': [], 'GET /v1/schedules/f1': [], 'GET /v1/me/ddays': BOARD(), 'GET /v1/ddays/f1': { cards: [], banners: [] }, 'POST /v1/me/schedules': () => slow.p } });
    E.S.renderSchedCalendar(); await tick(20);
    E.el('mhSchedInput').value = '내 일정'; E.el('mhSchedAddBtn').fire('click'); await tick();
    E.g.viewing = 'f1'; E.S.startVisit('f1'); await tick(20);
    slow.res(item('n1', YM + '-' + DD, '내 일정', 'PRIVATE', 1)); await tick(20);
    chk(!E.el('mhSchedDayList').textContent.includes('내 일정'), 'x');
  });
  await broken('순서 저장도 다시 받기도 못 해도 먼저 바꾼 순서를 둔다', (x) => x.replace("if(!fresh && gen === _gen && _boardState === LOAD.READY){ _schedDdays = before; renderDdays(); }", ""), async (src) => {
    const R2 = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD() } });
    R2.S.renderSchedCalendar(); await tick(20);
    R2.routes['PUT /v1/me/ddays'] = apiErr(503, 'X'); R2.routes['GET /v1/me/ddays'] = apiErr(503, 'X');
    const c2 = gridCards(R2);
    c2[1].fire('dragstart', { dataTransfer: { setData(){} } }); c2[0].fire('dragover'); c2[0].fire('drop'); await tick(30);
    chk(gridCards(R2)[0].textContent.includes('만난 날'), 'x');
  });
  await broken('편집창이 말없이 끝난다(받기 상태 문구를 안 보인다)', (x) => x.replace("const waiting = _boardState !== LOAD.READY;", "const waiting = false;"), async (src) => {
    const K3 = mkEnv({ src, routes: { 'GET /v1/me/ddays': BOARD() } });
    K3.S.renderSchedCalendar(); await tick(20);
    const hold = deferred();
    K3.routes['PUT /v1/me/ddays'] = () => hold.p;
    gridCards(K3)[0].fire('contextmenu');
    K3.el('mhDdaySaveBtn').fire('click'); await tick();
    K3.routes['GET /v1/me/ddays'] = () => new Promise(() => {});
    K3.S.reset(); K3.S.loadBoard(); await tick(20);
    hold.res(BOARD({ version: 6 })); await tick(30);
    chk(K3.el('mhDdayEditMsg').textContent.includes('불러오는 중이에요'), 'x');
  });
});

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
})();
