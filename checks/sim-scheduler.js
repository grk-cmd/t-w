/* ═══ 📅 sim-scheduler.js — 스케줄러 · 🔔 일정 알림 모듈 (2026-10-10 신설 · 앱 FSD 1번) ═══════════════════
   app.js 의 두 구역(📅 스케줄러 · 🔔 일정 알림)을 parts/scheduler.js 로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 셈 — 날짜 차이 · «그날이 1일» · 카드 글자(D-3 · D-day · 100일) · 이정표(당일 · 50 · 100 단위)
   ・2절: 만들 때 — 알림 구독 둘(친구 태그 · 오늘 일정) · firebase 가 늦으면 firebase-ready 뒤 · 1분 타이머 · ESC 창 등록 · window._closeBellWin
   ・3절: 🔔 뱃지 · 알림 목록 — 오늘 일정 · 100일째 기념일 · 친구 태그(토스트) · 창을 열면 읽음 → 뱃지 0 · 닫기
   ・4절: 달력 · D-day — 이번 달 구독 · 점 · 👀 관람이면 친구 것(공개만) · 편집 막음 · + 카드 없음
   ・5절: app.js 배선 — 정의는 모듈에만 · createScheduler 는 원래 자리 · 부르는 곳은 mhScheduler.이름 · BELL_SEEN_KEY 는 app.js · html 순서 · 내장 전역 이름과 안 겹침
   [실행] scheduler.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['scheduler.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = SRC['app.js'], HTML = SRC['desk-companion-prototype.html'], MOD = SRC['scheduler.js'];
/* 절마다 따로 — 옛 코드(모듈 없음)에 대면 멈추지 않고 그 절을 빨강 하나로 센다 */
const sec = (title, fn) => { say(title); try{ fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + (e && e.message)); } };

/* ── 가짜 DOM — 모듈이 쓰는 만큼만 ── */
function mkEl(tag, id){
  const L = {};
  const cls = new Set();
  const o = {
    tagName: tag, id: id || '', children: [], style: {}, dataset: {}, value: '', checked: false, title: '',
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
function mkEnv(opt){
  opt = opt || {};
  const els = {};
  /* 🔔 창은 html 에서 style=display:none 으로 시작한다 — 열림 판정이 style.display 라 똑같이 맞춘다 */
  els.bellWin = mkEl('div', 'bellWin'); els.bellWin.style.display = 'none';
  const ls = new Map();
  const subs = { notices: [], month: [] };
  const timers = [], toasts = [], escWins = [], winListeners = {};
  const api = {
    subscribeSchedNotices: (uid, cb) => { subs.notices.push({ uid, cb }); return () => {}; },
    subscribeScheduleMonth: (uid, ym, cb) => { subs.month.push({ uid, ym, cb }); return () => { subs.monthOff = (subs.monthOff || 0) + 1; }; },
    removeSchedNotice: async () => {}, removeScheduleItem: async () => {}, removeDday: async () => {},
    addScheduleItem: async () => {}, saveDday: async () => {}, setDdayOrder: async () => {}, sendScheduleNotices: async () => {},
  };
  const win = {
    firebaseAPI: opt.noApi ? undefined : api,
    addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); },
  };
  const document = {
    getElementById: id => (opt.only && !opt.only.includes(id)) ? null : (els[id] = els[id] || mkEl('div', id)),
    createElement: tag => mkEl(tag),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener(){}, removeEventListener(){},
    body: mkEl('body'),
  };
  const localStorage = { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) };
  const setInterval = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  const raf = fn => 0;
  const g = { viewing: null, friends: {} };
  new Function('window', 'module', 'document', 'localStorage', 'firebaseAPI', 'setInterval', 'requestAnimationFrame', 'innerWidth', 'innerHeight', MOD)
    (win, undefined, document, localStorage, win.firebaseAPI, setInterval, raf, 1280, 800);
  const S = win.MhScheduler.createScheduler({
    getMyUserId: () => 'me1', getDisplayName: () => '나나',
    viewingUserId: () => g.viewing, myHomeFriends: () => g.friends,
    toast: m => toasts.push(m),
    uiIconEl: (name) => { const e = mkEl('img'); e.dataset.icon = name; return e; },
    escRegisterWindow: w => escWins.push(w),
    closeChipPopups: () => {}, positionInputBelowChar: () => {},
    inboxUnreadCount: () => opt.inbox || 0, refreshFriendTabBadge: () => { g.friendBadge = (g.friendBadge || 0) + 1; },
    bellSeenKey: 'tw.bellSeenTs',
  });
  return { S, win, els, ls, subs, timers, toasts, escWins, winListeners, g, api, el: id => document.getElementById(id) };
}
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const TODAY = ymd(new Date());

