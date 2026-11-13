/* ═══ ⏱ sim-focus-progress.js — 포커스 진척(서버 값 · 못 올린 초 · 올리기 · 별 색) 실제로 돌려 본다 (0.13 앱 묶음 D5-2) ═══
   focus-progress.js 를 가짜 서버 길(focusApi) · 가짜 계정 칸 · 가짜 세션 위에서 그대로 돌린다. 답은 손으로 풀어 줘서(deferred) «보내는 중» 의 모든 순간을 잡는다.
   ・1절: 시작 — GET 한 번 → loading → ready(레벨 · 회차 · 별은 서버 값) · 실패 → failed + 번호 0 · 다시 받기(창 열기) 실패 → E-FOCUS-01 한 번 · 두 번 시작해도 GET 한 번
   ・2절: 보내는 때 — 599 → 0번 · 600 → 1번 · 레벨 경계(3600)를 넘기는 순간 1번 · 집중 끝남은 60초 이상일 때만 · 켤 때 남은 몫 · 받기 전에는 안 보냄
   ・3절: 한 줄 — 보내는 중 1초씩 쌓기 → 남은 몫 = 쌓인 것 − 보낸 것 · busy 면 again 한 번 · acceptedSec < sent 면 나머지를 버림
   ・4절: 실패 — 미전송분 그대로 · E-FOCUS-02 한 번(이어지는 실패 · 성공하면 풀림) · 타이머 0 · 혼자 다시 보내지 않음
   ・5절: 계정 바뀜 — reset 뒤 늦은 답(GET · 올리기 · 별 색)은 아무것도 안 바꾼다 · A 로 읽고 B 로 바뀐 뒤 쓰기 → 요청 0(진짜 focus-api)
   ・6절: 별 색 — 바로 보이고 · 한 줄 · 실패하면 이전 색 + E-FOCUS-03 · 받기 전 · 팔레트 밖은 거절
   ・7절: 읽기 — 해금 레벨 = 서버 레벨 · 별 모양 · 레벨 막대용 합계(받기 전 null) · 로그아웃 올리기 · 앱 끄기 · 옛 누적 올리기
   ・8절: 배선 — app.js · html · smoke
   ・9절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const SRC0 = {
  MOD: pick(['focus-progress.js', 'parts/focus/focus-progress.js', 'app/parts/focus/focus-progress.js']),
  API: pick(['focus-api.js', 'parts/focus/focus-api.js', 'app/parts/focus/focus-api.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }

const flush = () => new Promise((r) => setImmediate(r));
const TODAY = { day: '2026-11-13', isoWeek: '2026-W46', dayEndsAt: 1763067600000 };
const prog = (total, o) => {
  const C = 999 * 3600;
  return Object.assign({ totalSec: total, level: Math.min(999, 1 + Math.floor(total / 3600)), cycle: Math.floor(total / C), cycleLevel: 1 + Math.floor((total % C) / 3600), starColor: '#ffd76a', today: TODAY }, o || {});
};
const load = (src, timers) => { const w = {}; new Function('window', 'module', 'setTimeout', 'setInterval', src)(w, undefined, timers.setTimeout, timers.setInterval); return w.TwFocusProgress; };

/* 한 판 — 손으로 푸는 가짜 서버 길 · 가짜 계정 칸 · 가짜 세션 */
function world(S, o){
  o = o || {};
  const W = { gets: [], accrues: [], patches: [], notes: [], days: [], store: new Map(), storeWrites: 0, resets: [], quit: [], timers: 0, resetApi: 0 };
  if(o.pending) W.store.set('tw.focusPendingSec', String(o.pending));
  const defer = () => { const d = {}; d.p = new Promise((res, rej) => { d.res = res; d.rej = rej; }); return d; };
  const focusApi = {
    fetchProgress: (uid) => { const d = defer(); W.gets.push(Object.assign(d, { uid })); return d.p; },
    accrue: (uid, n) => { const d = defer(); W.accrues.push(Object.assign(d, { uid, n })); return d.p; },
    setStarColor: (uid, c) => { const d = defer(); W.patches.push(Object.assign(d, { uid, c })); return d.p; },
    reset: () => { W.resetApi++; },
  };
  const store = { get: (k) => (W.store.has(k) ? W.store.get(k) : null), set: (k, v) => { W.storeWrites++; W.store.set(k, String(v)); return true; }, remove: (k) => W.store.delete(k) };
  const timers = { setTimeout: () => { W.timers++; return 0; }, setInterval: () => { W.timers++; return 0; } };
  const T = load(S.MOD, timers);
  const mod = T.createFocusProgress({
    focusApi: o.focusApi ? o.focusApi(W) : focusApi, focusStore: store,
    notifyError: (c, e) => W.notes.push(c), setServerDay: (t) => W.days.push(t),
    addQuitListener: (fn) => W.quit.push(fn),
  });
  const session = { onReset: (fn) => W.resets.push(fn), setInterval: () => { W.timers++; }, setTimeout: () => { W.timers++; } };
  W.T = T; W.mod = mod; W.session = session;
  W.start = (code) => mod.startFocus(code || 'uAAAAAAAA1', { userCode: code || 'uAAAAAAAA1' }, session);
  W.reset = () => W.resets.forEach((f) => f());
  W.ok = async (d, v) => { d.res(v); await flush(); };
  W.up = async (total, extra) => { W.start(); await W.ok(W.gets[0], prog(total || 0, extra)); return W; };   // 시작 → ready
  W.add = (n) => { for(let i = 0; i < n; i++) mod.addSeconds(1); };
  return W;
}
const okAcc = (total, accepted) => ({ status: 'ok', progress: prog(total), acceptedSec: accepted });

