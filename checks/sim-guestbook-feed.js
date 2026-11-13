/* ═══ 📖 sim-guestbook-feed.js — 방명록 한 벌 (0.13 앱 묶음 D2-4) ═══
   [왜] 방명록의 원본은 서버다 — 앱은 새 글 수 · 열어 둔 방명록을 받아 보여 주고, 쓰기는 서버가 «됐다» 한 뒤에 맞춘다. 상시 구독·앱이 하던 정리·하루 5번 기억은 걷었다.
   ・1절: 새 글 배지 — 켤 때 숫자 하나만 받음(since = 마지막으로 연 때) · 서버 알림(내 방명록 · 오래 끊겼다 붙음)에만 다시 받음 · 남의 방명록 알림은 무시 ·
          받는 중에 또 부르면 한 번 더만 · 다 읽음 뒤 날아온 옛 숫자는 버림 · 못 받아도 조용히(오류 번호 없음) · 끄면 알림 걸기를 뗀다
   ・2절: 열어 둔 방명록 — 열 때 받음(받는 중 → 받음) · 남의 방명록은 «보는 중» 을 알림(내 것은 안 알림) · 알림이 오면 다시 받음 · 닫으면 비우고 떼기 ·
          주인을 갈아타면 앞 것의 늦은 답을 버림 · 못 받음(연 받기만 번호 한 번) vs 받은 뒤 실패(목록은 그대로) · 연결이 다시 붙으면 알림 다시 걸고 한 번 받음
   ・3절: 쓰기 — canWrite 가 아니면 보내지 않음 · 글 쓰기/지우기 뒤 다시 받음 · 서버 거절을 이름으로 번호에(글자 수 · 친구 아님 · 닿지 못함) · 닿지 못한 글은 같은 번호로 다시 ·
          박수(보내는 중 또 누르면 busy · 하루 몫 다 쓰면 limit 은 오류 번호 없음 · 서버 답의 수) · 폭죽(내 것만 · null 로 끔 · 409 면 다시 받고 번호)
   ・4절: 끝 — 연결이 끝나면(로그아웃 등) 스스로 비움 · 계정이 바뀌면 앞 계정 것을 비움 · 늦게 온 앞 계정 답은 버림
   ・5절: 배선 — createLastReadStore · app.js 에서 만드는 모양 · 오류 표 번호가 error-codes.js 에 다 있음
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
  FEED: pick(['guestbook-feed.js', 'parts/myhome/guestbook-feed.js', 'app/parts/myhome/guestbook-feed.js']),
  ERR: pick(['api-errors.js', 'parts/shared/api-errors.js', 'app/parts/shared/api-errors.js']),
  CODES: pick(['error-codes.js', 'parts/shared/error-codes.js', 'app/parts/shared/error-codes.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadWin = (src, name) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w[name]; };
const TwApiErrors = loadWin(SRC0.ERR, 'TwApiErrors');
const RT = { READY: 'ready', OFF: 'off', CONNECTING: 'connecting', RETRYING: 'retrying', AUTH_FAILED: 'authFailed', SESSION_LOST: 'sessionLost', UPDATE: 'update', MAINTENANCE: 'maintenance', ACCOUNT_GONE: 'accountGone', CLOSED: 'closed' };
const STOPPED = [RT.AUTH_FAILED, RT.SESSION_LOST, RT.UPDATE, RT.MAINTENANCE, RT.ACCOUNT_GONE, RT.CLOSED];   // 연결만 끊긴 여섯 멈춤 상태
const HUB_SRC = pick(['rt-hub.js', 'realtime/rt-hub.js', 'parts/realtime/rt-hub.js', 'app/parts/realtime/rt-hub.js']);
const flush = async (n = 6) => { for(let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const deferred = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
const apiErr = (status, code, kind) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: kind || (status >= 500 ? 'unavailable' : 'request') });
const book = (o) => Object.assign({ entries: [], clap: { count: 1, img: null, emoji: '', todayLeft: 3, dailyMax: 5 }, canWrite: true, version: 2 }, o || {});

function mkEnv(src, opt){
  opt = opt || {};
  const env = { calls: [], notes: [], lastRead: {}, sent: [], kinds: {}, states: [], connected: true, ids: 0, events: [], answers: Object.assign({}, opt.answers || {}) };
  const ans = (name, args) => { env.calls.push(name + ':' + args.join('|')); const a = env.answers[name]; return typeof a === 'function' ? a(...args) : a; };
  const api = {
    fetchView: async (uid, owner) => { const r = await ans('view', [uid, owner]); if(r instanceof Error) throw r; return r === undefined ? book() : r; },
    fetchNewCount: async (uid, since) => { const r = await ans('count', [uid, since]); if(r instanceof Error) throw r; return r === undefined ? 0 : r; },
    write: async (uid, owner, text, rid) => (await ans('write', [uid, owner, text, rid])) || { status: 'ok', entry: { id: 'n1' } },
    remove: async (uid, owner, id) => (await ans('remove', [uid, owner, id])) || { status: 'ok' },
    clap: async (uid, owner, rid) => (await ans('clap', [uid, owner, rid])) || { status: 'ok', count: 9, todayLeft: 1, dailyMax: 5 },
    uploadImage: async (uid, data) => (await ans('upload', [uid, data])) || { status: 'ok', url: 'https://img/u.png' },
    changeLook: async (uid, version, patch) => (await ans('look', [uid, version, JSON.stringify(patch)])) || { status: 'ok' },
  };
  const rt = {
    on: (k, fn) => { (env.kinds[k] = env.kinds[k] || []).push(fn); return () => { const a = env.kinds[k], i = a.indexOf(fn); if(i >= 0) a.splice(i, 1); }; },
    onState: (fn) => { env.states.push(fn); return () => { const i = env.states.indexOf(fn); if(i >= 0) env.states.splice(i, 1); }; },
    send: (m) => { env.sent.push(JSON.stringify(m)); return env.connected; },
  };
  const mod = loadWin(src, 'TwGuestbookFeed');
  const pendingIds = new Map();
  const pending = { idFor: (k) => { if(!pendingIds.has(k)) pendingIds.set(k, 'rid-' + (++env.ids)); return pendingIds.get(k); }, settle: (k) => { pendingIds.delete(k); }, has: (k) => pendingIds.has(k) };
  env.feed = mod.createGuestbookFeed({
    api, rt, rtState: RT, pending,
    lastRead: { get: (u) => env.lastRead[u] || 0, set: (u, t) => { env.lastRead[u] = t; } },
    notifyError: (code, err) => { env.notes.push(code + (err && err.code ? ':' + err.code : '')); return true; },
    translate: (e, t) => TwApiErrors.translate(e, t), ACTION: TwApiErrors.ACTION, now: () => 5000,
  });
  env.feed.onChange((e) => env.events.push(e.kind));
  env.notify = (n) => (env.kinds.guestbook || []).slice().forEach((fn) => fn(n));
  env.state = (s) => env.states.slice().forEach((fn) => fn(s));
  env.hooked = () => (env.kinds.guestbook || []).length + env.states.length;
  env.pend = pendingIds;
  return env;
}
const sec = async (title, fn) => { say(title); try{ await fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + (e && e.stack || e)); } };

async function judge(S){
  const F = S.FEED;

  await sec('── 1. 새 글 배지', async () => {
    const e = mkEnv(F, { answers: { count: 3 } }); e.lastRead.ME = 1234;
    const f = e.feed;
    chk(e.calls.length === 0 && e.hooked() === 0, '만들 때는 요청도 알림 걸기도 없다');
    f.startBadge('ME'); await flush();
    chk(e.calls.join() === 'count:ME|1234' && f.badgeCount() === 3, '켜면 숫자 하나만 받는다 — since = 마지막으로 연 때(이 PC 기억) · 글 목록은 안 받는다');
    chk(e.hooked() === 2, '  서버 알림(guestbook · 연결 상태)을 건다');
    e.answers.count = 5; e.notify({ kind: 'guestbook', subject: 'uOTHER' }); await flush();
    chk(e.calls.length === 1 && f.badgeCount() === 3, '남의 방명록 알림은 배지를 안 건드린다');
    e.notify({ kind: 'guestbook', subject: 'ME' }); await flush();
    chk(e.calls.length === 2 && f.badgeCount() === 5, '내 방명록이 바뀌었다는 알림 → 숫자만 다시 받는다');
    e.answers.count = 6; e.notify({ kind: 'guestbook', subject: null, resync: true }); await flush();
    chk(e.calls.length === 2 && f.badgeCount() === 5, '다시 받기 알림(resync)은 요청을 안 낸다 — 붙을 때 READY 가 이미 받았다');
    chk(e.events.filter((k) => k === 'badge').length >= 2, '  바뀔 때마다 받는 쪽(화면)에 알린다');
    // 받는 중 또 알림 → 끝난 뒤 한 번만 더
    const d = deferred(); e.answers.count = () => d.p; e.calls.length = 0;
    e.notify({ subject: 'ME' }); e.notify({ subject: 'ME' }); e.notify({ subject: 'ME' });
    chk(e.calls.length === 1, '받는 중에 알림이 여러 번 와도 요청은 하나');
    e.answers.count = 7; d.res(6); await flush();
    chk(e.calls.length === 2 && f.badgeCount() === 7, '  끝난 뒤 최신으로 한 번 더');
    // 다 읽음 뒤 옛 숫자
    const d2 = deferred(); e.answers.count = () => d2.p; e.notify({ subject: 'ME' });
    f.markRead(); d2.res(9); await flush();
    chk(e.lastRead.ME === 5000 && f.badgeCount() === 0, '다 읽음 — 지금 시각을 기억하고 숫자를 내린다 · 그 사이 날아온 옛 숫자는 되살리지 못한다');
    // 못 받음
    e.answers.count = apiErr(503, 'X'); e.notes.length = 0; e.notify({ subject: 'ME' }); await flush();
    chk(e.notes.length === 0 && f.badgeCount() === 0, '못 받아도 조용히 — 알림으로 자동 받은 것이라 오류 번호를 띄우지 않는다');
    f.stopBadge();
    chk(e.hooked() === 0 && f.badgeCount() === 0, '끄면 알림 걸기를 모두 뗀다(남아 새는 구독이 없다)');
    e.calls.length = 0; e.notify({ subject: 'ME' }); await flush();
    chk(e.calls.length === 0, '  뗀 뒤엔 알림이 와도 안 받는다');
    f.startBadge(''); chk(e.hooked() === 0 && e.calls.length === 0, '내 코드가 없으면 켜지 않는다(요청 0)');
    // 내 방명록을 받으면 받은 글 중 최신 시각까지 읽은 것 — PC 시계가 늦어도 새 글로 남지 않는다
    const lr = mkEnv(F, { answers: { view: book({ entries: [{ id: 'a', ts: 9e12 }, { id: 'b', ts: 3 }] }), count: 1 } });
    lr.feed.startBadge('ME'); await flush(); lr.feed.openBook('ME', 'ME'); await flush();
    chk(lr.lastRead.ME === 9e12 && lr.feed.badgeCount() === 0, '내 방명록을 받으면 마지막 읽은 때를 받은 글 중 최신 시각(지금보다 앞이어도)까지 올린다');
    lr.feed.markRead(); chk(lr.lastRead.ME === 9e12, '  다 읽음이 더 이른 시각으로 내리지 않는다(max)');
    const lo = mkEnv(F, { answers: { view: book({ entries: [{ id: 'a', ts: 9e12 }] }) } }); lo.feed.startBadge('ME'); await flush(); lo.feed.openBook('ME', 'uOWN'); await flush();
    chk(!lo.lastRead.ME, '  남의 방명록을 봐도 내 마지막 읽은 때는 안 바뀐다');
  });

  await sec('── 2. 열어 둔 방명록', async () => {
    const e = mkEnv(F, { answers: { view: book({ entries: [{ id: 'e1' }] }) } });
    const f = e.feed;
    chk(f.openBook('', 'uOWN') === false && e.calls.length === 0, '내 코드를 모르면 열 수 없다 — 요청 0');
    f.startBadge('ME'); await flush(); e.calls.length = 0;
    chk(f.openBook('ME', 'uOWN') === true && f.status() === 'loading' && f.view() === null, '열면 받는 중 — 아직 받은 것이 없다(빈 목록이 아니다)');
    await flush();
    chk(f.status() === 'ready' && f.view().entries.length === 1 && e.calls[0] === 'view:ME|uOWN', '받으면 ready · 그 주인의 방명록을 달라고 했다');
    chk(e.sent.join() === '{"t":"guestbookWatch","owner":"uOWN"}', '남의 방명록은 «보는 중» 을 서버에 알린다(그래야 그 방명록이 바뀌었다는 알림이 온다)');
    e.calls.length = 0; e.notify({ subject: 'uOWN' }); await flush();
    chk(e.calls.join() === 'view:ME|uOWN', '그 방명록이 바뀌었다는 알림 → 다시 받는다');
    e.notify({ subject: 'uELSE' }); await flush();
    chk(e.calls.length === 1, '다른 방명록 알림은 무시');
    f.closeBook();
    chk(f.view() === null && f.status() === 'idle' && f.owner() === null && e.sent[e.sent.length - 1] === '{"t":"guestbookUnwatch"}', '닫으면 받은 것을 비우고 «보는 중» 을 뗀다');
    chk(e.hooked() === 2, '  배지가 켜져 있으니 알림 걸기는 그대로(배지 몫)');
    f.stopBadge(); chk(e.hooked() === 0, '  배지도 꺼지면 알림 걸기를 모두 뗀다');

    // 내 방명록 — 보는 중을 알리지 않는다
    const m = mkEnv(F); m.feed.startBadge('ME'); await flush();
    m.feed.openBook('ME', 'ME'); await flush();
    chk(!m.sent.some((x) => /guestbookWatch/.test(x)), '내 방명록은 «보는 중» 을 알리지 않는다(주인이라 알림이 원래 온다)');
    m.feed.openBook('ME', 'uOWN'); await flush();
    chk(m.sent.join() === '{"t":"guestbookWatch","owner":"uOWN"}', '  내 것 → 남의 것으로 갈아타면 그때 알린다');
    m.feed.openBook('ME', 'ME'); await flush();
    chk(m.sent[m.sent.length - 1] === '{"t":"guestbookUnwatch"}', '  남의 것 → 내 것으로 돌아오면 뗀다');

    // 갈아타기 — 앞 것의 늦은 답
    const g = mkEnv(F); g.feed.startBadge('ME'); await flush();
    const da = deferred(), db = deferred();
    g.answers.view = (u, o) => (o === 'uA' ? da.p : db.p);
    g.feed.openBook('ME', 'uA'); g.feed.openBook('ME', 'uB');
    db.res(book({ entries: [{ id: 'B' }] })); da.res(book({ entries: [{ id: 'A' }] })); await flush();
    chk(g.feed.owner() === 'uB' && g.feed.view().entries[0].id === 'B', '주인을 갈아타면 앞 방명록의 늦은 답은 버린다(친구 방명록 자리에 내 것이 섞이지 않는다)');
    // 닫은 뒤 늦은 답
    const h = mkEnv(F); h.feed.startBadge('ME'); await flush();
    const dc = deferred(); h.answers.view = () => dc.p; h.feed.openBook('ME', 'uA'); h.feed.closeBook(); dc.res(book()); await flush();
    chk(h.feed.view() === null && h.feed.status() === 'idle', '닫은 뒤에 도착한 답은 버린다');

    // 못 받음
    const x = mkEnv(F, { answers: { view: apiErr(503, 'X') } }); x.feed.startBadge('ME'); await flush();
    x.feed.openBook('ME', 'uOWN'); await flush();
    chk(x.feed.status() === 'error' && x.feed.view() === null && x.notes.join() === 'E-GB-01:X', '창을 열어 받다 실패 → error(빈 목록이 아니다) + 오류 번호 한 번');
    x.feed.refreshBook({ manual: true }); await flush();
    chk(x.notes.length === 1, '  이어지는 실패는 번호를 또 띄우지 않는다');
    x.answers.view = book({ entries: [{ id: 'z' }] }); x.feed.refreshBook({ manual: true }); await flush();
    chk(x.feed.status() === 'ready' && x.feed.view().entries.length === 1, '  «다시 시도» 가 받으면 ready');
    x.answers.view = apiErr(503, 'X'); x.notes.length = 0; x.notify({ subject: 'uOWN' }); await flush();
    chk(x.feed.status() === 'error' && x.feed.view().entries.length === 1 && x.notes.length === 0, '받은 뒤 알림으로 자동 받다 실패 → 상태만 error · 받아 둔 목록은 그대로 · 번호 없음');
    chk(x.calls.filter((c) => c.startsWith('view:')).length === 4, '  혼자 다시 받지 않는다(타이머 되풀이 없음 — 연 · 누른 받기와 알림뿐)');

    // 연결이 끊겼다 붙음
    const r = mkEnv(F); r.connected = false; r.feed.startBadge('ME'); await flush();
    r.feed.openBook('ME', 'uOWN'); await flush(); r.calls.length = 0;
    r.answers.count = 3; r.connected = true; r.state(RT.READY); await flush();
    chk(r.sent.filter((s) => /guestbookWatch/.test(s)).length === 2 && r.calls.join() === 'count:ME|0,view:ME|uOWN', '연결이 없을 때 연 방명록은 다시 붙으면 «보는 중» 을 알리고 한 번 받는다');
    r.state(RT.RETRYING); r.calls.length = 0; await flush();
    chk(r.calls.length === 0, '  재시도 중 상태에서는 아무것도 안 한다');
    chk(r.feed.view() !== null && r.feed.badgeCount() === 3 && r.feed.status() === 'ready', '  재시도 중에도 열린 방명록 · 배지는 그대로 남는다');
    r.state(RT.CONNECTING); await flush();
    chk(r.calls.length === 0 && r.feed.view() !== null && r.feed.status() === 'ready', '  CONNECTING 은 아무것도 안 한다');
    r.calls.length = 0; r.state(RT.READY); r.notify({ kind: 'guestbook', subject: null, resync: true }); await flush();
    chk(r.calls.filter((c) => c.startsWith('count:')).length === 1 && r.calls.filter((c) => c.startsWith('view:')).length === 1, '  READY 바로 뒤 resync 알림이 와도 배지 · 방명록은 각각 한 번만 받는다');
  });

  await sec('── 3. 쓰기', async () => {
    const e = mkEnv(F, { answers: { view: book() } });
    const f = e.feed;
    f.startBadge('ME'); await flush();
    chk((await f.write('hi')).reason === 'closed' && e.calls.filter((c) => c.startsWith('write')).length === 0, '열어 둔 방명록이 없으면 보내지 않는다');
    f.openBook('ME', 'uOWN'); await flush(); e.calls.length = 0;
    const w = await f.write('  안녕  '); await flush();
    chk(w.ok && e.calls[0] === 'write:ME|uOWN|안녕|rid-1', '글 쓰기 — 앞뒤 공백을 자르고 같은 방명록에 · 요청 번호를 실어');
    chk(e.calls[1] === 'view:ME|uOWN', '  서버가 됐다 한 뒤 다시 받아 맞춘다(앱이 글을 정리하지 않는다)');
    chk((await f.write('   ')).reason === 'empty', '빈 글은 보내지 않는다');
    // canWrite
    const b = mkEnv(F, { answers: { view: book({ canWrite: false }) } });
    b.feed.startBadge('ME'); await flush(); b.feed.openBook('ME', 'uFRIEND'); await flush(); b.calls.length = 0;
    chk((await b.feed.write('hi')).reason === 'blocked' && b.calls.length === 0, '서버가 준 canWrite 가 아니면 보내지 않는다(친구 판정은 서버 한 곳)');
    // 서버 거절
    e.answers.write = { status: 'failed', err: apiErr(403, 'GUESTBOOK_NOT_FRIEND') }; e.notes.length = 0; e.calls.length = 0;
    const nf = await f.write('hi'); await flush();
    chk(!nf.ok && nf.code === 'E-GB-03' && e.notes.join() === 'E-GB-03:GUESTBOOK_NOT_FRIEND' && e.calls.some((c) => c.startsWith('view:')), '친구가 아니라는 거절 → E-GB-03 · 다시 받아 canWrite 를 맞춘다');
    e.answers.write = { status: 'failed', err: apiErr(400, 'GUESTBOOK_TEXT_INVALID') };
    chk((await f.write('hi')).code === 'E-GB-02', '글자 수 거절 → E-GB-02');
    e.answers.write = { status: 'failed', err: apiErr(503, 'X') };
    chk((await f.write('hi')).code === 'E-NET-07', '닿지 못함 → 공통 번호(E-NET-07)');
    e.answers.write = { status: 'failed', err: apiErr(500, 'WHAT', 'request') };
    chk((await f.write('hi')).code === 'E-NET-08', '표에 없는 거절 → E-NET-08');
    // 같은 번호
    e.pend.clear(); e.ids = 0; e.answers.write = { status: 'failed', err: apiErr(503, 'X') };
    await f.write('다시'); const id1 = [...e.pend.values()][0];
    await f.write('다시'); const id2 = [...e.pend.values()][0];
    chk(id1 === id2 && e.calls.filter((c) => /^write:.*다시\|rid-1$/.test(c)).length === 2, '닿지 못한 글은 다시 보낼 때 같은 번호(서버가 두 번 쓰지 않게)');
    e.answers.write = { status: 'ok', entry: { id: 'n' } };
    await f.write('다시');
    chk(e.pend.size === 0, '  됐다고 답이 오면 번호를 놓는다(다음 글은 새 번호)');
    e.answers.write = { status: 'failed', err: apiErr(400, 'GUESTBOOK_TEXT_INVALID') }; await f.write('거절');
    chk(![...e.pend.keys()].some((k) => /거절/.test(k)), '  서버가 거절한 글도 번호를 놓는다');
    e.answers.write = { status: 'stale' };
    chk((await f.write('hi')).reason === 'stale', '로그인한 사람이 바뀌는 중(stale)이면 조용히 — 오류 번호 없음');
    chk(!e.notes.includes('E-NET-08:undefined'), '  (stale 은 번호를 띄우지 않았다)');
    e.notes.length = 0; await f.write('hi'); chk(e.notes.length === 0, '  (stale 은 번호를 띄우지 않는다)');
    // 지우기
    e.calls.length = 0; const rm = await f.remove('e1'); await flush();
    chk(rm.ok && e.calls[0] === 'remove:ME|uOWN|e1' && e.calls[1] === 'view:ME|uOWN', '글 지우기 — 서버가 됐다 한 뒤 다시 받는다');
    e.answers.remove = { status: 'failed', err: apiErr(403, 'GUESTBOOK_NOT_AUTHOR') };
    chk((await f.remove('e2')).code === 'E-GB-04', '  남의 글이라는 거절 → E-GB-04');
    // 박수
    e.answers.view = book({ clap: { count: 1, img: null, emoji: '🎉', todayLeft: 2, dailyMax: 5 } }); await f.refreshBook(); e.calls.length = 0;
    const dd = deferred(); e.answers.clap = () => dd.p;
    const c1 = f.clap(); const c2 = await Promise.race([f.clap(), new Promise((r) => setTimeout(() => r({ reason: 'hang' }), 30))]);   // 깨 보면 답이 안 와 멈추니 시간을 둔다
    chk(f.clapBusy() === true && c2.reason === 'busy' && e.calls.filter((c) => c.startsWith('clap')).length === 1, '박수 — 답을 기다리는 동안 또 누르면 보내지 않는다(busy)');
    dd.res({ status: 'ok', count: 9, todayLeft: 1, dailyMax: 5 });
    const r1 = await c1;
    chk(r1.ok && r1.count === 9 && r1.todayLeft === 1 && r1.dailyMax === 5 && f.view().clap.count === 9 && f.view().clap.todayLeft === 1 && f.view().clap.emoji === '🎉', '  서버 답의 수 · 남은 수를 그대로 쓴다(앱이 세지 않는다) · 폭죽 같은 다른 칸은 그대로');
    chk(f.clapBusy() === false, '  끝나면 다시 누를 수 있다');
    e.answers.clap = { status: 'failed', err: apiErr(429, 'GUESTBOOK_CLAP_DAILY_LIMIT') }; e.notes.length = 0; e.calls.length = 0;
    const lim = await f.clap(); await flush();
    chk(lim.reason === 'limit' && e.notes.length === 0 && e.calls.some((c) => c.startsWith('view:')), '하루 몫을 다 쓰면 limit — 오류가 아니라 안내(번호 없음) · 남은 수를 다시 받는다');
    e.answers.clap = { status: 'failed', err: apiErr(503, 'X') };
    chk((await f.clap()).code === 'E-NET-07', '  닿지 못한 박수는 공통 번호');
    // 폭죽 — 남의 방명록에서는 막힘 · 내 것에서만
    chk((await f.setEmoji('🔥')).reason === 'blocked', '폭죽 — 남의 방명록의 폭죽은 못 바꾼다(내 것만)');
    f.openBook('ME', 'ME'); await flush(); e.calls.length = 0; e.answers.look = undefined;
    const em = await f.setEmoji('🔥'); await flush();
    chk(em.ok && e.calls[0] === 'look:ME|2|{"clapEmoji":"🔥"}' && e.calls[1] === 'view:ME|ME', '  내 것은 받은 판(version)으로 보내고 다시 받아 새 판을 맞춘다');
    e.calls.length = 0;
    await f.setEmoji(''); chk(e.calls[0] === 'look:ME|2|{"clapEmoji":null}', '  빈 글은 «끄기»(null) 로 보낸다');
    e.answers.look = { status: 'failed', err: apiErr(409, 'CONCURRENT_UPDATE') }; e.calls.length = 0; e.notes.length = 0;
    const cu = await f.setEmoji('🎈'); await flush();
    chk(!cu.ok && e.notes.join() === 'E-NET-05:CONCURRENT_UPDATE' && e.calls.some((c) => c.startsWith('view:')), '  다른 곳에서 먼저 바뀌었으면(409) 다시 받고 번호를 알린다(덮어쓰지 않는다)');
    e.answers.look = { status: 'failed', err: apiErr(400, 'GUESTBOOK_EMOJI_INVALID') };
    chk((await f.setEmoji('ab')).code === 'E-GB-05', '  이모지가 아니라는 거절 → E-GB-05');
  });

  await sec('── 3-2. 박수 그림 — 올리고 → 주소를 겉모습에', async () => {
    const e = mkEnv(F, { answers: { view: book({ version: 5 }) } }); const f = e.feed;
    f.startBadge('ME'); await flush(); f.openBook('ME', 'uOWN'); await flush();
    chk((await f.setImage('d')).reason === 'blocked', '남의 방명록 그림은 못 바꾼다(내 것만)');
    f.openBook('ME', 'ME'); await flush(); e.calls.length = 0;
    const ok = await f.setImage('data:X'); await flush();
    chk(ok.ok && e.calls[0] === 'upload:ME|data:X' && e.calls[1] === 'look:ME|5|{"clapImageUrl":"https://img/u.png"}' && e.calls[2] === 'view:ME|ME', '올리기 → 받은 주소를 받은 판(version)으로 PATCH → 다시 받아 맞춘다');
    e.answers.upload = { status: 'failed', err: apiErr(413, 'PAYLOAD_TOO_LARGE') }; e.calls.length = 0; e.notes.length = 0;
    const big = await f.setImage('d');
    chk(!big.ok && big.code === 'E-GB-07' && e.calls.length === 1 && e.notes.join() === 'E-GB-07:PAYLOAD_TOO_LARGE', '413 → E-GB-07 · 올리기에 실패하면 겉모습은 건드리지 않는다');
    e.answers.upload = { status: 'failed', err: apiErr(400, 'IMAGE_INVALID') };
    chk((await f.setImage('d')).code === 'E-GB-06', '400 IMAGE_INVALID → E-GB-06');
    e.answers.upload = { status: 'failed', err: apiErr(415, 'UNSUPPORTED_MEDIA_TYPE') };
    chk((await f.setImage('d')).code === 'E-GB-06', '415 → E-GB-06');
    e.answers.upload = { status: 'failed', err: apiErr(503, 'X') };
    chk((await f.setImage('d')).code === 'E-NET-07', '503 (저장소 장애) → 닿지 못함 번호(그림 문제가 아니라고 구분)');
    e.answers.upload = undefined; e.answers.look = { status: 'failed', err: apiErr(409, 'CONCURRENT_UPDATE') }; e.calls.length = 0;
    const cu = await f.setImage('d'); await flush();
    chk(!cu.ok && e.calls.some((c) => c.startsWith('view:')), '둘째가 409 면 다시 받는다');
    e.answers.look = { status: 'failed', err: apiErr(400, 'GUESTBOOK_IMAGE_INVALID') };
    chk((await f.setImage('d')).code === 'E-GB-06', '서버가 주소를 거절(GUESTBOOK_IMAGE_INVALID) → E-GB-06');
    // 올리기와 겉모습 바꾸기 사이에 연결이 끊김(release) → 겉모습을 못 바꿨으니 ok 가 아니다
    e.answers.look = undefined; e.answers.upload = undefined; e.calls.length = 0;
    let relFire = true; e.answers.upload = () => { if(relFire){ e.state(RT.SESSION_LOST); } return undefined; };
    const rel = await f.setImage('d'); await flush();
    chk(!rel.ok && rel.reason === 'gone' && !e.calls.some((c) => c.startsWith('look:')), '올리기 뒤 연결이 끊기면(release) → ok 아님 · 겉모습 PATCH 안 보냄');
    relFire = false; e.state(RT.READY); await flush(); e.calls.length = 0;
    chk((await f.setImage('d')).ok, '다시 붙은 뒤 정상 → ok');
    e.answers.upload = { status: 'ok', url: 'https://img/u.png' }; e.answers.look = { status: 'failed', err: apiErr(500, 'X') };
    chk(!(await f.setImage('d')).ok, '겉모습 PATCH 가 실패하면 → ok 아님');
    e.answers.look = undefined; e.answers.upload = { status: 'stale' };
    chk((await f.setImage('d')).reason === 'stale', '로그인이 바뀌는 중이면 조용히');
  });

  await sec('── 4. 끝 — 연결이 끝남 · 계정이 바뀜', async () => {
    const e = mkEnv(F, { answers: { count: 2, view: book() } });
    e.feed.startBadge('ME'); await flush(); e.feed.openBook('ME', 'uOWN'); await flush(); e.sent.length = 0;
    e.state(RT.OFF); await flush();
    chk(e.feed.view() === null && e.feed.owner() === null && e.feed.badgeCount() === 0 && e.hooked() === 0, '연결이 끝나면(로그아웃 등) 배지 · 방명록 · 알림 걸기를 모두 비운다');
    chk(e.sent.length === 0, '  끝난 연결에는 떼기 메시지를 보내지 않는다');
    const offs = []; const qo = mkEnv(F, { answers: { view: book() } }); qo.feed.onChange((x) => offs.push(x.kind)); qo.feed.openBook('ME', 'uOWN'); await flush(); chk(!offs.includes('off'), '  열기(계정을 비우며 시작해도)는 off 신호를 내지 않는다'); qo.state(RT.OFF); chk(offs.includes('off'), '  연결을 끈 것(OFF)에서만 off 신호를 낸다');
    e.calls.length = 0; e.notify({ subject: 'ME' }); await flush();
    chk(e.calls.length === 0, '  비운 뒤엔 알림이 와도 안 받는다');
    // 다른 계정으로 열면서 앞 계정을 비울 때 «owner 가 빈 book 알림» 을 내지 않는다(화면이 로그아웃으로 읽지 않게)
    const so = mkEnv(F, { answers: { view: book() } }); const evs = [];
    so.feed.startBadge('ME'); await flush(); so.feed.onChange((x) => evs.push(x.kind + ':' + so.feed.owner()));
    so.feed.openBook('YOU', 'uOWN'); await flush();
    chk(!evs.includes('book:null') && evs.includes('book:uOWN') && so.feed.status() === 'ready', '다른 계정으로 열면서 앞 계정을 비워도 «비어 있음» 알림은 내지 않는다(곧바로 받는 중부터 알림)');
    // 연결만 끊김(OFF 아님) — 받은 것만 거두고 걸기는 둔다. 다시 붙으면(«여기서 계속») 받는다
    for(const st of STOPPED){
      const q = mkEnv(F, { answers: { count: 4, view: book({ entries: [{ id: 'k' }] }) } });
      q.feed.startBadge('ME'); await flush(); q.feed.openBook('ME', 'uOWN'); await flush();
      q.state(st); await flush();
      chk(q.feed.view() === null && q.feed.badgeCount() === 0 && q.feed.status() === 'error' && q.feed.owner() === 'uOWN' && q.hooked() === 2, '  ' + st + ' — 받은 값만 거둔다(열린 방명록은 «못 받음» · 알림 걸기 · 내 코드는 그대로)');
      q.calls.length = 0; q.sent.length = 0; q.state(RT.READY); await flush();
      chk(q.calls.join() === 'count:ME|0,view:ME|uOWN' && q.feed.badgeCount() === 4 && q.feed.view().entries.length === 1 && q.sent.join() === '{"t":"guestbookWatch","owner":"uOWN"}', '    다시 붙으면 배지 · 열린 방명록을 받고 «보는 중» 을 다시 알린다');
      q.feed.closeBook(); q.calls.length = 0;
      q.state(st); q.state(RT.READY); await flush();
      q.calls.length = 0;
      chk(q.feed.openBook('ME', 'uOWN') === true, '    다시 붙은 뒤에도 방명록을 열 수 있다(내 코드는 입구에서 받는다)');
      await flush();
      chk(q.feed.status() === 'ready', '      받는다');
      q.state(st); q.calls.length = 0; q.feed.refreshBook({ manual: true }); await flush();
      chk(q.calls.join() === 'view:ME|uOWN', '    끊긴 채 «다시 시도» 도 요청을 낸다(무반응이 아니다)');
    }
    // 배지만 켜 둔 채 끊겼다 붙음 · 배지를 안 켜고 방명록만 연 경우
    const bo = mkEnv(F, { answers: { view: book() } }); bo.feed.openBook('ME', 'uOWN'); await flush();
    chk(bo.feed.status() === 'ready' && bo.hooked() === 2, '배지를 켠 적 없어도 입구에서 내 코드를 받아 방명록이 열린다');
    // 계정이 바뀜
    const a = mkEnv(F); const dv = deferred(); a.answers.view = () => dv.p;
    a.feed.startBadge('ME'); await flush(); a.feed.openBook('ME', 'uOWN');
    a.feed.startBadge('YOU'); dv.res(book({ entries: [{ id: 'old' }] })); await flush();
    chk(a.feed.owner() === null && a.feed.view() === null, '다른 계정으로 켜면 앞 계정의 열린 방명록을 비우고 · 늦게 온 앞 계정의 답은 버린다');
    a.answers.view = book(); const wr = await a.feed.write('hi');
    chk(wr.reason === 'closed', '  앞 계정의 방명록에는 쓸 수 없다');
  });

  await sec('── 5. 배선', () => {
    const LR = loadWin(F, 'TwGuestbookFeed').createLastReadStore;
    const store = {}; const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
    const lr = LR(ls);
    lr.set('ME', 1730000000000);
    chk(store['tw.mhGbLastRead:ME'] === '1730000000000' && lr.get('ME') === 1730000000000 && lr.get('NEW') === 0, '마지막으로 연 때 — tw.mhGbLastRead:<코드> (계정 칸) · 없으면 0');
    store['tw.mhGbLastRead:BAD'] = 'abc'; chk(lr.get('BAD') === 0, '  깨진 값은 0');
    const lr2 = LR({ getItem(){ throw new Error('x'); }, setItem(){ throw new Error('x'); } });
    let ok = true; try{ lr2.set('A', 1); chk(lr2.get('A') === 0, '  저장소가 막혀 있어도 던지지 않는다'); }catch(_){ ok = false; }
    chk(ok, '  (저장소 오류를 삼킨다)');
    const a = S.APP.replace(/\/\*[\s\S]*?\*\//g, ' ');
    chk(/TwGuestbookFeed\.createGuestbookFeed\(\{[\s\S]*?rt: TwRtHub\.store,[\s\S]*?rtState: TwRtHub\.STATE,[\s\S]*?pending: TwRequestId\.createPending\(\)[\s\S]*?lastRead: TwGuestbookFeed\.createLastReadStore\(localStorage\)/.test(a), 'app.js — 실제 realtime · 요청 번호 · 이 PC 기억을 넘겨 만든다');
    const hub = { exports: {} }; new Function('module', 'window', HUB_SRC)(hub, undefined);
    const known = new Set([RT.READY, RT.OFF, RT.CONNECTING, RT.RETRYING, ...STOPPED]);
    const hubStates = Object.values(hub.exports.STATE);
    chk(hubStates.length >= 10 && hubStates.every((v) => known.has(v)) && Object.entries(RT).every(([, v]) => hubStates.includes(v)), 'rt-hub 의 STATE 값이 이 검사가 나눈 상태(READY · OFF · CONNECTING · RETRYING · 멈춤 여섯)와 같다 — 새 상태가 생기면 여기서 빨강');
    const CODES = loadWin(S.CODES, 'TwErrorCodes');
    const used = [...F.matchAll(/'(E-[A-Z]+-\d\d)'/g)].map((m) => m[1]);
    chk(used.length >= 5 && used.every((c) => CODES.CODES[c]), 'feed 가 쓰는 오류 번호(' + [...new Set(used)].join(' · ') + ')가 error-codes.js 표에 다 있다');
  });
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 6. 일부러 깨 보기');
  const breaks = [
    ['배지를 상시 받음(알림 없이 켤 때 목록)', S.FEED.replace("api.fetchNewCount(who, lastRead.get(who))", "api.fetchNewCount(who, 0)"), 'since'],
    ['남의 방명록 알림에도 배지를 다시 받음', S.FEED.replace("if(badgeOn && subject === me) refreshBadge();", "if(badgeOn) refreshBadge();"), '남의 방명록 알림'],
    ['다 읽음 뒤 옛 숫자를 버리지 않음', S.FEED.replace("badgeGen++; badgeNum = 0;\n    emit('badge');\n  }\n\n  /* ── 열어", "badgeNum = 0;\n    emit('badge');\n  }\n\n  /* ── 열어"), '옛 숫자'],
    ['배지 끄기가 알림 걸기를 안 뗌', S.FEED.replace("    badgeOn = false; badgeNum = 0; badgeGen++;\n    unhookIfIdle();", "    badgeOn = false; badgeNum = 0; badgeGen++;"), '알림 걸기를 모두 뗀다'],
    ['남의 방명록 «보는 중» 을 안 알림', S.FEED.replace("if(owner && owner !== me){", "if(false){"), '보는 중'],
    ['내 방명록도 «보는 중» 을 알림', S.FEED.replace("if(owner && owner !== me){", "if(owner){"), '내 방명록은'],
    ['닫아도 «보는 중» 을 안 뗌', S.FEED.replace("    syncWatch();   // owner 가 없으니", "    // (떼기 빠짐)   // owner 가 없으니"), '뗀다'],
    ['갈아탄 뒤 앞 방명록의 답을 씀', S.FEED.replace("if(gen !== bookGen) return false;   // 앞 방명록에서 받은 것 — 버린다", ""), '늦은 답'],
    ['못 받음을 빈 방명록으로 숨김', S.FEED.replace("status = STATUS.ERROR;\n        if(manual", "status = STATUS.READY; view = view || { entries: [], clap: { count: 0, img: null, emoji: '', todayLeft: 0, dailyMax: 0 }, canWrite: false, version: 0 };\n        if(manual"), '빈 목록이 아니다'],
    ['자동 받기 실패에도 번호를 띄움', S.FEED.replace("if(manual && !failStreak){", "if(!failStreak){"), '번호 없음'],
    ['canWrite 를 안 봄', S.FEED.replace("if(!view || !view.canWrite) return { ok: false, reason: 'blocked' };", ""), 'canWrite'],
    ['쓴 뒤 다시 안 받음', S.FEED.replace("    refreshBook();\n    return { ok: true };\n  }\n  async function remove", "    return { ok: true };\n  }\n  async function remove"), '다시 받아 맞춘다'],
    ['닿지 못한 글의 번호를 놓음', S.FEED.replace("if(r.status === 'ok' || (r.status === 'failed' && answered(r.err))) ids.settle(key);\n    if(!same(who, ow)) return { ok: false, reason: 'gone' };\n    if(r.status === 'stale') return { ok: false, reason: 'stale' };\n    if(r.status === 'failed') return fail(r.err);\n    refreshBook();\n    return { ok: true };\n  }\n  async function remove", "ids.settle(key);\n    if(!same(who, ow)) return { ok: false, reason: 'gone' };\n    if(r.status === 'stale') return { ok: false, reason: 'stale' };\n    if(r.status === 'failed') return fail(r.err);\n    refreshBook();\n    return { ok: true };\n  }\n  async function remove"), '같은 번호'],
    ['박수 중복을 막지 않음', S.FEED.replace("if(clapping) return { ok: false, reason: 'busy' };", ""), 'busy'],
    ['하루 몫 다 씀을 오류로 띄움', S.FEED.replace("{ refreshBook(); return { ok: false, reason: 'limit' }; }", "{ refreshBook(); return fail(r.err); }"), 'limit'],
    ['박수 수를 앱이 셈', S.FEED.replace("count: r.count, todayLeft: r.todayLeft, dailyMax: r.dailyMax }) });", "count: (view.clap.count || 0) + 1, todayLeft: r.todayLeft, dailyMax: r.dailyMax }) });"), '서버 답의 수'],
    ['남의 방명록 폭죽을 바꿈', S.FEED.replace("if(owner !== me || !view) return { ok: false, reason: 'blocked' };", "if(!view) return { ok: false, reason: 'blocked' };"), '내 것만'],
    ['폭죽 끄기를 빈 글로 보냄', S.FEED.replace("v === '' ? null : v", "v"), 'null'],
    ['409 를 다시 받지 않음', S.FEED.replace("if(t.action === deps.ACTION.REFETCH || (err && err.code === NOT_FRIEND_CODE)) refreshBook();", ""), '다시 받고'],
    ['연결 끝나도 안 비움', S.FEED.replace("      reset();   // 연결을 끈 것", "      // reset();   // 연결이 끝났다"), '연결이 끝나면'],
    ['다시 붙어도 보는 중을 안 알림', S.FEED.replace("if(owner){ syncWatch(); refreshBook(); }", "if(owner){ refreshBook(); }"), '다시 붙으면'],
    ['계정이 바뀌어도 안 비움', S.FEED.replace("if(uid !== me){ reset(); me = uid; }", "me = uid;"), '다른 계정으로 켜면'],
    ['올리기 실패에도 겉모습을 보냄', S.FEED.replace("      if(r.status === 'ok'){\n        // 올리는", "      {\n        // 올리는"), '올리기에 실패하면'],
    ['올리기 뒤 끊겨도 성공으로 돌려줌', S.FEED.replace("if(!same(who, ow) || gen !== bookGen || !view) return { ok: false, reason: 'gone' };", ""), 'release'],
    ['413 번호 표 빠짐', S.FEED.replace("notifyError('E-GB-07', e)", "notifyError('E-NET-06', e)"), '413'],
    ['남의 방명록 그림을 바꿈', S.FEED.replace("if(owner !== me || !view) return { ok: false, reason: 'blocked' };\n    if(looking) return { ok: false, reason: 'busy' };\n    const who = me, ow = owner, gen = bookGen;\n    looking = true;\n    let r;\n    try{\n      r = await api.upload", "if(!view) return { ok: false, reason: 'blocked' };\n    if(looking) return { ok: false, reason: 'busy' };\n    const who = me, ow = owner, gen = bookGen;\n    looking = true;\n    let r;\n    try{\n      r = await api.upload"), '내 것만'],
    ['열면서 비울 때도 알림', S.FEED.replace("reset(true); me = uid; }   // 알리지 않는다", "reset(); me = uid; }   // 알리지 않는다"), '비우며 열기'],
    ['끊김(OFF 아님)에도 모두 비움', S.FEED.replace("      release();   // 연결만 끊겼다", "      reset();   // 연결만 끊겼다"), '다시 붙으면'],
    ['다시 붙어도 배지를 안 받음', S.FEED.replace("      if(badgeOn) refreshBadge();\n      if(owner){ syncWatch(); refreshBook(); }", "      if(owner){ syncWatch(); refreshBook(); }"), '배지 · 열린 방명록'],
    ['열 때 내 코드를 배지에서만 앎', S.FEED.replace("    if(!uid || !ow) return false;\n    if(uid !== me){ reset(true); me = uid; }   // 알리지 않는다 — 바로 아래에서 받는 중을 알린다", "    if(!me || !ow) return false;"), '입구에서 받는다'],
    ['받은 글 시각을 안 올림', S.FEED.replace("if(newest > lastRead.get(who)){", "if(false){"), '최신 시각'],
    ['다 읽음이 시각을 내림', S.FEED.replace("Math.max(now(), lastRead.get(me))", "now()"), '(max)'],
    ['점검(MAINTENANCE)에서 안 거둠', S.FEED.replace(" || s === RT.MAINTENANCE", ""), 'maintenance'],
    ['다시 받기 알림(resync)을 또 받음', S.FEED.replace("    if(n && n.resync) return;", "    const all = !!(n && n.resync);").replace("if(badgeOn && subject === me)", "if(badgeOn && (all || subject === me))").replace("if(owner && subject === owner)", "if(owner && (all || subject === owner))"), 'resync'],
    ['오류 번호 표 빠짐', S.FEED.replace("notifyError('E-GB-03', e)", "notifyError('E-GB-99', e)"), 'error-codes.js 표'],
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
