/* sim-rt-hub.js — 🛰 realtime 연결 하나(realtime/rt-hub.js) 검사 — 진짜 연결 공통부(realtime-link.js) · 가짜 웹소켓 · 가짜 시계로 그대로 돌린다
   ・1절: 켜기 — hello { pv:3 · token · ver · deviceId · session · claim } · userId 없음 · ready 의 userCode · 상태
   ・2절: 늘 붙음 — 끊기면 백오프로 다시 · 다시 붙기 hello 에는 claim 없음 · 세션 · 기기는 같음 · stop 하면 안 붙음
   ・3절: 알림 표 — 건 종류만 · 모르는 종류는 버림 · 모르는 이름을 걸면 던짐 · 끊긴 시간이 ready.graceMs 를 넘으면 건 함수마다 한 번 다시 받기(짧으면 없음)
   ・4절: 닫힘 번호 표 — 서버 표와 같은 이름 · 값 · 코드마다 처리(1000 끝 · 1001 흩어 다시 · 1006 · 1009 · 4005 · 4008 다시 붙기 · 4001 새 토큰으로 한 번 ·
          ready 전 error auth 도 4001 로 셈 · 4003 업데이트 · 4004 밀려남 · 4006 점검 · 4007 계정 없음 · 모르는 4000번대 멈춤 · 모르는 1000번대 다시)
   ・4-2절: 작별 · 살아 있음 — bye(leave 는 부르는 쪽) → 서버 닫힘 기다림 1초 · 못 받으면 앱이 닫음 · quit 은 바로 닫음 · ping 5초 · 다시 붙는 중엔 바로 한 번
   ・5절: 그 밖의 메시지 · 요청 — onMessage(방 메시지 자리 포함) · request 의 rid 짝 · send 는 ready 일 때만
   ・6절: 순수 · 배선 — 주소(운영 · dev · 시험 주소) · 세션 id 모양 · window.TwRtHub · bind 전 start 는 던짐 · html 차례 · firebase-init bind
   ・7절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  HUB: pick(at('rt-hub.js', 'realtime')),
  LINK: pick(at('realtime-link.js', 'realtime')),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  API: pick(at('api-client.js', 'shared')),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const loadLink = (src) => {
  const names = [...src.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
  return new Function('Buffer', src.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')(Buffer);
};
const loadHub = (src, win) => { const m = { exports: {} }; new Function('module', 'window', src)(win ? undefined : m, win); return win ? win.TwRtHub : m.exports; };

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
    close(code){ if(this.closed) return; this.closed = true; if(this.onclose) this.onclose({ code: (typeof code === 'number') ? code : 1000 }); }
    kill(code){ this.closed = true; if(this.onclose) this.onclose({ code }); }   // 서버가 끊음
    open(){ if(this.onopen) this.onopen(); }
    msg(m){ if(this.onmessage) this.onmessage({ data: JSON.stringify(m) }); }
    all(t){ return this.sent.filter((x) => x.t === t); }
  }
  return { FakeWS, socks };
}

function mk(S, tokenOk){
  tokenOk = tokenOk || (() => true);
  const L = loadLink(S.LINK), H = loadHub(S.HUB);
  const clock = mkClock();
  const { FakeWS, socks } = mkWS();
  const forces = [];
  const hub = H.createRtHub({
    createLink: L.createRealtimeLink, WebSocket: FakeWS, url: () => 'wss://realtime.together-working.com',
    getToken: async (force) => { forces.push(!!force); if(!tokenOk()) throw new Error('offline'); return 'tok' + forces.length; },
    getVersion: async () => '0.13.0', deviceId: () => 'dev-0001', session: 'sess01',
    now: () => clock.t, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, random: () => 0.5, log: { warn(){} },
  });
  const states = [];
  hub.onState((s) => states.push(s));
  return { H, L, hub, clock, socks, forces, states, last: () => socks[socks.length - 1] };
}
async function waitNewSock(e, n0){   // 새로 만든 · 아직 안 닫힌 소켓이 생길 때까지 시계를 조금씩
  for(let i = 0; i < 400 && (e.socks.length <= n0 || e.last().closed); i++) await e.clock.advance(250);
}
async function readyOn(e, code, graceMs){
  await tick();
  const ws = e.last();
  ws.open(); await tick();
  ws.msg({ t: 'ready', pv: 3, now: e.clock.t, userCode: code || 'u1', graceMs: (graceMs == null) ? 20000 : graceMs });
  await tick();
  return ws;
}

async function judge(S){
  let E;
  try{ E = mk(S); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }

  say('── 1. 켜기');
  {
    const e = E;
    chk(e.hub.state() === 'off' && e.socks.length === 0, '켜기 전엔 붙지 않는다');
    e.hub.start();
    const ws = await readyOn(e, 'u777');
    const h = ws.all('hello')[0];
    chk(h && h.pv === 3 && h.token === 'tok1' && h.ver === '0.13.0' && h.deviceId === 'dev-0001' && h.session === 'sess01' && h.claim === true && !('userId' in h),
      'hello { pv:3 · token · ver · deviceId · session · claim:true } · userId 없음');
    chk(e.hub.isReady() && e.hub.userCode() === 'u777' && e.states.join() === 'connecting,ready', '  ↳ ready 의 userCode · 상태 connecting → ready');
    e.hub.start();
    chk(e.socks.length === 1, '  ↳ 이미 켜져 있으면 다시 안 연다');
  }

  say('── 2. 늘 붙음');
  {
    const e = mk(S);
    e.hub.start();
    const w1 = await readyOn(e);
    w1.kill(1006);
    await tick();
    chk(e.hub.state() === 'retrying' && e.socks.length === 1, '끊기면 retrying — 백오프 전엔 안 붙음');
    await e.clock.advance(1000);
    const w2 = e.last();
    chk(e.socks.length === 2 && w2 !== w1, '  ↳ 1초(흩기 가운데) 뒤 다시 연다');
    await readyOn(e);
    const h2 = w2.all('hello')[0];
    chk(h2 && !('claim' in h2) && h2.session === 'sess01' && h2.deviceId === 'dev-0001', '  ↳ 다시 붙기 hello 는 claim 없이 · 같은 세션 · 같은 기기');
    w2.kill(1006); await tick();
    await e.clock.advance(1000);
    const w3 = e.last(); w3.kill(1006); await tick();
    await e.clock.advance(1999);
    chk(e.socks.length === 3, '  ↳ 붙지 못하면 2초로 늘린다(1 · 2 · 4 · 8 · 15)');
    await e.clock.advance(1);
    chk(e.socks.length === 4, '  ↳ 2초에 다시');
    e.hub.stop();
    const closedNow = e.socks[3].closed;
    await e.clock.advance(60000);
    chk(e.hub.state() === 'off' && e.socks.length === 4 && closedNow, 'stop — 곧바로 닫고 다시 붙지 않는다');
  }

  say('── 3. 알림 표');
  {
    const e = mk(S);
    const got = [];
    const fA = (n) => got.push('A:' + n.kind + ':' + (n.subject || '') + ':' + (n.section || '') + ':' + n.resync);
    const fB = (n) => got.push('B:' + n.kind + ':' + n.resync);
    e.hub.on('friends', fA); e.hub.on('notification', fA); const offB = e.hub.on('gifts', fB);
    let threw = 0;
    try{ e.hub.on('friend', () => {}); }catch(_){ threw++; }
    try{ e.hub.onMessage('nope', () => {}); }catch(_){ threw++; }
    chk(threw === 2, '모르는 알림 · 메시지 이름을 걸면 던진다(오타가 조용히 안 오지 않게)');
    e.hub.start();
    const ws = await readyOn(e);
    ws.msg({ t: 'notify', kind: 'notification', section: 'MAIL' });
    ws.msg({ t: 'notify', kind: 'card', subject: 'u2' });
    ws.msg({ t: 'notify', kind: 'brandNew' });
    ws.msg({ t: 'notify', kind: 'gifts' });
    await tick();
    chk(got.join('|') === 'A:notification::MAIL:false|B:gifts:false', '건 종류만 · subject · section 을 넘긴다 · 아무도 안 건 종류 · 모르는 종류는 버린다 — ' + got.join('|'));
    offB(); got.length = 0;
    ws.msg({ t: 'notify', kind: 'gifts' }); await tick();
    chk(got.length === 0, '  ↳ 건 것을 풀면 안 온다');
    e.hub.on('gifts', fB);
    ws.kill(1006); await tick();
    await e.clock.advance(1000); await readyOn(e);
    chk(got.length === 0, '  ↳ 짧게(유예 안) 끊겼다 붙으면 다시 받기 없음(서버가 들고 있다 보낸다)');
    e.last().kill(1006); await tick();
    await e.clock.advance(21000);   // 1초 · 2초 · 4초 백오프 사이 연결 시간 초과(5초)로 두 번 못 붙고, 세 번째 연결이 21초에 ready
    await readyOn(e);
    chk(got.sort().join('|') === 'A:friends:::true|B:gifts:true', '★ 유예(ready.graceMs 20초)보다 오래 끊겼다 붙으면 건 함수마다 한 번 다시 받기(같은 함수를 두 종류에 걸어도 한 번) — ' + got.join('|'));
    { /* 기준은 박힌 20초가 아니라 서버가 ready 에 실은 graceMs */
      const g = mk(S); const seen = [];
      g.hub.on('friends', (n) => seen.push(n.resync));
      g.hub.start(); await readyOn(g, 'u1', 60000);
      g.last().kill(1006); await tick();
      await g.clock.advance(21000); await waitNewSock(g, g.socks.length - 1);
      await readyOn(g, 'u1', 60000);
      chk(seen.length === 0, '★ graceMs 60초면 21초 끊김은 다시 받기 없음(서버가 들고 있다) — ' + seen.join());
      g.last().kill(1006); await tick();
      await g.clock.advance(3000); await waitNewSock(g, g.socks.length - 1);
      await readyOn(g, 'u1', 1000);
      chk(seen.join() === 'true', '  ↳ graceMs 1초면 3초 끊김도 다시 받기');
      const h = mk(S); const hs = [];
      h.hub.on('friends', (n) => hs.push(n.resync));
      h.hub.start(); await readyOn(h);
      chk(hs.length === 0, '  ↳ 처음 붙을 땐 다시 받기 없음(화면을 새로 받는다)');
    }
  }

  say('── 4. 닫힘 번호');
  {
    const a = mk(S);
    a.hub.start();
    const w1 = await readyOn(a);
    w1.kill(4001); await tick();
    await a.clock.advance(1000);
    chk(a.forces.join() === 'false,true' && a.hub.state() === 'retrying', '4001 — 새 토큰(force)으로 다시');
    a.last().kill(4001); await tick();
    await a.clock.advance(30000);
    chk(a.hub.state() === 'authFailed' && a.socks.length === 2, '  ↳ 또 4001 이면 멈춤(authFailed) — 더 붙지 않는다');
    { /* 이 PC 에서 토큰을 못 받음(오프라인) — 서버가 보낸 4001 이 아니니 멈추지 않고 계속 다시 붙는다 */
      let online = true;
      const o = mk(S, () => online);
      o.hub.start(); const ow = await readyOn(o);
      online = false; ow.kill(1006); await tick();
      await o.clock.advance(60000);
      chk(o.hub.state() === 'retrying', '★ 토큰을 못 받는 동안(오프라인)은 authFailed 가 아니라 retrying — ' + o.hub.state());
      online = true; await waitNewSock(o, o.socks.length); await readyOn(o);
      chk(o.hub.state() === 'ready', '  ↳ 다시 받을 수 있게 되면 붙는다');
      const p = mk(S, () => online);
      p.hub.start(); const pw = await readyOn(p);
      pw.kill(4001); await tick();
      online = false; await p.clock.advance(5000);
      online = true; await waitNewSock(p, p.socks.length);
      p.last().open(); await tick(); p.last().kill(4001); await tick(); await p.clock.advance(60000);
      chk(p.hub.state() === 'authFailed', '  ↳ 4001 → 토큰 실패 → 4001 이면 그때 멈춤 — ' + p.hub.state());
    }
    const b = mk(S);
    b.hub.start(); const bw = await readyOn(b);
    bw.kill(4003); await tick(); await b.clock.advance(30000);
    chk(b.hub.state() === 'update' && b.socks.length === 1, '4003 — 판이 다름: 멈추고 업데이트 안내(update)');
    const c = mk(S);
    c.hub.start(); const cw = await readyOn(c);
    cw.msg({ t: 'sessionLost' }); cw.kill(4004); await tick(); await c.clock.advance(30000);
    chk(c.hub.state() === 'sessionLost' && c.socks.length === 1, '4004 — 다른 기기가 차지: 멈춤(sessionLost) · 다시 안 붙음');
    { const c2 = mk(S); c2.hub.start(); const w = await readyOn(c2);
      w.msg({ t: 'sessionLost' }); w.kill(1006); await tick(); await c2.clock.advance(30000);
      chk(c2.hub.state() === 'sessionLost' && c2.socks.length === 1, '  ↳ sessionLost 메시지 뒤 번호 없이 끊겨도 멈춤'); }
    c.hub.start({ claim: true });
    const cw2 = await readyOn(c);
    chk(cw2.all('hello')[0].claim === true && c.hub.isReady(), '  ↳ «여기서 계속» — start({ claim:true }) 로 다시 차지');
    const d = mk(S);
    d.hub.start(); const dw = await readyOn(d);
    dw.kill(4005); await tick(); await d.clock.advance(1000);
    chk(d.hub.state() === 'retrying' && d.socks.length === 2, '4005 — 다시 붙기(점검 · API 못 닿음)');
    const n = mk(S);
    n.hub.start({ claim: false });
    const nw = await readyOn(n);
    chk(!('claim' in nw.all('hello')[0]), 'start({ claim:false }) — 차지하지 않고 붙기');

    /* 표 — 서버 closeCodes.ts 와 같은 이름 · 값 */
    const H = a.H;
    const SERVER = { bye: 1000, restart: 1001, tooLarge: 1009, auth: 4001, protocol: 4003, sessionLost: 4004, unavailable: 4005, maintenance: 4006, accountGone: 4007, helloTimeout: 4008 };
    chk(JSON.stringify(H.CLOSE_CODES) === JSON.stringify(SERVER) && !Object.values(H.CLOSE_CODES).includes(4002), '닫힘 번호 표 — 서버 표와 같은 이름 · 값(4002 없음)');
    const want = [[null, 'reconnect'], [1000, 'end'], [1001, 'restart'], [1006, 'reconnect'], [1009, 'reconnect'], [1011, 'reconnect'], [1999, 'reconnect'],
      [4001, 'auth'], [4002, 'unknown'], [4003, 'update'], [4004, 'sessionLost'], [4005, 'reconnect'], [4006, 'maintenance'], [4007, 'accountGone'], [4008, 'reconnect'],
      [4000, 'unknown'], [4999, 'unknown'], [5000, 'reconnect']];
    const bad = want.filter(([c, act]) => H.closeAction(c) !== act).map(([c, act]) => c + '→' + H.closeAction(c) + '(' + act + ')');
    chk(!bad.length, 'closeAction — 코드마다 처리 한 곳(모르는 1000번대 · 번호 없음은 다시 · 모르는 4000번대는 멈춤)' + (bad.length ? ' — ' + bad.join(' ') : ''));
    /* 멈추는 번호 — 상태 · 더 안 붙음 */
    const stopOn = async (code, want) => {
      const x = mk(S); x.hub.start(); const w = await readyOn(x);
      w.kill(code); await tick(); await x.clock.advance(120000);
      return x.hub.state() === want && x.socks.length === 1 && x.hub.lastCloseCode() === code;
    };
    chk(await stopOn(4006, 'maintenance'), '4006 — 점검: 멈춤(maintenance) · 다시 안 붙음(점검 창 [다시 시도] · 해제 때만 start)');
    chk(await stopOn(4007, 'accountGone'), '4007 — 계정 없음: 멈춤(accountGone)');
    chk(await stopOn(4999, 'closed') && await stopOn(4002, 'closed'), '모르는 4000번대(4999 · 걷은 4002) — 멈춤(closed · «다시 연결» 안내)');
    chk(await stopOn(1000, 'off'), '1000 — 끝(off) · 다시 안 붙음');
    const retryOn = async (code) => {
      const x = mk(S); x.hub.start(); const w = await readyOn(x);
      w.kill(code); await tick();
      const st = x.hub.state(); await x.clock.advance(1000);
      return st === 'retrying' && x.socks.length === 2;
    };
    chk(await retryOn(1006) && await retryOn(1009) && await retryOn(4005) && await retryOn(4008) && await retryOn(1011), '1006 · 1009 · 4005 · 4008 · 모르는 1000번대 — 백오프 다시 붙기');
    { /* 1001 — 첫 시도를 0~30초 흩고 그 연결은 ready 를 35초 기다린다 */
      const r = mk(S); r.hub.start(); const w = await readyOn(r);
      w.kill(1001); await tick();
      await r.clock.advance(14999);
      chk(r.socks.length === 1 && r.hub.state() === 'retrying', '1001 — 재시작: 흩기 가운데(random 0.5)면 15초 전엔 안 붙는다(백오프 1초가 아님)');
      await r.clock.advance(1); await tick();
      chk(r.socks.length === 2, '  ↳ 15초에 다시 연다');
      r.last().open(); await r.clock.advance(34000);
      chk(!r.last().closed, '  ↳ 그 연결은 ready 를 35초까지 기다린다(서버가 ready 를 0~30초 흩음)');
      await r.clock.advance(1001);
      chk(r.last().closed && r.hub.state() === 'retrying', '  ↳ 35초 넘으면 끊고 백오프로');
      const rnd = [0, 0.999];
      const L = loadLink(S.LINK), Hx = loadHub(S.HUB);
      const spread = []; for(const v of rnd){
        const c = mkClock(); const { FakeWS, socks } = mkWS();
        const hb = Hx.createRtHub({ createLink: L.createRealtimeLink, WebSocket: FakeWS, url: () => 'wss://x', getToken: async () => 't', getVersion: async () => '0.13.0',
          deviceId: () => 'd', session: 's', now: () => c.t, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, random: () => v, log: { warn(){} } });
        hb.start(); await tick(); socks[0].open(); await tick(); socks[0].msg({ t: 'ready', pv: 3, now: 0, userCode: 'u', graceMs: 20000 }); await tick();
        socks[0].kill(1001); await tick();
        let at = null; for(let i = 0; i < 400 && at == null; i++){ await c.advance(100); if(socks.length > 1) at = i * 100 + 100; }
        spread.push(at);
      }
      chk(spread[0] <= 100 && spread[1] >= 29900 && spread[1] <= 30000, '  ↳ 흩기 폭 0~30초(random 0 → 곧바로 · 0.999 → 30초 근처) — ' + spread.join(' · '));
    }
    { /* ready 전 error auth 도 4001 로 센다 — 두 번이면 멈춤(전엔 끝없이 다시 붙었다) */
      const q = mk(S); q.hub.start(); await tick();
      q.last().open(); await tick(); q.last().msg({ t: 'error', code: 'auth', ref: 'hello' }); await tick();
      chk(q.hub.state() === 'retrying', 'ready 전 error auth — 첫 번째는 새 토큰으로 다시');
      await waitNewSock(q, 1); await tick();
      q.last().open(); await tick(); q.last().msg({ t: 'error', code: 'auth', ref: 'hello' }); await tick();
      await q.clock.advance(60000);
      chk(q.hub.state() === 'authFailed' && q.forces.join() === 'false,true', '★ ready 전 error auth 두 번 → 멈춤(authFailed) — ' + q.hub.state() + ' · 토큰 ' + q.forces.join());
    }
    { /* 멈춘 뒤 사용자 누름 — start 로 다시(claim 없이) */
      const u = mk(S); u.hub.start(); const w = await readyOn(u);
      w.kill(4999); await tick();
      u.hub.start({ claim: false }); const w2 = await readyOn(u);
      chk(u.hub.isReady() && !('claim' in w2.all('hello')[0]), '멈춘 뒤 [다시 연결] — start({ claim:false }) 로 다시 붙는다');
    }
  }

  say('── 4-2. 작별 · 살아 있음');
  {
    { /* bye — 보내고 서버의 1000 을 기다린다 */
      const e = mk(S); e.hub.start(); const w = await readyOn(e);
      let done = false;
      const p = e.hub.bye('logout').then(() => { done = true; });
      await tick();
      chk(JSON.stringify(w.all('bye')) === '[{"t":"bye","why":"logout"}]' && !w.closed && !done, 'bye — {t:bye, why} 를 보내고 서버의 닫힘을 기다린다');
      w.kill(1000); await p;
      chk(done && e.hub.state() === 'off', '  ↳ 서버가 1000 으로 닫으면 끝(off)');
      await e.clock.advance(60000);
      chk(e.socks.length === 1, '  ↳ 다시 안 붙는다');
    }
    { /* 서버가 안 닫으면 1초 뒤 앱이 close(1000) */
      const e = mk(S); e.hub.start(); const w = await readyOn(e);
      let done = false; e.hub.bye('withdraw').then(() => { done = true; });
      await e.clock.advance(999);
      chk(!done && !w.closed, 'bye — 1초 안엔 기다린다');
      await e.clock.advance(1);
      chk(done && w.closed && e.hub.state() === 'off', '  ↳ 1초에 못 받으면 앱이 닫는다(off)');
    }
    { /* 붙어 있지 않으면 보내지 않고 바로 끔 */
      const e = mk(S); e.hub.start(); await tick();
      await e.hub.bye('switch');
      chk(e.hub.state() === 'off' && e.socks.every((x) => x.closed || !x.sent.length), 'bye — ready 전이면 바로 끈다(보낼 곳 없음)');
      const n = mk(S); await n.hub.bye('logout');
      chk(n.hub.state() === 'off', '  ↳ 켜지 않았어도 던지지 않는다');
    }
    { /* quit — 보내고 바로 닫음 */
      const e = mk(S); e.hub.start(); const w = await readyOn(e);
      e.hub.quit();
      chk(JSON.stringify(w.all('bye')) === '[{"t":"bye","why":"quit"}]' && w.closed && e.hub.state() === 'off', 'quit(beforeunload) — bye{quit} 를 보내고 기다리지 않고 닫는다');
      e.hub.quit();
      chk(w.all('bye').length === 1, '  ↳ 두 번 불러도 한 번');
    }
    { /* ping — ready 일 때만 · 5초 안에 pong 없으면 끊고 다시 */
      const e = mk(S); e.hub.start(); const w = await readyOn(e);
      e.hub.checkAlive(); e.hub.checkAlive();
      chk(w.all('ping').length === 1, 'checkAlive — ready 면 ping 한 번(기다리는 중엔 또 안 보냄)');
      await e.clock.advance(4000); w.msg({ t: 'pong' }); await e.clock.advance(10000);
      chk(!w.closed && e.hub.isReady(), '  ↳ 5초 안에 pong 이 오면 그대로');
      e.hub.checkAlive(); await e.clock.advance(4999);
      chk(!w.closed, '  ↳ 5초 전엔 안 끊는다');
      await e.clock.advance(1);
      chk(w.closed && e.hub.state() === 'retrying', '  ↳ 5초에 pong 이 없으면 끊고 다시 붙기');
      await waitNewSock(e, 1); const w2 = await readyOn(e);
      chk(e.hub.isReady() && w2 !== w, '  ↳ 다시 붙는다');
    }
    { /* 다시 붙는 중 — 기다림을 건너뛰고 바로 한 번 · ready 전엔 ping 안 보냄 */
      const e = mk(S); e.hub.start(); const w = await readyOn(e);
      w.kill(1006); await tick();
      await e.clock.advance(1000); e.last().kill(1006); await tick();   // 다음 백오프 2초
      const n0 = e.socks.length;
      e.hub.checkAlive(); await tick();
      chk(e.socks.length === n0 + 1, 'checkAlive — 다시 붙는 중이면 기다림(2초)을 건너뛰고 바로 연다');
      e.last().open(); await tick();
      e.hub.checkAlive(); await tick();
      chk(e.last().all('ping').length === 0, '  ↳ ready 전에는 ping 을 보내지 않는다(서버가 auth 로 답한다)');
      const off = mk(S); off.hub.checkAlive();
      chk(off.socks.length === 0, '  ↳ 꺼져 있으면 아무 일 없음');
    }
  }

  say('── 5. 그 밖의 메시지 · 요청');
  {
    const e = mk(S);
    const seen = [];
    e.hub.onMessage('announce', (m) => seen.push('announce:' + m.text));
    e.hub.onMessage('welcome', (m) => seen.push('welcome:' + m.room));
    chk(e.hub.send({ t: 'status', visible: true }) === false, 'ready 전 send 는 false(보내지 않음)');
    e.hub.start();
    const ws = await readyOn(e);
    ws.msg({ t: 'announce', text: '공지', until: 1 });
    ws.msg({ t: 'welcome', room: 'PLAY-ABCD' });
    await tick();
    chk(seen.join() === 'announce:공지,welcome:PLAY-ABCD', 'onMessage — 확성기 · 방 메시지(방 포트 자리)');
    chk(e.hub.send({ t: 'status', visible: true }) === true && ws.all('status').length === 1, '  ↳ ready 뒤 send');
    const p = e.hub.request({ t: 'presenceGet', ids: ['u2'] });
    await tick();
    const q = ws.all('presenceGet')[0];
    ws.msg({ t: 'presence', users: { u2: { online: true } }, rid: q && q.rid });
    const ans = await p;
    chk(q && typeof q.rid === 'string' && ans && ans.users.u2.online === true, 'request — rid 로 답 짝짓기(presenceGet → presence)');
    chk(e.H.ROOM_TYPES.every((t) => e.H.MESSAGE_TYPES.includes(t)) && e.H.ROOM_TYPES.includes('chatLine') && e.H.ROOM_TYPES.includes('photoShot'), '  ↳ 방 · 대화 · 사진 메시지 종류를 다 받는다(방 포트 자리)');
  }

  say('── 6. 순수 · 배선');
  {
    const H = loadHub(S.HUB);
    const mem = (o) => ({ getItem: (k) => (k in o ? o[k] : null) });
    chk(H.realtimeUrlFor('prod', mem({ 'tw.realtimeUrl': 'ws://127.0.0.1:8787' })) === 'wss://realtime.together-working.com', '운영 앱은 늘 운영 주소(시험 주소 무시)');
    chk(H.REALTIME_URLS.dev === 'ws://127.0.0.1:8787' && H.DEV_URL_RE.test(H.REALTIME_URLS.dev), '  dev 기본은 이 PC 로컬 8787(dev 용 공개 이름은 없다) · 시험 주소 규칙 안');
    chk(H.realtimeUrlFor('dev', mem({})) === H.REALTIME_URLS.dev && H.realtimeUrlFor('dev', mem({ 'tw.realtimeUrl': 'ws://127.0.0.1:8787' })) === 'ws://127.0.0.1:8787'
      && H.realtimeUrlFor('dev', mem({ 'tw.realtimeUrl': 'wss://evil.example' })) === H.REALTIME_URLS.dev && H.realtimeUrlFor('dev', mem({ 'tw.realtimeUrl': 'ws://127.0.0.1:9999' })) === H.REALTIME_URLS.dev,
      '  ↳ dev 앱만 tw.realtimeUrl(묶음 안 wss · 로컬 8787) · 밖은 무시');
    const sid = H.sessionIdOf('0b6c1f4e-2d0b-4b9e-9a7a-1f2e3d4c5b6a');
    chk(/^[A-Za-z0-9_-]{1,32}$/.test(sid) && sid.length === 32, '세션 id — 서버 규칙(영숫자 _ - 1~32) · ' + sid);
    const evs = {}; let wakeFn = null;
    const w = { localStorage: { getItem: () => null }, TwDeviceId: { store: { get: () => 'dev-0001' } }, TwRequestId: { newId: () => '0b6c1f4e-2d0b-4b9e-9a7a-1f2e3d4c5b6a' }, WebSocket: function(){},
      addEventListener: (n, f) => { (evs[n] = evs[n] || []).push(f); }, companion: { onWake: (f) => { wakeFn = f; } } };
    { const m = { exports: {} }; new Function('module', 'window', S.API)(m, undefined); w.TwApi = m.exports; }   // 환경 판정은 api-client 의 envOf 한 곳
    const T = loadHub(S.HUB, w);
    let threw = false; try{ T.store.start(); }catch(_){ threw = true; }
    chk(T && T.store && typeof T.store.bind === 'function' && threw, 'window.TwRtHub.store — bind 전 start 는 던진다(조용히 안 붙지 않게)');
    { /* 창 신호 — 앱 끄기 → quit · online · 깨어남 → checkAlive */
      const calls = [];
      const fake = { quit: () => calls.push('quit'), checkAlive: () => calls.push('alive') };
      const ev2 = {}; let wk = null;
      H.bindWindowEvents({ addEventListener: (n, f) => { (ev2[n] = ev2[n] || []).push(f); }, companion: { onWake: (f) => { wk = f; } } }, fake);
      ev2.beforeunload.forEach((f) => f()); ev2.online.forEach((f) => f()); wk('resume');
      chk(calls.join() === 'quit,alive,alive', '창 신호 — beforeunload → quit · online · 깨어남(companion.onWake) → checkAlive');
      chk((evs.beforeunload || []).length === 1 && (evs.online || []).length === 1 && typeof wakeFn === 'function', '  ↳ 앱 한 벌은 실릴 때 건다');
    }
    const h = S.HTML, i = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
    chk(i('shared/request-id.js') > 0 && i('shared/device-id.js') > i('shared/request-id.js') && i('realtime/rt-hub.js') > i('shared/device-id.js') && i('app.js') > i('realtime/rt-hub.js'),
      'html — request-id.js · device-id.js → rt-hub.js → app.js 차례');
    chk(i('shared/api-client.js') > 0 && i('shared/api-client.js') < i('realtime/rt-hub.js'), 'html — api-client.js(envOf) 가 rt-hub.js 보다 먼저');
    { /* 앱 한 벌이 고르는 주소 — dev 앱이면 dev · 그 밖은 운영 · 판정은 api-client 의 envOf 를 바꾸면 따라 바뀐다(따로 판정 안 함) */
      const urlOf = (companion, envOf) => {
        const w2 = Object.assign({}, w, { companion: Object.assign({ onWake(){} }, companion || {}) });
        { const m = { exports: {} }; new Function('module', 'window', S.API)(m, undefined); w2.TwApi = envOf ? Object.assign({}, m.exports, { envOf }) : m.exports; }
        const H2 = loadHub(S.HUB, w2); let target = null;
        H2.store.bind({ createLink: (d) => { target = d.target; return { ensureReady(){}, close(){}, send(){ return false; }, request(){ return Promise.resolve(null); } }; },
          getToken: async () => 't', getVersion: () => '0.13.0' });
        try{ H2.store.start(); }catch(_){}
        try{ H2.store.stop(); }catch(_){}
        return target ? target() : null;
      };
      chk(urlOf({ firebaseEnv: 'dev' }) === H.REALTIME_URLS.dev && urlOf(undefined) === H.REALTIME_URLS.prod, '앱 한 벌 — dev 앱은 dev 주소 · 그 밖은 운영 주소');
      chk(urlOf({ firebaseEnv: 'dev' }, () => 'prod') === H.REALTIME_URLS.prod, '  ↳ 판정은 TwApi.envOf 를 따른다(따로 판정하지 않는다)');
    }
    chk(/window\.TwRtHub\.store\.bind\(\{ createLink: createRealtimeLink, getToken: _getIdToken, getVersion: \(\) => _appVer\.ready \}\);/.test(strip(S.FI)), 'firebase-init — 연결 공통부 · 토큰 · 버전을 bind');
    chk(!/\.start\(/.test(strip(S.FI).split('window.TwRtHub.store.bind')[1].split('\n')[0]), '  ↳ 켜기는 여기서 안 한다(로그인 흐름 몫)');
  }
}

