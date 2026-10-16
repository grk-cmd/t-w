/* ═══ 👥 sim-friends-sub.js — 친구 목록 구독이 부팅이 늦어도 걸리고 · 실패하면 다시 걸리고 · 상태가 «친구 없음» 과 섞이지 않는다 (2026-10-16 신설) ═══
   [제보] v0.11.3 — 친구 목록이 «없음» 인데 추가하면 «이미 친구». Firebase SDK 를 실행 때 gstatic 에서 받아 느린 망이면 준비가 20초를 넘기는데,
     _waitForFirebaseAPI 가 20초 뒤 말없이 포기해 마이홈 구독(친구 · 요청 · 우편)이 영영 안 걸렸다.
   ・1절: 순수 — retryDelayMs(5 → 15 → 30 → 60초 고정 · 경계값) · noticeFor(받기 전 · 못 받음 · 받음)
   ・2절: friends-sub.js — 가짜 subscribe · 타이머로: 불러오는 중 → 받음(빈 목록도 받음) · 실패 → 간격 늘려 다시 · 성공하면 간격 처음부터 ·
         타이머 하나 · 동시 구독 1개 · 멈추면 다 풀림 · 늦은 소식 버림 · 바로 던지거나 바로 실패해도 새지 않음 · 종료 때 멈춤
   ・3절: firebase-init.js subscribeMyFriends 를 떼어 가짜 onValue 로 — 새로 걸면 앞의 것(친구별 4개까지) 다 풀림 · 에러 콜백 · 해제 함수
   ・4절: app.js _waitForFirebaseAPI — 포기 없음(타이머 안 씀) · firebase-ready 를 once 로 기다림 · 이미 준비면 바로
   ・5절: myhome-init.js — 친구 구독이 첫 await(쓰기)보다 먼저 · 쓰기가 영영 안 끝나도 구독은 걸림 · subscribeMyFriends 를 직접 안 부름
   ・6절: 일부러 깨 보기 — 하나라도 못 잡으면 빨강
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  FS: pick(['friends-sub.js', 'parts/myhome/friends-sub.js', 'app/parts/myhome/friends-sub.js']),
  FB: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  MI: pick(['myhome-init.js', 'parts/myhome/myhome-init.js', 'app/parts/myhome/myhome-init.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }

/* 가짜 타이머 — 시간은 손으로 돌린다 */
function mkTimers(){
  const T = { now: 0, q: [], seq: 0 };
  T.set = (fn, ms) => { const id = ++T.seq; T.q.push({ id, at: T.now + ms, ms, fn }); return id; };
  T.clear = (id) => { T.q = T.q.filter(t => t.id !== id); };
  T.pending = () => T.q.length;
  T.next = () => { T.q.sort((a, b) => a.at - b.at); const t = T.q.shift(); if(!t) return null; T.now = t.at; t.fn(); return t.ms; };
  return T;
}

function loadFS(src){
  const win = {};
  new Function('window', 'module', 'console', src)(win, undefined, { warn(){}, log(){} });
  return win.TwFriendsSub;
}

