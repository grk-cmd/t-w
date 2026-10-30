/* ═══ 📩 sim-mail-feed.js — 내 우편 한 벌 (0.13 앱 묶음 D4) ═══
   [왜] 우편의 원본이 서버가 됐다. 앱은 받아서 보여 줄 뿐이라 «받는 중 · 받음 · 못 받음» 을 가르고, 받기 전엔 고치지 않고, 계정이 바뀌면 앞 계정 것을 버리고,
     같은 실패는 한 번만 알려야 한다. 이 판단이 mail-feed.js 한 곳에 있어 실제로 불러서 판정한다.
   ・1절: 받기 — 처음 받음(새 우편 아님) · 상태 loading → ready · 받는 중에 또 부르면 끝난 뒤 한 번 더(요청이 겹치지 않음) · 내 코드 없음은 요청 0
   ・2절: 알림 — 새 우편(MAIL) · 코드 없는 알림 · 오래 끊겼다 붙음(resync)이면 다시 받음 · 종(BELL)은 무시 · 로그인 전은 무시 · 새로 늘어난 id 만 addedIds
   ・3절: 못 받음 — error 상태 · 오류 번호 E-MH-08 는 이어지는 동안 한 번 · 받으면 다시 알림 가능 · 못 받아도 앞서 받은 우편은 그대로(ready 유지)
   ・4절: 계정 바뀜 — 바뀌면 비우고 새로 받음 · 늦게 끝난 앞 계정 응답은 버림(실패도 알리지 않음) · stop 은 비움
   ・5절: 읽음 · 지우기 — 받기 전 잠금 · 서버가 됐다 한 뒤에만 고침(읽음 → 안 읽은 수 -1 · 모두 읽음 → 0 · 지우기 → 목록 · 안 읽은 수) · stale 은 조용히 버림 · 실패는 번호(E-MH-10 · 07)와 그대로 · 여러 통은 첫 실패에서 멈춤
   ・6절: 배선 — app.js 가 서버 길로 만듦 · 옛 let 이 없음 · html · smoke
   ・7절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  FEED: pick(['mail-feed.js', 'parts/myhome/mail-feed.js', 'app/parts/myhome/mail-feed.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwMailFeed; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const tick = () => new Promise((r) => setImmediate(r));
const mail = (read, tag) => ({ tag: tag || 'reward', title: 't', body: 'b', ts: 1, read: !!read });

/* 가짜 한 벌 — api 는 부른 것을 적고 정한 답을 낸다(손으로 풀 수 있는 답도). rt 는 건 함수를 모아 둔다. */
function mkEnv(){
  const env = { server: {}, unread: 0, fetches: [], writes: [], errors: [], changes: [], snaps: [], handlers: {}, result: 'ok', fail: null, gate: null };
  const api = {
    fetchMail: async (uid) => {
      env.fetches.push(uid);
      if(env.gate){ const g = env.gate; await g.promise; if(g.fail) throw g.fail; return g.value(uid); }
      if(env.fail) throw env.fail;
      return { items: JSON.parse(JSON.stringify(env.server)), unread: env.unread, complete: true };
    },
    markRead: async (uid, id) => { env.writes.push(['read', uid, id]); return env.result; },
    markAllRead: async (uid) => { env.writes.push(['all', uid]); return env.result; },
    remove: async (uid, id) => { env.writes.push(['del', uid, id]); return typeof env.result === 'function' ? env.result(id) : env.result; },
  };
  const rt = { on: (kind, fn) => { env.handlers[kind] = fn; return () => {}; } };
  return { env, api, rt };
}
function mk(src){
  const e = mkEnv();
  const feed = load(src).createMailFeed({ api: e.api, rt: e.rt, notifyError: (c, err) => e.env.errors.push(c) });
  feed.onChange((x) => { e.env.changes.push(x.addedIds.join(',')); e.env.snaps.push(Object.keys(feed.items()).join('+')); });
  return Object.assign(e, { feed });
}
const defer = () => { let res, rej; const promise = new Promise((a, b) => { res = a; rej = b; }); return { promise, release: () => res(), fail: null, value: null }; };

