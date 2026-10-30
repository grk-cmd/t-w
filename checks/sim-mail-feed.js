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
  RD: pick(['retry-delay.js', 'parts/shared/retry-delay.js', 'app/parts/shared/retry-delay.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwMailFeed || w.TwRetryDelay; };
const RD = SRC0.RD;
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const tick = () => new Promise((r) => setImmediate(r));
const mail = (read, tag) => ({ tag: tag || 'reward', title: 't', body: 'b', ts: 1, read: !!read });

/* 가짜 한 벌 — api 는 부른 것을 적고 정한 답을 낸다(손으로 풀 수 있는 답도). rt 는 건 함수를 모아 둔다. */
function mkEnv(){
  const env = { server: {}, unread: 0, fetches: [], writes: [], errors: [], timers: [], cleared: [], viewing: true, wgate: null, changes: [], snaps: [], handlers: {}, result: 'ok', fail: null, gate: null };
  const api = {
    fetchMail: async (uid) => {
      env.fetches.push(uid);
      if(env.gate){ const g = env.gate; await g.promise; if(g.fail) throw g.fail; return g.value(uid); }
      if(env.fail) throw env.fail;
      return { items: JSON.parse(JSON.stringify(env.server)), unread: env.unread, complete: true };
    },
    markRead: async (uid, id) => { env.writes.push(['read', uid, id]); if(env.wgate) await env.wgate.promise; return env.result; },
    markAllRead: async (uid) => { env.writes.push(['all', uid]); if(env.wgate) await env.wgate.promise; return env.result; },
    remove: async (uid, id) => { env.writes.push(['del', uid, id]); if(env.wgate) await env.wgate.promise; return typeof env.result === 'function' ? env.result(id) : env.result; },
  };
  const rt = { on: (kind, fn) => { env.handlers[kind] = fn; return () => {}; } };
  return { env, api, rt };
}
function mk(src){
  const e = mkEnv();
  const feed = load(src).createMailFeed({ api: e.api, rt: e.rt, notifyError: (c, err) => e.env.errors.push(c), isViewing: () => e.env.viewing, 
    retryDelay: (n) => load(RD).delay(n), setTimer: (fn, ms) => { const t = { ms, live: true }; t.fn = () => { t.live = false; fn(); }; e.env.timers.push(t); return e.env.timers.length - 1; }, clearTimer: (id) => { if(e.env.timers[id]) e.env.timers[id].live = false; e.env.cleared.push(id); } });
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

  say('── 1-2. busy() — 지금 받는 중인가');
  {
    const { env, feed } = mk(LIB);
    chk(feed.busy() === false, '시작 전은 false');
    const g = defer(); env.gate = g; g.value = () => ({ items: { a: mail(false) }, unread: 1, complete: true });
    feed.start('ME01'); await tick();
    chk(feed.busy() === true, '받는 중에는 true');
    if(!feed.busy()) feed.refresh({ manual: true });   // 받는 중이면 건너뛴다(retryIfFailed 와 같은 판단)
    g.release(); await tick(); await tick(); await tick();
    chk(feed.busy() === false && env.fetches.length === 1, '성공 뒤 false · 받는 중 busy 를 보고 건너뛰면 끝난 뒤 fetch 는 1번(겹쳐 한 번 더 나가지 않는다)');
    const e2 = mk(LIB); const g2 = defer(); e2.env.gate = g2; g2.fail = new Error('x');
    e2.feed.start('ME01'); await tick();
    const during = e2.feed.busy();
    g2.release(); await tick(); await tick(); await tick();
    chk(during === true && e2.feed.busy() === false && e2.feed.status() === 'error', 'fetch 가 던진 뒤에도 false(받는 중에 머물지 않는다)');
    const e3 = mk(LIB); const g3 = defer(); e3.env.gate = g3; g3.value = (uid) => ({ items: { [uid]: mail(false) }, unread: 1, complete: true });
    e3.feed.start('A01'); await tick(); e3.feed.start('B02'); await tick();
    g3.release(); await tick(); await tick(); await tick(); await tick();
    chk(e3.feed.busy() === false && Object.keys(e3.feed.items()).join() === 'B02', '받는 중 계정이 바뀌어 앞 계정 응답이 버려진 뒤에도 false(새 계정 우편만)');
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

  say('── 5-2. 늦은 응답 (지우기 경쟁 · 계정 바뀜)');
  {
    /* 지우기 응답을 기다리는 사이 다시 받기가 끝나 그 우편이 이미 목록에서 빠졌다 → 던지지 않고 true · removeMany 도 끝까지 */
    const { env, feed } = mk(LIB);
    env.server = { a: mail(true), b: mail(true), c: mail(true) }; env.unread = 0;
    feed.start('ME01'); await tick(); await tick();
    const g = defer(); env.wgate = g;
    const p = feed.removeMany(['a', 'b', 'c']);
    await tick();
    env.server = { c: mail(true) };   // 그 사이 서버 쪽에서 a · b 가 지워진 채 다시 받음
    await feed.refresh();
    env.wgate = null; g.release();
    let thrown = null, n = -1;
    try{ n = await p; }catch(e){ thrown = e; }
    chk(!thrown && n === 3 && Object.keys(feed.items()).length === 0, '지우기 응답 전에 다시 받기가 그 우편을 뺐어도 던지지 않는다 — removeMany 가 끝까지(3통)');
  }
  for(const what of ['read', 'all', 'del']){
    const { env, feed } = mk(LIB);
    env.server = { a: mail(false), b: mail(false) }; env.unread = 2;
    feed.start('U1'); await tick(); await tick();
    const g = defer(); env.wgate = g;
    const p = what === 'read' ? feed.markRead('a') : what === 'all' ? feed.markAllRead() : feed.remove('a');
    await tick();
    env.wgate = null; env.server = { a: mail(false), b: mail(false), z: mail(false) }; env.unread = 3;
    feed.start('U2'); await tick(); await tick();
    env.changes.length = 0; env.errors.length = 0;
    g.release();
    const r = await p;
    chk(r === false && feed.unread() === 3 && Object.values(feed.items()).every((m) => m.read === false) && Object.keys(feed.items()).length === 3 && env.changes.length === 0,
      '쓰는 사이 계정이 바뀌면(' + (what === 'read' ? '읽음' : what === 'all' ? '모두 읽음' : '지우기') + ') 새 계정 우편 · 안 읽은 수를 건드리지 않고 알리지도 않는다');
  }
  {
    const { env, feed } = mk(LIB);
    env.server = { a: mail(false) }; env.unread = 1;
    feed.start('U1'); await tick(); await tick();
    const g = defer(); env.wgate = g; env.result = 'failed';
    const p = feed.markRead('a'); await tick();
    env.wgate = null; feed.start('U2'); await tick(); await tick(); env.errors.length = 0;
    g.release(); await p;
    chk(env.errors.length === 0, '  앞 계정 쓰기의 늦은 실패도 새 계정에 오류 번호를 띄우지 않는다');
  }

  {
    const e = mkEnv();
    let thrown = null; try{ load(LIB).createMailFeed({ api: e.api, rt: e.rt, notifyError: () => {} }); }catch(x){ thrown = x; }
    chk(thrown && /isViewing/.test(thrown.message), 'isViewing 없이 만들면 던진다(조용히 «안 보임» 으로 두지 않는다)');
  }
  say('── 5-3. 스스로 다시 받기 · 오류 번호는 보는 동안만');
  {
    const { env, feed } = mk(LIB);
    env.fail = new Error('x'); env.viewing = false;
    feed.start('ME01'); await tick(); await tick();
    chk(feed.status() === 'error' && env.errors.length === 0, '알림함을 안 보는 동안 못 받으면 상태만 error — 오류 번호는 안 띄운다(화면 안 안내는 그대로)');
    chk(env.timers.length === 1 && env.timers[0].ms === 30000 && env.timers[0].live, '  30초 뒤 스스로 다시 받도록 건다');
    env.timers[0].fn(); await tick(); await tick();
    chk(env.fetches.length === 2 && env.timers.length === 2 && env.timers[1].ms === 60000, '  타이머가 돌면 다시 받고, 또 못 받으면 두 배(60초)');
    for(let i = 2; i < 9; i++){ env.timers[i - 1].fn(); await tick(); await tick(); }
    chk(env.timers[env.timers.length - 1].ms === 600000, '  10분이 상한');
    env.viewing = true;
    env.timers[env.timers.length - 1].fn(); await tick(); await tick();
    chk(env.errors.join() === 'E-MH-08', '  알림함을 보는 중에 또 못 받으면 그때 번호를 한 번 띄운다');
    env.timers[env.timers.length - 1].fn(); await tick(); await tick();
    chk(env.errors.length === 1, '  이어지는 실패는 더 안 띄운다');
    env.fail = null; env.server = { a: mail(false) }; env.unread = 1;
    env.timers[env.timers.length - 1].fn(); await tick(); await tick();
    chk(feed.status() === 'ready' && env.timers.filter((t) => t.live).length === 0, '  받으면 다시 받기 타이머를 거둔다');
    env.fail = new Error('또'); await feed.refresh(); await tick();
    chk(env.timers.filter((t) => t.live).length === 1, '  다시 실패하면 타이머가 다시 선다');
    env.fail = null; await feed.refresh(); await tick();
    chk(env.timers.filter((t) => t.live).length === 0, '  다른 길(알림 · 다시 시도)로 받아져도 기다리던 타이머를 거둔다');
    env.fail = new Error('또'); await feed.refresh(); await tick();
    chk(env.timers[env.timers.length - 1].ms === 30000, '  성공한 뒤의 첫 실패는 다시 30초부터(초기화)');
  }
  {
    const { env, feed } = mk(LIB);
    env.fail = new Error('x'); env.viewing = false;
    feed.start('ME01'); await tick(); await tick();
    await feed.refresh({ manual: true });
    chk(env.errors.join() === 'E-MH-08', '«다시 시도» 를 눌러 못 받으면(화면을 안 봐도) 번호를 띄운다');
    feed.start('OTHER'); await tick(); await tick();
    chk(env.timers[0].live === false, '계정이 바뀌면 앞 계정의 다시 받기를 취소한다');
    const live = env.timers.filter((t) => t.live).length;
    feed.stop();
    chk(env.timers.every((t) => !t.live) && live >= 1, 'stop 이면 다시 받기를 취소한다');
  }

  say('── 6. 배선');
  {
    const A = strip(S.APP);
    chk(/TwMailFeed\.createMailFeed\(\{[\s\S]*?rt: TwRtHub\.store[\s\S]*?\}\);/.test(A) && /TwInboxApi\.createInboxApi\(\{ authed: TwApi\.authed/.test(A), 'app.js — 서버 길과 realtime 알림을 넘겨 만든다');
    chk(/isViewing: _mailboxVisible,/.test(A) && /retryDelay: TwRetryDelay\.delay/.test(A), 'app.js — 알림함이 보이는지 · 다시 받기 재료를 넘긴다');
    const fnSrc = (String(S.APP).match(/function _mailboxVisible\(\)\{[\s\S]*?\n\}/) || [''])[0];
    const vis = (el) => new Function('document', fnSrc + '\nreturn _mailboxVisible();')({ getElementById: () => el });
    chk(fnSrc && vis(null) === false && vis({ offsetParent: null }) === false && vis({ offsetParent: {} }) === true, 'app.js — 알림함이 보이나: 칸이 없거나 숨어 있으면(offsetParent 없음) 거짓 · 보이면 참');
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
    ['busy 가 늘 false', S.FEED.replace('busy: () => flying', 'busy: () => false'), 'busy()'],
    ['처음 받은 판도 새 우편으로', S.FEED.replace("everReady ? Object.keys", "true ? Object.keys"), '처음 받은 우편'],
    ['받는 중 겹쳐 요청', S.FEED.replace("if(flying){ again = true; return false; }", ""), '요청은 하나'],
    ['계정이 바뀌어도 앞 응답을 씀', S.FEED.replace("      if(mine !== uid) return false;   // 앞 계정에서 받은 우편 — 버린다\n", ""), '앞 계정'],
    ['실패마다 알림', S.FEED.replace("{ failStreak = true; notifyError('E-MH-08', e); }", "{ notifyError('E-MH-08', e); }"), '한 번만'],
    ['못 받으면 우편을 비움', S.FEED.replace("status = STATUS.ERROR;", "status = STATUS.ERROR; items = {}; everReady = false;"), '그대로 둔다'],
    ['종 알림에도 받음', S.FEED.replace("n.section === SECTION_MAIL", "n.section === SECTION_MAIL || n.section === 'BELL'"), 'BELL'],
    ['받기 전에도 고침', S.FEED.replace("const usable = () => !!uid && everReady;", "const usable = () => !!uid;"), '받기 전'],
    ['서버 답 전에 고침', S.FEED.replace("    if(r !== 'ok') return false;\n    if(items[id] && !items[id].read)", "    if(items[id] && !items[id].read)"), '서버가 됐다'],
    ['여러 통이 실패해도 계속', S.FEED.replace("if(!(await remove(id))) break;\n      n++;", "if(await remove(id)) n++;"), '첫 실패'],
    ['stale 도 번호 알림', S.FEED.replace("if(r === 'failed') notifyError('E-MH-10', null);\n    if(r !== 'ok') return false;\n    if(items[id] && !items[id].read)", "if(r !== 'ok') notifyError('E-MH-10', null);\n    if(r !== 'ok') return false;\n    if(items[id] && !items[id].read)"), 'stale'],
    ['지우기 응답 뒤 없는 id 를 만짐', S.FEED.replace("    if(items[id]){\n      if(!items[id].read) unread = Math.max(0, unread - 1);\n      delete items[id];\n    }", "    if(!items[id].read) unread = Math.max(0, unread - 1);\n    delete items[id];"), '던지지 않는다'],
    ['모두 읽음 늦은 응답이 새 계정을 고침', S.FEED.replace("    const r = await api.markAllRead(who);\n    if(who !== uid) return false;", "    const r = await api.markAllRead(who);"), '모두 읽음'],
    ['읽음 늦은 응답이 새 계정을 고침', S.FEED.replace("    const r = await api.markRead(who, id);\n    if(who !== uid) return false;", "    const r = await api.markRead(who, id);"), '읽음'],
    ['지우기 늦은 응답이 새 계정을 고침', S.FEED.replace("    const r = await api.remove(who, id);\n    if(who !== uid) return false;", "    const r = await api.remove(who, id);"), '지우기'],
    ['isViewing 없어도 만들어짐', S.FEED.replace("if(!isViewing) throw new Error('[우편] isViewing 이 필요해요 — 알림함이 보이는지 알려 주는 함수');", ''), 'isViewing 없이'],
    ['안 보는 중에도 번호를 띄움', S.FEED.replace("(manual || isViewing())", "true"), '보는 동안만'],
    ['다시 시도에도 번호 안 띄움', S.FEED.replace("(manual || isViewing())", "isViewing()"), '다시 시도'],
    ['다시 받기 시간이 안 늘어남', S.FEED.replace("    failCount++;\n", ""), '두 배'],
    ['받아도 타이머를 안 거둠', S.FEED.replace("failStreak = false; failCount = 0; cancelRetry();\n      emit", "failStreak = false; failCount = 0;\n      emit"), '타이머를 거둔다'],
    ['계정이 바뀌어도 타이머가 남음', S.FEED.replace("failCount = 0; manualNext = false; cancelRetry(); }", "failCount = 0; manualNext = false; }"), '취소'],
    ['지워도 안 읽은 수 그대로', S.FEED.replace("if(!items[id].read) unread = Math.max(0, unread - 1);\n      delete items[id];", "delete items[id];"), '안 읽은 것이면 수'],
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
