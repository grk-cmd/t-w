/* ═══ 📢 sim-notice-feed.js — 공지 한 판 (0.13 앱 묶음 D4) ═══
   [왜] 소식 · 업데이트 공지 · 런처 배너의 원본이 서버가 됐다. 켤 때 한 번 받고, 서버가 «바뀌었다» 하면 다시 받고, 받는 중 · 받음 · 못 받음을 가르고,
     못 받아도 앞서 받은 판을 지우지 않고, 같은 실패는 한 번만 알려야 한다. 이 판단이 notice-feed.js 한 곳에 있어 실제로 불러서 판정한다.
   ・1절: 받기 — 상태 idle → loading → ready · 처음 받은 소식은 새 소식이 아니다 · 받는 중에 또 부르면 끝난 뒤 한 번 더 · 받으면 모든 받는 쪽에 알림 · 해제한 쪽과 던지는 쪽이 다른 쪽을 막지 않음
   ・2절: 알림 — notices 알림이 오면(바뀜 · 오래 끊겼다 붙음 모두) 다시 받음 · 새로 늘어난 소식 id 만 addedIds
   ・3절: 못 받음 — error · 자동 받기(켤 때 · 알림)가 실패하면 번호 없이 상태만 · 혼자 다시 받지 않음(타이머 0) · 사용자가 연 · 누른 받기(manual)에서만 E-MH-09(이어지는 동안 한 번) · 못 받아도 앞서 받은 판은 그대로 · 한 번도 못 받았으면 ready 아님
   ・4절: 관리자 쓰기 — 올리기(성공 → 다시 받음 · pinFailed → 다시 받고 번호 E-MH-12) · 고정 토글은 받은 판(version)으로 · 없는 id 는 요청 0 · 409 는 다시 받고 번호 · 실패는 번호
   ・5절: 배선 — app.js 가 서버 길로 만듦 · 업데이트 공지 팝업은 처음 받았을 때 한 번 · 배너 · 확성기 · 소식이 같은 한 벌을 읽음 · html · smoke
   ・6절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  FEED: pick(['notice-feed.js', 'parts/launcher/notice-feed.js', 'app/parts/launcher/notice-feed.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  BANNER: pick(['ad-banner.js', 'parts/launcher/ad-banner.js', 'app/parts/launcher/ad-banner.js']),
  OVER: pick(['overhead.js', 'parts/room/overhead.js', 'app/parts/room/overhead.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwNoticeFeed; };
const RD = SRC0.RD;
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const tick = () => new Promise((r) => setImmediate(r));
const note = (pinned, version) => ({ tag: 'notice', title: 't', body: 'b', ts: 1, pinned: !!pinned, version: version || 1 });
const boardOf = (ids, extra) => Object.assign({ updateNotice: null, banner: [], broadcasts: Object.fromEntries(ids.map((i) => [i, note(false)])), hasMore: false }, extra || {});

/* 계정 칸 흉내 — 코드(code)별로 칸이 갈리고, 코드가 없으면 읽기 null · 쓰기 false (shared/account-store.js 와 같은 약속) */
function mkStore(){
  const cells = {}; const st = { code: 'uAAAAAAAA', cells };
  st.get = (k) => (st.code ? (cells[st.code + '|' + k] === undefined ? null : cells[st.code + '|' + k]) : null);
  st.set = (k, v) => { if(!st.code) return false; cells[st.code + '|' + k] = String(v); return true; };
  return st;
}
function mk(src, store){
  const env = { board: boardOf([]), fail: null, gate: null, fetches: 0, errors: [], writes: [], wres: 'ok', handler: null, seen: [] };
  const api = {
    fetchBoard: async () => {
      env.fetches++;
      if(env.gate){ const g = env.gate; await g.promise; }
      if(env.fail) throw env.fail;
      return JSON.parse(JSON.stringify(env.board));
    },
    sendBroadcast: async (o) => { env.writes.push(['send', o]); return env.wres; },
    setPinned: async (id, v, p) => { env.writes.push(['pin', id, v, p]); return env.wres; },
    remove: async (id, v) => { env.writes.push(['del', id, v]); return env.wres; },
  };
  const rt = { on: (kind, fn) => { if(kind === 'notices') env.handler = fn; return () => {}; } };
  const feed = load(src).createNoticeFeed({ api, rt, notifyError: (c) => env.errors.push(c), store: store || mkStore() });
  feed.onChange((e) => env.seen.push(e.addedIds.join(',')));
  return { env, feed };
}
const defer = () => { let res; const promise = new Promise((a) => { res = a; }); return { promise, release: () => res() }; };