sec('── 1. 셈', () => {
  const C = mkEnv().S.calc;
  chk(C.daysBetween('2026-03-01', '2026-03-31') === 30 && C.daysBetween('2026-03-08', '2026-03-09') === 1, '날짜 차이 — 서머타임 · 시간대와 무관하게 하루 = 1');
  chk(C.ddayBase1({ kind: 'anniv', date: '2026-01-01' }) === true, '«그날이 1일» — 칸이 없는 예전 기념일은 켜진 것');
  chk(C.ddayBase1({ kind: 'anniv', base1: false }) === false && C.ddayBase1({ kind: 'dday', base1: true }) === false && C.ddayBase1(null) === false,
      '  끈 기념일 · ⏳ 배너 · 빈 값은 꺼진 것');
  const L = (d, b) => C.ddayCountLabel(d, b).txt;
  chk(L(3, false) === 'D-3' && L(3, true) === 'D-3', '미래는 셈법과 무관 — D-3 (켜도 D-4 가 아니다)');
  chk(L(0, false) === 'D-day' && C.ddayCountLabel(0, false).today, '당일 — D-day');
  chk(L(0, true) === '1일' && C.ddayCountLabel(0, true).today, '  «그날이 1일» 의 당일 — 1일');
  chk(L(-99, true) === '100일' && L(-99, false) === '99일', '지난 날 — 켜면 100일 · 끄면 99일 (제보 «하루씩 부족»)');
  chk(C.ddayShownDays({ kind: 'anniv', date: daysAgo(99) }, TODAY) === 100, '화면 숫자 — 99일 전 기념일은 100');
  const M = C.ddayMilestoneDays;
  chk(M(0, 1) && M(49, 50) && M(99, 100) && M(199, 200), '이정표 — 당일(raw 0) · 50 · 100 단위');
  chk(!M(-1, 0) && !M(98, 99) && !M(149, 150), '  아직 안 온 날 · 99 · 150 은 아님');
});

sec('── 2. 만들 때', () => {
  const E = mkEnv();
  chk(E.subs.notices.length === 1 && E.subs.notices[0].uid === 'me1', '🔔 친구 태그 알림 구독 — 내 uid 로 한 번');
  const t = new Date();
  chk(E.subs.month.length === 1 && E.subs.month[0].uid === 'me1' && E.subs.month[0].ym === t.getFullYear() + '-' + pad(t.getMonth() + 1),
      '오늘 일정 구독 — 스케줄러 탭을 안 열어도 이번 달을 듣는다');
  chk(E.timers.some(x => x.ms === 60 * 1000), '자정 넘김 — 1분마다 날짜를 본다');
  chk(E.escWins.length === 1 && E.escWins[0].key === 'bell' && E.escWins[0].el === E.el('bellWin'), 'ESC 로 닫히는 창에 🔔 알림창 등록');
  chk(typeof E.win._closeBellWin === 'function', 'window._closeBellWin — 칩 팝업 닫기가 부른다');
  chk(Array.isArray(E.win.__winPosResetters) && E.win.__winPosResetters.length === 1, '🪟 창 위치 초기화 목록에 🔔 자리');
  const L = mkEnv({ noApi: true });
  chk(L.subs.notices.length === 0 && (L.winListeners['firebase-ready'] || []).length === 1, 'firebase 가 아직이면 firebase-ready 를 기다린다');
  const N = mkEnv({ only: [] });
  chk(N.subs.notices.length === 0 && N.timers.length === 0 && N.escWins.length === 0, 'DOM 이 없으면(창 요소 없음) 아무것도 걸지 않는다 — 예전처럼 조용히');
});