async function judge(S){
  const LIB = S.FEED;

  say('── 1. 받기');
  {
    const { env, feed } = mk(LIB);
    chk(feed.status() === 'idle' && !feed.ready() && Object.keys(feed.items()).length === 0 && feed.unread() === 0, '시작 전은 idle · 빈 우편 · ready 아님');
    chk(await feed.refresh() === false && env.fetches.length === 0, '내 코드가 없으면 받지 않는다(요청 0)');
    env.server = { a: mail(false), b: mail(true) }; env.unread = 5;
    const g = defer(); env.gate = g; g.value = () => ({ items: env.server, unread: 5, complete: false });
    feed.start('ME01');
    await tick();
    chk(feed.status() === 'loading' && !feed.ready(), '받는 중에는 loading — 아직 «우편 없음» 이 아니다');
    g.release(); await tick(); await tick();
    chk(feed.status() === 'ready' && feed.ready() && Object.keys(feed.items()).join() === 'a,b' && feed.unread() === 5 && feed.complete() === false, '받으면 ready · 서버가 센 안 읽은 수 · 다 받지 못했음 표시');
    chk(env.changes.join('|') === '' || env.changes.every((c) => c === ''), '처음 받은 우편은 «새 우편» 으로 치지 않는다(앱을 켤 때 우르르 안 뜨게)');
  }
  {
    const { env, feed } = mk(LIB);
    env.server = { a: mail(false) };
    const g = defer(); env.gate = g; g.value = () => ({ items: { a: mail(false) }, unread: 1, complete: true });
    feed.start('ME01'); await tick();
    const second = feed.refresh(); feed.refresh(); await tick();
    chk(env.fetches.length === 1, '받는 중에 또 불러도 요청은 하나(겹치지 않는다)');
    env.gate = null; g.release(); await second; await tick(); await tick();
    chk(env.fetches.length === 2, '  끝난 뒤 한 번 더 받는다(그 사이 바뀐 것을 놓치지 않게)');
  }

  say('── 2. 알림');
  {
    const { env, feed } = mk(LIB);
    env.server = { a: mail(false) }; env.unread = 1;
    env.handlers.notification({ kind: 'notification', section: 'MAIL' });
    chk(env.fetches.length === 0, '로그인 전(내 코드 없음)의 알림은 무시');
    feed.start('ME01'); await tick(); await tick();
    env.changes.length = 0;
    env.server = { a: mail(false), n: mail(false) }; env.unread = 2;
    env.handlers.notification({ kind: 'notification', section: 'MAIL' }); await tick(); await tick();
    chk(env.fetches.length === 2 && Object.keys(feed.items()).length === 2 && env.changes[env.changes.length - 1] === 'n', '새 우편 알림 → 다시 받고, 새로 늘어난 id(n)만 addedIds');
    env.handlers.notification({ kind: 'notification', section: 'BELL' }); await tick();
    chk(env.fetches.length === 2, '종(BELL) 알림은 이 우편과 상관없다 — 받지 않는다');
    env.handlers.notification({ kind: 'notification', section: null }); await tick(); await tick();
    chk(env.fetches.length === 3, '칸이 없는 알림은 받는다(놓치는 쪽이 더 나쁘다)');
    env.handlers.notification({ kind: 'notification', section: 'BELL', resync: true }); await tick(); await tick();
    chk(env.fetches.length === 4, '오래 끊겼다 붙으면(resync) 칸과 상관없이 다시 받는다');
    env.changes.length = 0;
    env.server = {}; env.unread = 0;
    env.handlers.notification({ kind: 'notification', section: 'MAIL' }); await tick(); await tick();
    chk(Object.keys(feed.items()).length === 0 && feed.status() === 'ready' && env.changes.join() === '', '다른 기기에서 지워서 비면 빈 우편 — 새 우편 알림은 없다');
  }

  say('── 3. 못 받음');
  {
    const { env, feed } = mk(LIB);
    env.fail = Object.assign(new Error('x'), { status: 503 });
    feed.start('ME01'); await tick(); await tick();
    chk(feed.status() === 'error' && !feed.ready() && env.errors.join() === 'E-MH-08', '못 받으면 error — 빈 우편으로 그리지 않고 오류 번호 E-MH-08');
    await feed.refresh(); await feed.refresh();
    chk(env.errors.length === 1, '  이어지는 실패는 한 번만 알린다');
    env.fail = null; env.server = { a: mail(false) }; env.unread = 1;
    await feed.refresh();
    chk(feed.status() === 'ready' && feed.ready() && env.errors.length === 1, '  다시 받으면 ready');
    env.fail = new Error('또'); await feed.refresh();
    chk(feed.status() === 'error' && feed.ready() && Object.keys(feed.items()).join() === 'a' && env.errors.length === 2, '  한 번 받은 뒤의 실패 — 다시 알리고(새 실패 줄) 받아 둔 우편은 그대로 둔다');
  }

  say('── 4. 계정 바뀜');
  {
    const { env, feed } = mk(LIB);
    env.server = { a: mail(false) }; env.unread = 1;
    feed.start('A01'); await tick(); await tick();
    const g = defer(); env.gate = g; g.value = (uid) => ({ items: { late: mail(false) }, unread: 1, complete: true });
    feed.start('B02'); await tick();
    chk(Object.keys(feed.items()).length === 0 && feed.status() === 'loading' && !feed.ready(), '다른 계정이면 앞 계정의 우편을 비우고 새로 받는다');
    feed.start('A01');
    env.gate = null; g.release(); await tick(); await tick(); await tick();
    chk(feed.status() === 'ready' && Object.keys(feed.items()).join() === 'a' && !env.snaps.some((x) => x.indexOf('late') >= 0), '늦게 끝난 앞 계정(B)의 응답은 버린다 — 화면에 한 순간도 안 보이고 지금 계정(A) 우편만');
  }
  {
    const { env, feed } = mk(LIB);
    const g = defer(); env.gate = g; g.fail = new Error('늦은 실패');
    feed.start('A01'); await tick();
    feed.start('B02');
    env.gate = null; env.server = { b: mail(false) }; env.unread = 1;
    g.release(); await tick(); await tick(); await tick();
    chk(env.errors.length === 0 && feed.status() === 'ready', '앞 계정의 늦은 실패는 알리지 않는다');
    feed.stop();
    chk(feed.status() === 'idle' && Object.keys(feed.items()).length === 0 && !feed.ready(), 'stop — 비우고 idle');
    chk(await feed.refresh() === false, '  stop 뒤에는 받지 않는다');
  }

  say('── 5. 읽음 · 지우기');
  {
    const { env, feed } = mk(LIB);
    env.server = { a: mail(false), b: mail(false), c: mail(true) }; env.unread = 2;
    chk(await feed.markRead('a') === false && env.writes.length === 0, '받기 전에는 고치지 않는다(요청 0)');
    const g = defer(); env.gate = g; g.value = () => ({ items: env.server, unread: 2, complete: true });
    feed.start('ME01'); await tick();
    chk(feed.status() === 'loading' && await feed.markAllRead() === false && env.writes.length === 0, '받는 중에는 «모두 읽음» 도 보내지 않는다(아직 못 본 우편까지 덮지 않게)');
    env.gate = null; g.release(); await tick(); await tick(); await tick();
    env.changes.length = 0;
    chk(await feed.markRead('a') === true && feed.items().a.read === true && feed.unread() === 1 && env.writes[0].join() === 'read,ME01,a', '읽음 — 서버가 됐다 한 뒤에 읽음 · 안 읽은 수 -1');
    chk(await feed.markRead('a') === true && env.writes.length === 1, '  이미 읽은 것은 다시 안 보낸다');
    chk(await feed.markRead('nope') === false && env.writes.length === 1, '  없는 id 는 안 보낸다');
    chk(await feed.markRead('c') === true && feed.unread() === 1 && env.writes.length === 1, '  읽은 우편을 읽음 처리해도 안 읽은 수는 그대로');
    env.result = 'failed';
    chk(await feed.markRead('b') === false && feed.items().b.read === false && feed.unread() === 1 && env.errors.join() === 'E-MH-10', '실패 — 그대로 두고 오류 번호 E-MH-10');
    env.result = 'stale'; env.errors.length = 0;
    chk(await feed.markRead('b') === false && feed.items().b.read === false && env.errors.length === 0, 'stale(계정이 바뀌는 중) — 그대로 두고 조용히 버린다(번호 없음)');
    env.result = 'ok';
    chk(await feed.markAllRead() === true && feed.unread() === 0 && Object.values(feed.items()).every((m) => m.read), '모두 읽음 — 전부 읽음 · 안 읽은 수 0');
    env.result = 'failed'; env.errors.length = 0;
    env.server = { a: mail(false) };
    chk(await feed.markAllRead() === false && env.errors.join() === 'E-MH-10', '  모두 읽음 실패도 번호');
  }
  {
    const { env, feed } = mk(LIB);
    env.server = { a: mail(false), b: mail(true), c: mail(true), d: mail(false) }; env.unread = 2;
    feed.start('ME01'); await tick(); await tick();
    chk(await feed.remove('a') === true && !('a' in feed.items()) && feed.unread() === 1, '지우기 — 목록에서 빠지고 안 읽은 것이면 수 -1');
    chk(await feed.remove('b') === true && feed.unread() === 1, '  읽은 것을 지우면 안 읽은 수는 그대로');
    env.result = 'failed';
    chk(await feed.remove('c') === false && 'c' in feed.items() && env.errors.join() === 'E-MH-11', '실패 — 목록에 남고 번호 E-MH-11');
    env.result = (id) => (id === 'x' ? 'failed' : 'ok'); env.errors.length = 0; env.writes.length = 0;
    env.server = { w: mail(true), x: mail(true), y: mail(true) };
    await feed.refresh();
    const n = await feed.removeMany(['w', 'x', 'y']);
    chk(n === 1 && !('w' in feed.items()) && 'x' in feed.items() && 'y' in feed.items() && env.writes.length === 2 && env.errors.length === 1, '여러 통 지우기 — 첫 실패(x)에서 멈춘다(y 는 보내지도 않음) · 지운 수 1 · 번호 한 번');
  }

  say('── 6. 배선');
  {
    const A = strip(S.APP);
    chk(/TwMailFeed\.createMailFeed\(\{[\s\S]*?rt: TwRtHub\.store[\s\S]*?\}\);/.test(A) && /TwInboxApi\.createInboxApi\(\{ authed: TwApi\.authed/.test(A), 'app.js — 서버 길과 realtime 알림을 넘겨 만든다');
    chk(!/let _myInbox\b|let _myInboxReady\b|let _inboxBroadcast\b/.test(A), '옛 개인 수령함 · 공용 공지 let 이 app.js 에 없다(원본은 서버)');
    const h = S.HTML;
    chk(h.indexOf('<script src="parts/myhome/mail-feed.js"></script>') > 0 && h.indexOf('<script src="parts/myhome/mail-feed.js"></script>') < h.indexOf('<script src="parts/app.js"></script>'), 'html — mail-feed.js 를 app.js 보다 먼저');
    chk(/PRELOAD\.push\('mail-feed\.js'\)/.test(S.SMOKE), 'smoke PRELOAD');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 7. 일부러 깨 보기');
  const breaks = [
    ['처음 받은 판도 새 우편으로', S.FEED.replace("everReady ? Object.keys", "true ? Object.keys"), '처음 받은 우편'],
    ['받는 중 겹쳐 요청', S.FEED.replace("if(flying){ again = true; return false; }", ""), '요청은 하나'],
    ['계정이 바뀌어도 앞 응답을 씀', S.FEED.replace("      if(mine !== uid) return false;   // 앞 계정에서 받은 우편 — 버린다\n", ""), '앞 계정'],
    ['실패마다 알림', S.FEED.replace("if(!failStreak){ failStreak = true; notifyError('E-MH-08', e); }", "notifyError('E-MH-08', e);"), '한 번만'],
    ['못 받으면 우편을 비움', S.FEED.replace("status = STATUS.ERROR;", "status = STATUS.ERROR; items = {}; everReady = false;"), '그대로 둔다'],
    ['종 알림에도 받음', S.FEED.replace("n.section === SECTION_MAIL", "n.section === SECTION_MAIL || n.section === 'BELL'"), 'BELL'],
    ['받기 전에도 고침', S.FEED.replace("const usable = () => !!uid && everReady;", "const usable = () => !!uid;"), '받기 전'],
    ['서버 답 전에 고침', S.FEED.replace("    if(r !== 'ok') return false;\n    if(items[id] && !items[id].read)", "    if(items[id] && !items[id].read)"), '서버가 됐다'],
    ['여러 통이 실패해도 계속', S.FEED.replace("if(!(await remove(id))) break; n++;", "if(await remove(id)) n++;"), '첫 실패'],
    ['stale 도 번호 알림', S.FEED.replace("if(r === 'failed') notifyError('E-MH-10', null);\n    if(r !== 'ok') return false;\n    if(items[id] && !items[id].read)", "if(r !== 'ok') notifyError('E-MH-10', null);\n    if(r !== 'ok') return false;\n    if(items[id] && !items[id].read)"), 'stale'],
    ['지워도 안 읽은 수 그대로', S.FEED.replace("if(!items[id].read) unread = Math.max(0, unread - 1);\n    delete items[id];", "delete items[id];"), '안 읽은 것이면 수'],
  ];
  for(const [name, src, what] of breaks){
    if(src === S.FEED){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(Object.assign({}, S, { FEED: src })); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
}
runAll();