async function judge(S){
  const LIB = S.FEED;

  say('── 1. 받기');
  {
    const { env, feed } = mk(LIB);
    chk(feed.status() === 'idle' && !feed.ready() && feed.updateNotice() === null && feed.banner().length === 0 && Object.keys(feed.broadcasts()).length === 0, '시작 전은 idle · 비어 있음');
    const g = defer(); env.gate = g;
    env.board = boardOf(['a', 'b'], { updateNotice: { title: 'u', body: 'b', ts: 5 }, banner: [{ img: 'i', link: 'l' }], hasMore: true });
    feed.start(); await tick();
    chk(feed.status() === 'loading' && !feed.ready(), '받는 중에는 loading');
    g.release(); await tick(); await tick();
    chk(feed.status() === 'ready' && feed.ready() && Object.keys(feed.broadcasts()).join() === 'a,b' && feed.updateNotice().ts === 5 && feed.banner()[0].img === 'i' && feed.hasMore() === true, '받으면 ready — 소식 · 업데이트 공지 · 배너 · 더 있음');
    chk(env.seen.join('|') === '', '처음 받은 소식은 «새 소식» 이 아니다(앱을 켤 때 우르르 안 뜨게)');
  }
  {
    const { env, feed } = mk(LIB);
    const g = defer(); env.gate = g;
    feed.refresh(); await tick(); feed.refresh(); feed.refresh(); await tick();
    chk(env.fetches === 1, '받는 중에 또 불러도 요청은 하나');
    env.gate = null; g.release(); await tick(); await tick(); await tick();
    chk(env.fetches === 2, '  끝난 뒤 한 번 더');
    const calls = [];
    feed.onChange(() => calls.push('x'));
    const bad = mk(LIB);
    bad.feed.onChange(() => { throw new Error('받는 쪽 오류'); });
    let seen = 0; bad.feed.onChange(() => { seen++; });
    await bad.feed.refresh();
    chk(seen === 1, '받는 쪽 하나가 던져도 다른 쪽은 받는다');
    const off = bad.feed.onChange(() => { seen += 10; }); off();
    await bad.feed.refresh();
    chk(seen === 2, '해제한 쪽에는 더 안 간다');
  }

  say('── 1-3. 저장본 — 켜면 바로 그리고 · 응답이 통째로 덮고 · 계정이 섞이지 않는다');
  {
    const store = mkStore();
    const a = mk(LIB, store);
    a.env.board = boardOf(['a', 'b'], { hasMore: true });
    a.feed.start(); await tick(); await tick();
    const savedRaw = store.get('tw.noticeBoard');
    chk(!!savedRaw && Object.keys(JSON.parse(savedRaw).broadcasts).join() === 'a,b' && JSON.parse(savedRaw).hasMore === true, '받으면 소식 묶음(broadcasts · hasMore)을 계정 칸에 남긴다');
    const b = mk(LIB, store);
    const g = defer(); b.env.gate = g; b.env.board = boardOf(['c']);
    b.feed.start(); await tick();
    chk(b.feed.ready() && !b.feed.confirmed() && b.feed.status() === 'loading' && Object.keys(b.feed.broadcasts()).join() === 'a,b' && b.feed.hasMore() === true, '다시 켜면 서버 응답 전에 저장본을 바로 보여 준다(확정은 아직)');
    chk(b.env.seen.join('|') === '', '저장본을 그린 것은 «새 소식» 이 아니다');
    chk(await b.feed.togglePin('a') === false && await b.feed.remove('a') === false && b.env.writes.length === 0, '저장본을 보여 주는 동안 고정 · 내리기는 요청 0(서버 응답 뒤에만)');
    g.release(); await tick(); await tick();
    chk(b.feed.confirmed() && Object.keys(b.feed.broadcasts()).join() === 'c' && b.feed.hasMore() === false && b.env.seen.join('|') === '|', '응답이 오면 저장본에 맞추지 않고 통째로 갈아 끼운다(a · b 가 사라지고 새 소식 취급도 안 함)');
    chk(Object.keys(JSON.parse(store.get('tw.noticeBoard')).broadcasts).join() === 'c', '응답을 다시 저장한다');
    b.env.fetches = 0; await b.feed.togglePin('c');
    chk(b.env.writes.length === 1, '확정 뒤에는 고칠 수 있다');
  }
  {
    const store = mkStore();
    const a = mk(LIB, store); a.env.board = boardOf(['a']); a.feed.start(); await tick(); await tick();
    store.code = 'uBBBBBBBB';
    const b = mk(LIB, store); const g = defer(); b.env.gate = g;
    b.feed.start(); await tick();
    chk(!b.feed.ready() && b.feed.status() === 'loading' && Object.keys(b.feed.broadcasts()).length === 0, '다른 계정은 앞 계정 저장본을 보지 못한다(없으면 받는 중)');
    g.release(); await tick(); await tick();
    store.code = 'uAAAAAAAA';
    const c = mk(LIB, store); c.env.gate = defer();
    c.feed.start(); await tick();
    chk(Object.keys(c.feed.broadcasts()).join() === 'a', '앞 계정으로 돌아오면 그 계정 저장본이 이어진다(B 의 응답이 A 칸을 덮지 않았다)');
  }
  for(const bad of ['{not json', '[]', 'null', '"x"', '{"broadcasts":[],"hasMore":false}', '{"broadcasts":{"a":{"title":"t"}},"hasMore":false}',
    '{"broadcasts":{"a":{"tag":"notice","title":"t","body":"b","ts":"1","pinned":false,"version":1}},"hasMore":false}', '{"broadcasts":{},"hasMore":"no"}']){
    const store = mkStore(); store.set('tw.noticeBoard', bad);
    const { env, feed } = mk(LIB, store); env.gate = defer();
    feed.start(); await tick();
    chk(!feed.ready() && Object.keys(feed.broadcasts()).length === 0, '깨진 저장본은 무시 — ' + bad.slice(0, 40));
  }
  {
    const store = mkStore(); store.code = null;
    const { env, feed } = mk(LIB, store); env.board = boardOf(['a']);
    feed.start(); await tick(); await tick();
    chk(feed.confirmed() && Object.keys(store.cells).length === 0, '로그인 전(계정 코드 없음)에는 받아도 저장하지 않는다');
  }
  {
    const store = mkStore(); store.set('tw.noticeBoard', JSON.stringify({ broadcasts: { a: note(false, 3) }, hasMore: false }));
    const { env, feed } = mk(LIB, store); env.fail = new Error('x');
    feed.start(); await tick(); await tick();
    chk(feed.status() === 'error' && feed.ready() && !feed.confirmed() && Object.keys(feed.broadcasts()).join() === 'a', '못 받아도 저장본은 그대로 보인다(확정은 아님)');
  }

  say('── 1-2. busy() — 지금 받는 중인가');
  {
    const { env, feed } = mk(LIB);
    chk(feed.busy() === false, '시작 전은 false');
    const g = defer(); env.gate = g;
    feed.start(); await tick();
    chk(feed.busy() === true, '받는 중에는 true');
    if(!feed.busy()) feed.refresh({ manual: true });   // 받는 중이면 건너뛴다(retryIfFailed 와 같은 판단)
    env.gate = null; g.release(); await tick(); await tick(); await tick();
    chk(feed.busy() === false && env.fetches === 1, '성공 뒤 false · 받는 중 busy 를 보고 건너뛰면 끝난 뒤 fetch 는 1번(겹쳐 한 번 더 나가지 않는다)');
    const e2 = mk(LIB); const g2 = defer(); e2.env.gate = g2; e2.env.fail = new Error('x');
    e2.feed.start(); await tick();
    const during = e2.feed.busy();
    g2.release(); await tick(); await tick(); await tick();
    chk(during === true && e2.feed.busy() === false && e2.feed.status() === 'error', 'fetch 가 던진 뒤에도 false(받는 중에 머물지 않는다)');
  }

  say('── 2. 알림');
  {
    const { env, feed } = mk(LIB);
    env.board = boardOf(['a']);
    feed.start(); await tick(); await tick();
    env.board = boardOf(['a', 'n']);
    env.handler({ kind: 'notices' }); await tick(); await tick();
    chk(env.fetches === 2 && env.seen[env.seen.length - 1] === 'n', 'notices 알림 → 다시 받고 새로 늘어난 id(n)만 addedIds');
    env.handler({ kind: 'notices', resync: true }); await tick(); await tick();
    chk(env.fetches === 3 && env.seen[env.seen.length - 1] === '', '오래 끊겼다 붙어도 다시 받는다 · 늘어난 게 없으면 새 소식 없음');
    env.board = boardOf(['n']);
    env.handler({ kind: 'notices' }); await tick(); await tick();
    chk(Object.keys(feed.broadcasts()).join() === 'n' && env.seen[env.seen.length - 1] === '', '내려간 소식은 목록에서 빠진다');
  }

  say('── 3. 못 받음 · 혼자 다시 받지 않음 · 오류 번호는 사용자가 연 · 누른 받기에서만');
  {
    const { env, feed } = mk(LIB);
    env.fail = new Error('x');
    const timers = []; const realST = global.setTimeout; global.setTimeout = (...a) => { timers.push(a[1]); return realST(...a); };
    try{
      feed.start(); await tick(); await tick();
      chk(feed.status() === 'error' && !feed.ready() && env.errors.length === 0, '켤 때(자동) 못 받으면 error 상태만 — 빈 소식으로 그리지 않고 오류 번호는 안 띄운다');
      env.handler({ kind: 'notices' }); await tick(); await tick();
      chk(env.errors.length === 0 && env.fetches === 2, '  알림으로 자동 받다 실패해도 번호 없음');
      const f = env.fetches; await new Promise((r) => realST(r, 30)); await tick();
      chk(timers.length === 0 && env.fetches === f, '  혼자 다시 받지 않는다(타이머 0개 · 요청이 늘지 않는다)');
    }finally{ global.setTimeout = realST; }
    await feed.refresh({ manual: true });
    chk(env.errors.join() === 'E-MH-09', '«다시 시도» · 알림함 열기(manual)로 못 받으면 번호 E-MH-09');
    await feed.refresh({ manual: true }); await feed.refresh();
    chk(env.errors.length === 1, '  이어지는 실패는 한 번만');
    env.fail = null; env.board = boardOf(['a']);
    await feed.refresh();
    chk(feed.status() === 'ready' && feed.ready(), '  다시 받으면 ready');
    env.fail = new Error('또'); await feed.refresh({ manual: true });
    chk(feed.status() === 'error' && feed.ready() && Object.keys(feed.broadcasts()).join() === 'a' && env.errors.length === 2, '  받은 뒤의 실패 — 다시 알리고(새 실패 줄) 앞서 받은 소식은 그대로');
  }
  say('── 3-2. 업데이트 공지 한 번');
  {
    const { env, feed } = mk(LIB);
    env.board = boardOf(['a'], { updateNotice: { title: '이미 받음', body: 'b', ts: 9 } });
    await feed.refresh();
    const shown = [];
    feed.onceReady((n) => shown.push(n && n.title));
    chk(shown.join() === '이미 받음', '업데이트 공지 — 이미 받은 뒤에 걸어도 바로 한 번(기다리다 놓치지 않는다)');
    await feed.refresh();
    chk(shown.length === 1, '  그 뒤 다시 받아도 더 안 띄운다');
  }
  {
    const { env, feed } = mk(LIB);
    const shown = [];
    feed.onceReady((n) => shown.push(n && n.title));
    env.fail = new Error('x'); env.board = boardOf(['a'], { updateNotice: { title: '새 판', body: 'b', ts: 9 } });
    feed.start(); await tick(); await tick();
    chk(shown.length === 0, '업데이트 공지 — 못 받았으면 팝업을 안 띄운다');
    env.fail = null; await feed.refresh(); await feed.refresh(); env.handler({ kind: 'notices' }); await tick(); await tick();
    chk(shown.join() === '새 판', '  실패 → 성공 → 다시 받기 여러 번에도 팝업은 한 번(받은 공지로)');
  }

  say('── 4. 관리자 쓰기');
  {
    const { env, feed } = mk(LIB);
    env.board = boardOf(['a']); env.board.broadcasts.a.version = 9; env.board.broadcasts.a.pinned = false;
    await feed.refresh();
    const before = env.fetches;
    chk(await feed.sendBroadcast({ tag: 'notice', title: 't', body: 'b', pinned: false }) === true && env.fetches === before + 1 && env.errors.length === 0, '올리기 성공 → 다시 받는다 · 번호 없음');
    env.wres = 'pinFailed';
    chk(await feed.sendBroadcast({ tag: 'notice', title: 't', body: 'b', pinned: true }) === false && env.fetches === before + 2 && env.errors.join() === 'E-MH-12', '올라는 갔는데 고정 실패 → 다시 받고(올린 글은 보인다) 번호 E-MH-12');
    env.wres = 'failed'; env.errors.length = 0; const f0 = env.fetches;
    chk(await feed.sendBroadcast({ tag: 'notice', title: 't', body: 'b' }) === false && env.fetches === f0 && env.errors.join() === 'E-MH-12', '실패 → 다시 받지 않고 번호');
    env.wres = 'ok';
    chk(await feed.togglePin('a') === true && env.writes.some((w) => w[0] === 'pin' && w[1] === 'a' && w[2] === 9 && w[3] === true), '고정 토글 — 받은 판(9)을 실어 반대로(꺼져 있었으니 켬)');
    env.board.broadcasts.a.pinned = true; env.board.broadcasts.a.version = 10; await feed.refresh();
    await feed.togglePin('a');
    chk(env.writes[env.writes.length - 1].join() === 'pin,a,10,false', '  고정이 켜져 있으면 끈다(새 판 10)');
    const w0 = env.writes.length;
    chk(await feed.togglePin('nope') === false && await feed.remove('nope') === false && env.writes.length === w0, '없는 id 는 요청 0');
    chk(await feed.remove('a') === true && env.writes[env.writes.length - 1].join() === 'del,a,10', '내리기 — 받은 판을 실어');
    env.wres = 'conflict'; env.errors.length = 0; const f1 = env.fetches;
    chk(await feed.remove('a') === false && env.fetches === f1 + 1 && env.errors.join() === 'E-MH-12', '409 → 덮어쓰지 않고 다시 받아 그 값으로 + 번호');
  }

  say('── 5. 배선');
  {
    const A = strip(S.APP);
    chk(/TwNoticeFeed\.createNoticeFeed\(\{[\s\S]*?rt: TwRtHub\.store[\s\S]*?store: accountStoreMod[\s\S]*?\}\);/.test(A), 'app.js — 서버 길과 realtime 알림 · 계정 칸을 넘겨 만든다');
    chk(/ notice: \(\)=>noticeFeed\.start\(\),/.test(A) && !/whenNetReady\(\(\)=>noticeFeed\.start\(\)\)/.test(A) && /function _showUpdateNoticeOnce/.test(A) && !/firebaseAPI\.getUpdateNotice/.test(A), 'app.js — 계정 확인 뒤 app-boot 가 받고(만들 때 안 받음) · 업데이트 공지 팝업은 공지 한 판에서(옛 getUpdateNotice 읽기가 없다)');
    chk(!/isViewing|_mailboxVisible|retryDelay/.test(A) && /noticeFeed\.onceReady\(_showUpdateNoticeOnce\)/.test(A), 'app.js — 보는 중 거르기 · 다시 받기 재료를 안 넘기고 · 업데이트 공지 팝업은 onceReady 한 번');
    const B = strip(S.BANNER);
    chk(/noticeFeed\.onChange\(/.test(B) && !/localStorage\.setItem\(AD_BANNER_KEY/.test(B) && !/subscribeAdBanner/.test(B), '배너 — 공지 한 판이 바뀔 때 그린다 · 이 PC 사본(localStorage)을 안 남긴다');
    const O = strip(S.OVER);
    chk(/rtHub\.store\.onMessage\('announce'/.test(O) && !/subscribeAnnounce/.test(O), '확성기 — realtime announce 메시지로(옛 구독이 없다)');
    const h = S.HTML;
    chk(/PRELOAD\.push\('notice-feed\.js'\)/.test(S.SMOKE) && h.indexOf('<script src="parts/launcher/notice-feed.js"></script>') > 0, 'html · smoke 에 notice-feed.js');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 6. 일부러 깨 보기');
  const F = S.FEED;
  const breaks = [
    ['busy 가 늘 false', F.replace('busy: () => flying', 'busy: () => false'), 'busy()'],
    ['처음 받은 판도 새 소식', F.replace("everReady ? Object.keys", "true ? Object.keys"), '처음 받은'],
    ['받는 중 겹쳐 요청', F.replace("if(flying){ again = true; return false; }", ""), '요청은 하나'],
    ['받는 쪽 하나가 던지면 멈춤', F.replace("try{ fn({ addedIds }); }catch(e){ console.warn('[공지] 받는 쪽 처리 실패', e); }", "fn({ addedIds });"), '다른 쪽은 받는다'],
    ['실패마다 알림', F.replace("{ failStreak = true; notifyError('E-MH-09', e); }", "{ notifyError('E-MH-09', e); }"), '한 번만'],
    ['notices 알림을 안 받음', F.replace("deps.rt.on('notices', () => { refresh(); });", "deps.rt.on('notices', () => {});"), 'notices 알림'],
    ['못 받으면 판을 비움', F.replace("status = STATUS.ERROR;\n", "status = STATUS.ERROR; board = { updateNotice: null, banner: [], broadcasts: {}, hasMore: false }; everReady = false;\n"), '그대로'],
    ['이미 받았는데 기다림', F.replace("if(everReady){ fn(board.updateNotice); return; }", ''), '이미 받은 뒤에 걸어도'],
    ['업데이트 공지를 받을 때마다 띄움', F.replace("      off();\n      fn(board.updateNotice);", "      fn(board.updateNotice);"), '한 번'],
    ['못 받았는데 업데이트 공지를 띄움', F.replace("if(!everReady) return;\n      off();", "off();"), '못 받았으면'],
    ['자동 받기 실패에도 번호를 띄움', F.replace("!failStreak && manual", "!failStreak"), '자동'],
    ['다시 시도에 번호 안 띄움', F.replace("!failStreak && manual", "false"), '다시 시도'],
    ['혼자 다시 받음', F.replace("        emit([]);\n        return false;", "        setTimeout(() => refresh(), 5); emit([]);\n        return false;"), '혼자 다시 받지'],
    ['고정에 옛 판을 실음', F.replace("api.setPinned(id, m.version, !m.pinned)", "api.setPinned(id, 0, !m.pinned)"), '받은 판'],
    ['없는 id 도 보냄', F.replace("async function togglePin(id){\n    const m = board.broadcasts[id];\n    if(!everReady || !m) return false;", "async function togglePin(id){\n    const m = board.broadcasts[id] || { version: 0, pinned: false };"), '요청 0'],
    ['409 에 다시 안 받음', F.replace("if(r === 'conflict'){ await refresh(); notifyError('E-MH-12', null); return false; }", "if(r === 'conflict'){ notifyError('E-MH-12', null); return false; }"), '다시 받아'],
    ['저장본을 안 그림', F.replace("if(saved){ board =", "if(false){ board ="), '저장본을 바로'],
    ['저장본이 확정 취급', F.replace("confirmed: () => everReady", "confirmed: () => everReady || savedShown"), '고정 · 내리기는 요청 0'],
    ['저장본 위에서 고침', F.replace("if(!everReady || !m) return false;   // 저장본의", "if(!m) return false;   // 저장본의"), '고정 · 내리기는 요청 0'],
    ['응답을 저장본에 합침', F.replace("board = got; everReady", "board = Object.assign({}, got, { broadcasts: Object.assign({}, board.broadcasts, got.broadcasts) }); everReady"), '통째로'],
    ['응답을 저장 안 함', F.replace("store.set(SAVED_KEY,", "void (SAVED_KEY,"), '다시 저장'],
    ['계정 상관없이 한 칸', F.replace("store.get(SAVED_KEY)", "(store.cells ? store.cells['uAAAAAAAA|tw.noticeBoard'] : null)"), '다른 계정'],
    ['깨진 저장본을 그림', F.replace("try{ o = JSON.parse(raw); }catch(_){ return null; }", "try{ o = JSON.parse(raw); }catch(_){ return { broadcasts: {}, hasMore: false }; }"), '깨진 저장본'],
    ['모양 검사 없음', F.replace("return Object.values(o.broadcasts).every(isNote) ?", "return true ?"), '깨진 저장본'],
    ['저장본이 새 소식 취급', F.replace("savedShown = true; emit([]);", "savedShown = true; emit(Object.keys(saved.broadcasts));"), '새 소식'],
    ['고정 실패에 다시 안 받음', F.replace("if(r === 'pinFailed'){ await refresh(); notifyError('E-MH-12', null); return false; }", "if(r === 'pinFailed'){ notifyError('E-MH-12', null); return false; }"), '올린 글은 보인다'],
  ];
  for(const [name, src, what] of breaks){
    if(src === F){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(Object.assign({}, S, { FEED: src })); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
}
runAll();