sec('── 3. 🔔 뱃지 · 알림 목록', () => {
  const E = mkEnv({ inbox: 1 });
  const badge = E.el('myBellBadge'), list = E.el('bellList');
  E.S.refreshBellBadge();
  chk(badge.textContent === '1' && badge.classList.contains('on'), '수령함 안 읽은 것 1 → 뱃지 1');
  const now = Date.now();
  E.subs.month[0].cb({ [pad(new Date().getDate())]: { a: { text: '병원', ts: now - 2 } } });
  chk(badge.textContent === '2', '오늘 내 일정이 들어오면 뱃지 +1');
  E.S.setDdays({ d1: { kind: 'anniv', text: '만난 날', date: daysAgo(99), notify: true },
                 d2: { kind: 'anniv', text: '조용', date: daysAgo(99), notify: false } });
  E.S.refreshBellBadge();
  chk(badge.textContent === '3', '알림 켠 기념일이 오늘 100일 → +1 (끈 것은 안 셈)');
  E.subs.notices[0].cb({ n1: { fromName: '친구A', text: '같이 점심', date: TODAY, ts: now - 1 } });
  chk(badge.textContent === '4', '친구가 태그한 오늘 일정 → +1');
  chk(E.toasts.some(m => m === '🔔 친구A 님이 일정에 태그했어요'), '  새 태그 알림은 토스트');
  chk(E.g.friendBadge > 0, '  친구 탭 보상 뱃지도 같이 갱신');
  E.el('myBellBtn').fire('click');
  chk(E.el('bellWin').style.display === 'block' && E.S.isBellOpen(), '🔔 버튼 → 알림창이 열린다');
  const txt = list.textContent;
  chk(txt.includes('병원') && txt.includes('만난 날 100일째 되는 날!') && txt.includes('같이 점심') && txt.includes('친구A 님이 태그함'),
      '  목록 — 오늘 일정 · 100일째 기념일 · 친구 태그 (일정이 «뜬다»)');
  chk(!txt.includes('조용'), '  알림을 끈 기념일은 안 뜬다');
  chk(txt.includes('수령함 확인') && txt.includes('NEW 1'), '  아래 [📪 수령함 확인] · 안 읽은 수');
  chk(Number(E.ls.get('tw.bellSeenTs')) >= now, '  열면 읽음 시각을 tw.bellSeenTs 에 적는다');
  /* ⚠️ 옛 셈 그대로 — 본 날(seenDay)은 UTC 날짜(toISOString), 오늘은 로컬 날짜라 한국 0~9시에는 둘이 달라
       기념일 이정표가 다시 센다. 옮기기만 한 PR 이라 고치지 않고 그 차이를 그대로 기대한다. */
  const sameDay = new Date(Number(E.ls.get('tw.bellSeenTs'))).toISOString().slice(0, 10) === TODAY;
  chk(badge.textContent === (sameDay ? '1' : '2'), '  열고 나면 본 것은 빠지고 수령함 1 만 남는다' + (sameDay ? '' : ' (+ 기념일 1 — UTC 날짜 차이, 옛 셈 그대로)'));
  E.el('bellClose').fire('click');
  chk(E.el('bellWin').style.display === 'none' && !E.S.isBellOpen(), '✕ → 닫힌다');
  const E2 = mkEnv();
  E2.S.renderBellList();
  chk(E2.el('bellList').textContent.includes('오늘 예정된 일정이 없어요'), '아무것도 없으면 «오늘 예정된 일정이 없어요»');
});

