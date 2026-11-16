/*
 * realtime 연결 공통부 검사 — realtime-link.js 를 가짜 웹소켓 · 가짜 시계로 그대로 돌린다.
 * 방 연결(room-server-net.js)이 이것 위에서 그대로 도는지는 sim-room-server-net.js 가 본다. 여기는 공통부만:
 * 1. 순수 — jwtExpMs · LINK_TIMING · import 없음
 * 2. 열기 · hello(선택 칸 helloExtra) · ready · 토큰 없음 → auth
 * 3. rid 요청 — answers 로 rid 로만 답 짝짓기 · rid 없는 답 · 모르는 rid 의 답은 warn 후 버림 · badRequest · unavailable(깨 보기) · 시간 초과 · 끊기면 null
 * 4. 끊김 → onClosed(wasReady, fatal) · 다시 붙기 백오프(reconnectWanted) · markAuthRetry → getToken(true)
 * 5. 토큰 갱신 hello 에도 선택 칸 · 쉬면 닫기(idleCloseMs · busy) · 못 붙은 주소 1분 쉼 · retry · 주소 바뀜(switchOk)
 * 6. rt-bind 연결 — import 하고 realtime 연결 하나(rt-hub)에 createLink 로 넘긴다
 * 7. 끊김 정책 몫 — ready 전 error auth · protocol 의 닫힘 번호(4001 · 4003) · scheduleReconnect({ delayMs, readyWaitMs }) · reconnectNow
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('realtime-link.js'), FI = read('firebase-init.js'), RB = read('rt-bind.js');
for(const [n, v] of [['realtime-link.js', SRC], ['firebase-init.js', FI], ['rt-bind.js', RB]]){
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
  const link = (o.M || M).createRealtimeLink({
    WebSocket: FakeWS,
    enabled: () => o.enabled !== false,
    target: () => url,
    switchOk: () => st.switchOk,
    getToken: async (force) => { log.tokens.push(!!force); return ('token' in o) ? o.token : 'tok' + log.tokens.length; },
    getVersion: o.getVersion || (async () => '0.11.4'),
    pv: 2,
    helloExtra: o.helloExtra,
    helloFields: o.helloFields,
    requestKinds: o.requestKinds || ['presenceGet'],
    answers: o.answers || { presence: 'presenceGet' },
    idleCloseMs: o.idleCloseMs || 0,
    busy: () => st.busy,
    reconnectWanted: () => st.want,
    hooks: {
      onReady: (m) => { log.ready++; log.readyMsg = m; },
      onMessage: (m) => { log.msgs.push(m); },
      onClosed: (wasReady, fatal, code) => { log.closed.push([wasReady, fatal]); log.codes = (log.codes || []).concat([code]); },
    },
    now: () => clock.t, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    // 0.5 = 흩기 없음(아래 백오프 시험이 정확한 초를 본다) · 흩기 시험은 o.random 으로 끝값을 준다
    random: o.random || (() => 0.5),
    log: { warn(){ log.warns = (log.warns || 0) + 1; } },
  });
  return { link, clock, socks, log, st, setUrl: (u) => { url = u; } };
}
/* unavailable(ref · rid) — 서버가 그 요청에 필요한 값을 못 받음. error 에 그 요청의 rid 가 실려 와 그 요청만 실패 · 나머지는 그대로 답을 기다린다. rid 없는 오류는 낡은 것 — 버린다. */
async function unavailableCase(Mod){
  const out = [];
  const e = mk({ M: Mod });
  const { ws } = await up(e);
  const p1 = e.link.request({ t: 'presenceGet', ids: ['a'] }, (m) => m);
  const p2 = e.link.request({ t: 'presenceGet', ids: ['b'] }, (m) => m);
  let r1 = 'pending', r2 = 'pending';
  p1.then((v) => { r1 = v; }); p2.then((v) => { r2 = v; });
  await tick();
  const sent = ws.sent.filter((m) => m.t === 'presenceGet');
  ws.msg({ t: 'error', code: 'unavailable', ref: 'presenceGet' });   // rid 없음 — 어느 요청의 것인지 모른다
  await tick();
  out.push([r1 === 'pending' && r2 === 'pending' && !e.log.msgs.some((m) => m.t === 'error'), '★ rid 없는 unavailable(ref presenceGet) 은 어느 요청에도 붙이지 않고 버린다(onMessage 로도 안 보냄)']);
  ws.msg({ t: 'error', code: 'unavailable', ref: 'presenceGet', rid: sent[1].rid });
  await tick();
  out.push([r2 && r2.t === 'error' && r2.code === 'unavailable' && r1 === 'pending', '★ unavailable(ref · rid) → 그 rid 의 요청(둘째)만 바로 오류 메시지(4초 기다리지 않음) · 첫째는 그대로(먼저 보낸 것이 아니라 제 짝)']);
  out.push([!e.log.msgs.some((m) => m.t === 'error'), '  ↳ 짝지은 error 는 onMessage 로 다시 안 간다']);
  ws.msg({ t: 'presence', users: { a: { online: true } }, rid: sent[0].rid });
  await tick();
  out.push([r1 && r1.users && r1.users.a, '  ↳ 첫째 요청은 제 rid 답을 받는다']);
  ws.msg({ t: 'error', code: 'unavailable', ref: 'watch' });
  await tick();
  out.push([e.log.msgs.some((m) => m.t === 'error' && m.ref === 'watch'), '  ↳ 요청 종류가 아닌 ref(watch) 의 unavailable 은 onMessage 로(듣는 쪽이 받는다)']);
  return out;
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
    chk(h && h.pv === 2 && h.token === 'tok1' && !('userId' in h) && h.ver === '0.11.4' && h.scope === 'presence', 'hello — pv 2 · token · ver + 선택 칸 scope (userId 는 싣지 않는다)');
    const e2 = mk();
    const { ws: w2 } = await up(e2);
    chk(!('scope' in w2.last('hello')), '  ↳ helloExtra 가 없으면 선택 칸을 싣지 않는다(방 연결 모양 그대로)');
    /* ★ 앱 버전을 못 읽으면 가짜 버전('0.0.0')으로 연결하지 않는다 — 소켓을 열지 않고 version 으로 끝 · console.warn · onClosed(false, version) */
    for(const [why, gv] of [['null', async () => null], ['빈 글', async () => ''], ['던짐', async () => { throw new Error('no companion'); }]]){
      const ev = mk({ getVersion: gv });
      const rv = await ev.link.ensureReady();
      chk(rv.ok === false && rv.code === 'appVersion' && ev.socks.length === 0 && JSON.stringify(ev.log.closed) === '[[false,"appVersion"]]' && ev.log.warns === 1, '★ 버전을 못 읽음(' + why + ') — 소켓 안 열고 appVersion 으로 끝 · onClosed(false, appVersion) · console.warn(가짜 버전을 보내지 않는다)');
    }
    {
      const fake = SRC.replace("if(typeof ver !== 'string' || !ver){", "if(false){").replace('token = tk; helloVer = ver;', "token = tk; helloVer = (typeof ver === 'string' && ver) ? ver : '0.0.0';");
      const MF = new Function('Buffer', fake.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')(Buffer);
      const ef = mk({ M: MF, getVersion: async () => null });
      ef.link.ensureReady(); await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
      chk(fake !== SRC && ef.socks.length === 1, '  깨 보기 — 가짜 버전으로 되돌리면 위 판정이 빨강');
    }
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
    const e = mk();
    const { ws } = await up(e);
    const p1 = e.link.request({ t: 'presenceGet', ids: ['a'] }, (m) => m.users);
    await tick();
    const q = ws.last('presenceGet');
    chk(q && typeof q.rid === 'string' && /^[A-Za-z0-9_.:-]{1,16}$/.test(q.rid), '요청에 rid(서버가 받는 모양)');
    ws.msg({ t: 'presence', users: { z: {} } });   // rid 없는 presence = 밀어 준 변화 — 요청 답으로 먹지 않는다
    await tick();
    chk(e.log.msgs.some((m) => m.t === 'presence' && m.users.z), 'rid 없는 답은 요청이 가져가지 않고 onMessage 로');
    ws.msg({ t: 'presence', users: { a: { online: true } }, full: true, rid: q.rid });
    const v1 = await p1;
    chk(v1 && v1.a && v1.a.online === true, '  ↳ rid 가 맞는 답은 그 요청으로(answers: presence → presenceGet)');
    chk(e.log.msgs.filter((m) => m.t === 'presence').length === 1, '  ↳ 짝지어진 답은 onMessage 로 다시 안 간다');

    const p3 = e.link.request({ t: 'presenceGet', ids: ['b'] }, (m) => m);
    await tick();
    const rid3 = ws.last('presenceGet').rid;
    ws.msg({ t: 'error', code: 'badRequest', ref: 'presenceGet', rid: rid3 });
    const r3 = await p3;
    chk(r3 && r3.t === 'error' && r3.code === 'badRequest', 'badRequest(ref · rid) → 그 rid 의 요청이 오류 메시지를 받는다');
    const p4 = e.link.request({ t: 'presenceGet', ids: ['c'] }, (m) => m);
    await tick();
    ws.msg({ t: 'error', code: 'badRequest' });   // ref 도 rid 도 없는 오류는 어느 요청의 것인지 모른다 — 요청을 끝내지 않고 onMessage 로
    await tick();
    chk(e.log.msgs.some((m) => m.t === 'error' && m.code === 'badRequest'), 'ref 없는 badRequest 는 요청이 가져가지 않고 onMessage 로');
    const w0 = e.log.warns || 0;
    ws.msg({ t: 'error', code: 'badRequest', ref: 'presenceGet' });   // rid 없는 요청 종류의 오류 — 낡은 답. 추측해 붙이지 않고 버린다
    await tick();
    const still4 = await Promise.race([p4, new Promise((r) => setTimeout(() => r('__wait'), 20))]);
    chk(still4 === '__wait' && (e.log.warns || 0) > w0 && !e.log.msgs.some((m) => m.t === 'error' && m.ref === 'presenceGet' && m.rid === undefined), '★ rid 없는 요청 종류(ref presenceGet)의 오류는 낡은 것 — 대기 중인 요청에 붙이지 않고 버린다(warn) · onMessage 로도 안 보낸다');
    ws.msg({ t: 'error', code: 'badRequest', ref: 'presenceGet', rid: ws.last('presenceGet').rid });
    const r4 = await p4;
    chk(r4 && r4.t === 'error', '  ↳ 그 요청은 제 rid 의 오류로만 끝난다');
    {
      /* 짝 없는 rid 의 늦은 답(presence)은 밀어 주는 메시지로 새지 않고 버린다 */
      const n0 = e.log.msgs.length;
      ws.msg({ t: 'presence', users: { late: {} }, full: true, rid: 'old-1' });
      await tick();
      chk(e.log.msgs.length === n0, '★ 짝 없는 rid 의 낡은 답은 버린다(onMessage 로 안 감 · 다른 요청에 안 붙음)');
    }

    {
      /* rid 를 실어 보낸 요청의 오류(서버: photoOpen · photoStart · roomInvite 의 오류에 rid) — 그 rid 의 요청이 오류 메시지를 받는다(가장 먼저 보낸 것이 아니라 제 짝) */
      const pa = e.link.request({ t: 'presenceGet', ids: ['r1'] }, (m) => m), pb = e.link.request({ t: 'presenceGet', ids: ['r2'] }, (m) => m);
      await tick();
      const sentQ = ws.sent.filter((x) => x.t === 'presenceGet');
      const rids = sentQ.slice(-2).map((x) => x.rid);
      if(rids.length === 2){
        ws.msg({ t: 'error', code: 'ROOM_INVITE_NOT_FRIEND', ref: 'presenceGet', rid: rids[1] });
        const rb = await pb;
        chk(rb && rb.t === 'error' && rb.code === 'ROOM_INVITE_NOT_FRIEND', '★ 오류에 rid 가 있으면 그 rid 의 요청이 오류 메시지를 받는다(ref 종류의 «가장 먼저 보낸 것» 이 아니라)');
        ws.msg({ t: 'presence', users: {}, full: true, rid: rids[0] });
        chk((await pa) !== null && !e.log.msgs.some((m) => m.rid === rids[1]), '  ↳ 다른 요청은 그대로 제 답을 받는다 · 오류는 onMessage 로 새지 않는다');
      }else chk(false, '보낸 요청 둘을 못 찾음');
    }
    {
      /* 짝 없는 rid 의 늦은 오류는 다른 대기 요청을 건드리지 않는다 */
      const pw = e.link.request({ t: 'presenceGet', ids: ['w1'] }, (m) => m);
      await tick();
      ws.msg({ t: 'error', code: 'badRequest', ref: 'presenceGet', rid: 'zz-old' });
      await tick();
      const still = await Promise.race([pw, new Promise((r) => setTimeout(() => r('__wait'), 20))]);
      chk(still === '__wait' && e.log.msgs.some((m) => m.rid === 'zz-old'), '★ 지워진 rid 의 늦은 오류는 onMessage 로 — 같은 종류의 다른 대기 요청을 실패로 끝내지 않는다');
      ws.msg({ t: 'presence', users: {}, full: true, rid: ws.sent.filter((x) => x.t === 'presenceGet').pop().rid });
      await pw;
    }
    for(const [ok, msg] of await unavailableCase(M)) chk(ok, msg);
    const brokenSrc = SRC.split("if(requestKinds.indexOf(m.ref) >= 0){   // rid 요청 종류의 오류인데").join("if(false){   // rid 요청 종류의 오류인데");
    const MB = new Function('Buffer', brokenSrc.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')(Buffer);
    chk(brokenSrc !== SRC && (await unavailableCase(MB)).some(([ok]) => !ok), '  깨 보기 — rid 없는 오류를 버리는 갈래를 빼면 위 판정이 빨강');

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

  say('── 5-2. 통신 규약 2판(pv 2) · 닫힘 번호');
  {
    const phases = [];
    const e = mk({ helloFields: (ph) => { phases.push(ph); return { deviceId: 'dev-1', session: 's1', ...(ph === 'open' ? { claim: true } : {}) }; } });
    const { ws, r } = await up(e);
    const h = ws.all('hello')[0];
    chk(r.ok && h && h.pv === 2 && !('userId' in h) && h.deviceId === 'dev-1' && h.session === 's1' && h.claim === true && h.ver === '0.11.4',
      'pv 2 — hello 에 userId 를 싣지 않는다(신원은 토큰뿐) · helloFields(open) 칸');
    chk(e.log.readyMsg && e.log.readyMsg.t === 'ready', '  ↳ onReady 에 ready 메시지를 넘긴다(userCode 를 읽게)');
    const exp = Math.floor(e.clock.t / 1000) + 3600;
    const e2 = mk({ token: jwt(exp), helloFields: (ph) => ({ deviceId: 'dev-1', session: 's1', ...(ph === 'open' ? { claim: true } : {}) }) });
    const { ws: w2 } = await up(e2);
    await e2.clock.advance(3600 * 1000 - 5 * 60 * 1000 + 10);
    const hs = w2.all('hello');
    chk(hs.length === 2 && !('claim' in hs[1]) && hs[1].session === 's1' && hs[1].deviceId === 'dev-1', '  ↳ 토큰 갱신 hello(refresh)는 같은 기기 · 세션 · claim 없음');
    const c = mk({ helloFields: () => ({}) });
    const { ws: w4 } = await up(c);
    w4.closed = true; w4.onclose({ code: 4004 });
    chk(c.log.codes && c.log.codes[c.log.codes.length - 1] === 4004 && c.log.closed[c.log.closed.length - 1][0] === true, 'onClosed 셋째 인자로 닫힘 번호(4004)');
    const c2 = mk({ helloFields: () => ({}) });
    const { ws: w5 } = await up(c2);
    w5.close();
    chk(c2.log.codes[c2.log.codes.length - 1] === null, '  ↳ 번호가 없으면 null');
  }

  say('── 7. 끊김 정책 몫 — ready 전 error 의 닫힘 번호 · 정한 시간 뒤 다시 붙기 · 지금 다시 붙기');
  {
    const preReady = async (code) => {
      const e = mk({ pv: 3, uid: null, helloFields: () => ({}) });
      const p = e.link.ensureReady(); await tick();
      e.socks[0].open(); e.socks[0].msg({ t: 'error', code });
      await p;
      return e.log.codes[e.log.codes.length - 1];
    };
    chk(await preReady('auth') === 4001, 'ready 전 error auth → 먼저 끊어도 닫힘 번호 4001(부르는 쪽이 서버 4001 과 같이 센다)');
    chk(await preReady('protocol') === 4003, '  ↳ error protocol → 4003');
    chk(await preReady('version') === null, '  ↳ error version(옛 방 서버) → 번호 없음(4002 는 걷은 번호)');
    { /* 토큰을 못 받아 열지 못함(이 PC 사정) — 서버 번호가 아니다 */
      const e = mk({ pv: 3, uid: null, token: null, helloFields: () => ({}) });
      await e.link.ensureReady();
      chk(e.log.codes[0] === null && e.log.closed[0][1] === 'auth', '  ↳ 토큰 없음은 번호 없음(fatal auth 만)');
    }
    const d = mk();
    d.link.scheduleReconnect({ delayMs: 12345, readyWaitMs: 35000 });
    await d.clock.advance(12344);
    chk(d.socks.length === 0, 'scheduleReconnect({ delayMs }) — 백오프 대신 그 시간까지 안 붙는다');
    await d.clock.advance(1); await tick();
    chk(d.socks.length === 1, '  ↳ 그 시간에 연다');
    d.socks[0].open();
    await d.clock.advance(34000);
    chk(!d.socks[0].closed, '  ↳ readyWaitMs — 그 연결은 ready 를 35초까지 기다린다(기본 5초에 끊지 않음)');
    await d.clock.advance(1001);
    chk(d.socks[0].closed && d.log.closed.length === 1 && d.log.closed[0][1] === 'timeout', '  ↳ 35초가 지나면 끊는다(timeout)');
    d.link.scheduleReconnect(); await d.clock.advance(1); await tick();
    const n0 = d.socks.length;
    const rn = d.link.reconnectNow(); await tick();
    chk(rn === true && d.socks.length === n0 + 1, 'reconnectNow — 다시 붙기를 기다리는 중이면 기다림을 건너뛰고 지금 연다');
    chk(d.link.reconnectNow() === false, '  ↳ 기다리는 중이 아니면 아무 일 없음(false)');
    d.socks[d.socks.length - 1].open();
    await d.clock.advance(5001);
    chk(d.socks[d.socks.length - 1].closed, '  ↳ 다음 연결의 ready 기다림은 다시 기본 5초');
  }

  say('── 6. 연결');
  {
    const FC = strip(RB);
    chk(/import \{ createRealtimeLink \} from "\.\/realtime-link\.js";/.test(FC), 'rt-bind.js 가 realtime-link.js 를 import');
    chk(/TwRtHub\.store\.bind\(\{\s*createLink: createRealtimeLink,/.test(FC) && !/createRoomServerNet/.test(FC), '  ↳ realtime 연결 하나(rt-hub)에 createLink 로 넘긴다 · 옛 방 연결(pv 1)은 없다');
    chk(!/realtime-link|createRealtimeLink/.test(strip(FI)), '  ↳ firebase-init.js 는 realtime 연결을 모른다');
  }

  say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
