/* ═══ 📢 sim-notice-feed.js — 공지 한 판 (0.13 앱 묶음 D4) ═══
   [왜] 소식 · 업데이트 공지 · 런처 배너의 원본이 서버가 됐다. 켤 때 한 번 받고, 서버가 «바뀌었다» 하면 다시 받고, 받는 중 · 받음 · 못 받음을 가르고,
     못 받아도 앞서 받은 판을 지우지 않고, 같은 실패는 한 번만 알려야 한다. 이 판단이 notice-feed.js 한 곳에 있어 실제로 불러서 판정한다.
   ・1절: 받기 — 상태 idle → loading → ready · 처음 받은 소식은 새 소식이 아니다 · 받는 중에 또 부르면 끝난 뒤 한 번 더 · 받으면 모든 받는 쪽에 알림 · 해제한 쪽과 던지는 쪽이 다른 쪽을 막지 않음
   ・2절: 알림 — notices 알림이 오면(바뀜 · 오래 끊겼다 붙음 모두) 다시 받음 · 새로 늘어난 소식 id 만 addedIds
   ・3절: 못 받음 — error · 오류 번호 E-MH-09 는 이어지는 동안 한 번 · 못 받아도 앞서 받은 판은 그대로 · 한 번도 못 받았으면 ready 아님
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
  RD: pick(['retry-delay.js', 'parts/shared/retry-delay.js', 'app/parts/shared/retry-delay.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  BANNER: pick(['ad-banner.js', 'parts/launcher/ad-banner.js', 'app/parts/launcher/ad-banner.js']),
  OVER: pick(['overhead.js', 'parts/room/overhead.js', 'app/parts/room/overhead.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwNoticeFeed || w.TwRetryDelay; };
const RD = SRC0.RD;
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const tick = () => new Promise((r) => setImmediate(r));
const note = (pinned, version) => ({ tag: 'notice', title: 't', body: 'b', ts: 1, pinned: !!pinned, version: version || 1 });
const boardOf = (ids, extra) => Object.assign({ updateNotice: null, banner: [], broadcasts: Object.fromEntries(ids.map((i) => [i, note(false)])), hasMore: false }, extra || {});

function mk(src){
  const env = { board: boardOf([]), fail: null, gate: null, fetches: 0, errors: [], writes: [], wres: 'ok', handler: null, seen: [], timers: [], viewing: true };
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
  const feed = load(src).createNoticeFeed({ api, rt, notifyError: (c) => env.errors.push(c), isViewing: () => env.viewing, 
    retryDelay: (n) => load(RD).delay(n), setTimer: (fn, ms) => { const t = { ms, live: true }; t.fn = () => { t.live = false; fn(); }; env.timers.push(t); return env.timers.length - 1; }, clearTimer: (id) => { if(env.timers[id]) env.timers[id].live = false; } });
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

  say('── 3. 못 받음');
  {
    const { env, feed } = mk(LIB);
    env.fail = new Error('x');
    feed.start(); await tick(); await tick();
    chk(feed.status() === 'error' && !feed.ready() && env.errors.join() === 'E-MH-09', '못 받으면 error — 빈 소식으로 그리지 않고 오류 번호 E-MH-09');
    await feed.refresh(); await feed.refresh();
    chk(env.errors.length === 1, '  이어지는 실패는 한 번만');
    env.fail = null; env.board = boardOf(['a']);
    await feed.refresh();
    chk(feed.status() === 'ready' && feed.ready(), '  다시 받으면 ready');
    env.fail = new Error('또'); await feed.refresh();
    chk(feed.status() === 'error' && feed.ready() && Object.keys(feed.broadcasts()).join() === 'a' && env.errors.length === 2, '  받은 뒤의 실패 — 다시 알리고 앞서 받은 소식은 그대로');
  }

  say('── 3-2. 스스로 다시 받기 · 오류 번호는 보는 동안만 · 업데이트 공지 한 번');
  {
    const { env, feed } = mk(LIB);
    env.fail = new Error('x'); env.viewing = false;
    feed.start(); await tick(); await tick();
    chk(feed.status() === 'error' && env.errors.length === 0 && env.timers.length === 1 && env.timers[0].ms === 30000, '알림함을 안 보는 동안 못 받으면 번호 없이 상태만 error · 30초 뒤 다시 받도록 건다');
    env.timers[0].fn(); await tick(); await tick();
    chk(env.fetches === 2 && env.timers[1].ms === 60000, '  타이머가 돌면 다시 받고 또 못 받으면 두 배');
    for(let i = 2; i < 9; i++){ env.timers[i - 1].fn(); await tick(); await tick(); }
    chk(env.timers[env.timers.length - 1].ms === 600000, '  10분이 상한');
    env.viewing = true; env.timers[env.timers.length - 1].fn(); await tick(); await tick();
    chk(env.errors.join() === 'E-MH-09', '  보는 중에 또 못 받으면 번호를 한 번');
    env.timers[env.timers.length - 1].fn(); await tick(); await tick();
    chk(env.errors.length === 1, '  이어지는 실패는 더 안 띄운다');
    env.fail = null; await feed.refresh();
    chk(feed.status() === 'ready' && env.timers.filter((t) => t.live).length === 0, '  받으면 타이머를 거둔다(다른 길로 받아져도)');
    env.fail = new Error('또'); await feed.refresh(); await tick();
    chk(env.timers[env.timers.length - 1].ms === 30000, '  성공한 뒤의 첫 실패는 다시 30초부터');
  }
  {
    const { env, feed } = mk(LIB);
    env.fail = new Error('x'); env.viewing = false;
    feed.start(); await tick(); await tick();
    await feed.refresh({ manual: true });
    chk(env.errors.join() === 'E-MH-09', '«다시 시도» 로 못 받으면 화면을 안 봐도 번호를 띄운다');
  }
  {
    const { env, feed } = mk(LIB);
    env.board = boardOf(['a'], { updateNotice: { title: '이미 받음', body: 'b', ts: 9 } });
    await feed.refresh();
    const shown = [];
    feed.onceReady((n) => shown.push(n && n.title));
    chk(shown.join() === '이미 받음', '업데이트 공지 — 이미 받은 뒤에 걸어도 바로 한 번(기다리다 놓치지 않는다)');
    await feed.refresh();
    chk(shown.length === 1, '  그 뒤 다시 받아도 더 안 띄운다');
    let thrown = null; try{ load(LIB).createNoticeFeed({ api: {}, rt: { on(){} }, notifyError(){} }); }catch(x){ thrown = x; }
    chk(thrown && /isViewing/.test(thrown.message), 'isViewing 없이 만들면 던진다(조용히 «안 보임» 으로 두지 않는다)');
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
    chk(/TwNoticeFeed\.createNoticeFeed\(\{[\s\S]*?rt: TwRtHub\.store[\s\S]*?\}\);/.test(A), 'app.js — 서버 길과 realtime 알림을 넘겨 만든다');
    chk(/whenNetReady\(\(\)=>noticeFeed\.start\(\)\)/.test(A) && /function _showUpdateNoticeOnce/.test(A) && !/firebaseAPI\.getUpdateNotice/.test(A), 'app.js — 켤 때 받고 · 업데이트 공지 팝업은 공지 한 판에서(옛 getUpdateNotice 읽기가 없다)');
    chk(/isViewing: _mailboxVisible,/.test(A) && /noticeFeed\.onceReady\(_showUpdateNoticeOnce\)/.test(A), 'app.js — 알림함이 보이는지 잇고 · 업데이트 공지 팝업은 onceReady 한 번');
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
    ['처음 받은 판도 새 소식', F.replace("everReady ? Object.keys", "true ? Object.keys"), '처음 받은'],
    ['받는 중 겹쳐 요청', F.replace("if(flying){ again = true; return false; }", ""), '요청은 하나'],
    ['받는 쪽 하나가 던지면 멈춤', F.replace("try{ fn({ addedIds }); }catch(e){ console.warn('[공지] 받는 쪽 처리 실패', e); }", "fn({ addedIds });"), '다른 쪽은 받는다'],
    ['실패마다 알림', F.replace("{ failStreak = true; notifyError('E-MH-09', e); }", "{ notifyError('E-MH-09', e); }"), '한 번만'],
    ['notices 알림을 안 받음', F.replace("deps.rt.on('notices', () => { refresh(); });", "deps.rt.on('notices', () => {});"), 'notices 알림'],
    ['못 받으면 판을 비움', F.replace("status = STATUS.ERROR;\n", "status = STATUS.ERROR; board = { updateNotice: null, banner: [], broadcasts: {}, hasMore: false }; everReady = false;\n"), '그대로'],
    ['이미 받았는데 기다림', F.replace("if(everReady){ fn(board.updateNotice); return; }", ''), '이미 받은 뒤에 걸어도'],
    ['isViewing 없어도 만들어짐', F.replace("if(!isViewing) throw new Error('[공지] isViewing 이 필요해요 — 알림함이 보이는지 알려 주는 함수');", ''), 'isViewing 없이'],
    ['업데이트 공지를 받을 때마다 띄움', F.replace("      off();\n      fn(board.updateNotice);", "      fn(board.updateNotice);"), '한 번'],
    ['못 받았는데 업데이트 공지를 띄움', F.replace("if(!everReady) return;\n      off();", "off();"), '못 받았으면'],
    ['안 보는 중에도 번호를 띄움', F.replace("(manual || isViewing())", "true"), '보는 동안만'],
    ['다시 시도에도 번호 안 띄움', F.replace("(manual || isViewing())", "isViewing()"), '다시 시도'],
    ['다시 받기 시간이 안 늘어남', F.replace("    failCount++;\n", ""), '두 배'],
    ['받아도 타이머를 안 거둠', F.replace("failCount = 0; cancelRetry();", "failCount = 0;"), '타이머를 거둔다'],
    ['고정에 옛 판을 실음', F.replace("api.setPinned(id, m.version, !m.pinned)", "api.setPinned(id, 0, !m.pinned)"), '받은 판'],
    ['없는 id 도 보냄', F.replace("async function togglePin(id){\n    const m = board.broadcasts[id];\n    if(!m) return false;", "async function togglePin(id){\n    const m = board.broadcasts[id] || { version: 0, pinned: false };"), '요청 0'],
    ['409 에 다시 안 받음', F.replace("if(r === 'conflict'){ await refresh(); notifyError('E-MH-12', null); return false; }", "if(r === 'conflict'){ notifyError('E-MH-12', null); return false; }"), '다시 받아'],
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
