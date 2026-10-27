/*
 * realtime 연결 공통부 검사 — realtime-link.js 를 가짜 웹소켓 · 가짜 시계로 그대로 돌린다.
 * 방 연결(room-server-net.js)이 이것 위에서 그대로 도는지는 sim-room-server-net.js 가 본다. 여기는 공통부만:
 * 1. 순수 — jwtExpMs · LINK_TIMING · import 없음
 * 2. 열기 · hello(선택 칸 helloExtra) · ready · 토큰 없음 → auth
 * 3. rid 요청 — answers 로 답 짝짓기 · rid 없는 답(ridless 켬/끔) · badRequest(ref · ref 없음) · 시간 초과 · 끊기면 null
 * 4. 끊김 → onClosed(wasReady, fatal) · 다시 붙기 백오프(reconnectWanted) · markAuthRetry → getToken(true)
 * 5. 토큰 갱신 hello 에도 선택 칸 · 쉬면 닫기(idleCloseMs · busy) · 못 붙은 주소 1분 쉼 · retry · 주소 바뀜(switchOk)
 * 6. firebase-init 연결 — import 하고 방 연결에 createLink 로 넘긴다
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('realtime-link.js'), FI = read('firebase-init.js');
for(const [n, v] of [['realtime-link.js', SRC], ['firebase-init.js', FI]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const names = [...SRC.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
const M = new Function('Buffer', SRC.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')(Buffer);

const tick = async () => { for(let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
function mkClock(){
  const c = { t: 1_800_000_000_000, q: [], id: 0 };
  c.setTimeout = (f, ms) => { const h = { id: ++c.id, at: c.t + Math.max(0, ms | 0), f }; c.q.push(h); return h; };
  c.clearTimeout = (h) => { const i = c.q.indexOf(h); if(i >= 0) c.q.splice(i, 1); };
  c.advance = async (ms) => {
    const end = c.t + ms;
    for(;;){
      await tick();
      c.q.sort((a, b) => a.at - b.at || a.id - b.id);
      const h = c.q[0];
      if(!h || h.at > end) break;
      c.t = h.at; c.q.shift(); h.f();
    }
    c.t = end;
    await tick();
  };
  return c;
}
function mkWS(){
  const socks = [];
  class FakeWS {
    constructor(url){ this.url = url; this.sent = []; this.closed = false; socks.push(this); }
    send(s){ if(this.closed) throw new Error('closed'); this.sent.push(JSON.parse(s)); }
    close(){ if(this.closed) return; this.closed = true; if(this.onclose) this.onclose({}); }
    open(){ if(this.onopen) this.onopen(); }
    msg(m){ if(this.onmessage) this.onmessage({ data: JSON.stringify(m) }); }
    last(t){ return [...this.sent].reverse().find((x) => x.t === t) || null; }
    all(t){ return this.sent.filter((x) => x.t === t); }
  }
  return { FakeWS, socks };
}
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (expSec) => b64u({ alg: 'none' }) + '.' + b64u({ exp: expSec }) + '.sig';

function mk(o = {}){
  const clock = mkClock();
  const { FakeWS, socks } = mkWS();
  const log = { closed: [], ready: 0, msgs: [], tokens: [] };
  let url = ('url' in o) ? o.url : 'ws://hub';
  const st = { busy: false, want: true, switchOk: true };
  const link = M.createRealtimeLink({
    WebSocket: FakeWS,
    enabled: () => o.enabled !== false,
    target: () => url,
    switchOk: () => st.switchOk,
    getToken: async (force) => { log.tokens.push(!!force); return ('token' in o) ? o.token : 'tok' + log.tokens.length; },
    getUserId: () => ('uid' in o) ? o.uid : 'u1',
    getVersion: async () => '0.11.4',
    pv: 1,
    helloExtra: o.helloExtra,
    requestKinds: o.requestKinds || ['presenceGet'],
    answers: o.answers || { presence: 'presenceGet' },
    reflessKind: o.reflessKind || null,
    ridless: o.ridless,
    idleCloseMs: o.idleCloseMs || 0,
    busy: () => st.busy,
    reconnectWanted: () => st.want,
    hooks: {
      onReady: () => { log.ready++; },
      onMessage: (m) => { log.msgs.push(m); },
      onClosed: (wasReady, fatal) => { log.closed.push([wasReady, fatal]); },
    },
    now: () => clock.t, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    // 0.5 = 흩기 없음(아래 백오프 시험이 정확한 초를 본다) · 흩기 시험은 o.random 으로 끝값을 준다
    random: o.random || (() => 0.5),
    log: { warn(){} },
  });
  return { link, clock, socks, log, st, setUrl: (u) => { url = u; } };
}
async function up(env){
  const p = env.link.ensureReady();
  await tick();
  const ws = env.socks[env.socks.length - 1];
  ws.open();
  ws.msg({ t: 'ready', pv: 1, now: 0 });
  const r = await p;
  return { ws, r };
}

(async () => {
  say('── 1. 순수');
  {
    chk(M.jwtExpMs(jwt(2_000_000_000)) === 2_000_000_000_000 && M.jwtExpMs('x') === null && M.jwtExpMs(null) === null, 'jwtExpMs — exp 초 → ms · 못 읽으면 null');
    const T = M.LINK_TIMING;
    chk(T.CONNECT_TIMEOUT_MS === 5000 && T.REQ_TIMEOUT_MS === 4000 && T.FAIL_COOLDOWN_MS === 60000 && JSON.stringify(T.BACKOFF_MS) === '[1000,2000,4000,8000,15000]', 'LINK_TIMING — 방 연결과 같은 값(5초 · 4초 · 1분 · 백오프 1~15초)');
    chk(Object.isFrozen(T) && Object.isFrozen(T.BACKOFF_MS), '  ↳ 바꿀 수 없다');
    chk(T.BACKOFF_JITTER === 0.5, 'BACKOFF_JITTER — 백오프를 ±50% 흩는다');
    chk(!/^\s*import\s/m.test(SRC) && !/firebase|gstatic/i.test(strip(SRC)), 'realtime-link.js 는 아무것도 import 하지 않는다(Firebase 직접 호출 없음)');
  }

  say('── 2. 열기 · hello · ready');
  {
    const e = mk({ helloExtra: { scope: 'presence' } });
    const { ws, r } = await up(e);
    const h = ws.last('hello');
    chk(r.ok === true && e.link.isReady() && e.log.ready === 1, 'ready 가 오면 ensureReady → ok · onReady 한 번');
    chk(h && h.pv === 1 && h.token === 'tok1' && h.userId === 'u1' && h.ver === '0.11.4' && h.scope === 'presence', 'hello — pv · token · userId · ver + 선택 칸 scope');
    const e2 = mk();
    const { ws: w2 } = await up(e2);
    chk(!('scope' in w2.last('hello')), '  ↳ helloExtra 가 없으면 선택 칸을 싣지 않는다(방 연결 모양 그대로)');
    const e3 = mk({ token: null });
    const r3 = await e3.link.ensureReady();
    chk(r3.ok === false && r3.code === 'auth' && e3.socks.length === 0 && JSON.stringify(e3.log.closed) === '[[false,"auth"]]', '토큰이 없으면 소켓을 열지 않고 auth 로 끝 · onClosed(false, auth)');
    const e4 = mk({ enabled: false });
    chk((await e4.link.ensureReady()).code === 'off' && !e4.link.enabled(), '꺼져 있으면 off');
    const e5 = mk({ url: null });
    chk((await e5.link.ensureReady()).code === 'off', '주소가 없으면 off');
  }

  say('── 3. rid 요청');
  {
    const e = mk({ ridless: false });
    const { ws } = await up(e);
    const p1 = e.link.request({ t: 'presenceGet', ids: ['a'] }, (m) => m.users);
    await tick();
    const q = ws.last('presenceGet');
    chk(q && typeof q.rid === 'string' && /^[A-Za-z0-9_.:-]{1,16}$/.test(q.rid), '요청에 rid(서버가 받는 모양)');
    ws.msg({ t: 'presence', users: { z: {} } });   // rid 없는 presence = 밀어 준 변화 — 요청 답으로 먹지 않는다
    await tick();
    chk(e.log.msgs.some((m) => m.t === 'presence' && m.users.z), 'ridless 끔 — rid 없는 답은 요청이 가져가지 않고 onMessage 로');
    ws.msg({ t: 'presence', users: { a: { online: true } }, full: true, rid: q.rid });
    const v1 = await p1;
    chk(v1 && v1.a && v1.a.online === true, '  ↳ rid 가 맞는 답은 그 요청으로(answers: presence → presenceGet)');
    chk(e.log.msgs.filter((m) => m.t === 'presence').length === 1, '  ↳ 짝지어진 답은 onMessage 로 다시 안 간다');

    const e2 = mk({ ridless: true, answers: { stats: 'stats' }, requestKinds: ['stats'] });
    const { ws: w2 } = await up(e2);
    const p2 = e2.link.request({ t: 'stats' }, (m) => m.total);
    await tick();
    w2.msg({ t: 'stats', total: 7 });
    chk(await p2 === 7, 'ridless 켬(옛 서버) — rid 없는 답을 같은 종류의 가장 먼저 보낸 요청에');

    const p3 = e.link.request({ t: 'presenceGet', ids: ['b'] }, (m) => m);
    await tick();
    ws.msg({ t: 'error', code: 'badRequest', ref: 'presenceGet' });
    chk(await p3 === null, 'badRequest(ref) → 그 종류 가장 먼저 보낸 요청이 null');
    const e3 = mk({ ridless: false, reflessKind: 'presenceGet' });
    const { ws: w3 } = await up(e3);
    const p4 = e3.link.request({ t: 'presenceGet', ids: ['c'] }, (m) => m);
    await tick();
    w3.msg({ t: 'error', code: 'badRequest' });
    chk(await p4 === null && !e3.log.msgs.length, 'ref 없는 badRequest(새 요청을 모르는 옛 서버) → reflessKind 의 요청이 null');
    w3.msg({ t: 'error', code: 'badRequest' });
    await tick();
    chk(e3.log.msgs.length === 1 && e3.log.msgs[0].t === 'error', '  ↳ 기다리는 요청이 없으면 onMessage 로');

    const p5 = e.link.request({ t: 'presenceGet', ids: ['d'] }, (m) => m);
    await e.clock.advance(4001);
    chk(await p5 === null, '답이 4초 안에 없으면 null');
    const p6 = e.link.request({ t: 'presenceGet', ids: ['e'] }, (m) => m);
    await tick();
    ws.close();
    chk(await p6 === null, '끊기면 기다리던 요청은 null');
  }

  say('── 4. 끊김 · 다시 붙기');
  {
    const e = mk();
    const { ws } = await up(e);
    ws.close();
    chk(JSON.stringify(e.log.closed) === '[[true,null]]' && !e.link.isReady(), '끊기면 onClosed(true, null)');
    e.link.scheduleReconnect();
    await e.clock.advance(999);
    chk(e.socks.length === 1, '다시 붙기는 백오프 1초 뒤');
    await e.clock.advance(1);
    chk(e.socks.length === 2, '  ↳ 1초가 지나면 다시 연다');
    e.socks[1].close();
    e.link.scheduleReconnect();
    await e.clock.advance(1999);
    chk(e.socks.length === 2, '  ↳ 두 번째는 2초');
    await e.clock.advance(1);
    chk(e.socks.length === 3, '  ↳ 2초 뒤 연다');
    e.st.want = false;
    e.socks[2].close();
    e.link.scheduleReconnect();
    await e.clock.advance(5000);
    chk(e.socks.length === 3, 'reconnectWanted() 가 false 면 타이머가 울려도 안 연다');
    e.st.want = true;
    e.socks.splice(0);
    const p = e.link.ensureReady(undefined, { retry: true });
    await tick();
    e.socks[0].open(); e.socks[0].msg({ t: 'ready' });
    await p;
    e.socks[0].close();
    e.link.scheduleReconnect();
    await e.clock.advance(1000);
    chk(e.socks.length === 2, 'ready 를 한 번 받으면 백오프는 1초부터 다시');

    // 흩기 — 같은 순간 끊긴 앱들이 1초 «한 점» 이 아니라 0.5~1.5초에 퍼져 다시 붙는다
    for(const [rnd, lo, hi, what] of [[0, 499, 500, '난수 0 → 0.5초(가장 이름)'], [0.999, 1498, 1499, '난수 0.999 → 약 1.5초(가장 늦음)']]){
      const j = mk({ random: () => rnd });
      const { ws: jw } = await up(j);
      jw.close();
      j.link.scheduleReconnect();
      await j.clock.advance(lo);
      const before = j.socks.length;
      await j.clock.advance(hi - lo);
      chk(before === 1 && j.socks.length === 2, '첫 다시 붙기 ' + what);
    }
    {
      const j = mk({ random: () => 0.999 });
      const { ws: jw } = await up(j);
      jw.close();
      j.link.scheduleReconnect(); await j.clock.advance(1499);
      j.socks[1].close();
      j.link.scheduleReconnect(); await j.clock.advance(2997);
      const before = j.socks.length;
      await j.clock.advance(1);
      chk(before === 2 && j.socks.length === 3, '  ↳ 두 번째는 2초 기준으로 흩는다(약 3초)');
    }

    const a = mk();
    const pa = a.link.ensureReady();
    await tick();
    a.socks[0].open();
    a.socks[0].msg({ t: 'error', code: 'auth' });
    const ra = await pa;
    chk(ra.ok === false && ra.code === 'auth' && a.socks[0].closed && JSON.stringify(a.log.closed) === '[[false,"auth"]]', 'ready 전 error auth → 끊고 onClosed(false, auth)');
    chk(a.link.state().authRetried === false, '  ↳ 다시 묻기 표시는 부르는 쪽이 정한다(markAuthRetry)');
    a.link.markAuthRetry();
    a.link.scheduleReconnect();
    await a.clock.advance(1000);
    chk(a.log.tokens[a.log.tokens.length - 1] === true && a.link.state().authRetried === true, 'markAuthRetry → 다음 열기는 getToken(true)');
    a.socks[1].open(); a.socks[1].msg({ t: 'ready' });
    await tick();
    chk(a.link.state().authRetried === false, '  ↳ ready 가 오면 다시 묻기 표시를 지운다');
    const v = mk();
    const pv = v.link.ensureReady();
    await tick();
    v.socks[0].open(); v.socks[0].msg({ t: 'error', code: 'version' });
    chk((await pv).code === 'version', 'ready 전 error version → version');
  }

  say('── 5. 토큰 갱신 · 쉬면 닫기 · 주소');
  {
    const e = mk({ helloExtra: { scope: 'presence' } });
    const { ws } = await up(e);
    await e.clock.advance(50 * 60 * 1000);   // 만료를 못 읽는 토큰 → 50분 뒤
    await tick();
    const hs = ws.all('hello');
    chk(hs.length === 2 && hs[1].token === 'tok2' && hs[1].scope === 'presence' && e.log.tokens[1] === true, '토큰 갱신 hello — 새 토큰(force) + 같은 선택 칸');
    ws.msg({ t: 'ready' });
    await tick();
    chk(e.log.ready === 1, '  ↳ 갱신의 ready 는 onReady 를 다시 부르지 않는다');

    const i = mk({ idleCloseMs: 60000 });
    const { ws: wi } = await up(i);
    await i.clock.advance(59999);
    chk(!wi.closed, '쉬면 닫기 — 60초 전에는 그대로');
    await i.clock.advance(1);
    chk(wi.closed, '  ↳ 60초 쉬면 닫는다');
    const b = mk({ idleCloseMs: 60000 });
    b.st.busy = true;
    const { ws: wb } = await up(b);
    await b.clock.advance(120000);
    chk(!wb.closed, '  ↳ busy() 면 닫지 않는다');
    const n = mk();
    const { ws: wn } = await up(n);
    await n.clock.advance(10 * 60 * 1000);
    chk(!wn.closed, 'idleCloseMs 가 없으면(친구 접속 상태 연결) 쉬어도 안 닫는다');

    const f = mk();
    const pf = f.link.ensureReady();
    await tick();
    f.socks[0].close();
    await pf;
    const rf = await f.link.ensureReady();
    chk(rf.ok === false && f.socks.length === 1, '방금 못 붙은 주소는 1분 동안 다시 시도하지 않는다');
    const pr = f.link.ensureReady(undefined, { retry: true });
    await tick();
    chk(f.socks.length === 2, '  ↳ retry 면 바로 다시');
    f.socks[1].open(); f.socks[1].msg({ t: 'ready' }); await pr;
    f.link.markFailed();
    f.link.close();
    chk((await f.link.ensureReady()).ok === false && f.socks.length === 2, 'markFailed → 그 주소를 1분 쉼');

    const s = mk();
    const { ws: ws1 } = await up(s);
    s.st.switchOk = false;
    s.setUrl('ws://other');
    chk((await s.link.ensureReady()).ok === true && !ws1.closed, '주소가 바뀌어도 switchOk() 가 false 면 그대로');
    s.st.switchOk = true;
    const ps = s.link.ensureReady();
    await tick();
    chk(ws1.closed && s.socks[1] && s.socks[1].url === 'ws://other', '  ↳ true 면 옛 연결을 닫고 새 주소로');
    s.socks[1].open(); s.socks[1].msg({ t: 'ready' }); await ps;
  }

  say('── 6. 연결');
  {
    const FC = strip(FI);
    chk(/import \{ createRealtimeLink \} from "\.\/realtime\/realtime-link\.js";/.test(FC), 'firebase-init.js 가 realtime/realtime-link.js 를 import');
    chk(/createRoomServerNet\(\{\s*createLink: createRealtimeLink,/.test(FC), '  ↳ 방 연결에 createLink 로 넘긴다');
  }

  say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
