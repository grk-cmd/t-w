/* ═══ 👥 sim-friends-sub.js — 친구 목록 구독이 부팅이 늦어도 걸리고 · 목록을 열 때 다시 걸리고 · 판정은 받은 목록으로 (2026-10-16 신설) ═══
   [제보] v0.11.3 — 친구 목록이 «없음» 인데 추가하면 «이미 친구». Firebase SDK 를 실행 때 gstatic 에서 받아 느린 망이면 준비가 20초를 넘기는데,
     _waitForFirebaseAPI 가 20초 뒤 말없이 포기해 마이홈 구독(친구 · 요청 · 우편)이 영영 안 걸렸다.
   ・1절: 순수 — noticeFor(받기 전 · 못 받음 · 받음) · 판정 대기 상한 상수
   ・2절: friends-sub.js — 가짜 subscribe 로: 불러오는 중 → 받음(빈 목록도 받음) · 실패 → 타이머 0개 · 다시 걸기는 retryIfFailed(목록 열 때)만 ·
         동시 구독 1개 · 멈추면 다 풀림 · 늦은 소식 버림 · 바로 던지거나 바로 실패해도 새지 않음 · 종료 때 멈춤
   ・2-2절: friendsForCheck — ready 면 읽기 0회 · 못 받음이면 1회(동시 N번도 1회) · 연결 시도 중이면 상한 전 0회 · 상한 넘으면 1회 ·
         실패면 null + 토스트 한 번 · 늦은 읽기가 구독 값을 안 덮음 · 읽는 중 다시 걸기는 끝난 뒤로
   ・2-3b절: 새 친구 — 켠 뒤 늘어난 id 만 readFriend 로 한 명씩(listFriends 다시 안 부름) · 진행 중 · 실패 · 없음도 친구당 한 번 · 지난 실행 버림 ·
         실패면 자리표시 · 첫 구독 값 · 첫 받기 중엔 안 묻음 · 다시 받은 목록에 없는 새 친구는 알던 이름 남김
   ・2-4절: 접속 상태 — 목록이 열려 있는 동안만 듣는다(평소 0 · 열면 1벌 · 닫으면 0) · 그 친구만 한 번 읽기(refreshPresence)
   ・3절: firebase-init.js 친구 함수를 떼어 가짜 onValue 로 — 목록 구독 1개(친구별 0) · 새로 걸면 앞의 것 풀림 · 에러 콜백 · 카드 · 접속 상태 · 판정용 읽기 경로
   ・4절: app.js _waitForFirebaseAPI — 포기 없음(타이머 안 씀) · firebase-ready 를 once 로 기다림 · 이미 준비면 바로
   ・5절: myhome-init.js — 친구 구독이 첫 await(쓰기)보다 먼저 · 쓰기가 영영 안 끝나도 구독은 걸림 · subscribeMyFriends 를 직접 안 부름
   ・5-2절: 부르는 곳 — 친구 추가 · 수락은 friendsForCheck 로 판정 · 친구 탭 · 초대 목록을 열 때 retryIfFailed · 다른 파일에 친구 경로 직접 읽기 0곳
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
  UI: pick(['myhome-ui.js', 'parts/myhome/myhome-ui.js', 'app/parts/myhome/myhome-ui.js']),
  FM: pick(['friend-manage.js', 'parts/myhome/friend-manage.js', 'app/parts/myhome/friend-manage.js']),
  RI: pick(['room-invite-ui.js', 'parts/room/room-invite-ui.js', 'app/parts/room/room-invite-ui.js']),
  NET: pick(['net-ready.js', 'parts/shared/net-ready.js', 'app/parts/shared/net-ready.js']),   // 🛰 _waitForFirebaseAPI 가 넘기는 네트워크 준비 기다리기 한 곳
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
/* 5-2절 «직접 읽기 0곳» 이 훑는 렌더러 파일 전부(스테이징 평면의 .js) — firebase-init.js 만 경로를 안다 */
const ALL_JS = fs.readdirSync('.').filter(f => f.endsWith('.js') && !/^sim-|^smoke\.js$|^run\.js$/.test(f)).map(f => [f, read(f) || '']);

/* 가짜 타이머 — 시간은 손으로 돌린다 */
function mkTimers(){
  const T = { now: 0, q: [], seq: 0 };
  T.set = (fn, ms) => { const id = ++T.seq; T.q.push({ id, at: T.now + ms, ms, fn }); return id; };
  T.clear = (id) => { T.q = T.q.filter(t => t.id !== id); };
  T.pending = () => T.q.length;
  T.next = () => { T.q.sort((a, b) => a.at - b.at); const t = T.q.shift(); if(!t) return null; T.now = t.at; t.fn(); return t.ms; };
  return T;
}
const flush = async () => { for(let i = 0; i < 8; i++) await Promise.resolve(); };

function loadFS(src){
  const win = {};
  new Function('window', 'module', 'console', src)(win, undefined, { warn(){}, log(){} });
  return win.TwFriendsSub;
}