sec('── 4. 달력 · D-day · 👀 관람', () => {
  const E = mkEnv();
  E.S.renderSchedCalendar();
  const t = new Date(), ym = t.getFullYear() + '-' + pad(t.getMonth() + 1);
  const mine = E.subs.month[E.subs.month.length - 1];
  chk(E.subs.month.length === 2 && mine.uid === 'me1' && mine.ym === ym, '스케줄러 탭 — 이번 달 내 달력을 구독');
  chk(E.el('mhSchedTitle').textContent === t.getFullYear() + '년 ' + (t.getMonth() + 1) + '월', '  제목 «YYYY년 M월»');
  mine.cb({ [pad(t.getDate())]: { a: { text: '회의', ts: 1 } } });
  const cells = E.el('mhSchedGrid').children.filter(c => !c.classList.contains('out'));
  const todayCell = cells[t.getDate() - 1];
  chk(cells.length === new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(), '  날짜 칸 수 = 이번 달 날 수');
  chk(todayCell.classList.contains('today') && todayCell.classList.contains('sel') && todayCell.children.length === 2, '  오늘 칸 — today · 선택 · 일정 점');
  chk(E.el('mhSchedDayList').textContent.includes('회의'), '  고른 날 일정 목록');
  E.S.setDdays({ a1: { kind: 'anniv', text: '기념', date: daysAgo(10), ts: 1 }, b1: { kind: 'dday', text: '시험', date: '2999-01-01', ts: 2 } });
  E.S.renderDdays();
  const grid = E.el('mhDdayGrid');
  chk(grid.children.length === 2 && grid.children[1].classList.contains('add'), '기념일 카드 1 + [+] 카드');
  chk(E.el('mhDdayBanners').children.length === 1, '⏳ 배너 1');
  // 👀 관람 — 친구 것(공개만) · 편집 막음
  E.g.viewing = 'f1';
  E.S.setDdaysVisit({ v1: { kind: 'anniv', text: '친구 기념', date: daysAgo(3), public: true } });
  E.S.subscribeMonth();
  const fr = E.subs.month[E.subs.month.length - 1];
  chk(fr.uid === 'f1' && E.subs.monthOff >= 1, '관람 — 달력 구독을 끊고 친구 것으로');
  fr.cb({ '01': { p: { text: '공개', public: true }, q: { text: '비밀' } } });
  E.S.renderDdays();
  chk(grid.children.length === 1 && grid.children[0].textContent.includes('친구 기념'), '  친구 기념일만 · [+] 카드 없음');
  E.el('mhDdayEdit').style.display = 'none';
  grid.children[0].fire('contextmenu');
  chk(E.el('mhDdayEdit').style.display === 'none', '  우클릭해도 편집창이 안 열린다');
  E.g.viewing = null; E.S.setDdaysVisit(null); E.S.renderDdays();
  chk(grid.children.length === 2 && grid.children[0].textContent.includes('기념'), '관람 끝 — 내 기념일로 돌아온다');
  grid.children[0].fire('contextmenu');
  chk(E.el('mhDdayEdit').style.display === 'block' && E.el('mhDdayEditTitle').textContent === '📌 기념일 수정', '  내 것은 우클릭 → «📌 기념일 수정»');
});