(async () => {
await judge(SRC0);

say('── 7. 일부러 깨 보기');
const BREAKS = [
  ['HUB', "        if(phase === 'open' && claimNext) o.claim = true;", "        o.claim = true;", '다시 붙기 · 토큰 갱신에도 claim(밀려난 앱이 남을 밈)'],
  ['HUB', "    authFails = 0; claimNext = false;", "    authFails = 0;", '다시 붙을 때 또 차지'],
  ['HUB', "    if(gap != null && gap > graceOf(m)) resync();", "    if(gap != null) resync();", '짧게 끊겨도 다 다시 받음(몰림)'],
  ['HUB', "    if(gap != null && gap > graceOf(m)) resync();", "", '오래 끊겨도 다시 받기 없음(놓친 알림)'],
  ['HUB', "    if(gap != null && gap > graceOf(m)) resync();", "    if(gap != null && gap > 20000) resync();", 'graceMs 대신 박힌 20초'],
  ['HUB', "        if(done.has(fn)) continue;", "", '같은 함수를 종류마다 다시 부름'],
  ['HUB', "      if(!kindFns.has(m.kind)) return;", "      if(!kindFns.has(m.kind)){ emitKind('friends', {}); return; }", '모르는 종류를 다른 데로 흘림'],
  ['HUB', "      if(authFails > 1){ stopWith(STATE.AUTH_FAILED); return; }", "", '4001 을 끝없이 다시'],
  ['HUB', "    if(act === ACTION.AUTH || fatal === 'auth') link.markAuthRetry();   // 다음 열기는 새 토큰", "", '4001 뒤 옛 토큰으로 다시'],
  ['HUB', "    if(act === ACTION.AUTH){", "    if(act === ACTION.AUTH || fatal === 'auth'){", '토큰 못 받음(오프라인)도 4001 처럼 세어 멈춤'],
  ['HUB', "    if(sawSessionLost){ sawSessionLost = false; stopWith(STATE.SESSION_LOST); return; }", "", '밀려남 메시지 뒤 번호 없이 끊겨도 멈춰야 함'],
  ['HUB', "[CLOSE_CODES.protocol]: ACTION.UPDATE,", "  [CLOSE_CODES.protocol]: ACTION.RECONNECT,", '판이 달라도 계속 붙음'],
  ['HUB', "[CLOSE_CODES.maintenance]: ACTION.MAINTENANCE,", "  [CLOSE_CODES.maintenance]: ACTION.RECONNECT,", '점검인데 끝없이 다시 붙음'],
  ['HUB', "[CLOSE_CODES.accountGone]: ACTION.ACCOUNT_GONE,", "", '계정 없음(4007)을 모르는 번호로 봄'],
  ['HUB', "[CLOSE_CODES.restart]: ACTION.RESTART,", "  [CLOSE_CODES.restart]: ACTION.RECONNECT,", '재시작(1001)을 흩지 않고 1초 뒤 몰림'],
  ['HUB', "  return (code >= 4000 && code <= 4999) ? ACTION.UNKNOWN : ACTION.RECONNECT;", "  return ACTION.RECONNECT;", '모르는 4000번대에도 계속 붙음'],
  ['HUB', "  return (code >= 4000 && code <= 4999) ? ACTION.UNKNOWN : ACTION.RECONNECT;", "  return ACTION.UNKNOWN;", '모르는 1000번대에 멈춤'],
  ['HUB', "  if(typeof code !== 'number') return ACTION.RECONNECT;", "  if(typeof code !== 'number') return ACTION.END;", '번호 없는 끊김(1006)에 멈춤'],
  ['HUB', "    if(act === ACTION.RESTART) link.scheduleReconnect({ delayMs: random() * RESTART_SPREAD_MS, readyWaitMs: RESTART_READY_WAIT_MS });", "    if(act === ACTION.RESTART) link.scheduleReconnect({ delayMs: random() * RESTART_SPREAD_MS });", '1001 뒤 ready 를 5초만 기다림'],
  ['HUB', "const RESTART_READY_WAIT_MS = 35000;", "const RESTART_READY_WAIT_MS = 5000;", '재시작 ready 기다림이 흩기보다 짧음'],
  ['HUB', "      byeDone = { res, timer: tSet(() => { byeDone = null; link.close(); setState(STATE.OFF); res(); }, BYE_WAIT_MS) };", "      link.close(); setState(STATE.OFF); res();", 'bye 뒤 서버 닫힘을 안 기다림'],
  ['HUB', "      byeDone = { res, timer: tSet(() => { byeDone = null; link.close(); setState(STATE.OFF); res(); }, BYE_WAIT_MS) };", "      byeDone = { res, timer: tSet(() => { byeDone = null; setState(STATE.OFF); res(); }, BYE_WAIT_MS) };", '서버가 안 닫으면 앱도 안 닫음'],
  ['HUB', "    if(!link.send({ t: 'bye', why })){", "    if(true){", 'bye 를 안 보냄'],
  ['HUB', "    link.send({ t: 'bye', why: BYE_WHY.QUIT });\n    link.close();", "    link.close();", '앱 끄기에 bye 없음'],
  ['HUB', "      pongTimer = tSet(() => { pongTimer = null; if(started) link.drop(); }, PONG_WAIT_MS);", "", 'pong 이 없어도 안 끊음'],
  ['HUB', "    if(m.t === 'pong'){ clearPong(); return; }", "", 'pong 을 받아도 끊음'],
  ['HUB', "    if(state === STATE.READY){", "    if(true){", 'ready 전에도 ping(서버가 auth)'],
  ['HUB', "    link.reconnectNow();\n  }", "  }", '다시 붙는 중 online 에 기다림 그대로'],
  ['HUB', "  win.addEventListener('beforeunload', () => hub.quit());", "", '앱 끄기에 작별 안 함'],
  ['HUB', "  if(win.companion) win.companion.onWake(() => hub.checkAlive());", "", '깨어남에 확인 안 함'],
  ['LINK', "        closeCode = PRE_READY_ERROR_CLOSE[m.code] || null;", "", 'ready 전 error auth 를 4001 로 안 셈(끝없이 다시)'],
  ['LINK', "    if(want && !ws) open(waitMs);", "    if(want && !ws) open();", '정한 ready 기다림을 안 씀'],
  ['HUB', "    if(!kindFns.has(kind)) throw new Error('[realtime] 모르는 알림 종류 — ' + kind);", "    if(!kindFns.has(kind)) kindFns.set(kind, []);", '모르는 이름을 조용히 받음'],
  ['HUB', "    if(link) link.close();\n    setState(STATE.OFF);", "    setState(STATE.OFF);", 'stop 이 연결을 안 닫음'],
  ['LINK', "    const base = (deps.pv >= 2) ? { t: 'hello', pv: deps.pv, token: tk, ver: helloVer } : ", "    const base = (deps.pv >= 2) ? { t: 'hello', pv: deps.pv, token: tk, userId: helloUid, ver: helloVer } : ", 'pv 2 hello 에 userId(서버가 모르는 칸 — badRequest)'],
  ['HTML', '<script src="parts/realtime/rt-hub.js"></script>', '', 'html 에 안 실음'],
  ['FI', "  window.TwRtHub.store.bind({ createLink: createRealtimeLink, getToken: _getIdToken, getVersion: () => _appVer.ready });", '', 'firebase-init 이 bind 안 함'],
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
})().catch((e) => { console.error(e); process.exit(1); });