async function judge(S){
  let W, r;

  say('── 1. 시작 · 받기');
  W = world(S);
  chk(W.gets.length === 0 && W.timers === 0 && W.mod.progress().load === 'idle', '만들 때는 요청 · 타이머 0 — 시작 전 idle');
  chk(W.mod.getFocusLevel() === 1 && W.mod.myFocusShow() === null && W.mod.shownTotalSec() === null && W.mod.isReady() === false, '  idle — 레벨 막대용 합계 null · 별 없음');
  W.mod.addSeconds(30);
  chk(W.mod.unsentSec() === 0 && W.storeWrites === 0, '  시작 전(계정 칸이 닫힌 때)에는 쌓지도 쓰지도 않는다');
  W.start();
  chk(W.gets.length === 1 && W.gets[0].uid === 'uAAAAAAAA1' && W.mod.progress().load === 'loading' && W.resets.length === 1, '시작 → GET 한 번(내 계정 코드) · loading · 세션 reset 훅 하나');
  W.start();
  chk(W.gets.length === 1 && W.resets.length === 1, '  두 번 시작해도 GET 한 번 · 훅 한 번');
  chk(W.mod.shownTotalSec() === null && W.mod.myFocusShow() === null, '  loading 동안 레벨 막대용 합계는 null(비워 둔다)');
  await W.ok(W.gets[0], prog(7300));
  r = W.mod.progress();
  chk(r.load === 'ready' && r.totalSec === 7300 && r.level === 3 && W.mod.getFocusLevel() === 3 && W.days.length === 1 && W.days[0].isoWeek === '2026-W46', '답 → ready · 서버 레벨 3 · 서버 날(G1)을 넘긴다');
  chk(W.notes.length === 0, '  번호 알림 0');

  W = world(S); W.start();
  W.gets[0].rej(Object.assign(new Error('x'), { code: 'NET' })); await flush();
  chk(W.mod.progress().load === 'failed' && W.notes.length === 0 && W.mod.shownTotalSec() === null && W.mod.isReady() === false, '시작 GET 실패 → failed · 번호 0(사용자가 연 것이 아니다) · 합계 null');
  chk(W.mod.getFocusLevel() === 1 && W.mod.myFocusShow() === null, '  failed — 해금 레벨은 1(잠긴 쪽) · 별 없음 · 화면은 isReady 로 가른다');
  const rl = W.mod.reload(true); await flush();
  chk(W.gets.length === 2 && W.mod.progress().load === 'loading', '창을 열면(reload) 못 받은 상태라 다시 받는다');
  W.mod.reload(true);
  chk(W.gets.length === 2, '  받는 중에 또 열어도 GET 는 하나로 합친다');
  W.gets[1].rej(new Error('y')); await flush(); await rl;
  chk(W.notes.join() === 'E-FOCUS-01' && W.mod.progress().load === 'failed', '★ 사용자가 연 창의 실패 → E-FOCUS-01 한 번');
  W.mod.reload(true); await W.ok(W.gets[2], prog(3600)); await flush();
  chk(W.mod.progress().load === 'ready' && W.mod.getFocusLevel() === 2, '  다시 받기 성공 → ready');
  const n = W.gets.length; W.mod.reload(true);
  chk(W.gets.length === n && W.notes.length === 1, '  ready 일 때 열면 아무 요청도 안 한다');

  say('── 2. 보내는 때');
  W = await world(S).up(0);
  W.add(599);
  chk(W.accrues.length === 0 && W.mod.unsentSec() === 599, '★ 미전송분 599초 → 요청 0');
  W.add(1);
  chk(W.accrues.length === 1 && W.accrues[0].n === 600 && W.accrues[0].uid === 'uAAAAAAAA1', '★ 600초 → 요청 1(deltaSec = 600)');
  W = await world(S).up(3500);
  W.add(99);
  chk(W.accrues.length === 0, '레벨 경계 — 서버 3500 + 미전송 99 = 3599 → 요청 0');
  W.add(1);
  chk(W.accrues.length === 1 && W.accrues[0].n === 100, '★ 3600 을 넘기는 그 초 → 요청 1(레벨업 우편이 바로 오게)');
  await W.ok(W.accrues[0], okAcc(3600, 100)); W.add(5);
  chk(W.accrues.length === 1 && W.mod.getFocusLevel() === 2, '  올린 뒤 경계 안쪽 → 더 안 보낸다 · 레벨은 서버 답으로 2');
  W = await world(S).up(0);
  W.add(59); W.mod.focusEnded();
  chk(W.accrues.length === 0, '집중 끝남 — 59초 남음 → 요청 0');
  W.add(1); W.mod.focusEnded();
  chk(W.accrues.length === 1 && W.accrues[0].n === 60, '★ 집중 끝남 — 60초 → 요청 1');
  W = world(S, { pending: 700 }); W.start();
  chk(W.mod.unsentSec() === 700 && W.accrues.length === 0, '켤 때 — 계정 칸에 남은 700초를 읽는다 · 받기 전에는 안 보낸다');
  await W.ok(W.gets[0], prog(0));
  chk(W.accrues.length === 1 && W.accrues[0].n === 700, '★ 받은 뒤 남은 몫을 한 번 올린다(켤 때 보내기)');
  W = world(S); W.start(); W.add(5);
  W.gets[0].rej(new Error('z')); await flush(); W.add(700); W.mod.focusEnded();
  chk(W.accrues.length === 0 && W.mod.unsentSec() === 705, '받기 못 한 상태 — 쌓기만 하고 보내지 않는다(올릴 길이 없다)');
  const fp0 = W.mod.flushPending(); await flush();
  chk(W.gets.length === 2, '  로그아웃 올리기는 먼저 받기를 한 번 더 해 본다');
  W.gets[1].rej(new Error('n')); await fp0;
  chk(W.accrues.length === 0, '  그래도 못 받으면 올릴 길이 없어 요청 0');

  say('── 3. 한 줄 · 남은 몫');
  W = await world(S).up(0);
  W.add(600);
  W.add(5);
  chk(W.accrues.length === 1 && W.mod.unsentSec() === 605, '보내는 중 1초씩 5번 쌓기 — 요청은 그대로 1 · 합계 605');
  await W.ok(W.accrues[0], okAcc(600, 600));
  chk(W.mod.unsentSec() === 5 && W.storeWrites > 0 && W.store.get('tw.focusPendingSec') === '5', '★ 답 → 남은 몫 = 쌓은 605 − 보낸 600 = 5(계정 칸에도)');
  chk(W.mod.progress().totalSec === 600, '  진척은 답의 값');
  W = await world(S).up(0);
  W.add(600); W.mod.focusEnded(); W.add(30);
  chk(W.accrues.length === 1, '보내는 중에 또 보낼 일(집중 끝남) → again 만 켜고 요청은 그대로 1');
  await W.ok(W.accrues[0], okAcc(600, 600));
  chk(W.accrues.length === 2 && W.accrues[1].n === 30, '★ 끝나면 쌓인 몫(30)을 한 번 더');
  await W.ok(W.accrues[1], okAcc(630, 30));
  chk(W.mod.unsentSec() === 0 && W.accrues.length === 2, '  그 뒤 더 안 보낸다');
  W = await world(S).up(0);
  W.add(600); W.add(5);
  await W.ok(W.accrues[0], okAcc(400, 400));
  chk(W.mod.unsentSec() === 5, '★ 서버가 400 만 받아 줌(acceptedSec 400 < sent 600) → 받지 않은 200 은 버리고 남은 몫은 보내는 중 쌓은 5');
  chk(W.mod.progress().totalSec === 400, '  진척은 서버 값 그대로(앱이 600 으로 고치지 않는다)');
  W = await world(S).up(0);
  W.add(600);
  W.mod.setStarColor('#ff8a8a');
  await W.ok(W.patches[0], { status: 'ok', progress: prog(550, { starColor: '#ff8a8a' }) });
  await W.ok(W.accrues[0], okAcc(600, 600));
  chk(W.mod.progress().totalSec === 550 && W.mod.progress().starColor === '#ff8a8a', '★ 요청 순번 — 더 나중에 보낸 별 색 답이 먼저 와 적용되면 앞서 보낸 올리기 답이 늦게 와도 진척을 못 바꾼다');
  chk(W.mod.unsentSec() === 0, '  그래도 보낸 몫은 뺀다(미전송분은 순번과 상관없이)');

  say('── 4. 실패');
  W = await world(S).up(0);
  W.add(600);
  await W.ok(W.accrues[0], { status: 'failed', err: new Error('500') });
  chk(W.mod.unsentSec() === 600 && W.notes.join() === 'E-FOCUS-02', '★ 올리기 실패 → 미전송분 그대로 · E-FOCUS-02 한 번');
  chk(W.timers === 0 && W.accrues.length === 1, '  재시도 타이머 0 · 혼자 다시 보내지 않는다');
  W.add(600);
  chk(W.accrues.length === 2, '  다음 때(다음 600초 칸)에는 다시 보낸다');
  await W.ok(W.accrues[1], { status: 'failed', err: new Error('500') });
  chk(W.notes.length === 1 && W.mod.unsentSec() === 1200, '★ 이어지는 같은 실패는 번호를 또 안 띄운다');
  W.add(600);
  await W.ok(W.accrues[2], okAcc(1800, 1800));
  chk(W.mod.unsentSec() === 0 && W.notes.length === 1, '  성공하면 몫을 다 올리고');
  W.add(600);
  await W.ok(W.accrues[3], { status: 'failed', err: new Error('x') });
  chk(W.notes.join() === 'E-FOCUS-02,E-FOCUS-02', '  ★ 성공한 뒤의 새 실패는 다시 알린다(성공이 푼다)');
  W = await world(S).up(0);
  W.add(600);
  await W.ok(W.accrues[0], { status: 'stale' });
  chk(W.notes.length === 0 && W.mod.unsentSec() === 600, '읽기 전 · 계정 바뀜으로 못 보냄(stale) → 조용히 그대로(번호 없음)');

  say('── 5. 계정 바뀜');
  W = world(S); W.start(); W.reset();
  await W.ok(W.gets[0], prog(9000));
  chk(W.mod.progress().load === 'idle' && W.mod.getFocusLevel() === 1 && W.days.every((d) => d === null), '★ reset 뒤 늦은 GET 답 → 아무것도 안 바뀐다(idle · 서버 날 안 채움)');
  chk(W.resetApi === 1 && W.days[W.days.length - 1] === null, '  reset 은 서버 길의 «읽은 주인» 도 비우고 서버 날을 비운다');
  W = await world(S).up(0);
  W.add(600); const w0 = W.storeWrites;
  W.reset();
  await W.ok(W.accrues[0], okAcc(600, 600));
  chk(W.mod.unsentSec() === 0 && W.storeWrites === w0 && W.mod.progress().load === 'idle', '★ 올리는 중 reset → 늦은 올리기 답이 새 계정 값을 안 바꾼다(계정 칸에도 안 씀)');
  W.add(600);
  chk(W.accrues.length === 1, '  reset 뒤에는 쌓지도 보내지도 않는다(시작 전 상태)');
  W = await world(S).up(0);
  W.mod.setStarColor('#ff8a8a'); W.reset();
  await W.ok(W.patches[0], { status: 'ok', progress: prog(0, { starColor: '#ff8a8a' }) });
  chk(W.mod.getStarColor() === '#ffd76a' && W.notes.length === 0, '★ 별 색 PATCH 도중 reset → 늦은 답이 아무것도 안 바꾼다 · 알림 0');
  W = await world(S).up(0);
  W.reset(); W.start('uBBBBBBBB2'); await W.ok(W.gets[1], prog(7200));
  W.mod.addSeconds(5);
  chk(W.gets[1].uid === 'uBBBBBBBB2' && W.mod.getFocusLevel() === 3 && W.mod.unsentSec() === 5, '  reset 뒤 다른 계정으로 다시 시작 → 그 계정 값으로 새로(미전송분 0 에서)');
  W = await world(S).up(0); W.add(30);
  W.reset(); W.quit[0]();
  chk(W.accrues.length === 0, '  reset 뒤 앱 끄기 → 요청 0');

  /* 진짜 focus-api 위 — 읽은 토큰 주인과 쓸 때 주인이 다르면 요청이 안 나간다 */
  {
    const apiMod = (() => { const m = { exports: {} }; new Function('module', 'window', S.API)(m, undefined); return m.exports; })();
    const TODAY_ISO = { day: 'd1', isoWeek: '2026-W46', dayEndsAt: '2026-11-14T21:00:00Z' };
    const real = (W) => {
      W.who = { v: 'A' }; W.posts = []; W.apiGets = [];
      const body = (total, color) => ({ totalSec: total, level: 1, cycle: 0, cycleLevel: 1, starColor: color || '#ffd76a', today: TODAY_ISO });
      const guard = (o) => { if(o && o.expectOwner !== W.who.v) throw Object.assign(new Error('owner'), { code: 'OWNER_CHANGED' }); };
      const authed = {
        get: async (path, o) => { W.apiGets.push(path); if(o && o.onOwner) o.onOwner(W.who.v); return body(100); },
        post: async (path, b, o) => { guard(o); W.posts.push(path); return Object.assign(body(700), { acceptedSec: b.deltaSec }); },
        patch: async (path, b, o) => { guard(o); W.posts.push(path); return body(100, b.starColor); },
      };
      return apiMod.createFocusApi({ authed, warn: () => {} });
    };
    const settle = async () => { for(let i = 0; i < 4; i++) await flush(); };
    const W3 = world(S, { focusApi: real });
    W3.start(); await settle();
    chk(W3.mod.progress().load === 'ready' && W3.apiGets.join() === '/v1/me/focus', '진짜 focus-api 위 — 시작 GET /v1/me/focus → ready');
    W3.who.v = 'B';   // 읽은 뒤 로그인한 사람이 바뀜(reset 이 오기 전의 틈)
    W3.add(600); await settle();
    chk(W3.posts.length === 0 && W3.mod.unsentSec() === 600 && W3.notes.length === 0, '★ A 로 읽고 B 로 바뀐 뒤 쓰기 → 서버에 나간 요청 0 · 미전송분 그대로 · 번호 없음');
    W3.mod.setStarColor('#ff8a8a'); await settle();
    chk(W3.posts.length === 0 && W3.mod.getStarColor() === '#ffd76a' && W3.notes.length === 0, '  별 색도 같다(요청 0 · 보이는 색은 서버가 아는 색으로 조용히 돌아온다)');
    const W4 = world(S, { focusApi: real });
    W4.start(); await settle(); W4.add(600); await settle();
    chk(W4.posts.join() === '/v1/me/focus/accruals' && W4.mod.unsentSec() === 0 && W4.mod.progress().totalSec === 700, '  같은 사람이면 나간다(POST /v1/me/focus/accruals · 미전송분 0 · 서버 합계 700)');
  }

  say('── 6. 별 색');
  W = await world(S).up(3600 * 999 * 2 + 3600 * 4);
  chk(W.mod.getStarColor() === '#ffd76a' && JSON.stringify(W.mod.myFocusShow()) === JSON.stringify({ cyc: 2, lv: 5, color: '#ffd76a' }), '회차 2 · 이번 바퀴 5 · 서버 별 색 → 이름표 모양');
  chk(W.mod.setStarColor('#000000') === false && W.mod.setStarColor('red') === false && W.patches.length === 0, '팔레트 밖 색은 거절 — 요청 0');
  chk(W.mod.setStarColor('#8fc8ff') === true && W.mod.getStarColor() === '#8fc8ff' && W.patches.length === 1 && W.patches[0].c === '#8fc8ff', '★ 고르면 바로 보이고 PATCH 한 번');
  W.mod.setStarColor('#6ef0a0'); W.mod.setStarColor('#ffa3c4');
  chk(W.patches.length === 1 && W.mod.getStarColor() === '#ffa3c4', '  보내는 중 두 번 더 골라도 요청은 그대로 1(한 줄) · 보이는 색은 최신');
  await W.ok(W.patches[0], { status: 'ok', progress: prog(0, { cycle: 2, cycleLevel: 5, starColor: '#8fc8ff' }) });
  chk(W.patches.length === 2 && W.patches[1].c === '#ffa3c4' && W.mod.getStarColor() === '#ffa3c4', '★ 끝나면 최신 색으로 한 번 더 · 그 사이 보이는 색은 안 깜빡인다');
  await W.ok(W.patches[1], { status: 'ok', progress: prog(0, { cycle: 2, cycleLevel: 5, starColor: '#ffa3c4' }) });
  chk(W.mod.getStarColor() === '#ffa3c4' && W.notes.length === 0, '  서버가 받은 색이 된다');
  W.mod.setStarColor('#7fe0f0');
  await W.ok(W.patches[2], { status: 'failed', err: new Error('x') });
  chk(W.mod.getStarColor() === '#ffa3c4' && W.notes.join() === 'E-FOCUS-03', '★ 실패 → 이전(서버가 아는) 색으로 되돌리고 E-FOCUS-03');
  W = world(S); W.start();
  chk(W.mod.setStarColor('#8fc8ff') === false && W.patches.length === 0, '받기 전에는 별 색을 못 바꾼다 — 요청 0');

  say('── 7. 읽기 · 올리기 길');
  W = await world(S).up(3600 * 999 * 3 + 5);
  chk(W.mod.getFocusLevel() === 999 && W.mod.myFocusShow().cyc === 3 && W.mod.myFocusShow().lv === 1, '해금 레벨은 서버 레벨(999 에서 멈춘 값 그대로) · 표시는 이번 바퀴');
  W = world(S, { pending: 40 }); await W.start(); await W.ok(W.gets[0], prog(1000));
  chk(W.mod.shownTotalSec() === 1040 && W.mod.progress().totalSec === 1000, '레벨 막대용 합계 = 서버 누적 1000 + 못 올린 40 · 진척의 누적은 서버 값 그대로');
  W = await world(S).up(0); W.add(50);
  const fl = W.mod.flushPending(); await flush();
  chk(W.accrues.length === 1 && W.accrues[0].n === 50, '로그아웃 올리기 — 60초 아래여도 보낸다(미전송분이 있으면 한 번)');
  W.add(5);
  await W.ok(W.accrues[0], okAcc(50, 50)); await fl;
  chk(W.mod.unsentSec() === 5, '  끝난 뒤 남은 몫은 unsentSec 로 본다(로그아웃 검문)');
  W = await world(S).up(0); W.add(50);
  const fl2 = W.mod.flushPending(); await flush();
  await W.ok(W.accrues[0], { status: 'failed', err: new Error('x') }); await fl2;
  chk(W.mod.unsentSec() === 50, '  못 올리면 unsentSec 가 그대로 남아 검문이 막는다');
  W = await world(S).up(0);
  chk(W.quit.length === 1, '앱 끄기 — 끄는 때 부를 함수를 한 번 건다');
  W.add(30); W.quit[0]();
  chk(W.accrues.length === 1 && W.accrues[0].n === 30, '  ready 에서 끄면(30초) 한 번 보낸다 — 기다리지 않는다');
  W = world(S); W.start(); W.add(0); W.quit[0]();
  chk(W.accrues.length === 0, '  받기 전에 끄면 요청 0(남은 몫은 계정 칸에 있다)');
  W = world(S); W.start(); await W.ok(W.gets[0], prog(0));
  const lg = W.mod.legacyAccrue(2000); await flush();
  chk(W.accrues.length === 1 && W.accrues[0].n === 2000, '옛 누적 올리기 — 올리지 않은 몫 2000 을 한 번(미전송분과 따로)');
  await W.ok(W.accrues[0], okAcc(900, 900));
  r = await lg;
  chk(r.ok === true && W.mod.progress().totalSec === 900, '  서버가 900 만 받아도 성공(서버가 «지난번 뒤 흐른 시간 + 60초» 로 자른다)');
  W = world(S); W.start(); await W.ok(W.gets[0], prog(0));
  const lg2 = W.mod.legacyAccrue(2000); await flush();
  await W.ok(W.accrues[0], { status: 'failed', err: new Error('x') });
  r = await lg2;
  chk(r.ok === false && W.notes.length === 0, '  실패 → ok:false(첫 실행이 멈추고 키를 남긴다) · 번호 알림은 첫 실행 몫이 아니다');
  W = world(S); W.start();
  const lg3 = W.mod.legacyAccrue(100); await flush();
  chk(W.accrues.length === 0, '  받기 전에는 기다린다(진척을 받은 뒤에야 올린다)');
  await W.ok(W.gets[0], prog(0)); await flush();
  chk(W.accrues.length === 1 && W.accrues[0].n === 100, '  받으면 올린다'); await W.ok(W.accrues[0], okAcc(100, 100)); await lg3;
  W = world(S); chk((await W.mod.legacyAccrue(100)).ok === false && W.accrues.length === 0, '  시작 전에는 ok:false · 요청 0');

  say('── 8. 배선');
  const A = S.APP;
  const mk = (A.match(/const focusProgressMod = TwFocusProgress\.createFocusProgress\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  chk(/focusApi: TwFocusApi\.createFocusApi\(\{ authed: TwApi\.authed/.test(mk) && /focusStore: accountStoreMod/.test(mk) && /notifyError: \(\.\.\.a\)=>TwErrorCodes\.notify\(\.\.\.a\)/.test(mk) && /setServerDay: \(t\)=>focusTotalMod\.setServerDay\(t\)/.test(mk) && /addQuitListener/.test(mk), 'app.js — 진척 모듈을 서버 길 · 계정 칸 · 오류 번호 · 서버 날에 잇는다');
  chk(/focusLevel: \(code, me, session\)=>focusProgressMod\.startFocus\(code, me, session\),/.test(A), 'app.js — app-boot 의 focusLevel 차례가 startFocus(code, me, session) — 세션을 넘긴다');
  chk(!/startFocusSync|syncFocusTotalToServer/.test(A), '  옛 시작 · 동기화 부름이 없다');
  chk(/else if\(_focusAccruedLast\) focusProgressMod\.focusEnded\(\);/.test(A), 'app.js — 집중이 끝나는 순간 focusEnded 를 부른다');
  const iP = S.HTML.indexOf('<script src="parts/focus/focus-progress.js"></script>'), iApi = S.HTML.indexOf('<script src="parts/focus/focus-api.js"></script>'), iApp = S.HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iP > 0 && iApp > iP && iApi > 0, 'html — focus-progress.js 를 app.js 앞에');
  chk(/PRELOAD\.push\('focus-progress\.js'\)/.test(S.SMOKE), 'smoke — PRELOAD');
  chk(!/setInterval|setTimeout/.test(S.MOD.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), '모듈에 타이머 코드가 없다(주기 · 재시도 없음)');
}

(async () => {
  await judge(SRC0);

  say('── 9. 일부러 깨 보기');
  const BREAKS = [
    ['MOD', "    if(busy){ again = true; return running; }", "    if(false){ again = true; return running; }", '한 줄(busy)을 빼서 보내는 중에 또 보냄'],
    ['MOD', "            pendingRaw = Math.max(0, pendingRaw - sent);", "            pendingRaw = 0;", '남은 몫 셈을 = 0 으로'],
    ['MOD', "            pendingRaw = Math.max(0, pendingRaw - sent);", "            pendingRaw = Math.max(0, pendingRaw - (r.acceptedSec || sent));", '받아 주지 않은 몫을 안 버리고 남김'],
    ['MOD', "        }while(again && unsent() > 0);", "        }while(false);", 'again 을 지움(끝난 뒤 한 번 더가 없음)'],
    ['MOD', "          if(g !== gen) return;\n          if(r.status === 'ok'){", "          if(r.status === 'ok'){", '올리기 답에서 gen 확인을 뺌(늦은 답이 새 계정을 바꿈)'],
    ['MOD', "        if(g !== gen) return 'skipped';\n        adopt(prog, seq);", "        adopt(prog, seq);", '받기 답에서 gen 확인을 뺌'],
    ['MOD', "const SEND_STEP_SEC = 600; ", "const SEND_STEP_SEC = 500; ", '보내는 칸을 600 이 아닌 값으로'],
    ['MOD', "    if(crossStep || crossLevel) send();", "    if(crossStep) send();", '레벨 경계 보내기를 뺌'],
    ['MOD', "    if(crossStep || crossLevel) send();", "    if(crossLevel) send();", '600초 보내기를 뺌'],
    ['MOD', "    if(started && load === 'ready' && unsent() >= END_MIN_SEC) send();", "    if(started && load === 'ready' && unsent() >= 1) send();", '집중 끝남을 60초 문턱 없이 보냄'],
    ['MOD', "            if(!failShown){ failShown = true; notifyError('E-FOCUS-02', r.err); }", "            notifyError('E-FOCUS-02', r.err);", '이어지는 실패도 번호를 또 띄움'],
    ['MOD', "            failShown = false;\n", "", '성공해도 실패 알림 표시를 안 풂'],
    ['MOD', "            return;   // 미전송분 그대로 · 혼자 다시 보내지 않는다", "            setTimeout(() => send(), 60000); return;", '실패하면 60초 재시도 타이머'],
    ['MOD', "        if(userOpened) notifyError('E-FOCUS-01', e);", "        notifyError('E-FOCUS-01', e);", '시작 때의 실패에도 번호를 띄움'],
    ['MOD', "          starWant = null;   // 서버가 아는 색으로 되돌린다\n", "", '별 색 실패해도 이전 색으로 안 되돌림'],
    ['MOD', "          if(r.status === 'failed') notifyError('E-FOCUS-03', r.err);", "", '별 색 실패 알림이 빠짐'],
    ['MOD', "    if(starBusy){ starAgain = true; changed(); return true; }", "    if(false){ starAgain = true; changed(); return true; }", '별 색 한 줄을 뺌'],
    ['MOD', "    session.onReset(reset);", "", '세션 reset 훅을 안 건다'],
    ['MOD', "    loadNow(false);\n  }", "  }", '시작해도 진척을 안 받음'],
    ['MOD', "    if(seq < appliedSeq) return false;", "", '요청 순번을 안 봄'],
    ['MOD', "  const shownTotalSec = () => (load === 'ready' ? p.totalSec + unsent() : null);", "  const shownTotalSec = () => (load === 'ready' ? p.totalSec : null);", '레벨 막대용 합계에 못 올린 몫을 안 더함'],
    ['MOD', "  const getFocusLevel = () => (load === 'ready' ? p.level : 1);", "  const getFocusLevel = () => (load === 'ready' ? Math.min(p.level, 50) : 1);", '레벨을 앱이 다시 셈'],
    ['MOD', "    if(!started || !(sec > 0)) return;", "    if(!(sec > 0)) return;", '시작 전에도 쌓음'],
    ['MOD', "    setServerDay(prog.today);", "", '서버 날을 안 넘김'],
    ['APP', "focusLevel: (code, me, session)=>focusProgressMod.startFocus(code, me, session),", "focusLevel: ()=>{},", '앱 켜는 차례가 시작을 안 부름'],
    ['HTML', '<script src="parts/focus/focus-progress.js"></script>', '', 'html 에 안 실음'],
  ];
  const caught = [];
  for(const [where, from, to, what] of BREAKS){
    if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
    const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
    quiet = true; qfail = 0;
    try{ await judge(S); }catch(_){ qfail++; }
    quiet = false;
    caught.push([what, qfail]);
  }
  const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
  chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('✗ 검사 자체가 죽음: ' + (e && e.stack || e)); process.exit(1); });