sec('── 5. app.js 배선 · html', () => {
  const NAMES = ['renderSchedCalendar', 'renderSchedGrid', 'renderSchedDay', 'renderDdays', 'renderAnnivCards', 'renderDdayBanners',
    '_ddayOpenEdit', '_ddayCloseEdit', '_schedSubscribeMonth', 'refreshBellBadge', 'renderBellList', '_bellWinOpen', '_bellSubscribeToday',
    '_ddayMilestoneDays', '_ddayBase1', '_ddayCountLabel', '_daysBetween', '_todayYMD'];
  const left = NAMES.filter(n => new RegExp('function ' + n + '\\(').test(APP));
  chk(left.length === 0, '정의는 모듈에만 — app.js 에 같은 이름의 함수가 없다' + (left.length ? ' (남음: ' + left.join(' ') + ')' : ''));
  chk(NAMES.every(n => new RegExp('function ' + n + '\\(').test(MOD)), '  모듈에 다 있다');
  chk(!/═+ 📅 스케줄러|═+ 🔔 일정 알림/.test(APP) && /═+ 📅 스케줄러/.test(MOD) && /═+ 🔔 일정 알림/.test(MOD), '구역 머리 둘이 모듈로 옮겨 갔다');
  const iC = APP.indexOf('MhScheduler.createScheduler('), iV = APP.indexOf('let _mhViewingUserId'), iB = APP.indexOf('═ 🐞 버그 제보 탭');
  chk(iC > 0 && iC < iB && iC < iV, 'createScheduler 는 원래 자리(🐞 버그 제보 탭 바로 앞)에서 부른다');
  chk(/const mhScheduler = \(typeof MhScheduler === 'undefined'\) \? SCHEDULER_OFF/.test(APP), '  모듈이 없으면 빈 껍데기(SCHEDULER_OFF) — 앱 · 검사가 안 선다');
  chk(/viewingUserId: \(\)=>_mhViewingUserId/.test(APP) && /myHomeFriends: \(\)=>_myHomeFriends/.test(APP), '  다시 대입되는 let 둘은 읽는 함수로 넘긴다');
  chk(/const BELL_SEEN_KEY = 'tw\.bellSeenTs';/.test(APP) && /bellSeenKey: BELL_SEEN_KEY/.test(APP) && !/'tw\.bellSeenTs';/.test(MOD.replace(/\/\/.*$/gm, '')),
      'BELL_SEEN_KEY 는 app.js 한 곳(계정 전환 지움 목록이 같이 쓴다) — 모듈은 deps 로 받는다');
  chk(/const ANNIV_H_KEY = 'tw\.annivAreaH';/.test(MOD) && /const BELL_POS_KEY = 'tw\.bellWinPos';/.test(MOD), 'localStorage 키 그대로 — tw.annivAreaH · tw.bellWinPos');
  const bare = APP.split('\n').filter(l => /(^|[^.\w])(refreshBellBadge|renderBellList|renderDdays|renderSchedCalendar|_schedSubscribeMonth|_bellWinOpen)\((?!\)\{\})/.test(l));   // SCHEDULER_OFF 의 빈 함수 name(){} 는 뺀다
  chk(bare.length === 0, '부르는 곳은 전부 mhScheduler.이름 — 옛 전역 이름 호출이 안 남았다' + (bare.length ? ' (' + bare[0].trim().slice(0, 80) + ')' : ''));
  chk(/mhScheduler\.setDdays\(dd \|\| \{\}\); mhScheduler\.renderDdays\(\); mhScheduler\.refreshBellBadge\(\);/.test(APP), '  내 D-day 구독 → setDdays · 그리기 · 뱃지');
  chk((APP.match(/mhScheduler\.setDdaysVisit\(/g) || []).length === 3 && (APP.match(/mhScheduler\.subscribeMonth\(\)/g) || []).length === 2, '  관람 시작 · 끝 → setDdaysVisit · subscribeMonth');
  chk(/if\(tab\.dataset\.tab==='scheduler'\)\{\s*mhScheduler\.renderSchedCalendar\(\); mhScheduler\.renderDdays\(\);/.test(APP), '  [스케줄러] 탭 → 달력 · D-day 그리기');
  const a = HTML.indexOf('<script src="parts/scheduler.js"></script>'), b = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(a > 0 && b > a, 'html 이 scheduler.js 를 app.js 앞에 싣는다');
  /* 크로미움(Electron)에는 내장 전역 Scheduler · scheduler(작업 예약 API)가 있다 — 같은 이름을 쓰면 typeof 가드가 늘 통과하고
     모듈이 안 실렸을 때 내장 생성자에 createScheduler 를 부르다 app.js 가 선다(헤드리스 크로미움에서 실제로 typeof Scheduler === 'function'). */
  chk(!/window\.Scheduler\s*=/.test(MOD) && !/\b(?:const|let|var)\s+scheduler\b/.test(APP) && !/typeof Scheduler\s*===/.test(APP),
      '내장 전역 이름(Scheduler · scheduler)을 안 쓴다 — window.MhScheduler · mhScheduler');
});

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
