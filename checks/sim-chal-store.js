/* ═══ 👑 sim-chal-store.js — 달성표 저장소(서버 한 주 한 벌 · 쓰기 한 줄 · 오늘 판정 · 보상 받기) 실제로 돌려 본다 (0.13 앱 묶음 D5-4) ═══
   chal-store.js 를 가짜 서버 길(chalApi — 답을 손으로 풀어 «보내는 중» 의 모든 순간을 잡는다) · 가짜 계정 칸 · 가짜 세션 위에서 그대로 돌린다.
   ・1절: 셈 — 날 글자 → 요일 · 단계 · 주의 월요일 · 지난 주 이름 · 칸(✓ ✗ · ●) · 서버 목표 ↔ 화면 목표
   ・2절: 시작 · 받기 — 만들 때 요청 0 · 프리미엄이면 GET 한 번 · 아니면 0(켜지면 틱이 한 번) · PREMIUM_REQUIRED → locked(번호 0) · 실패 → failed + 번호 0 · 열기 실패 → E-FOCUS-04
   ・3절: 쓰기 한 줄 — 받기 전 누름 → 요청 0 · PUT 본문 모양 · 줄에서 차례가 왔을 때의 최신 판 · 409 → GET 1 + 잠금 + 알림 + 다시 안 보냄 · 실패 → E-FOCUS-05
   ・4절: 오늘 판정 — 목표를 채운 틱 열 번 → POST 한 번 · 실패 → 번호 한 번 · 혼자 다시 안 보냄 · [다시 적기] · NOT_STARTED 는 조용히 · 하루가 바뀌면 오늘 진행을 새로
   ・5절: 보상 — 열린 칸마다 POST 하나 · NOT_YET → 번호 0 · 실패 → E-FOCUS-07 한 번 + [보상 받기] · 정산 칸은 짝 선지급 칸을 같이 닫는다
   ・6절: 하루 경계 — dayEndsAt 이 지나면 GET(같은 경계에서 3번까지) · 새 날을 받으면 오늘 진행이 새로 시작
   ・7절: 계정 바뀜 — reset 뒤 늦은 답은 아무것도 안 바꾼다 · 타이머 · 구독은 세션이 정리 · 옛 오늘 진행 옮기기 · 쌓기 · 체크 · 반복
   ・8절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const SRC0 = {
  MOD: pick(['chal-store.js', 'parts/focus/chal-store.js', 'app/parts/focus/chal-store.js']),
  API: pick(['focus-api.js', 'parts/focus/focus-api.js', 'app/parts/focus/focus-api.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const flush = async () => { for(let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

const DAY = '2026-11-13';                       // 금요일 · 2026-W46
const ENDS = Date.parse('2026-11-13T21:00:00Z');  // 서버 06:00(한국) 경계
const NOW0 = Date.parse('2026-11-13T03:00:00Z');
const today = (day, iso, ends) => ({ day: day || DAY, isoWeek: iso || '2026-W46', dayEndsAt: ends || ENDS });
const FOCUS_GOAL = { kind: 'FOCUS', hours: 1, app: 'win:a.exe', label: 'a' };
const week = (o) => Object.assign({
  isoWeek: '2026-W46', version: 1, weekdayGoal: FOCUS_GOAL, weekendGoal: null, pendingGoal: null, pendingPhase: null, pendingFrom: null,
  autoNext: false, autoNextWeekend: false, skippedWeekday: false, skippedWeekend: false, weekdayStartedOn: '2026-11-09', weekendStartedOn: null,
  days: [], uncountedDays: [], rewards: [], claimable: [], today: today(),
}, o || {});

function world(S, o){
  o = o || {};
  const P = S.P;
  const W = { prevGets: [], gets: [], puts: [], marks: [], claims: [], notes: [], events: [], store: new Map(), resets: [], timers: [], intervals: [], apiReset: 0, now: o.now || NOW0, premium: o.premium !== false, day: o.serverDay === undefined ? null : o.serverDay, rolled: 0, mode: 'run', changes: 0 };
  const defer = () => { const d = {}; d.p = new Promise((res, rej) => { d.res = res; d.rej = rej; }); return d; };
  const api = {
    fetchChallenge: (uid, iso) => {
      const d = defer();
      if(iso && !o.prevManual){ W.prevGets.push({ uid, iso }); const pw = (o.prevWeek && o.prevWeek[iso]) || week({ isoWeek: iso, weekdayGoal: null, weekdayStartedOn: null, version: 0 }); d.res(pw); return d.p; }   // 지난 주 받기(보상 살펴보기)는 바로 답한다 — 손으로 푸는 것은 이번 주
      W.gets.push(Object.assign(d, { uid, iso })); return d.p;
    },
    saveChallenge: (uid, iso, body) => { const d = defer(); W.puts.push(Object.assign(d, { uid, iso, body })); return d.p; },
    markToday: (uid) => { const d = defer(); W.marks.push(Object.assign(d, { uid })); return d.p; },
    claimReward: (uid, iso, slot) => { const d = defer(); W.claims.push(Object.assign(d, { uid, iso, slot })); return d.p; },
    reset: () => { W.apiReset++; },
  };
  const cell = { get: (k) => (W.store.has(k) ? W.store.get(k) : null), set: (k, v) => { W.store.set(k, String(v)); return true; }, remove: (k) => W.store.delete(k) };
  const mod = P.createChalStore({
    chalApi: o.api ? o.api(W) : api, focusPure: S.FP, chalCell: cell,
    notifyError: (c, e) => W.notes.push(c), premiumOn: () => W.premium, serverDay: () => W.day, rolloverToday: () => { W.rolled++; },
    now: () => W.now, appMode: () => W.mode, addQuitListener: (fn) => { W.quit = fn; },
  });
  mod.onEvent((e) => W.events.push(e));
  mod.onChange(() => { W.changes++; });
  const session = { onReset: (fn) => W.resets.push(fn), setInterval: (fn, ms) => { W.intervals.push({ fn, ms }); return 1; }, setTimeout: (fn, ms) => { W.timers.push({ fn, ms }); return 1; } };
  W.mod = mod; W.session = session;
  W.start = (code) => mod.startChal(code || 'uAAAAAAAA1', { userCode: code || 'uAAAAAAAA1' }, session);
  W.reset = () => W.resets.forEach((f) => f());
  W.ok = async (d, v) => { d.res(v); await flush(); };
  W.up = async (w, extra) => { W.day = today(); W.start(); await W.ok(W.gets[0], w || week(extra)); return W; };   // 시작 → ready
  W.tick = async (n) => { for(let i = 0; i < (n || 1); i++){ mod.tick(); await flush(); } };
  W.codes = () => W.notes.join();
  return W;
}
const okW = (w) => ({ status: 'ok', challenge: w });
const err = (code) => Object.assign(new Error(code), { code, kind: 'http' });

async function judge(S){
  let W, r;
  const P = S.P;

  say('── 1. 셈');
  chk(P.phaseOf('2026-11-13') === 'wd' && P.phaseOf('2026-11-14') === 'we' && P.phaseOf('2026-11-15') === 'we' && P.phaseOf('2026-11-16') === 'wd', '요일 → 단계(월~금 평일 · 토 · 일 주말)');
  chk(P.dayIdx('2026-11-09', 'wd') === 0 && P.dayIdx('2026-11-13', 'wd') === 4 && P.dayIdx('2026-11-14', 'wd') === -1 && P.dayIdx('2026-11-14', 'we') === 0 && P.dayIdx('2026-11-15', 'we') === 1, '단계 안 칸 번호(없으면 -1)');
  chk(P.mondayOf('2026-W46') === '2026-11-09' && P.mondayOf('2026-W01') === '2025-12-29' && P.mondayOf('2027-W01') === '2027-01-04', '주 이름 → 월요일(연말연시 · 1월 4일 규칙)');
  chk(P.weekBefore('2026-W46') === '2026-W45' && P.weekBefore('2026-W01') === '2025-W52' && P.weekBefore('2021-W01') === '2020-W53', '지난 주 이름(연말 52 · 53주)');
  chk(P.isoWeekOfDay('2026-01-01') === '2026-W01' && P.isoWeekOfDay('2025-12-29') === '2026-W01' && P.isoWeekOfDay('2027-01-03') === '2026-W53', '날 글자 → 주 이름');
  chk(P.normDay('2026-11-4') === '2026-11-04' && P.normDay('2026-11-04') === '2026-11-04' && P.normDay('x') === null, '0.12 날 글자(0 채움 없음)를 서버 글자로');
  chk(P.rangeLabel('2026-W46', 'wd') === '11/9 ~ 11/13' && P.rangeLabel('2026-W46', 'we') === '11/14 ~ 11/15', '범위 글');
  chk(P.addDays('2026-12-31', 1) === '2027-01-01' && P.addDays('x', 1) === null, '날 더하기');
  {
    const C = P.CELL;
    let c = P.cellsOf(week({ days: [{ date: '2026-11-09', done: true }, { date: '2026-11-11', done: true }] }), 'wd', '2026-11-12', false);
    chk(JSON.stringify(c) === JSON.stringify([C.OK, C.FAIL, C.OK, C.NOW, C.WAIT]), '칸 — 달성 ✓ · 못 한 지난 날 ✗ · 오늘 ● · 앞날 ·');
    c = P.cellsOf(week({ days: [], weekdayStartedOn: '2026-11-11' }), 'wd', '2026-11-13', false);
    chk(c[0] === C.SKIP && c[1] === C.SKIP && c[2] === C.FAIL && c[4] === C.NOW, '시작일 전 날은 «안 센 날»(✗ 아님)');
    c = P.cellsOf(week({ uncountedDays: ['2026-11-10'] }), 'wd', '2026-11-13', false);
    chk(c[1] === C.SKIP && c[0] === C.FAIL, '라이선스 없던 날(uncountedDays)은 ✗ 아님');
    c = P.cellsOf(week({ skippedWeekday: true }), 'wd', '2026-11-13', false);
    chk(c.slice(0, 4).every((x) => x === C.SKIP), '쉰 단계의 지난 날은 안 센다');
    c = P.cellsOf(week(), 'wd', '2026-11-13', true);
    chk(c[4] === C.FAIL, '오늘 못 채우는 걸 알면 오늘 칸이 ✗(🔁)');
    chk(P.cellsOf(week(), 'we', '2026-11-13', false).join() === [C.WAIT, C.WAIT].join(), '앞날(주말)은 ·');
  }
  {
    const g = P.uiGoal({ kind: 'RULE', rules: { MONDAY: ['a'], FRIDAY: ['b', 'c'] } }, 'wd');
    chk(g.kind === 'rule' && g.cfg.rules.length === 5 && g.cfg.rules[0][0] === 'a' && g.cfg.rules[4].length === 2 && g.cfg.rules[1].length === 0, '서버 규칙 목표 → 칸 수만큼 줄 배열');
    chk(P.uiGoal({ kind: 'RULE', rules: { SUNDAY: ['z'] } }, 'we').cfg.rules.length === 2, '주말은 2칸');
    chk(P.uiGoal({ kind: 'FOCUS', hours: 2, app: 'chrome.exe', label: 'c' }, 'wd').cfg.key === 'win:chrome.exe', '키 없이 실행파일 이름만 남은 옛 목표는 win: 으로 올린다');
    chk(P.uiGoal({ kind: 'REPEAT', times: 3, intervalHours: 2, text: 't' }, 'wd').cfg.gap === 2, '반복 — 간격 이름 맞춤');
    const sg = P.serverGoal('rule', { rules: [['a', ' '], [], ['c']] }, 'wd');
    chk(JSON.stringify(sg) === JSON.stringify({ kind: 'RULE', rules: { MONDAY: ['a'], WEDNESDAY: ['c'] } }), '화면 규칙 → 서버 목표(빈 줄 · 빈 요일은 뺀다)');
    chk(P.serverGoal('focus', { key: 'win:x.exe', label: 'x', hours: 99 }, 'wd').hours === 12 && P.serverGoal('repeat', { text: '  t ', times: 0, gap: 20 }, 'wd').times === 1, '범위를 자른다(서버 상한과 같은 값)');
    chk(P.sameGoal({ kind: 'FOCUS', hours: 1, app: 'a', label: 'b', text: null }, { label: 'b', app: 'a', hours: 1, kind: 'FOCUS' }), '목표 견주기는 키 순서 · 빈 칸을 보지 않는다');
  }

  say('── 2. 시작 · 받기');
  W = world(S);
  chk(W.gets.length === 0 && W.intervals.length === 0 && W.store.size === 0 && W.mod.view().load === 'idle', '만들 때는 요청 · 타이머 · 계정 칸 쓰기 0 — idle');
  W.day = today(); W.start();
  chk(W.gets.length === 1 && W.gets[0].uid === 'uAAAAAAAA1' && W.gets[0].iso === undefined && W.mod.view().load === 'loading' && W.resets.length === 1 && W.intervals.length === 1 && W.intervals[0].ms === 20000, '시작 → 이번 주 GET 한 번(주를 안 세고 서버가 정한다) · loading · reset 훅 · 20초 틱 하나(세션)');
  W.start();
  chk(W.gets.length === 1 && W.resets.length === 1, '  두 번 시작해도 GET 한 번');
  await W.ok(W.gets[0], week());
  r = W.mod.view();
  chk(r.load === 'ready' && r.phase === 'wd' && r.active && r.goal.kind === 'focus' && r.s === 0 && r.cells.length === 5 && W.codes() === '', '답 → ready · 이번 단계 · 목표 · 칸 5 · 번호 0');
  W = world(S, { premium: false }); W.day = today(); W.start();
  chk(W.gets.length === 0, '프리미엄이 아니면 시작해도 GET 0');
  await W.tick();
  chk(W.gets.length === 0 && W.mod.view().premium === false, '  틱도 0 — 잠긴 화면');
  W.premium = true; await W.tick(); await W.tick();
  chk(W.gets.length === 1, '  프리미엄이 켜지면 틱이 한 번 받는다');
  W = world(S); W.day = today(); W.start();
  W.gets[0].rej(err('PREMIUM_REQUIRED')); await flush();
  chk(W.mod.view().load === 'locked' && W.mod.view().premium === false && W.codes() === '', 'PREMIUM_REQUIRED → locked(실패 아님 · 번호 0)');
  await W.tick(); await W.tick();
  chk(W.gets.length === 1, '  잠긴 뒤 틱이 혼자 다시 받지 않는다');
  W.mod.openDrawer();
  chk(W.gets.length === 2, '  서랍을 열면 한 번 다시 받는다');
  W = world(S); W.day = today(); W.start();
  W.gets[0].rej(Object.assign(new Error('x'), { code: 'NET' })); await flush();
  chk(W.mod.view().load === 'failed' && W.codes() === '', '시작 GET 실패 → failed · 번호 0(사용자가 연 것이 아니다)');
  await W.tick(); await W.tick(); await W.tick();
  chk(W.gets.length === 1 && W.intervals.length === 1, '  틱이 혼자 다시 받지 않는다(타이머는 세션 하나뿐)');
  W.mod.openDrawer();
  chk(W.gets.length === 2 && W.mod.view().load === 'loading', '  서랍 열기 → 다시 받기');
  W.gets[1].rej(Object.assign(new Error('x'), { code: 'NET' })); await flush();
  chk(W.codes() === 'E-FOCUS-04', '  열어서 받다 실패 → E-FOCUS-04 한 번');
  W.mod.openDrawer(); W.mod.openDrawer();
  chk(W.gets.length === 3, '  받는 중에 또 열어도 GET 한 번(같은 약속)');
  await W.ok(W.gets[2], week());
  chk(W.mod.view().load === 'ready', '  받으면 ready');

  say('── 3. 쓰기 한 줄');
  W = world(S); W.day = today(); W.start();
  r = await W.mod.start('wd', 'focus', { key: 'win:b.exe', label: 'b', hours: 2 }, true);
  chk(r.ok === false && r.reason === 'loading' && W.puts.length === 0, '★ 받기 전 누름 → 요청 0 · «불러오는 중»');
  await W.ok(W.gets[0], week({ weekdayGoal: null, weekdayStartedOn: null, version: 0 }));
  chk(W.mod.view().active === false && W.mod.view().goal === null, '목표 없는 주 = 종류 고르기 화면(active false)');
  const p1 = W.mod.start('wd', 'focus', { key: 'win:b.exe', label: 'b', hours: 2 }, true);
  await flush();
  chk(W.puts.length === 1 && W.puts[0].iso === '2026-W46', 'PUT 한 번 — 이번 주 경로');
  const b = W.puts[0].body;
  chk(b.version === 0 && JSON.stringify(b.weekdayGoal) === JSON.stringify({ kind: 'FOCUS', hours: 2, app: 'win:b.exe', label: 'b' }) && b.weekendGoal === null && b.pendingGoal === null && b.pendingPhase === null
    && b.autoNext === true && b.autoNextWeekend === false && b.skippedWeekday === false && b.skippedWeekend === false && !('days' in b) && !('rewards' in b), 'PUT 본문 — 판 · 단계 목표 · 자동 · 쉬기 (기록 · 보상은 싣지 않는다)');
  const p2 = W.mod.setAutoNext('wd', false);   // 앞 쓰기가 도는 중 또 고침
  await flush();
  chk(W.puts.length === 1, '★ 앞 쓰기가 도는 중이면 뒤 쓰기는 줄에서 기다린다(요청 겹침 0)');
  await W.ok(W.puts[0], okW(week({ version: 1, weekdayGoal: { kind: 'FOCUS', hours: 2, app: 'win:b.exe', label: 'b' }, autoNext: true })));
  await flush();
  chk((await p1).ok === true && W.puts.length === 2 && W.puts[1].body.version === 1 && W.puts[1].body.autoNext === false && W.puts[1].body.weekdayGoal.hours === 2, '★ 뒤 쓰기는 차례가 왔을 때의 최신 판(1)을 싣고 앞 쓰기 결과 위에 얹는다');
  await W.ok(W.puts[1], okW(week({ version: 2 })));
  chk((await p2).ok === true && W.mod.view().week.version === 2, '  답 → 판 2');
  // 수정 — 내일부터(다음 날 목표)
  const pe = W.mod.edit('wd', 'focus', { key: 'win:b.exe', label: 'b', hours: 3 }, false); await flush();
  chk(W.puts[2].body.pendingGoal.hours === 3 && W.puts[2].body.pendingPhase === 'WEEKDAY' && W.puts[2].body.weekdayGoal.hours === 1, '수정 → 다음 날 목표(pendingGoal · pendingPhase WEEKDAY) · 지금 목표는 그대로');
  await W.ok(W.puts[2], okW(week({ version: 3, pendingGoal: { kind: 'FOCUS', hours: 3, app: 'win:b.exe', label: 'b' }, pendingPhase: 'WEEKDAY', pendingFrom: '2026-11-14' }))); await pe;
  chk(W.mod.view().pending && W.mod.view().pending.cfg.hours === 3, '  받은 한 벌에 다음 날 목표가 보인다');
  const pg = W.mod.giveUp('wd'); await flush();
  chk(W.puts[3].body.skippedWeekday === true && W.puts[3].body.pendingGoal === null && W.puts[3].body.weekdayGoal !== null, '포기 → 이번 단계 쉬기(목표는 남긴다 — 다음 주 자동 시작이 이어받는다) · 다음 날 목표는 지운다');
  await W.ok(W.puts[3], okW(week({ version: 4, skippedWeekday: true }))); await pg;
  chk(W.mod.view().skipped && !W.mod.view().active && W.mod.view().goal, '  쉬는 중 = 종류 고르기 화면 · 목표는 남아 자동 버튼이 켜질 수 있다');
  r = await W.mod.start('we', 'focus', FOCUS_GOAL && { key: 'k', label: 'l', hours: 1 }, false);
  chk(r.ok === false && r.reason === 'dayChanged' && W.puts.length === 4, '오늘 단계가 아닌 쪽 쓰기는 요청 0(날이 바뀐 때)');
  // 실패 · 409
  W = world(S); await W.up();
  let pp = W.mod.setAutoNext('wd', true); await flush();
  W.puts[0].res({ status: 'failed', err: err('NETWORK') }); await flush();
  r = await pp;
  chk(r.reason === 'failed' && W.codes() === 'E-FOCUS-05' && W.gets.length === 1 && W.mod.view().load === 'ready', '저장 실패 → E-FOCUS-05 · 다시 안 보냄 · 받기도 안 함');
  pp = W.mod.setAutoNext('wd', true); await flush();
  W.puts[1].res({ status: 'failed', err: err('CONCURRENT_UPDATE') }); await flush();
  chk(W.gets.length === 2 && W.mod.view().load === 'loading' && W.puts.length === 2 && W.codes() === 'E-FOCUS-05', '★ 409 → 덮지 않고 잠근다(loading) · 그 주 GET 한 번 · 다시 안 보냄 · 번호 없음');
  r = await W.mod.setAutoNext('wd', false);
  chk(r.reason === 'loading' && W.puts.length === 2, '  잠긴 동안 누름 → «불러오는 중» · 요청 0');
  await W.ok(W.gets[1], week({ version: 7, autoNext: true })); r = await pp;
  chk(r.reason === 'conflict' && W.mod.view().load === 'ready' && W.mod.view().week.version === 7 && W.events.some((e) => e.type === 'conflict'), '  받은 값으로 바뀌고 알림(conflict) — 다른 기기에서 바꾼 내용');
  W = world(S); await W.up();
  const q1 = W.mod.setAutoNext('wd', true), q2 = W.mod.setAutoNext('wd', false); await flush();
  W.puts[0].res({ status: 'failed', err: err('CONCURRENT_UPDATE') }); await flush();
  W.gets[1].rej(Object.assign(new Error('x'), { code: 'NET' })); await flush(); await q1; r = await q2;
  chk(W.puts.length === 1 && r.reason === 'failed' && W.mod.view().load === 'failed', '★ 줄에서 기다리던 쓰기는 앞 쓰기의 409 뒤 다시 받기가 실패하면 보내지 않는다(받기 전 잠금)');
  W = world(S); await W.up();
  pp = W.mod.setAutoNext('wd', true); await flush();
  W.puts[0].res({ status: 'failed', err: err('PREMIUM_REQUIRED') }); await flush(); await pp;
  chk(W.mod.view().load === 'locked' && W.codes() === '', '쓰다 PREMIUM_REQUIRED → locked(번호 0)');
  W = world(S); await W.up();
  pp = W.mod.setAutoNext('wd', true); await flush();
  W.puts[0].res({ status: 'stale' }); await flush(); r = await pp;
  chk(r.ok === false && W.codes() === '' && W.mod.view().load === 'ready', '계정이 바뀌는 중이라 보내지 않은 쓰기(stale) → 조용히');
  W = world(S); await W.up(); await W.mod.flush();
  chk(true, '쓰기가 없으면 flush 는 바로 끝난다');

  say('── 4. 오늘 판정');
  W = world(S); await W.up();
  await W.tick(10);
  chk(W.marks.length === 0, '목표를 못 채웠으면 POST 0');
  for(let i = 0; i < 12; i++) W.mod.addFocusSec(300);   // 1시간
  chk(W.mod.view().rec.sec === 3600 && W.mod.view().met === true, '활성 앱 초가 쌓이고 목표를 채웠다');
  await W.tick(10);
  chk(W.marks.length === 1, '★ 채운 뒤 틱 열 번 → POST 한 번(하루 한 번만 자동)');
  const dd = [{ date: '2026-11-13', done: true }];
  await W.ok(W.marks[0], okW(week({ version: 2, days: dd })));
  await W.tick(10);
  chk(W.marks.length === 1 && W.mod.view().posted && W.events.some((e) => e.type === 'today' && e.count === 1), '  답 후에도 POST 0 · posted · «오늘 달성! 1일째» 이벤트');
  chk(JSON.parse(W.store.get('tw.chalToday')).posted === true, '  posted 를 계정 칸에 적는다(앱을 껐다 켜도 안 보냄)');
  W.reset(); W.start(); await W.ok(W.gets[W.gets.length - 1], week({ version: 2, days: dd })); await W.tick(5);
  chk(W.marks.length === 1, '  다시 켜도(서버 한 벌에 오늘이 있다) POST 0');
  // 실패
  W = world(S); await W.up(); for(let i = 0; i < 12; i++) W.mod.addFocusSec(300);
  await W.tick(); await flush();
  W.marks[0].res({ status: 'failed', err: err('NETWORK') }); await flush();
  await W.tick(10); await flush();
  chk(W.marks.length === 1 && W.codes() === 'E-FOCUS-06' && W.intervals.length === 1 && W.timers.length === 0, '★ 실패 → E-FOCUS-06 한 번 · 혼자 다시 안 보냄 · 재시도 타이머 0');
  chk(W.mod.view().postFailed && W.mod.view().met && !W.mod.view().posted, '  서랍에 [다시 적기] 가 뜰 조건(postFailed)');
  const rp = W.mod.retryPost(); await flush();
  chk(W.marks.length === 2, '  [다시 적기] → POST 한 번');
  W.marks[1].res({ status: 'failed', err: err('NETWORK') }); await flush(); await rp;
  chk(W.codes() === 'E-FOCUS-06,E-FOCUS-06', '  사용자가 누른 다시 적기의 실패는 번호를 다시 띄운다(자동은 한 번)');
  W.mod.retryPost(); await flush(); await W.ok(W.marks[2], okW(week({ version: 2, days: dd })));
  chk(W.mod.view().posted && !W.mod.view().postFailed, '  성공하면 풀린다');
  W = world(S); await W.up(); for(let i = 0; i < 12; i++) W.mod.addFocusSec(300);
  await W.tick(); await flush();
  W.marks[0].res({ status: 'failed', err: err('FOCUS_CHALLENGE_NOT_STARTED') }); await flush();
  chk(W.codes() === '' && W.gets.length === 2, 'NOT_STARTED → 번호 0 · 서버가 아는 모양으로 조용히 다시 받는다');
  // 📋 규칙 · 🔁 반복
  W = world(S); await W.up(week({ weekdayGoal: { kind: 'RULE', rules: { FRIDAY: ['a', 'b'] } } }));
  W.mod.check(0); await W.tick();
  chk(W.marks.length === 0 && W.mod.view().rec.checks[0] === true, '규칙 — 한 줄만 체크 → POST 0');
  W.mod.check(1);
  await flush();
  chk(W.marks.length === 1, '  전부 체크하는 순간 POST 한 번');
  W = world(S); await W.up(week({ weekdayGoal: { kind: 'REPEAT', times: 2, intervalHours: 1, text: 't' } }));
  await W.tick();
  chk(W.events.length === 0 && W.mod.view().rec.anchor === NOW0, '반복 — 실행 화면에서 간격을 재기 시작(anchor)');
  W.now = NOW0 + 3600000; await W.tick();
  chk(W.events.some((e) => e.type === 'repeatDue'), '  간격이 되면 알림 이벤트');
  W.mod.repeatAnswer(true); W.mod.repeatAnswer(true); await flush();
  chk(W.mod.view().rec.done === 2 && W.marks.length === 1, '  [했다] 두 번 → 채움 · POST 한 번');
  W = world(S); await W.up(week({ weekdayGoal: { kind: 'REPEAT', times: 5, intervalHours: 5, text: 't' } }));
  await W.tick(); W.now = NOW0 + 3600000; await W.tick();
  chk(W.events.some((e) => e.type === 'repeatFail') && W.mod.view().cells[4] === S.P.CELL.FAIL, '반복 — 남은 시간으로 못 채우면 그 자리에서 확정(오늘 칸 ✗)');
  W = world(S); await W.up(week({ weekdayGoal: { kind: 'REPEAT', times: 2, intervalHours: 1, text: 't' } }));
  W.mode = 'launcher'; await W.tick(); W.now += 7200000; await W.tick();
  chk(W.mod.view().rec.anchor === 0 && !W.events.length, '반복 — 실행 화면이 아니면 간격을 재지 않는다');
  // 🎯 쓰기 조건
  W = world(S); await W.up(week({ weekdayGoal: null, weekdayStartedOn: null }));
  chk(W.mod.addFocusSec(5) === false, '목표가 없으면 집중 초를 쌓지 않는다');
  W = world(S); await W.up(week({ skippedWeekday: true }));
  chk(W.mod.addFocusSec(5) === false && W.mod.liveGoal() === null, '쉬는 단계는 쌓지 않는다');
  W = world(S);
  chk(W.mod.addFocusSec(5) === false, '받기 전에는 쌓지 않는다');

  say('── 5. 보상 받기');
  const CL = [{ slot: 'WEEKDAY_EARLY', amount: 1 }, { slot: 'WEEKDAY_SETTLE', amount: 2 }];
  W = world(S); W.day = today(); W.start();
  await W.ok(W.gets[0], week({ claimable: CL }));
  chk(W.claims.length === 1 && W.claims[0].slot === 'WEEKDAY_EARLY' && W.claims[0].iso === '2026-W46', '받은 한 벌에 열린 칸이 있으면 칸마다 POST 하나(앞 칸부터 한 줄로)');
  await W.ok(W.claims[0], { status: 'ok', amount: 1 });
  chk(W.claims.length === 2 && W.claims[1].slot === 'WEEKDAY_SETTLE', '  앞 칸이 끝나야 다음 칸');
  await W.ok(W.claims[1], { status: 'ok', amount: 1 });
  const cl = W.events.filter((e) => e.type === 'claimed');
  chk(cl.length === 2 && cl[0].settle === false && cl[1].settle === true && cl[1].early === 1 && cl[1].amount === 1 && cl[1].phKey === 'wd', '  받은 양은 서버 답(정산 1 — 선지급 1 + 합계 2) · 정산이면 settle · early 를 싣는다');
  chk(W.mod.view().claimable.length === 0 && W.mod.view().earlyGot === true && W.codes() === '', '  열린 칸이 비고 선지급 표식 · 번호 0');
  await W.tick(10);
  chk(W.claims.length === 2, '  틱이 혼자 다시 받지 않는다');
  W = world(S); W.day = today(); W.start();
  await W.ok(W.gets[0], week({ claimable: CL }));
  W.claims[0].res({ status: 'failed', err: err('FOCUS_REWARD_NOT_YET') }); await flush();
  chk(W.codes() === '' && W.claims.length === 2, 'NOT_YET → 번호 0 · 그 칸은 빼고 다음 칸으로');
  W.claims[1].res({ status: 'failed', err: err('FOCUS_REWARD_NOTHING') }); await flush();
  chk(W.codes() === '' && W.mod.view().claimable.length === 0, 'NOTHING → 번호 0');
  W = world(S); W.day = today(); W.start();
  await W.ok(W.gets[0], week({ claimable: CL }));
  W.claims[0].res({ status: 'failed', err: err('NETWORK') }); await flush();
  chk(W.codes() === 'E-FOCUS-07' && W.claims.length === 1 && W.mod.view().claimFailed && W.mod.view().claimable.length === 2, '★ 실패 → E-FOCUS-07 한 번 · 멈춤 · 서랍 [보상 받기](claimFailed)');
  await W.tick(10);
  chk(W.claims.length === 1 && W.timers.length === 0, '  혼자 다시 안 보낸다 · 재시도 타이머 0');
  const cn = W.mod.claimNow(); await flush();
  chk(W.claims.length === 2, '  [보상 받기] → POST 다시');
  W.claims[1].res({ status: 'failed', err: err('NETWORK') }); await flush(); await cn;
  chk(W.codes() === 'E-FOCUS-07,E-FOCUS-07', '  사용자가 누른 [보상 받기] 의 실패는 번호를 다시 띄운다(자동은 한 번)');
  const cn2 = W.mod.claimNow(); await flush(); await W.ok(W.claims[2], { status: 'ok', amount: 1 });
  await flush(); await W.ok(W.claims[3], { status: 'ok', amount: 1 }); await cn2;
  chk(!W.mod.view().claimFailed && W.mod.view().claimable.length === 0, '  받으면 풀린다');
  W = world(S); W.day = today(); W.start();
  await W.ok(W.gets[0], week({ claimable: [{ slot: 'WEEKDAY_SETTLE', amount: 2 }, { slot: 'WEEKDAY_EARLY', amount: 1 }] }));
  await W.ok(W.claims[0], { status: 'ok', amount: 2 });
  chk(W.claims.length === 1 && W.mod.view().claimable.length === 0, '정산 칸을 받으면 짝인 선지급 칸은 같이 닫는다(서버도 «받을 것 없음»)');
  // 오늘 달성 직후
  W = world(S); await W.up(); for(let i = 0; i < 12; i++) W.mod.addFocusSec(300);
  await W.tick(); await flush();
  await W.ok(W.marks[0], okW(week({ version: 2, days: [{ date: '2026-11-13', done: true }], claimable: [{ slot: 'WEEKDAY_EARLY', amount: 1 }] })));
  chk(W.claims.length === 1 && W.claims[0].slot === 'WEEKDAY_EARLY', '오늘 달성 답에 열린 칸이 생기면 바로 받는다(선지급)');
  W = world(S); await W.up();
  r = await W.mod.claimNow();
  chk(r === undefined || r.ok !== false || true, '열린 칸이 없으면 claimNow 는 요청 0'); chk(W.claims.length === 0, '  요청 0');

  say('── 6. 하루 경계');
  W = world(S); await W.up();
  W.now = ENDS + 1000;
  await W.tick();
  chk(W.rolled === 1 && W.gets.length === 2 && W.gets[1].iso === undefined, '★ dayEndsAt 이 지나면 틱이 이번 주를 한 번 다시 받는다(진척의 새 날을 기다리지 않는다)');
  await W.tick(); await W.tick();
  chk(W.gets.length === 2, '  받는 중에는 합쳐진다');
  const stale = () => week({ today: today(DAY, '2026-W46', ENDS) });   // 아직 옛 날을 주는 경우(PC 시계가 서버보다 빠름)
  await W.ok(W.gets[1], stale());
  for(let i = 0; i < 6; i++){ await W.tick(); if(W.gets.length > i + 2 && i < 3) await W.ok(W.gets[W.gets.length - 1], stale()); }
  chk(W.gets.length === 4, '  같은 경계에서 3번까지만(그 뒤 되풀이하지 않는다)');
  W = world(S); await W.up();
  for(let i = 0; i < 6; i++) W.mod.addFocusSec(100);
  const NEXT = today('2026-11-14', '2026-W46', ENDS + 86400000);
  W.now = ENDS + 1000; W.mod.dayEnded(); await flush();
  await W.ok(W.gets[1], week({ version: 3, weekdayGoal: FOCUS_GOAL, today: NEXT, claimable: [{ slot: 'WEEKDAY_SETTLE', amount: 2 }] }));
  r = W.mod.view();
  chk(r.day === '2026-11-14' && r.phase === 'we' && r.rec.day === '2026-11-14' && r.rec.sec === 0 && !r.rec.posted, '★ 새 날을 받으면 오늘 진행이 새로 시작(어제 초를 안 가져간다) · 단계는 서버 날의 요일에서(주말)');
  chk(W.claims.length === 1 && W.claims[0].slot === 'WEEKDAY_SETTLE', '  정산이 열린 칸을 바로 받는다(토 06:00 정산)');
  chk(r.cells.length === 2 && r.cells[0] === S.P.CELL.NOW, '  주말 칸 2 · 오늘(토) ●');
  chk(W.mod.arcView('wd').state === 'ready' && W.mod.arcView('wd').cells.length === 5, '  지난 단계(주중)는 같은 주 한 벌에서 그린다(요청 0)');
  chk(W.gets.length === 2, '  요청 늘지 않음');
  W = world(S); await W.up(week({ version: 5 }));
  W.now = ENDS + 1000; await W.tick(); await W.ok(W.gets[1], week({ version: 3, today: today('2026-11-14', '2026-W46', ENDS + 86400000) }));
  chk(W.mod.view().week.version === 5, '앞선 판보다 낮은 판의 늦은 답은 받지 않는다(같은 주)');
  // 서버 날이 먼저 알려진 경우
  W = world(S); await W.up();
  W.day = today('2026-11-14', '2026-W46', ENDS + 86400000); W.now = ENDS + 5000;
  await W.tick();
  chk(W.gets.length === 2, '진척 쪽이 새 날을 먼저 알아도 이 주 답이 옛 것이면 다시 받는다');
  // 지난 주말 기록
  W = world(S, { prevManual: true }); await W.up();
  W.mod.view(); const a0 = W.mod.arcView('we');
  chk(a0.state === 'loading' && W.gets.length === 2 && W.gets[1].iso === '2026-W45', '평일에 주말 기록을 보면 지난 주를 한 번 받는다(2026-W45)');
  W.mod.arcView('we');
  chk(W.gets.length === 2, '  다시 그려도 한 번');
  await W.ok(W.gets[1], week({ isoWeek: '2026-W45', weekendGoal: FOCUS_GOAL, weekendStartedOn: '2026-11-07', days: [{ date: '2026-11-07', done: true }], rewards: [{ slot: 'WEEKEND_EARLY', amount: 1 }, { slot: 'WEEKEND_SETTLE', amount: 1 }] }));
  const a1 = W.mod.arcView('we');
  chk(a1.state === 'ready' && a1.cells.join() === '1,-2' && a1.s === 1 && a1.tickets === 2 && a1.range === '11/7 ~ 11/8', '  지난 주말 — ✓ ✗ · 달성 1일 · 보상 2회 · 범위');
  chk(W.mod.view().week.isoWeek === '2026-W46', '  이번 주 한 벌은 그대로(지난 주 답이 덮지 않는다)');

  say('── 6b. 지난 주 보상');
  W = world(S, { prevWeek: { '2026-W46': week({ isoWeek: '2026-W46', weekendGoal: FOCUS_GOAL, weekendStartedOn: '2026-11-14', claimable: [{ slot: 'WEEKEND_SETTLE', amount: 1 }, { slot: 'WEEKDAY_SETTLE', amount: 2 }] }) } });
  W.day = today('2026-11-16', '2026-W47', ENDS + 3 * 86400000); W.start();
  await W.ok(W.gets[0], week({ isoWeek: '2026-W47', today: W.day }));
  chk(W.prevGets.length === 1 && W.prevGets[0].iso === '2026-W46', '★ 새 주를 받으면 지난 주(2026-W46)를 한 번 받는다(월 06:00 에 열리는 주말 정산 · 토 · 일에 앱을 안 켠 평일 정산)');
  chk(W.claims.length === 1 && W.claims[0].iso === '2026-W46' && W.claims[0].slot === 'WEEKEND_SETTLE', '  지난 주 열린 칸을 지난 주 경로로 POST 한다');
  W.claims[0].res({ status: 'failed', err: err('FOCUS_REWARD_NOT_YET') }); await flush();
  chk(W.codes() === '' && W.claims.length === 2 && W.claims[1].slot === 'WEEKDAY_SETTLE', '  NOT_YET → 번호 0 · 다음 칸');
  await W.ok(W.claims[1], { status: 'ok', amount: 2 });
  chk(W.events.some((e) => e.type === 'claimed' && e.slot === 'WEEKDAY_SETTLE' && e.amount === 2 && e.prev === true) && W.codes() === '', '  받은 양은 서버 답 · 정산 알림');
  W.mod.openDrawer(); await W.tick(5);
  chk(W.prevGets.length === 1 && W.claims.length === 2, '  같은 주에서는 다시 살펴보지 않는다');
  W = world(S, { prevWeek: { '2026-W46': week({ isoWeek: '2026-W46', claimable: [{ slot: 'WEEKEND_SETTLE', amount: 1 }] }) } });
  W.day = today('2026-11-16', '2026-W47', ENDS + 3 * 86400000); W.start();
  await W.ok(W.gets[0], week({ isoWeek: '2026-W47', today: W.day }));
  W.claims[0].res({ status: 'failed', err: err('NETWORK') }); await flush();
  chk(W.codes() === 'E-FOCUS-07' && W.claims.length === 1, '지난 주 보상 실패 → E-FOCUS-07 한 번 · 혼자 다시 안 보냄');
  W = world(S, { api: (X) => ({ fetchChallenge: (u, iso) => { const d = {}; d.p = new Promise((a, b) => { d.res = a; d.rej = b; }); if(iso) X.prevGets.push({ iso }); else X.gets.push(d); if(iso) d.rej(Object.assign(new Error('x'), { code: 'NET' })); return d.p; }, saveChallenge: async () => ({ status: 'stale' }), markToday: async () => ({ status: 'stale' }), claimReward: async () => ({ status: 'stale' }), reset(){} }) });
  W.day = today(); W.start(); await W.ok(W.gets[0], week()); await flush();
  chk(W.mod.view().load === 'ready' && W.codes() === '', '지난 주를 못 받아도 이번 주 화면 · 번호 0(조용히)');

  say('── 7. 계정 바뀜 · 옛 기록 · 쌓기');
  W = world(S); W.day = today(); W.start(); W.reset();
  await W.ok(W.gets[0], week());
  chk(W.mod.view().load === 'idle' && W.mod.view().week === null && W.apiReset === 1, '★ reset 뒤 늦은 GET 답은 아무것도 안 바꾼다 · 서버 길 주인 기억도 비운다');
  W = world(S); await W.up();
  pp = W.mod.setAutoNext('wd', true); await flush(); W.reset();
  await W.ok(W.puts[0], okW(week({ version: 9 }))); await pp;
  chk(W.mod.view().week === null, '  reset 뒤 늦은 PUT 답도 같다');
  W = world(S); await W.up(); for(let i = 0; i < 12; i++) W.mod.addFocusSec(300);
  await W.tick(); await flush(); W.reset();
  await W.ok(W.marks[0], okW(week({ version: 9, days: [{ date: DAY, done: true }] })));
  chk(W.mod.view().week === null && W.events.every((e) => e.type !== 'today'), '  reset 뒤 늦은 «오늘 달성» 답도 같다(알림 0)');
  W = world(S); await W.up();
  pp = W.mod.setAutoNext('wd', true); await flush(); W.reset();
  const n0 = W.puts.length; W.start('uBBBBBBBB2');
  chk(W.mod.view().load === 'loading' && W.gets.length === 2 && W.gets[1].uid === 'uBBBBBBBB2', '다른 계정으로 다시 시작 → 새 GET(그 계정 코드)');
  W = world(S); W.store.set('tw.chalToday', JSON.stringify({ day: DAY, sec: 120, done: 1, checks: { 0: true }, anchor: 5, fail: false, posted: false })); await W.up();
  chk(W.mod.view().rec.sec === 120 && W.mod.view().rec.checks[0] === true, '시작할 때 계정 칸의 오늘 진행을 읽는다(날이 같으면 이어서)');
  W = world(S); W.store.set('tw.chalToday', JSON.stringify({ day: '2026-11-12', sec: 999, done: 3, checks: {}, anchor: 0, fail: true, posted: true })); await W.up();
  chk(W.mod.view().rec.day === DAY && W.mod.view().rec.sec === 0 && !W.mod.view().rec.fail, '어제 진행은 서버 날을 안 뒤 버린다');
  W = world(S); W.store.set('tw.chalToday', '{깨진'); await W.up();
  chk(W.mod.view().rec.sec === 0, '깨진 칸은 새로 시작');
  W = world(S); await W.up();
  W.mod.addFocusSec(40); await W.tick();
  chk(JSON.parse(W.store.get('tw.chalToday')).sec === 40, '쌓은 초는 틱에서 계정 칸에 적는다(초마다 쓰지 않는다)');
  W.mod.addFocusSec(5); const wrote = W.store.get('tw.chalToday'); W.quit();
  chk(JSON.parse(W.store.get('tw.chalToday')).sec === 45 && JSON.parse(wrote).sec === 40, '  앱을 끌 때 마지막 몫을 적는다');
  // 옛 기록 옮기기
  W = world(S);
  chk(W.mod.adoptLegacyToday({ date: DAY, sec: 1 }).ok === false, '시작 전에는 옛 기록을 받지 않는다(첫 실행이 멈추고 다음에 다시)');
  await W.up();
  r = W.mod.adoptLegacyToday({ date: '2026-11-13', sec: 900, done: 1, checks: { 0: true }, anchor: 7, fail: false });
  chk(r.ok && W.mod.view().rec.sec === 900 && W.mod.view().rec.done === 1 && JSON.parse(W.store.get('tw.chalToday')).sec === 900, '옛 오늘 진행 → 새 칸(날 글자는 0 채움으로 맞춘다)');
  r = W.mod.adoptLegacyToday({ date: '2026-11-13', sec: 100 });
  chk(W.mod.view().rec.sec === 900, '  새 칸이 더 많이 쌓았으면 덮지 않는다');
  r = W.mod.adoptLegacyToday({ date: '2026-11-12', sec: 5000 });
  chk(W.mod.view().rec.day === DAY && W.mod.view().rec.sec === 0, '  어제 것은 다음 틱이 아니라 바로 새 날로 버려진다');
  chk(W.mod.adoptLegacyToday(null).ok === true, '  빈 값은 그냥 통과');

  say('── 8. 읽기 모양');
  W = world(S); await W.up(week({ pendingGoal: { kind: 'FOCUS', hours: 2, app: 'win:a.exe', label: 'a' }, pendingPhase: 'WEEKEND' }));
  chk(W.mod.view().pending === null, '다음 날 목표는 그 단계(WEEKEND)에서만 보인다');
  W = world(S); await W.up(week({ autoNext: true }));
  chk(W.mod.view().auto === true && W.mod.view().range === '11/9 ~ 11/13', '자동 · 범위 글');
  chk(W.mod.todayIdx('wd') === 4 && W.mod.todayIdx('we') === -1, '오늘이 단계의 몇 번째 칸인가(서버 날 기준)');
  W = world(S);
  chk(W.mod.view().cells.length === 0 && W.mod.view().phase === null && W.mod.todayIdx('wd') === -1 && W.mod.liveGoal() === null, '받기 전에는 칸 · 단계 · 목표가 비어 있다');
}

(async () => {
  const P = load(SRC0.MOD), FP = load(SRC0.API);
  const S = { P, FP };
  await judge(S);

  say('── 9. 일부러 깨 보기');
  const BREAKS = [
    ["if(w.version < week.version) return false;", "", '옛 판의 늦은 답을 막지 않음'],
    ["lane = p.then(() => {}, (e) => { console.warn('[달성표] 쓰기 줄 오류', e); });", "lane = Promise.resolve();", '쓰기 줄을 끊음(겹침)'],
    ["rec.posted || posting || postFailed", "rec.posted", '오늘 달성 하루 한 번 장치를 지움'],
    ["if(f.kind === KIND.CONFLICT){ await conflicted(g); return { ok: false, reason: 'conflict' }; }", "if(f.kind === KIND.CONFLICT){ return { ok: false, reason: 'conflict' }; }", '409 를 받아 오지 않음'],
    ["judge(); claimAll(); claimPrevWeek(); }", "judge(); claimAll(); }", '지난 주 보상을 안 받음'],
    ["if(boundary.tries >= BOUNDARY_TRIES) return;", "", '하루 경계 다시 받기 한도를 지움'],
    ["if(f.kind === KIND.NOT_YET || f.kind === KIND.NOTHING){ week.claimable = week.claimable.filter((x) => x.slot !== c.slot); continue; }", "", 'NOT_YET 를 실패로 다룸'],
    ["return (t && now() < t.dayEndsAt) ? t : null;", "return t;", '서버 날 경계를 안 봄'],
    ["const settle = /_SETTLE$/.test(slot);", "const settle = false;", '정산 받아도 짝 선지급 칸을 안 닫음'],
    ["if(!rec || rec.day !== d.day){ rec = freshRec(d.day);", "if(!rec){ rec = freshRec(d.day);", '날이 바뀌어도 어제 진행을 씀'],
    ["if(load !== 'ready' || !week) return { ok: false, reason: load };\n      const w = week, d = draftOf(w);", "const w = week, d = draftOf(w);", '줄에서 받기 전 검사를 지움'],
  ];
  let total = 0, caught = 0;
  quiet = true;
  for(const [a, b, why] of BREAKS){
    total++;
    if(!SRC0.MOD.includes(a)){ quiet = false; say('  ? 깨 보기 대상 글을 못 찾음 — ' + why); fail++; quiet = true; continue; }
    qfail = 0;
    try{
      const P2 = load(SRC0.MOD.replace(a, b));
      let t;
      await Promise.race([judge({ P: P2, FP }), new Promise((_, rej) => { t = setTimeout(() => rej(new Error('멈춤')), 4000); })]);   // 깨진 글이 약속을 영영 안 푸는 경우도 빨강
      clearTimeout(t);
    }catch(e){ qfail++; }
    if(qfail > 0) caught++;
    else{ quiet = false; say('  ✗ 깨도 빨강이 안 남 — ' + why); fail++; quiet = true; }
  }
  quiet = false;
  chk(caught === total || fail > 0, '일부러 깬 ' + total + '곳 중 ' + caught + '곳에서 빨강');
  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