async function judge(S){
  /* ── 1. 순수 ── */
  say('── 1. 순수 — 안내 문구 · 대기 상한');
  let FS = null;
  try{ FS = loadFS(S.FS); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  chk(FS && typeof FS.createFriendsSub === 'function', '전역 이름 TwFriendsSub · createFriendsSub');
  chk(FS.SUB_WAIT_MS === 3000, '연결 시도 중인 구독을 판정이 기다리는 상한 3초(모듈 위 상수)');
  chk(!('retryDelayMs' in FS) && !('RETRY_DELAYS_MS' in FS), '  시간 간격 재시도(5 → 15 → 30 → 60초)는 걷었다');
  chk(FS.noticeFor('ready') === null && FS.noticeFor('loading') === '친구 목록을 불러오는 중이에요' && FS.noticeFor('idle') === FS.noticeFor('loading'),
    '받았으면 null · 받기 전(시작 전 포함)은 «불러오는 중이에요»');
  chk(FS.noticeFor('error') === '친구 목록을 불러오지 못했어요.\n잠시 후 다시 시도할게요', '못 받았으면 «불러오지 못했어요.⏎잠시 후 다시 시도할게요»(두 문장 사이 줄바꿈)');
  chk(FS.NOTICE.checkFail === '친구 목록을 불러오지 못했어요.\n잠시 후 다시 눌러 주세요', '판정용 읽기 실패 토스트 «불러오지 못했어요.⏎잠시 후 다시 눌러 주세요»(두 문장 사이 줄바꿈 — toast pre-line)');

  /* ── 2. 구독 한 벌 ── */
  say('── 2. friends-sub.js — 상태 · 목록 열 때만 다시 걸기 · 동시 구독 1개');
  const mk = (o) => {
    o = o || {};
    const T = mkTimers();
    const E = { T, subs: [], live: 0, maxLive: 0, statuses: [], got: [], unload: [], fetches: [], lists: [], ones: [], pres: [], presLive: 0, reads: [], friends: {}, toasts: [], sets: 0 };
    E.mod = FS.createFriendsSub({
      subscribe: (id, ok, err) => {
        const s = { id, ok, err, on: true };
        E.subs.push(s); E.live++; E.maxLive = Math.max(E.maxLive, E.live);
        if(o.throwOn && o.throwOn(E.subs.length)) { E.live--; s.on = false; throw new Error('바로 던짐'); }
        if(o.syncFail && o.syncFail(E.subs.length)) err(new Error('바로 실패'));
        return () => { if(s.on){ s.on = false; E.live--; } };
      },
      fetchOnce: (id) => new Promise((res, rej) => { E.fetches.push({ id, res, rej }); }),
      listFriends: (id) => new Promise((res, rej) => { const l = { id, res, rej }; E.lists.push(l); if(o.failList) rej(new Error('offline')); else if(!o.holdList) res(Object.assign({}, o.details)); }),   // 받을 때마다 새 객체(서버가 주는 것처럼)
      readFriend: (fid) => new Promise((res, rej) => { E.ones.push({ fid, res, rej }); }),
      watchPresence: (id, ids, cb) => { const w = { id, ids: ids.slice(), cb, on: true }; E.pres.push(w); E.presLive++; return () => { if(w.on){ w.on = false; E.presLive--; } }; },
      readPresence: (fid) => { E.reads.push(fid); if(o.readFail) return Promise.reject(new Error('offline')); return Promise.resolve({ online: true, room: 'R-' + fid }); },
      current: () => E.friends,
      setFriends: (v) => { E.sets++; E.friends = v; },
      getMyUserId: () => (o.noUid ? null : 'ME'),
      toast: (m) => E.toasts.push(m),
      setTimer: T.set, clearTimer: T.clear,
      onUnload: (fn) => E.unload.push(fn),
    });
    E.last = () => E.subs[E.subs.length - 1];
    E.start = () => E.mod.start('ME', (f) => { E.friends = f; E.got.push([E.mod.status(), f]); }, (st) => E.statuses.push(st));
    return E;
  };
  {
    const E = mk();
    chk(E.mod.status() === 'idle' && E.mod.notice() === '친구 목록을 불러오는 중이에요', '시작 전 — idle · 안내는 «불러오는 중»');
    chk(E.unload.length === 1, '  만들 때 종료 정리(beforeunload)를 건다');
    E.start(); await flush();
    chk(E.mod.status() === 'loading' && E.statuses.join() === 'loading' && E.live === 1 && E.last().id === 'ME', 'start — 불러오는 중 · 구독 1개 · 내 id 로');
    E.last().ok({});
    chk(E.mod.status() === 'ready' && E.mod.notice() === null && E.got.length === 1 && E.got[0][0] === 'ready' && Object.keys(E.got[0][1]).length === 0,
      '빈 목록도 «받음» — 그릴 때 이미 ready(«친구 없음» 은 이때만)');
    E.last().ok({ f1: { name: 'A' } });
    chk(E.got.length === 2 && E.got[1][1].f1 && E.T.pending() === 0, '  바뀔 때마다 넘긴다 · 타이머 없음');
    chk(E.mod.retryIfFailed() === false && E.subs.length === 1, '  받은 상태에서 목록을 열어도 다시 걸지 않는다(0회)');
  }
  {
    const E = mk();
    E.start();
    chk(E.mod.retryIfFailed() === false && E.subs.length === 1, '거는 중에 목록을 열어도 하나 더 걸지 않는다');
    E.last().err(new Error('permission_denied'));
    chk(E.mod.status() === 'error' && E.mod.notice() === FS.NOTICE.error && E.live === 0, '실패 — 못 불러옴 · 구독 풀림');
    chk(E.T.pending() === 0, '  타이머 0개 — 시간이 지나도 혼자 다시 걸지 않는다');
    E.T.next();
    chk(E.subs.length === 1, '  (시간을 돌려도 구독 그대로 1번)');
    chk(!/info\/connected|watchConnected/.test(S.FS) && !/info\/connected/.test(S.MI), '  연결 복귀로는 다시 걸지 않는다(연결 감시를 두지 않음 — 재구독 0회)');
    chk(E.mod.retryIfFailed() === true && E.subs.length === 2 && E.live === 1 && E.mod.status() === 'loading', '목록을 열면 — 다시 걸기 1회 · 불러오는 중');
    chk(E.mod.retryIfFailed() === false && E.subs.length === 2, '  거는 중에 또 열어도 1회 그대로');
    E.last().err(new Error('x'));
    chk(E.mod.status() === 'error' && E.T.pending() === 0, '  또 실패 — 못 불러옴 · 타이머 0개');
    E.mod.retryIfFailed(); E.last().ok({ f1: {} });
    chk(E.mod.status() === 'ready' && E.live === 1 && E.maxLive === 1, '다시 열어 받음 — 구독 1개 · 내내 동시 1개 (최대 ' + E.maxLive + ')');
  }
  {
    const E = mk();
    E.start(); const a = E.last(); E.start(); E.start();
    chk(E.live === 1 && E.maxLive === 1 && !a.on, 'start 를 여러 번 — 앞의 구독을 먼저 푼다(동시 1개)');
    a.ok({ old: {} }); a.err(new Error('late'));
    chk(E.got.length === 0 && E.mod.status() === 'loading', '  풀린 구독의 늦은 소식(목록 · 실패)은 버린다');
    E.mod.stop();
    chk(E.live === 0 && E.mod.status() === 'idle', 'stop(걸려 있을 때) — 구독을 푼다');
    chk(E.mod.retryIfFailed() === false && E.subs.length === 3, '  멈춘 뒤에는 목록을 열어도 다시 걸지 않는다');
    E.start(); E.unload[0]();
    chk(E.live === 0 && E.T.pending() === 0, '종료(beforeunload) — 구독 정리 · 타이머 없음');
  }
  {
    const E = mk({ throwOn: (n) => n === 1 });
    E.start();
    chk(E.mod.status() === 'error' && E.live === 0 && E.T.pending() === 0, 'subscribe 가 바로 던져도 — 못 불러옴 · 타이머 0개');
    const F = mk({ syncFail: (n) => n === 1 });
    F.start();
    chk(F.mod.status() === 'error' && F.live === 0, '돌아오기 전에 실패를 알려도 — 돌려받은 해제 함수를 불러 새지 않음');
    F.mod.retryIfFailed(); F.last().ok({});
    chk(F.mod.status() === 'ready' && F.live === 1, '  목록을 열어 다시 걸면 받음');
  }

  /* ── 2-2. 판정용 목록 ── */
  say('── 2-2. friendsForCheck — 받은 목록으로 판정 · 읽기는 한 곳에서 한 번');
  {
    const E = mk(); E.start(); E.last().ok({ f1: { name: 'A' } });
    const r = await E.mod.friendsForCheck();
    chk(r && r.f1 && E.fetches.length === 0, 'ready — 지금 목록 그대로 · 읽기 0회');
  }
  {
    const E = mk(); E.start(); E.last().err(new Error('x'));
    const ps = [1, 2, 3, 4, 5].map(() => E.mod.friendsForCheck());
    await flush();
    chk(E.fetches.length === 1 && E.fetches[0].id === 'ME' && ps.every(p => p === ps[0]), '못 불러옴 — 동시 5번 불러도 읽기 1회 · 모두 같은 Promise');
    E.mod.retryIfFailed();
    chk(E.subs.length === 1, '  읽는 중에 목록을 열면 지금 다시 걸지 않는다(같은 경로를 동시에 두 번 읽지 않게)');
    E.fetches[0].res({ f1: { addedAt: 1 }, f2: { addedAt: 2 } });
    const rs = await Promise.all(ps);
    chk(rs.every(x => x && Object.keys(x).join() === 'f1,f2') && E.sets === 1 && E.friends.f2 && E.friends.f2.addedAt === 2,
      '  읽은 값으로 판정 · 화면 목록도 채움(setFriends 1회)');
    chk(E.subs.length === 2 && E.live === 1, '  읽기가 끝난 뒤 미뤄 둔 다시 걸기 1회');
    chk(E.mod.status() === 'loading', '  한 번 읽은 값은 «받음» 으로 치지 않는다(캐시 안 함)');
    E.last().err(new Error('y'));
    E.mod.friendsForCheck(); await flush();
    chk(E.fetches.length === 2, '  다음 판정은 다시 읽는다(1회)');
  }
  {
    const E = mk(); E.start(); E.last().err(new Error('x'));
    const p = E.mod.friendsForCheck(); await flush();
    E.fetches[0].rej(new Error('offline'));
    const r = await p;
    chk(r === null && E.toasts.length === 1 && E.toasts[0] === FS.NOTICE.checkFail && E.sets === 0, '읽기 실패 — null(부르는 쪽은 아무것도 안 보냄) · 토스트 한 번 · 목록 안 건드림');
  }
  {
    const E2 = mk(); E2.start(); E2.last().err(new Error('x'));
    E2.friends = {};
    const p2 = E2.mod.friendsForCheck(); await flush();
    /* 읽는 사이에 구독이 붙어 값이 온다(다른 길로 다시 건 경우) */
    E2.mod.start('ME', (f) => { E2.friends = f; }, () => {});
    E2.last().ok({ fresh: { name: 'N' } });
    E2.fetches[0].res({ old: {} });
    const r2 = await p2;
    chk(r2 && r2.fresh && !r2.old && E2.sets === 0 && E2.friends.fresh && !E2.friends.old, '늦게 끝난 읽기는 그 사이 온 구독 값을 덮지 않는다 · 판정도 구독 값으로');
  }
  {
    const E = mk(); E.start();
    const ps = [E.mod.friendsForCheck(), E.mod.friendsForCheck(), E.mod.friendsForCheck()];
    await flush();
    chk(E.fetches.length === 0 && E.T.pending() === 1 && E.T.q[0].ms === FS.SUB_WAIT_MS, '연결 시도 중 — 상한 전 읽기 0회 · 기다림 타이머 1개(3초)');
    E.last().ok({ f9: { name: 'Z' } });
    const rs = await Promise.all(ps);
    chk(rs.every(r => r && r.f9) && E.fetches.length === 0 && E.T.pending() === 0, '  구독 값이 오면 그걸로 판정 · 읽기 0회 · 타이머 정리');
  }
  {
    const E = mk(); E.start();
    const p = E.mod.friendsForCheck(); await flush();
    E.T.next(); await flush();
    chk(E.fetches.length === 1, '연결 시도 중 — 상한(3초)을 넘으면 그때 읽기 1회');
    E.fetches[0].res({}); const r = await p;
    chk(r && Object.keys(r).length === 0, '  빈 목록도 판정에 쓴다');
  }
  {
    const E = mk(); E.start();
    const p = E.mod.friendsForCheck(); await flush();
    E.last().err(new Error('x')); await flush();
    chk(E.fetches.length === 1 && E.T.pending() === 0, '기다리는 중 구독이 실패하면 — 상한을 안 기다리고 바로 읽기 1회');
    E.fetches[0].res({ a: {} }); await p;
  }

  /* ── 2-3. 이름 · 사진 받기 · 목록 열기/닫기 ── */
  say('── 2-3. 이름 · 사진 — 켤 때 한 번 · 목록을 열 때 다시(서버부터) · 열려 있는 동안만 다시 그리기');
  {
    const m = FS.mergeFriends({ a: { addedAt: 1 }, b: { addedAt: 2 } }, { a: { name: 'A', level: null, bio: undefined }, z: { name: 'Z' } });
    chk(Object.keys(m).join() === 'a,b' && m.a.name === 'A' && m.a.level === null && m.a.addedAt === 1 && !('bio' in m.a),
      'mergeFriends(순수) — 목록에 있는 친구만(받은 이름 목록에만 있는 z 는 버림) · null 은 덮고 undefined 는 안 덮음');
    chk(m.b.name === '...' && m.b.online === false && m.b.lastSeen === 0 && m.b.addedAt === 2, '  ↳ 이름을 아직 못 받은 친구는 예전 자리표시(\'...\' · 오프라인)');
    chk(JSON.stringify(FS.mergeFriends({}, { a: {} })) === '{}' && JSON.stringify(FS.mergeFriends(null, null)) === '{}', '  ↳ 빈 목록 · 없음 → {}');
    const f = FS.friendOf({ addedAt: 1, name: 'old' }, { name: 'new' }, { online: true });
    chk(f.name === 'new' && f.online === true && f.addedAt === 1, 'friendOf — 칸 → 이름 · 사진 → 접속 상태 순서로 얹는다');
  }
  {
    const E = mk({ holdList: true, details: {} });
    E.start(); await flush();
    chk(E.lists.length === 1 && E.lists[0].id === 'ME', '켤 때 이름 받기 1회(내 id)');
    E.last().ok({ f1: { addedAt: 1 } });
    chk(E.mod.status() === 'ready' && E.mod.notice() === FS.NOTICE.loading, '  목록은 받았어도 첫 이름 받기 동안은 «불러오는 중이에요»');
    E.mod.open('tab', () => {}); await flush();
    chk(E.lists.length === 1, '  첫 받기 중에 목록을 열어도 하나 더 묻지 않는다(같이 기다림)');
    E.lists[0].res({ f1: { name: 'A', level: 3 }, gone: { name: 'X' } }); await flush();
    const g = E.got[E.got.length - 1][1];
    chk(E.mod.notice() === null && g.f1.name === 'A' && g.f1.level === 3 && !g.gone, '  받으면 목록에 얹어 다시 그린다 · 안내 없음');
    E.mod.close('tab');
    E.mod.open('tab', () => {}); await flush();
    chk(E.lists.length === 2, '목록을 다시 열면 — 이름 다시 받기 1회(서버부터)');
    E.lists[1].rej(new Error('offline')); await flush();
    const g2 = E.got[E.got.length - 1][1];
    chk(E.mod.notice() === null && g2.f1.name === 'A', '  다시 받기가 실패하면 — 지난 이름 그대로 · 안내 없음');
    E.mod.open('tab', () => {}); await flush();
    chk(E.lists.length === 2, '  열려 있는 목록을 또 열어도(같은 key) 다시 안 받음');
  }
  {
    const E = mk({ holdList: true });
    E.start(); await flush(); E.last().ok({ f1: {} });
    E.lists[0].rej(new Error('x')); await flush();
    chk(E.mod.notice() === null && E.got[E.got.length - 1][1].f1.name === '...', '첫 이름 받기가 실패해도 — 목록은 그린다(자리표시 이름)');
  }
  {
    const E = mk({ holdList: true });
    E.start(); await flush(); E.last().err(new Error('x'));
    E.mod.open('invite', () => {});
    chk(E.subs.length === 2 && E.mod.status() === 'loading', '못 불러온 상태에서 목록을 열면 — 다시 걸기 1회');
    E.lists[0].res({ f1: { name: 'A' } }); await flush();
    chk(E.got.length === 0, '  받기 전에는 이름만 와도 넘기지 않는다(판정용으로 읽은 목록을 빈 값으로 덮지 않게)');
    let n = 0; E.mod.open('invite', () => n++);
    E.last().ok({ f1: {} });
    chk(n === 1 && E.got[0][1].f1.name === 'A', '  열려 있으면 바뀔 때 onUpdate · 이름은 먼저 받은 것을 얹는다');
    E.mod.close('invite'); E.last().ok({ f1: {}, f2: {} });
    chk(n === 1, '  닫은 뒤에는 onUpdate 를 안 부른다');
    let bad = 0; E.mod.open('x', () => { bad++; throw new Error('boom'); }); E.last().ok({ f1: {} });
    chk(bad === 1 && E.got.length === 3, '  다시 그리기가 던져도 목록 넘기기는 그대로');
  }
  {
    const E = mk({ holdList: true });
    E.start(); await flush(); E.last().ok({});
    const first = E.lists[0];
    E.mod.stop(); E.start(); await flush(); E.last().ok({ f1: {} });
    first.res({ f1: { name: 'OLD' } }); await flush();
    chk(E.lists.length === 2 && E.got[E.got.length - 1][1].f1.name !== 'OLD' && E.mod.notice() === FS.NOTICE.loading, '멈추고 다시 켜면 — 지난 실행의 늦은 이름은 버린다(이번 받기는 그대로 기다림)');
  }

  /* ── 2-3b. 새 친구 — 그 친구만 한 명 받기 ── */
  say('── 2-3b. 새 친구 — 켠 뒤 늘어난 친구만 readFriend 로(목록 전체를 다시 받지 않음)');
  const lastF = (E) => E.got[E.got.length - 1][1];
  {
    const E = mk({ details: { f1: { name: 'A' } } });
    E.start(); await flush(); E.last().ok({ f1: { addedAt: 1 } }); await flush();
    chk(E.ones.length === 0 && lastF(E).f1.name === 'A', '켤 때 — 이름은 목록 받기로 · 한 명 받기 0회');
    E.last().ok({ f1: { addedAt: 1 }, f2: { addedAt: 2 } }); await flush();
    chk(E.ones.map(x => x.fid).join() === 'f2' && E.lists.length === 1, '★ 친구가 늘면 — 그 친구만 한 명 받기 1회 · listFriends 는 다시 안 부름');
    chk(lastF(E).f2.name === '...', '  받기 전에는 자리표시(\'...\')');
    E.last().ok({ f1: { addedAt: 1 } }); E.last().ok({ f1: { addedAt: 1 }, f2: { addedAt: 2 } }); await flush();
    chk(E.ones.length === 1, '★ 받는 중에 같은 친구가 빠졌다 다시 들어와도 또 안 묻는다(진행 중 겹치기 없음)');
    E.ones[0].res({ name: 'B', level: 2, bio: '' }); await flush();
    const g = lastF(E);
    chk(g.f2.name === 'B' && g.f2.level === 2 && g.f2.addedAt === 2 && g.f1.name === 'A', '★ 받으면 그 친구 이름 · 레벨을 얹어 다시 그린다(다른 친구 그대로)');
    E.mod.open('tab', () => {}); await flush();
    chk(E.lists.length === 2 && lastF(E).f2.name === 'B' && lastF(E).f1.name === 'A', '  다시 받은 목록에 새 친구가 없어도(서버 사본이 늦음) 알던 이름을 남긴다');
    E.last().ok({ f1: { addedAt: 1 }, f2: { addedAt: 2 }, f3: { addedAt: 3 }, f4: { addedAt: 4 } }); await flush();
    chk(E.ones.map(x => x.fid).join() === 'f2,f3,f4', '  여럿이 한꺼번에 늘면 늘어난 친구마다 1회');
    E.ones[1].rej(new Error('offline')); E.ones[2].res(null); await flush();
    chk(lastF(E).f3.name === '...' && lastF(E).f4.name === '...' && E.T.pending() === 0, '★ 실패 · 없음(null) — 자리표시 그대로 · 타이머 재시도 없음');
    E.last().ok({ f1: {}, f2: {}, f4: {} }); E.last().ok({ f1: {}, f2: {}, f3: {}, f4: {} }); await flush();
    chk(E.ones.length === 3, '  실패한 친구도 이번 실행에선 다시 안 묻는다(다음 목록 받기가 채운다)');
  }
  {
    const E = mk({ details: {} });
    E.start(); await flush(); E.last().ok({ f1: {} }); await flush();
    E.last().ok({ f1: {}, f2: {} }); await flush();
    const old = E.ones[0];
    E.mod.stop(); E.start(); await flush(); E.last().ok({ f1: {}, f2: {} }); await flush();
    old.res({ name: 'OLD' }); await flush();
    chk(E.ones.length === 1 && lastF(E).f2.name === '...', '★ 멈추고 다시 켜면 — 지난 실행의 늦은 한 명 받기는 버린다 · 새 실행의 첫 구독 값은 새 친구가 아님');
  }
  {
    const E = mk({ failList: true });
    E.start(); await flush(); E.last().ok({ f1: {}, f2: {}, f3: {} }); await flush();
    chk(E.ones.length === 0 && lastF(E).f1.name === '...', '★ 첫 목록 받기가 실패해도 — 첫 구독 값의 친구를 한 명씩 묻지 않는다(n회 폭주 없음)');
    E.last().ok({ f1: {}, f2: {}, f3: {}, f9: {} }); await flush();
    chk(E.ones.map(x => x.fid).join() === 'f9', '  그 뒤 늘어난 친구만 한 명 받기');
  }
  {
    const E = mk({ holdList: true });
    E.start(); await flush(); E.last().ok({ f1: {} }); E.last().ok({ f1: {}, f2: {} }); await flush();
    chk(E.ones.length === 0, '첫 목록 받기 중에 늘어난 친구는 — 그 받기가 채운다(한 명 받기 0회)');
  }

  /* ── 2-4. 접속 상태 — 목록이 열려 있는 동안만 ── */
  say('── 2-4. 접속 상태 — 목록이 열려 있는 동안만 듣는다 · 닫힌 동안은 그 친구만 한 번 읽기');
  {
    const E = mk(); E.start(); await flush();
    E.last().ok({ f1: {}, f2: {} }); await flush();
    chk(E.presLive === 0 && E.pres.length === 0, '★ 평소(목록 닫힘) — 접속 상태 구독 0 (상시 구독은 목록 1개뿐)');
    let n = 0; E.mod.open('myhome', () => n++);
    chk(E.presLive === 1 && E.pres[0].ids.join() === 'f1,f2' && E.pres[0].id === 'ME', '★ 목록을 열면 — 친구 전원을 한 벌로(1 + n)');
    E.mod.open('invite', () => {});
    chk(E.presLive === 1 && E.pres.length === 1, '  다른 목록을 또 열어도 한 벌 그대로(겹쳐 걸지 않음)');
    E.pres[0].cb({ f1: { online: true, room: 'PLAY-1', inRoom: true } });
    const g = E.got[E.got.length - 1][1];
    chk(g.f1.online === true && g.f1.room === 'PLAY-1' && g.f2.online === false && n >= 1, '  받은 접속 상태를 목록에 얹어 넘긴다 · 열린 목록 다시 그리기');
    E.last().ok({ f1: {}, f2: {} });
    chk(E.pres.length === 1 && E.presLive === 1, '  친구가 그대로면 다시 걸지 않는다');
    E.last().ok({ f1: {}, f2: {}, f3: {} });
    chk(E.pres.length === 2 && E.presLive === 1 && !E.pres[0].on && E.pres[1].ids.join() === 'f1,f2,f3', '  친구가 늘면 — 풀고 새 목록으로 한 벌(동시 1)');
    E.mod.close('myhome');
    chk(E.presLive === 1, '  하나만 닫으면 — 다른 목록이 열려 있으니 그대로');
    E.mod.close('invite');
    chk(E.presLive === 0, '★ 다 닫으면 — 접속 상태 구독을 푼다(다시 목록 1개)');
    E.last().ok({ f1: {}, f2: {}, f3: {} });
    chk(E.presLive === 0 && E.got[E.got.length - 1][1].f1.online === true, '  닫은 뒤 — 다시 안 건다 · 마지막 접속 상태는 남는다');
    E.pres[1].cb({ f1: { online: false } });
    chk(E.got[E.got.length - 1][1].f1.online === true || E.presLive === 0, '  (풀린 구독은 provider 가 더 안 부른다 — 부르더라도 열린 목록이 없으니 다시 걸지 않음)');
    await E.mod.refreshPresence(['f2', 'f3']);
    chk(E.reads.join() === 'f2,f3' && E.got[E.got.length - 1][1].f2.room === 'R-f2', '★ 닫힌 동안 필요한 곳 — 그 친구만 한 번 읽어 얹는다(refreshPresence)');
    E.mod.open('myhome', () => {});
    E.reads.length = 0;
    await E.mod.refreshPresence(['f1', 'f9']);
    chk(E.reads.join() === 'f9', '  듣고 있는 친구는 다시 안 읽는다');
    E.mod.close('myhome');
    E.mod.stop();
    chk(E.presLive === 0, 'stop — 접속 상태 구독도 푼다');
  }
  {
    const E = mk(); E.start(); await flush();
    E.mod.open('myhome', () => {});
    chk(E.presLive === 0, '받기 전(불러오는 중)에 열어도 — 아직 안 건다');
    E.last().ok({});
    chk(E.presLive === 0, '  친구가 없으면 안 건다');
    E.last().ok({ f1: {} });
    chk(E.presLive === 1, '  받으면(열려 있으니) 건다');
    E.last().err(new Error('x'));
    chk(E.presLive === 0 && E.mod.status() === 'error', '  목록 구독이 끊기면 접속 상태도 푼다');
    E.mod.close('myhome');
    E.mod.open('myhome', () => {});
    E.last().ok({ f1: {} });
    chk(E.presLive === 1, '  다시 열어 받으면 다시 건다');
    const old = E.pres[E.pres.length - 1];
    E.mod.stop();
    chk(E.presLive === 0, '  목록이 열린 채 멈춰도(로그아웃 · 종료) 접속 상태 구독을 푼다');
    E.start(); await flush(); E.last().ok({ f1: {} });
    old.cb({ f1: { online: true } });
    chk(!E.got.some(x => x[1].f1 && x[1].f1.online === true), '  멈춘 뒤 지난 실행의 늦은 접속 상태는 버린다');
  }
  {
    const E = mk({ readFail: true }); E.start(); await flush(); E.last().ok({ f1: {} });
    const before = E.got.length;
    await E.mod.refreshPresence(['f1']);
    chk(E.reads.join() === 'f1' && E.got.length === before + 1 && E.got[E.got.length - 1][1].f1.online === false, '한 번 읽기가 실패해도 — 끝나고 지난 값으로 다시 넘긴다');
    chk((await E.mod.refreshPresence([])) === undefined && E.reads.length === 1, '  빈 목록이면 안 읽는다');
  }

  {
    /* 내 코드 없음(로그인 전 · getMyUserId()=null) — main 과 같은 «아직 친구가 없어요»: 요청 0 · 안내 null(빈 목록을 그린다) */
    const E = mk();
    E.mod.start(null, (f) => E.got.push(f), (st) => E.statuses.push(st));
    for(let i = 0; i < 5; i++) E.T.next();
    E.mod.retryIfFailed();
    const r0 = await E.mod.friendsForCheck();
    chk(E.subs.length === 0 && E.fetches.length === 0 && E.T.pending() === 0 && E.mod.status() === 'ready' && E.mod.notice() === null && r0 && !Object.keys(r0).length,
      '내 코드 없음 — 요청 0(구독 · 읽기 · 다시 걸기) · «친구 없음»(안내 null → 화면은 «아직 친구가 없어요»)');
  }
  {
    /* 내 코드 없음 · 시작 전(idle)에 친구 [추가] — users/null/friends 를 읽지 않는다: 판정 요청 0 · 빈 목록 · 토스트 0 */
    const E = mk({ noUid: true });
    const r0 = await E.mod.friendsForCheck();
    chk(E.fetches.length === 0 && E.subs.length === 0 && E.toasts.length === 0 && r0 && !Object.keys(r0).length,
      '내 코드 없음 · 시작 전 판정 — 요청 0 · 빈 목록 · 토스트 0');
  }
  /* ── 3. firebase-init.js 친구 함수(옛 길) ── */
  say('── 3. firebase-init.js — 목록 구독 하나(친구별 구독 없음) · 카드 한 번 읽기 · 접속 상태 구독 · 한 번 읽기');
  const i0 = S.FB.indexOf('    watchMyFriendList(myId, onChange, onError){');
  const i1 = i0 < 0 ? -1 : S.FB.indexOf('    async getFriendPresence(fid){', i0);
  const i2 = i1 < 0 ? -1 : S.FB.indexOf('\n    },\n', i1);
  chk(i0 > 0 && i1 > i0 && i2 > i1 && S.FB.indexOf('    subscribeMyFriends(') < 0, 'watchMyFriendList · getFriendCard · watchFriendPresence · getFriendPresence — 친구별 4개 구독(subscribeMyFriends)은 없앴다');
  if(i0 > 0 && i2 > i1){
    const method = S.FB.slice(i0, i2 + 6);
    const R = { live: [], gets: [] };
    const ref = (db, p) => ({ p });
    const onValue = (r, cb, err) => { const l = { p: r.p, cb, err, on: true }; R.live.push(l); return () => { l.on = false; }; };
    const get = async (r) => { R.gets.push(r.p); return { val: () => ({ 'users/F/profile': { name: 'N', level: 2 }, 'users/F/home/bio': 'B', 'users/F/home/avatar': 'A', 'users/F/presence': { online: true } })[r.p] }; };
    let fb = null;
    try{
      fb = new Function('ref', 'onValue', 'get', 'db', 'console',
        'let _myFriendsOff = null;\nconst api = {\n' + method + '\n};\nreturn api;')(ref, onValue, get, {}, { warn(){}, log(){} });
    }catch(e){ chk(false, '떼어 굴리기 실패 — ' + e.message); }
    if(fb){
      const on = (p) => R.live.filter(l => l.on && (!p || l.p === p));
      const got = [], errs = [];
      const offA = fb.watchMyFriendList('ME', (f) => got.push(['A', f]), (e) => errs.push(['A', e]));
      chk(typeof offA === 'function' && on().length === 1 && on()[0].p === 'users/ME/friends' && typeof on()[0].err === 'function', '목록 구독 1개 · onValue 에 에러 콜백 · 해제 함수를 돌려준다');
      const listA = on()[0];
      const many = {}; for(let k = 0; k < 100; k++) many['f' + k] = { addedAt: k };
      listA.cb({ val: () => many });
      chk(on().length === 1 && got.length === 1 && Object.keys(got[0][1]).length === 100, '★ 친구 100명이어도 구독은 목록 1개(친구별 구독 0) · 받은 대로 바로 넘긴다');
      const offB = fb.watchMyFriendList('ME', (f) => got.push(['B', f]), (e) => errs.push(['B', e]));
      chk(on().length === 1 && on()[0] !== listA, '다시 걸면 앞의 것을 풀고 새 목록 1개만');
      listA.cb({ val: () => ({ late: {} }) });
      chk(!got.some(g => g[0] === 'A' && g[1].late), '  풀린 구독의 늦은 소식은 버린다');
      const listB = on()[0];
      listB.cb({ val: () => null });
      chk(got[got.length - 1][0] === 'B' && Object.keys(got[got.length - 1][1]).length === 0, '빈 목록도 넘긴다(받음 · 친구 없음)');
      listB.err(new Error('permission_denied'));
      chk(on().length === 0 && errs.length === 1 && errs[0][0] === 'B', '거부 · 끊김 — 풀고 onError 한 번');
      offB(); offA();
      chk(on().length === 0, '  해제 함수는 몇 번 불러도 탈 없음');
      const c = await fb.getFriendCard('F');
      chk(R.gets.join() === 'users/F/profile,users/F/home/bio,users/F/home/avatar' && c.profile.name === 'N' && c.bio === 'B' && c.avatar === 'A',
        '카드 한 번 읽기 — 프로필 · 소개 · 사진 세 칸만(home 통째 아님) · 날것 그대로');
      const pres = [];
      const offP = fb.watchFriendPresence('F', (v) => pres.push(v));
      const pl = on('users/F/presence')[0];
      chk(pl && on().length === 1, '접속 상태 구독 — users/{친구}/presence 1개');
      pl.cb({ val: () => ({ online: true }) });
      offP();
      chk(pres.length === 1 && pres[0].online === true && on().length === 0, '  날것을 넘긴다 · 해제하면 0개');
      R.gets.length = 0;
      const p1 = await fb.getFriendPresence('F');
      chk(R.gets.join() === 'users/F/presence' && p1.online === true && on().length === 0, '접속 상태 한 번 읽기 — 그 친구 presence 한 칸 · 구독 안 남김');
    }
  }
  {
    const g0 = S.FB.indexOf('    async getMyFriendList(myId){');
    const g1 = g0 < 0 ? -1 : S.FB.indexOf('\n    },\n', g0);
    chk(g0 > 0 && g1 > g0, '판정용 한 번 읽기 getMyFriendList(myId) 가 있다');
    if(g0 > 0 && g1 > g0){
      const reads = [];
      const fb2 = new Function('ref', 'get', 'db', 'const api = {\n' + S.FB.slice(g0, g1 + 6) + '\n};\nreturn api;')(
        (db, p) => ({ p }), async (r) => { reads.push(r.p); return { val: () => (r.p === 'users/ME/friends' ? { f1: { addedAt: 1 } } : null) }; }, {});
      const v = await fb2.getMyFriendList('ME');
      chk(reads.join() === 'users/ME/friends' && v.f1 && v.f1.addedAt === 1, '  users/{나}/friends 한 경로만 한 번 읽는다(통째 읽기 없음)');
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
      const win = { firebaseAPI: ready ? { watchMyFriendList(){} } : undefined, addEventListener: (t, fn, o) => L.push({ t, fn, o }) };
      const wait = new Function('window', 'setTimeout', 'setInterval', 'module', S.NET + '\nvar TwNetReady = window.TwNetReady;\nwith(window){\n' + fnSrc + '\nreturn _waitForFirebaseAPI;\n}')(win, (f, ms) => { timers.push(ms); return 1; }, (f, ms) => { timers.push(ms); return 1; });
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
      b.win.firebaseAPI = { watchMyFriendList(){} };
      if(b.L[0]) b.L[0].fn({});
      chk(b.n() === 1, '  준비되면(30초 뒤라도) 한 번 부른다');
    }catch(e){ chk(false, '굴리기 실패 — ' + e.message); }
  }

  /* ── 5. myhome-init.js — 구독이 쓰기보다 먼저 ── */
  say('── 5. myhome-init.js — 친구 구독이 await 쓰기보다 먼저');
  const body = ((S.MI.match(/async function initMyHome\(code, me\)\{([\s\S]*?)\nreturn \{/) || [])[1] || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');   // 주석 속 «await» 글자는 빼고
  const iStart = body.indexOf('friendsSub.start('), iAwait = body.search(/\bawait\b/);
  chk(iStart > 0 && iAwait > 0 && iStart < iAwait, 'friendsSub.start 가 첫 await 보다 앞');
  chk(!/firebaseAPI\.(subscribeMyFriends|watchMyFriendList)\(/.test(S.MI), '  친구 목록 구독은 friends-sub 로만 건다(두 벌로 걸지 않음)');
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
    m.initMyHome('ME', {});
    chk(starts.length === 1 && starts[0].id === 'ME', '프로필 쓰기 · 코드 확보가 영영 안 끝나고 presence 가 던져도 친구 구독은 걸린다');
    if(starts[0]){
      starts[0].onF({ f1: {} });
      chk(JSON.stringify(renders) === JSON.stringify([['set', { f1: {} }], 'list', 'gb']), '  받으면 — 목록 저장 → 친구 탭 그리기 → 방명록 게이트 (예전 순서 그대로)');
      renders.length = 0; starts[0].onS('error');
      chk(renders.join() === 'list', '  상태가 바뀌면 친구 탭을 다시 그린다(«못 불러옴» 안내)');
    }
  }catch(e){ chk(false, '굴리기 실패 — ' + e.message); }

  /* ── 5-2. 부르는 곳 ── */
  say('── 5-2. 부르는 곳 — 판정은 friendsForCheck · 다시 걸기는 목록 열 때 · 직접 읽기 0곳');
  const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const ui = strip(S.UI), fm = strip(S.FM), ri = strip(S.RI);
  const iChk = ui.indexOf('const _fr = await friendsForCheck();'), iNull = ui.indexOf('if(!_fr) return;'), iMax = ui.indexOf('if(Object.keys(_fr).length>=FRIEND_MAX)');
  const iSend = ui.indexOf('firebaseAPI.sendFriendRequest(');
  chk(iChk > 0 && iNull > iChk && iMax > iNull && iSend > iMax, '친구 코드로 추가 — 판정용 목록 → 못 읽으면 그만(아무것도 안 보냄) → 상한 → … → 요청 보내기 순서');
  chk(/if\(_fr\[friendId\] \|\| _myHomeFriends\(\)\[friendId\]\)\{ toast\('이미 친구예요'\); return; \}/.test(ui) && !/Object\.keys\(_myHomeFriends\(\)\)\.length>=FRIEND_MAX/.test(ui),
    '  «이미 친구» · 상한은 판정용 목록으로(빈 캐시로 판정 안 함)');
  const jChk = fm.indexOf('const _fr = await friendsForCheck();'), jNull = fm.indexOf('if(!_fr) continue;'), jMax = fm.indexOf('if(Object.keys(_fr).length >= FRIEND_MAX){'), jAcc = fm.indexOf('firebaseAPI.acceptFriendRequest(');
  chk(jChk > 0 && jNull > jChk && jMax > jNull && jAcc > jMax, '요청 수락(팝업) — 판정용 목록 → 못 읽으면 요청 남김 → 상한 → 수락 순서');
  chk(/if\(tab\.dataset\.tab==='friend'\) friendsRetry\(\);/.test(ui), '친구 탭을 열 때 friendsRetry(못 불러왔으면 다시 걸기)');
  const kOpen = ri.indexOf('function openPick(){'), kRetry = ri.indexOf('_friendsRetry();', kOpen), kNotice = ri.indexOf('const notice = _friendsNotice();', kOpen);
  chk(kOpen > 0 && kRetry > kOpen && kNotice > kRetry, '워킹룸 초대 목록을 열 때 _friendsRetry → 안내 읽기');
  const direct = ALL_JS.filter(([f, src]) => f !== 'firebase-init.js' && f !== 'friends-sub.js' && f !== 'friends-firebase.js' && /\/friends`\s*\)|getMyFriendList\(/.test(strip(src).replace("getList: (...a)=>firebaseAPI.getMyFriendList(...a),", '')));
  chk(!direct.length, '다른 파일에 친구 경로 직접 읽기 · getMyFriendList 부르기 0곳(app.js 의 firebase provider deps 한 줄만)' + (direct.length ? ' — ' + direct.map(d => d[0]).join(' · ') : ''));
  const fbFriendGets = (strip(S.FB).match(/get\(ref\(db, `users\/\$\{\w+\}\/friends`\)\)/g) || []).length;
  chk(fbFriendGets === 1, '  firebase-init.js 의 친구 목록 get 도 한 곳(getMyFriendList) (' + fbFriendGets + ')');
}

/* 판정 하나가 영영 안 끝나면(풀리지 않는 Promise) node 는 말없이 0 으로 끝난다 — 상한을 두고 «멈춤» 은 실패로 센다 */
const STALL = Symbol('멈춤');
const withLimit = (p) => Promise.race([p, new Promise(r => setTimeout(() => r(STALL), 3000))]);
(async () => {
if(await withLimit(judge(SRC0)) === STALL) chk(false, '판정이 끝나지 않는다(멈춤)');

say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['FS', '  if(!myId){ _myId = null; _setStatus(STATUS.READY); return; }\n', '', '내 코드 없이 구독(users/null/friends)'],
  ['FS', 'const SUB_WAIT_MS = 3000;', 'const SUB_WAIT_MS = 0;', '대기 상한을 0 으로(구독과 같은 경로를 바로 또 읽음)'],
  ['FS', 'function stop(){\n  _gen++; _run++;\n  _detach();', 'function stop(){\n  _gen++; _run++;', '멈춰도 구독이 남음'],
  ['FS', "  return status === STATUS.ERROR ? NOTICE.error : NOTICE.loading;", "  return status === STATUS.ERROR ? NOTICE.error : null;", '불러오는 중을 «받음» 으로'],
  ['FS', 'onUnload(stop);', '', '종료 때 안 멈춤'],
  ['FS', 'function _ok(gen, friends){\n  if(gen !== _gen) return;', 'function _ok(gen, friends){', '늦은 소식을 받아 씀'],
  ['FS', "  _setStatus(STATUS.ERROR);\n  _wake();", "  _setStatus(STATUS.ERROR);\n  _wake();\n  setTimer(()=>_attach(), 5000);", '시간 간격 재시도를 되살림'],
  ['FS', "  if(_status !== STATUS.ERROR || !_myId) return false;", "  if(!_myId) return false;", '받은 · 거는 중에도 다시 걺'],
  ['FS', "  if(_fetching){ _retryAfterFetch = true; return false; }\n", '', '읽는 중에 다시 걸어 같은 경로를 두 번 읽음'],
  ['FS', '  if(_check) return _check;\n', '', '진행 중 판정을 같이 안 기다림(읽기 여러 번)'],
  ['FS', "    if(_okSeq !== seq || _status === STATUS.READY) return current() || {};", "    if(false) return current() || {};", '늦은 읽기가 구독 값을 덮음'],
  ['FS', "    toast(NOTICE.checkFail);\n", '', '읽기 실패를 안 알림'],
  ['FS', '  if(_status !== STATUS.READY) return;\n  if(_onFriends)', '  if(_onFriends)', '받기 전에 이름만 와도 목록을 넘김'],
  ['FS', '  if(_detailsP) return _detailsP;\n', '', '이름 받기를 겹쳐 묻음'],
  ['FS', '  if(first) _loadDetails();', '  _loadDetails();', '열린 목록을 또 열 때마다 다시 받음'],
  ['FS', '  _loadDetails();   // 켤 때 한 번', '  // 켤 때 안 받음', '켤 때 이름을 안 받음'],
  ['FS', "      if(run !== _run) return;\n      _detailsP = null;", "      _detailsP = null;", '지난 실행의 늦은 이름을 받아 씀'],
  ['FS', '  if(_status === STATUS.READY && _detailsP && !_detailsTried) return NOTICE.loading;\n', '', '첫 이름 받기 동안 이름 없는 목록을 보여 줌'],
  ['FS', "function close(key){ delete _open[key]; _syncPresence(); }", "function close(key){ _syncPresence(); }", '닫아도 다시 그리기를 부름'],
  ['FS', "function close(key){ delete _open[key]; _syncPresence(); }", "function close(key){ delete _open[key]; }", '닫아도 접속 상태 구독이 남음'],
  ['FS', "  const want = (Object.keys(_open).length && _status", "  const want = (_status", '목록이 닫혀 있어도 접속 상태를 들음(상시 1 + n)'],
  ['FS', "  if(want && want === _presKey && _presOff) return;\n", '', '친구가 그대로여도 다시 걺'],
  ['FS', "fid && watching.indexOf(fid) < 0", "fid", '듣고 있는 친구도 또 읽음'],
  ['FS', "  _stopPresence();\n  _status = STATUS.IDLE;", "  _status = STATUS.IDLE;", '멈춰도 접속 상태 구독이 남음'],
  ['FS', "mergeFriends(_ids, _details, _presence)", "mergeFriends(_ids, _details)", '접속 상태를 목록에 안 얹음'],
  ['FS', "p=>{ if(run !== _run) return; Object.assign(_presence, p); _emit(); }", "p=>{ Object.assign(_presence, p); _emit(); }", '지난 실행의 늦은 접속 상태를 받아 씀'],
  ['FS', "  _wake();\n  _syncPresence();\n}\nfunction _attach", "  _wake();\n}\nfunction _attach", '목록 구독이 끊겨도 접속 상태가 남음'],
  ['FS', "  if(_status === STATUS.READY) return Promise.resolve(current() || {});", "", 'ready 여도 읽음'],
  ['FS', "  if(prev) _loadNew(Object.keys(_ids).filter(fid=>!(fid in prev)));\n", '', '새 친구 이름을 안 받음(재시작 전까지 \'...\')'],
  ['FS', "  if(prev) _loadNew(", "  _loadNew(", '첫 구독 값의 친구까지 한 명씩 물음'],
  ['FS', "filter(fid=>!(fid in prev))", "filter(fid=>true)", '늘어난 친구가 아니어도 물음'],
  ['FS', "    if(_details[fid] || _asked[fid]) continue;", "    if(_details[fid]) continue;", '받는 중 · 실패한 친구를 또 물음'],
  ['FS', "      .then(v=>{ if(run !== _run || !v) return;", "      .then(v=>{ if(!v) return;", '지난 실행의 늦은 한 명 받기를 받아 씀'],
  ['FS', "  if(!_detailsTried || !_myId) return;", "  if(!_myId) return;", '첫 목록 받기 중에도 한 명씩 물음'],
  ['FS', "_details = _keepKnown(v || {});", "_details = v || {};", '다시 받은 목록이 새 친구 이름을 지움'],
  ['FB', '      if(_myFriendsOff) _myFriendsOff();\n', '', '새로 걸 때 앞의 것을 안 풂(동시 2개)'],
  ['FB', '      }, err=>{\n        teardown();', '      }, err=>{', '거부돼도 친구별 구독이 남음'],
  ['FB', '        if(onError) onError(err);\n', '', '에러를 안 알림'],
  ['APP', "  TwNetReady.whenNetReady(()=>cb(), 'watchMyFriendList');", "  setTimeout(()=>_waitForFirebaseAPI(cb), 500);", '예전 폴링으로 되돌림'],
  ['NET', "  window.addEventListener(NET_READY_EVENT, cb, { once:true });", "  window.addEventListener(NET_READY_EVENT, cb, { once:false });", 'once 를 뺌'],
  ['MI', '      friendsSub.start(myId,', '      await Promise.resolve();\n      friendsSub.start(myId,', '구독을 await 뒤로'],
  ['UI', '    if(!_fr) return;\n', '', '판정용 목록을 못 읽어도 보냄'],
  ['UI', "      if(tab.dataset.tab==='friend') friendsRetry();\n", '', '친구 탭을 열어도 다시 안 걺'],
  ['FM', '      if(!_fr) continue;\n', '', '판정용 목록을 못 읽어도 수락'],
  ['RI', "    _friendsRetry();", "    0;", '초대 목록을 열어도 다시 안 걺'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ if(await withLimit(judge(S)) === STALL) qfail++; }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