function judge(S){
  /* ── 1. 순수 ── */
  say('── 1. 순수 — 다시 걸기 간격 · 안내 문구');
  let FS = null;
  try{ FS = loadFS(S.FS); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  chk(FS && typeof FS.createFriendsSub === 'function', '전역 이름 TwFriendsSub · createFriendsSub');
  const d = [0, 1, 2, 3, 4, 50].map(n => FS.retryDelayMs(n));
  chk(d.join() === '5000,15000,30000,60000,60000,60000', '간격 5 → 15 → 30 → 60초, 그 뒤 60초 고정 (' + d.join() + ')');
  chk([-1, NaN, undefined, '2'].map(n => FS.retryDelayMs(n)).join() === '5000,5000,5000,30000', '  경계값 — 음수 · NaN · 없음은 처음 간격 · 글자 숫자는 숫자로');
  chk(FS.noticeFor('ready') === null && FS.noticeFor('loading') === '친구 목록을 불러오는 중이에요' && FS.noticeFor('idle') === FS.noticeFor('loading'),
    '받았으면 null · 받기 전(시작 전 포함)은 «불러오는 중이에요»');
  chk(FS.noticeFor('error') === '친구 목록을 불러오지 못했어요. 잠시 후 다시 시도할게요', '못 받았으면 «불러오지 못했어요. 잠시 후 다시 시도할게요»');

  /* ── 2. 구독 한 벌 ── */
  say('── 2. friends-sub.js — 상태 · 자동 다시 걸기 · 동시 구독 1개');
  const mk = (o) => {
    o = o || {};
    const T = mkTimers();
    const E = { T, subs: [], live: 0, maxLive: 0, statuses: [], got: [], unload: [] };
    E.mod = FS.createFriendsSub({
      subscribe: (id, ok, err) => {
        const s = { id, ok, err, on: true };
        E.subs.push(s); E.live++; E.maxLive = Math.max(E.maxLive, E.live);
        if(o.throwOn && o.throwOn(E.subs.length)) { E.live--; s.on = false; throw new Error('바로 던짐'); }
        if(o.syncFail && o.syncFail(E.subs.length)) err(new Error('바로 실패'));
        return () => { if(s.on){ s.on = false; E.live--; } };
      },
      setTimer: T.set, clearTimer: T.clear,
      onUnload: (fn) => E.unload.push(fn),
    });
    E.last = () => E.subs[E.subs.length - 1];
    E.start = () => E.mod.start('ME', (f) => { E.got.push([E.mod.status(), f]); }, (st) => E.statuses.push(st));
    return E;
  };
  {
    const E = mk();
    chk(E.mod.status() === 'idle' && E.mod.notice() === '친구 목록을 불러오는 중이에요', '시작 전 — idle · 안내는 «불러오는 중»');
    chk(E.unload.length === 1, '  만들 때 종료 정리(beforeunload)를 건다');
    E.start();
    chk(E.mod.status() === 'loading' && E.statuses.join() === 'loading' && E.live === 1 && E.last().id === 'ME', 'start — 불러오는 중 · 구독 1개 · 내 id 로');
    E.last().ok({});
    chk(E.mod.status() === 'ready' && E.mod.notice() === null && E.got.length === 1 && E.got[0][0] === 'ready' && Object.keys(E.got[0][1]).length === 0,
      '빈 목록도 «받음» — 그릴 때 이미 ready(«친구 없음» 은 이때만)');
    E.last().ok({ f1: { name: 'A' } });
    chk(E.got.length === 2 && E.got[1][1].f1 && E.T.pending() === 0, '  바뀔 때마다 넘긴다 · 타이머 없음');
  }
  {
    const E = mk();
    E.start();
    E.last().err(new Error('permission_denied'));
    chk(E.mod.status() === 'error' && E.mod.notice() === FS.NOTICE.error && E.live === 0 && E.T.pending() === 1, '실패 — 못 불러옴 · 구독 풀림 · 다시 걸기 타이머 1개');
    const waits = [];
    for(let i = 0; i < 5; i++){
      waits.push(E.T.next());
      chk(E.live === 1 && E.T.pending() === 0, '  ' + (i + 1) + '번째 다시 걸기 — 구독 1개 · 타이머 0개');
      E.last().err(new Error('x'));
    }
    chk(waits.join() === '5000,15000,30000,60000,60000', '  기다림 5 → 15 → 30 → 60 → 60초 (' + waits.join() + ')');
    chk(E.mod.status() === 'error' && E.statuses.filter(s => s === 'error').length === 1, '  다시 거는 동안 상태는 «못 불러옴» 그대로(깜빡이지 않음)');
    E.T.next(); E.last().ok({ f1: {} });
    chk(E.mod.status() === 'ready' && E.T.pending() === 0 && E.live === 1, '성공 — 멈춘다(타이머 없음) · 구독 1개');
    E.last().err(new Error('y'));
    chk(E.T.q[0] && E.T.q[0].ms === 5000, '  성공 뒤 다시 실패하면 간격은 처음(5초)부터');
    chk(E.maxLive === 1, '  내내 동시 구독은 1개를 넘지 않는다 (최대 ' + E.maxLive + ')');
  }
  {
    const E = mk();
    E.start(); const a = E.last(); E.start(); E.start();
    chk(E.live === 1 && E.maxLive === 1 && !a.on, 'start 를 여러 번 — 앞의 구독을 먼저 푼다(동시 1개)');
    a.ok({ old: {} }); a.err(new Error('late'));
    chk(E.got.length === 0 && E.T.pending() === 0 && E.mod.status() === 'loading', '  풀린 구독의 늦은 소식(목록 · 실패)은 버린다');
    E.mod.stop();
    chk(E.live === 0 && E.mod.status() === 'idle', 'stop(걸려 있을 때) — 구독을 푼다');
    E.start(); E.last().err(new Error('z')); E.mod.stop();
    chk(E.live === 0 && E.T.pending() === 0 && E.mod.status() === 'idle', 'stop — 구독 · 타이머 다 정리');
    E.T.next();
    chk(E.subs.length === 4, '  멈춘 뒤에는 다시 걸지 않는다');
    E.start(); E.last().err(new Error('q')); E.unload[0]();
    chk(E.live === 0 && E.T.pending() === 0, '종료(beforeunload) — 기다리던 다시 걸기도 지운다');
  }
  {
    const E = mk({ throwOn: (n) => n === 1 });
    E.start();
    chk(E.mod.status() === 'error' && E.T.pending() === 1 && E.live === 0, 'subscribe 가 바로 던져도 — 못 불러옴 · 다시 걸기 1개');
    const F = mk({ syncFail: (n) => n === 1 });
    F.start();
    chk(F.mod.status() === 'error' && F.live === 0 && F.T.pending() === 1, '돌아오기 전에 실패를 알려도 — 돌려받은 해제 함수를 불러 새지 않음');
    F.T.next(); F.last().ok({});
    chk(F.mod.status() === 'ready' && F.live === 1, '  다음 다시 걸기에서 받음');
  }

  {
    /* 내 코드 없음(로그인 전 · getMyUserId()=null) — main 과 같은 «아직 친구가 없어요»: 요청 0 · 안내 null(빈 목록을 그린다) */
    const E = mk();
    E.mod.start(null, (f) => E.got.push(f), (st) => E.statuses.push(st));
    for(let i = 0; i < 5; i++) E.T.next();
    const r0 = {};
    chk(E.subs.length === 0 && E.T.pending() === 0 && E.mod.status() === 'ready' && E.mod.notice() === null && r0 && !Object.keys(r0).length,
      '내 코드 없음 — 요청 0(구독 · 읽기 · 다시 걸기) · «친구 없음»(안내 null → 화면은 «아직 친구가 없어요»)');
  }
  /* ── 3. firebase-init.js subscribeMyFriends ── */
  say('── 3. firebase-init.js subscribeMyFriends — 동시 하나 · 에러 콜백 · 해제');
  const i0 = S.FB.indexOf('    subscribeMyFriends(myId, onChange, onError){');
  const i1 = i0 < 0 ? -1 : S.FB.indexOf('\n    },\n', i0);
  chk(i0 > 0 && i1 > i0, 'subscribeMyFriends(myId, onChange, onError) — 에러 콜백을 받는다');
  if(i0 > 0 && i1 > i0){
    const method = S.FB.slice(i0, i1 + 6);
    const R = { live: [], T: mkTimers() };
    const ref = (db, p) => ({ p });
    const onValue = (r, cb, err) => { const l = { p: r.p, cb, err, on: true }; R.live.push(l); return () => { l.on = false; }; };
    const off = (r, ev, cb) => { R.live.filter(l => l.p === r.p && l.cb === cb).forEach(l => { l.on = false; }); };
    let fb = null;
    try{
      fb = new Function('ref', 'onValue', 'off', 'db', 'setTimeout', 'clearTimeout', 'console',
        'let _friendListListeners = {}; let _myFriendsOff = null;\nconst api = {\n' + method + '\n};\nreturn api;')(ref, onValue, off, {}, R.T.set, R.T.clear, { warn(){}, log(){} });
    }catch(e){ chk(false, '떼어 굴리기 실패 — ' + e.message); }
    if(fb){
      const on = (p) => R.live.filter(l => l.on && (!p || l.p === p));
      const got = [], errs = [];
      const offA = fb.subscribeMyFriends('ME', (f) => got.push(['A', f]), (e) => errs.push(['A', e]));
      chk(typeof offA === 'function' && on().length === 1 && on()[0].p === 'users/ME/friends' && typeof on()[0].err === 'function', '목록 구독 1개 · onValue 에 에러 콜백 · 해제 함수를 돌려준다');
      const listA = on()[0];
      listA.cb({ val: () => ({ f1: { addedAt: 1 }, f2: { addedAt: 2 } }) });
      chk(on().length === 9, '  친구 2명 → 목록 1 + 친구별 4 × 2 = 9개');
      R.T.next();
      chk(got.length === 1 && Object.keys(got[0][1]).join() === 'f1,f2', '  묶어서 한 번 넘긴다');
      const offB = fb.subscribeMyFriends('ME', (f) => got.push(['B', f]), (e) => errs.push(['B', e]));
      chk(on().length === 1 && on()[0] !== listA, '다시 걸면 앞의 것(목록 · 친구별)을 다 풀고 새 목록 1개만');
      listA.cb({ val: () => ({ f3: {} }) }); R.T.next();
      chk(on().length === 1 && !got.some(g => g[0] === 'A' && g[1].f3), '  풀린 구독의 늦은 소식은 아무것도 안 건다');
      const listB = on()[0];
      listB.cb({ val: () => null }); R.T.next();
      chk(got.length === 2 && got[1][0] === 'B' && Object.keys(got[1][1]).length === 0, '빈 목록도 넘긴다(받음 · 친구 없음)');
      listB.cb({ val: () => ({ f1: {} }) });
      chk(on().length === 5, '  친구 1명 → 5개');
      listB.err(new Error('permission_denied'));
      chk(on().length === 0 && errs.length === 1 && errs[0][0] === 'B', '거부 · 끊김 — 친구별까지 다 풀고 onError 한 번');
      offB(); offA();
      chk(on().length === 0, '  해제 함수는 몇 번 불러도 탈 없음');
      const offC = fb.subscribeMyFriends('ME', () => {}, () => {});
      offC();
      chk(on().length === 0 && R.T.pending() === 0, '해제하면 목록 구독 · 그리기 타이머까지 남지 않음');
    }
  }

  /* ── 4. app.js _waitForFirebaseAPI ── */
  say('── 4. app.js _waitForFirebaseAPI — 포기 없음 · firebase-ready 기다림');
  const w0 = S.APP.search(/^function _waitForFirebaseAPI\(/m);
  const w1 = w0 < 0 ? -1 : S.APP.indexOf('\n}\n', w0);
  chk(w0 > 0 && w1 > w0, '정의가 app.js 에 한 벌');
  if(w0 > 0 && w1 > w0){
    const fnSrc = S.APP.slice(w0, w1 + 2);
    const run = (ready) => {
      const L = [], timers = [];
      const win = { firebaseAPI: ready ? { subscribeMyFriends(){} } : undefined, addEventListener: (t, fn, o) => L.push({ t, fn, o }) };
      const wait = new Function('window', 'setTimeout', 'setInterval', 'with(window){\n' + fnSrc + '\nreturn _waitForFirebaseAPI;\n}')(win, (f, ms) => { timers.push(ms); return 1; }, (f, ms) => { timers.push(ms); return 1; });
      let n = 0;
      wait(() => { n++; });
      return { L, timers, win, n: () => n };
    };
    try{
      const a = run(true);
      chk(a.n() === 1 && a.L.length === 0 && a.timers.length === 0, '이미 준비 — 바로 부른다 · 기다리지 않음');
      const b = run(false);
      chk(b.n() === 0 && b.timers.length === 0, '준비 전 — 부르지 않고 · 타이머를 안 쓴다(몇 초 뒤 포기하는 길이 없다)');
      chk(b.L.length === 1 && b.L[0].t === 'firebase-ready' && b.L[0].o && b.L[0].o.once === true, '  firebase-ready 를 { once:true } 로 기다린다');
      b.win.firebaseAPI = { subscribeMyFriends(){} };
      if(b.L[0]) b.L[0].fn({});
      chk(b.n() === 1, '  준비되면(30초 뒤라도) 한 번 부른다');
    }catch(e){ chk(false, '굴리기 실패 — ' + e.message); }
  }

  /* ── 5. myhome-init.js — 구독이 쓰기보다 먼저 ── */
  say('── 5. myhome-init.js — 친구 구독이 await 쓰기보다 먼저');
  const body = ((S.MI.match(/async function initMyHome\(\)\{([\s\S]*?)\nreturn \{/) || [])[1] || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');   // 주석 속 «await» 글자는 빼고
  const iStart = body.indexOf('friendsSub.start('), iAwait = body.search(/\bawait\b/);
  chk(iStart > 0 && iAwait > 0 && iStart < iAwait, 'friendsSub.start 가 첫 await 보다 앞');
  chk(!/firebaseAPI\.subscribeMyFriends\(/.test(S.MI), '  subscribeMyFriends 는 friends-sub 로만 건다(두 벌로 걸지 않음)');
  try{
    const any = new Proxy(function(){}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
    const hang = new Promise(() => {});
    const starts = [], renders = [];
    const fbApi = new Proxy({}, { get: (t, k) => k === 'setMyPresenceOnline' ? (() => { throw new Error('presence 던짐'); }) : (() => hang) });
    const win = { _mhGbRefreshWriteUI: () => renders.push('gb') };
    const mod = new Function('window', 'document', 'localStorage', 'firebaseAPI', 'console', S.MI + '\nreturn window.TwMyHomeInit;')(win, any, { getItem: () => null }, fbApi, { warn(){}, log(){} });
    const m = mod.createMyHomeInit({
      MY_FRIEND_CODE_KEY: 'k', _inboxBroadcast: () => ({}), _myFriendRequests: () => ({}), _myHomeFriends: () => ({}), _myHomeReady: () => false,
      _myInbox: () => ({}), _myInboxReady: () => false, _waitForFirebaseAPI: (cb) => cb(), deviceLostMod: any, ensureMyFriendCode: () => hang,
      focusLevelMod: () => ({ _mobileStart(){}, _adoptStarColorFromProfile: () => hang, getFocusLevel: () => 1, myStarProfileOut: () => null }),
      friendManage: any, friendsSub: { start: (id, onF, onS) => starts.push({ id, onF, onS }) }, getDisplayName: () => 'n', getMyUserId: () => 'ME',
      inboxMod: () => ({ renderMyHomeFriendList: () => renders.push('list') }), mhScheduler: any, myHomeOpen: () => false, toast: () => {},
      setInboxBroadcast(){}, setMyFriendRequests(){}, setMyHomeFriends: (v) => renders.push(['set', v]), setMyHomeReady(){}, setMyInbox(){}, setMyInboxReady(){},
    });
    m.initMyHome();
    chk(starts.length === 1 && starts[0].id === 'ME', '프로필 쓰기 · 코드 확보가 영영 안 끝나고 presence 가 던져도 친구 구독은 걸린다');
    if(starts[0]){
      starts[0].onF({ f1: {} });
      chk(JSON.stringify(renders) === JSON.stringify([['set', { f1: {} }], 'list', 'gb']), '  받으면 — 목록 저장 → 친구 탭 그리기 → 방명록 게이트 (예전 순서 그대로)');
      renders.length = 0; starts[0].onS('error');
      chk(renders.join() === 'list', '  상태가 바뀌면 친구 탭을 다시 그린다(«못 불러옴» 안내)');
    }
  }catch(e){ chk(false, '굴리기 실패 — ' + e.message); }
}

judge(SRC0);

say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['FS', '  if(!myId){ _myId = null; _setStatus(STATUS.READY); return; }\n', '', '내 코드 없이 구독(users/null/friends)'],
  ['FS', 'const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];', 'const RETRY_DELAYS_MS = [500, 500];', '간격을 짧게 박음'],
  ['FS', 'function stop(){\n  _clearRetry();', 'function stop(){', '멈춰도 다시 걸기 타이머가 남음'],
  ['FS', 'function stop(){\n  _clearRetry();\n  _gen++;\n  _detach();', 'function stop(){\n  _clearRetry();\n  _gen++;', '멈춰도 구독이 남음'],
  ['FS', '  _fails = 0;\n  _status = STATUS.READY;', '  _status = STATUS.READY;', '성공해도 간격이 안 줄어듦'],
  ['FS', "  return status === STATUS.ERROR ? NOTICE.error : NOTICE.loading;", "  return status === STATUS.ERROR ? NOTICE.error : null;", '불러오는 중을 «받음» 으로'],
  ['FS', 'onUnload(stop);', '', '종료 때 안 멈춤'],
  ['FS', 'function _ok(gen, friends){\n  if(gen !== _gen) return;', 'function _ok(gen, friends){', '늦은 소식을 받아 씀'],
  ['FB', '      if(_myFriendsOff) _myFriendsOff();\n', '', '새로 걸 때 앞의 것을 안 풂(동시 2개)'],
  ['FB', '      }, err=>{\n        teardown();', '      }, err=>{', '거부돼도 친구별 구독이 남음'],
  ['FB', '        if(onError) onError(err);\n', '', '에러를 안 알림'],
  ['APP', "  window.addEventListener('firebase-ready', ()=>cb(), { once:true });", "  setTimeout(()=>_waitForFirebaseAPI(cb), 500);", '예전 폴링으로 되돌림'],
  ['APP', "{ once:true });\n}\n/* 🔇", "{ once:false });\n}\n/* 🔇", 'once 를 뺌'],
  ['MI', '      friendsSub.start(myId,', '      await Promise.resolve();\n      friendsSub.start(myId,', '구독을 await 뒤로'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
