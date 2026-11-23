/* sim-rt-hub.js — 🛰 realtime 연결 하나(realtime/rt-hub.js) 검사 — 진짜 연결 공통부(realtime-link.js) · 가짜 웹소켓 · 가짜 시계로 그대로 돌린다
   ・1절: 켜기 — hello { pv:4 · token · ver · deviceId · session · claim } · userId 없음 · ready 의 userCode · 상태
   ・2절: 늘 붙음 — 끊기면 백오프로 다시 · 다시 붙기 hello 에는 claim 없음 · 세션 · 기기는 같음 · stop 하면 안 붙음
   ・3절: 알림 표 — 건 종류만 · 모르는 종류는 버림 · 모르는 이름을 걸면 던짐 · 끊긴 시간이 ready.graceMs 를 넘으면 건 함수마다 한 번 다시 받기(짧으면 없음)
   ・4절: 닫힘 번호 표 — 서버 표와 같은 이름 · 값 · 코드마다 처리(1000 끝 · 1001 흩어 다시 · 1006 · 1009 · 4008 다시 붙기 · 4005 첫 시도 0~60초 · 그다음 상한 120초 · 잠깐 ready 로는 횟수를 안 놓음 · 4001 새 토큰으로 한 번 ·
          ready 전 error auth 도 4001 로 셈 · 4003 업데이트 · 4004 밀려남 · 4006 점검 · 4007 계정 없음 · 모르는 4000번대 멈춤 · 모르는 1000번대 다시)
   ・4-2절: 작별 · 살아 있음 — bye(leave 는 부르는 쪽) → 서버 닫힘 기다림 1초 · 못 받으면 앱이 닫음 · quit 은 바로 닫음 · ping 5초 · 다시 붙는 중엔 바로 한 번
   ・4-3절: 조용함 확인 — ready 인 채 15초 아무것도 못 받으면 ping · 5초 안에 pong 없으면 끊기 · 받은 메시지가 15초를 다시 셈 · stop · bye · quit · 끊김 뒤 타이머 없음 · 다시 붙어도 하나
   ・5절: 그 밖의 메시지 · 요청 — onMessage(방 메시지 자리 포함) · request 의 rid 짝 · send 는 ready 일 때만
   ・6절: 순수 · 배선 — 주소(운영 · dev · 시험 주소) · 세션 id 모양 · window.TwRtHub · bind 전 start 는 던짐 · html 차례 · firebase-init bind
   ・7절: mutation test */
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
  RB: pick(at('rt-bind.js', 'realtime')),
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
  const c = { t: 1_800_000_000_000, q: [], id: 0, skew: 0 };   // skew — PC 시계(now)만 앞뒤로 옮김 · 타이머는 그대로
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
    kill(code, reason){ this.closed = true; if(this.onclose) this.onclose({ code, reason: reason || '' }); }   // 서버가 끊음(reason = 닫힘 까닭)
    open(){ if(this.onopen) this.onopen(); }
    msg(m){ if(this.onmessage) this.onmessage({ data: JSON.stringify(m) }); }
    all(t){ return this.sent.filter((x) => x.t === t); }
  }
  return { FakeWS, socks };
}

function mk(S, tokenOk, url){
  tokenOk = tokenOk || (() => true);
  url = url || (() => 'wss://realtime.together-working.com');
  const L = loadLink(S.LINK), H = loadHub(S.HUB);
  const clock = mkClock();
  const { FakeWS, socks } = mkWS();
  const forces = [];
  const nSess = { n: 0, ids: [] };   // 새 세션 id 를 뽑은 횟수 — 연결(로그인)마다 하나
  const hub = H.createRtHub({
    createLink: L.createRealtimeLink, WebSocket: FakeWS, url,
    getToken: async (force) => { forces.push(!!force); if(!tokenOk()) throw new Error('offline'); return 'tok' + forces.length; },
    getVersion: async () => '0.13.0', deviceId: () => 'dev-0001', newSession: () => { const s = 'sess0' + (++nSess.n); nSess.ids.push(s); return s; },
    now: () => clock.t + clock.skew, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, random: () => 0.5, log: { warn(){} },
  });
  const states = [];
  hub.onState((s) => states.push(s));
  return { H, L, hub, clock, socks, forces, states, nSess, last: () => socks[socks.length - 1] };
}
async function waitNewSock(e, n0){   // 새로 만든 · 아직 안 닫힌 소켓이 생길 때까지 시계를 조금씩
  for(let i = 0; i < 400 && (e.socks.length <= n0 || e.last().closed); i++) await e.clock.advance(250);
}
async function readyOn(e, code, graceMs){
  await tick();
  const ws = e.last();
  ws.open(); await tick();
  ws.msg({ t: 'ready', pv: 4, now: e.clock.t, userCode: code || 'u1', graceMs: (graceMs == null) ? 20000 : graceMs });
  await tick();
  return ws;
}

const e0KeepConst = (S) => loadHub(S.HUB).KEEPALIVE_IDLE_MS;

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
    chk(h && h.pv === 4 && h.token === 'tok1' && h.ver === '0.13.0' && h.deviceId === 'dev-0001' && h.session === 'sess01' && h.claim === true && !('userId' in h),
      'hello { pv:4 · token · ver · deviceId · session · claim:true } · userId 없음');
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

  say('── 2-0. 서버 시계 — ready.now 로 맞춘 방 밖 시계(첫 ready 전 · 끝낸 뒤에는 null = 모름)');
  {
    const e = mk(S);
    chk(e.hub.serverNow() === null, '★ ready 전에는 null — PC 시계로 대신하지 않는다');
    e.hub.start();
    await tick(); const ws = e.last(); ws.open(); await tick();
    ws.msg({ t: 'ready', pv: 4, now: e.clock.t + 5000, userCode: 'u1', graceMs: 20000 }); await tick();
    chk(e.hub.serverNow() === e.clock.t + 5000, '★ ready.now 와 PC 시계의 차이를 더한다(서버가 5초 앞)');
    await e.clock.advance(1000);
    chk(e.hub.serverNow() === e.clock.t + 5000, '  ↳ 시간이 가면 같은 차이로 따라간다');
    e.hub.stop();
    chk(e.hub.serverNow() === null, '★ 연결을 끝내면 다시 null(로그인마다 새로 — 앞 계정 값이 남지 않는다)');
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
    { const r = mk(S); r.hub.start(); const w = await readyOn(r);
      w.msg({ t: 'sessionLost' }); w.kill(4004, 'deviceRemoved'); await tick(); await r.clock.advance(30000);
      chk(r.hub.state() === 'deviceRemoved' && r.socks.length === 1, '★ 4004 + 까닭 deviceRemoved — 이 PC 가 지워짐: 멈춤(deviceRemoved) · 다시 안 붙음 · sessionLost 와 다른 상태');
      const r2 = mk(S); r2.hub.start(); const w2 = await readyOn(r2);
      w2.kill(4004, 'deviceRemoved'); await tick(); await r2.clock.advance(30000);
      chk(r2.hub.state() === 'deviceRemoved', '  ↳ 메시지 없이 닫혀도 까닭으로 가른다');
      const r3 = mk(S); r3.hub.start(); const w3 = await readyOn(r3);
      w3.msg({ t: 'sessionLost' }); w3.kill(4004, 'sessionLost'); await tick();
      chk(r3.hub.state() === 'sessionLost', '  ↳ 까닭이 sessionLost(또는 없음)면 옛 뜻 그대로 sessionLost'); }
    chk(c.hub.serverNow() === null, '★ 밀려 멈추면 서버 시계도 놓는다(밀려난 PC 가 폰 집중 시간을 쌓지 않게)');
    { const sid = c.hub.session();
      c.hub.start({ claim: true });
      const cw2 = await readyOn(c);
      chk(cw2.all('hello')[0].session === sid && c.hub.session() === sid, '★ session() — 다시 붙기 전 등록이 쓰는 세션 id 와 hello.session 이 같다'); }
    {
    const cw2 = c.last();
    chk(cw2.all('hello')[0].claim === true && c.hub.isReady(), '  ↳ «여기서 계속» — start({ claim:true }) 로 다시 붙기');
    }
    { const f = mk(S); const sid = f.hub.session(); f.hub.start(); const w = await readyOn(f);
      chk(w.all('hello')[0].session === sid, '★ 첫 start 전에 뽑은 session() 을 첫 hello 가 그대로 싣는다(등록이 먼저)'); }
    const d = mk(S);
    d.hub.start(); const dw = await readyOn(d);
    dw.kill(4005); await tick(); await d.clock.advance(30000);
    chk(d.hub.state() === 'retrying' && d.socks.length === 2, '4005 — 다시 붙기(API 못 닿음 · 흩은 기다림 뒤)');
    const n = mk(S);
    n.hub.start({ claim: false });
    const nw = await readyOn(n);
    chk(!('claim' in nw.all('hello')[0]), 'start({ claim:false }) — 차지하지 않고 붙기');

    /* 표 — 서버 closeCodes.ts 와 같은 이름 · 값 */
    const H = a.H;
    const SERVER = { bye: 1000, restart: 1001, tooLarge: 1009, auth: 4001, protocol: 4003, sessionLost: 4004, unavailable: 4005, maintenance: 4006, accountGone: 4007, helloTimeout: 4008 };
    chk(JSON.stringify(H.CLOSE_CODES) === JSON.stringify(SERVER) && !Object.values(H.CLOSE_CODES).includes(4002), '닫힘 번호 표 — 서버 표와 같은 이름 · 값(4002 없음)');
    const want = [[null, 'reconnect'], [1000, 'end'], [1001, 'restart'], [1006, 'reconnect'], [1009, 'reconnect'], [1011, 'reconnect'], [1999, 'reconnect'],
      [4001, 'auth'], [4002, 'unknown'], [4003, 'update'], [4004, 'sessionLost'], [4004, 'deviceRemoved', 'deviceRemoved'], [4004, 'sessionLost', 'sessionLost'], [4005, 'unavailable'], [4006, 'maintenance'], [4007, 'accountGone'], [4008, 'reconnect'],
      [4000, 'unknown'], [4999, 'unknown'], [5000, 'reconnect']];
    const bad = want.filter(([c, act, why]) => H.closeAction(c, why) !== act).map(([c, act, why]) => c + (why ? '/' + why : '') + '→' + H.closeAction(c, why) + '(' + act + ')');
    chk(typeof H.isDeviceOff === 'function' && H.isDeviceOff('sessionLost') && H.isDeviceOff('deviceRemoved') && !['ready', 'off', 'retrying', 'authFailed', 'closed', 'accountGone'].some(H.isDeviceOff),
      '★ isDeviceOff — «서버가 이 PC 연결을 끝냄» 판정 한 곳(sessionLost · deviceRemoved 만)');
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
    chk(await retryOn(1006) && await retryOn(1009) && await retryOn(4008) && await retryOn(1011), '1006 · 1009 · 4008 · 모르는 1000번대 — 백오프 다시 붙기(1초 · 그대로)');
    { /* 4005 — API 로 토큰을 확인 못 함: 첫 시도 0~60초 흩기 · 그다음 [base/2, base] 상한 120초 · 잠깐 ready 로는 횟수를 안 놓음 (random 0.5) */
      const u = mk(S); u.hub.start(); let w = await readyOn(u);
      const gapTo = async (ms) => {   // ms-1 에는 안 붙고 ms 에 붙는가
        const n0 = u.socks.length;
        await u.clock.advance(ms - 1); const before = u.socks.length === n0;
        await u.clock.advance(1); await tick();
        return before && u.socks.length === n0 + 1;
      };
      w.kill(4005); await tick();
      chk(await gapTo(30000), '★ 4005 — 첫 시도는 0~60초 흩기(random 0.5 → 30초) · 1초 백오프 아님');
      u.last().open(); await tick(); u.last().kill(4005); await tick();
      chk(await gapTo(45000), '  ↳ ready 전에 또 4005 — 두 번째는 60초 기준 [30, 60]초(45초)');
      w = await readyOn(u); await u.clock.advance(10000);
      w.kill(4005); await tick();
      chk(await gapTo(90000), '  ↳ ★ 잠깐(10초) ready 됐다 또 4005 — 횟수를 놓지 않고 늘린다(120초 기준 90초 · 1초 · 30초 아님)');
      u.last().open(); await tick(); u.last().kill(4005); await tick();
      chk(await gapTo(90000), '  ↳ 그다음도 상한 120초 기준(90초) — 더 늘지 않는다');
      w = await readyOn(u);
      for(let i = 0; i < 6; i++){ await u.clock.advance(10000); w.msg({ t: 'pong' }); await tick(); }   // 조용함 확인에 안 끊기게 10초마다 받기
      chk(!w.closed, '  ↳ (60초 ready 유지)');
      w.kill(4005); await tick();
      chk(await gapTo(30000), '  ↳ ready 가 60초 이어진 뒤의 4005 는 처음부터(30초)');
      w = await readyOn(u); await u.clock.advance(5000);
      w.kill(1006); await tick();
      chk(await gapTo(1000), '  ↳ 4005 사이에 온 1006 은 그대로 1초 백오프');
      const v = mk(S); v.hub.start(); let vw = await readyOn(v);
      vw.kill(4005); await tick(); await v.clock.advance(30000); v.last().open(); await tick(); v.last().kill(4005); await tick();
      v.hub.stop(); v.hub.start(); vw = await readyOn(v); vw.kill(4005); await tick();
      const n0 = v.socks.length; await v.clock.advance(29999); const early = v.socks.length === n0; await v.clock.advance(1); await tick();
      chk(early && v.socks.length === n0 + 1, '  ↳ 끄고 다시 켜면(start) 횟수를 놓는다');
      const D = u.H.unavailableDelayMs, mx = [];
      for(let n = 0; n < 8; n++) mx.push([D(n, 0), D(n, 0.999999)]);
      chk(D(0, 0) === 0 && D(0, 0.999999) <= 60000 && D(0, 0.999999) > 59000 && mx.slice(1).every(([a, b]) => a <= 120000 && b >= 30000) && D(1, 0) === 60000 && D(2, 0) === 120000 && D(7, 0) === 120000 && D(7, 1) === 60000,
        '  ↳ unavailableDelayMs — 첫 시도 [0, 60초] · 그다음 [30, 60] · [60, 120]초 · 상한 120초 — ' + mx.map((x) => x.join('~')).join(' '));
    }
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
          deviceId: () => 'd', newSession: () => 's', now: () => c.t, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, random: () => v, log: { warn(){} } });
        hb.start(); await tick(); socks[0].open(); await tick(); socks[0].msg({ t: 'ready', pv: 4, now: 0, userCode: 'u', graceMs: 20000 }); await tick();
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
    { /* 세션 id — 연결(로그인)마다 새로 · 다시 붙기 · «여기서 계속» 은 같은 값(S-4b) */
      const e = mk(S); e.hub.start(); const w1 = await readyOn(e);
      const sid1 = w1.all('hello')[0].session;
      w1.kill(1006); await tick(); await e.clock.advance(1000); const w2 = e.last(); await readyOn(e);
      chk(w2.all('hello')[0].session === sid1 && e.nSess.ids.length === 1, '세션 id — 다시 붙기 hello 는 같은 값(새로 안 뽑는다)');
      let p = e.hub.bye('logout'); await tick(); e.last().kill(1000); await p;
      e.hub.start(); const w3 = await readyOn(e);
      const sid2 = w3.all('hello')[0].session;
      chk(sid2 !== sid1 && e.nSess.ids.length === 2, '  ↳ bye(로그아웃) 뒤 다시 켜면(다음 로그인) 새 세션 id · hello 가 앞과 다르다');
      e.hub.stop(); e.hub.start(); const w4 = await readyOn(e);
      chk(w4.all('hello')[0].session !== sid2 && e.nSess.ids.length === 3, '  ↳ stop(계정이 없어 끈 연결) 뒤 켜도 새 세션 id');
      e.hub.quit(); e.hub.start(); const w5 = await readyOn(e);
      chk(w5.all('hello')[0].session === e.nSess.ids[3] && e.nSess.ids.length === 4, '  ↳ quit 뒤 켜도 새 세션 id');
      w5.msg({ t: 'sessionLost' }); w5.kill(4004); await tick();
      chk(e.hub.state() === 'sessionLost', '  (밀림 — 멈춤)');
      e.hub.start({ claim: true }); const w6 = await readyOn(e);
      chk(w6.all('hello')[0].session === w5.all('hello')[0].session && e.nSess.ids.length === 4 && w6.all('hello')[0].claim === true, '  ↳ «여기서 계속»(밀린 뒤 claim start)은 같은 세션 id — 새로 안 뽑는다');
      const w7e = mk(S); w7e.hub.start(); const a = await readyOn(w7e); w7e.hub.bye('switch'); await tick(); w7e.last().kill(1000); await tick(); w7e.hub.start(); const b = await readyOn(w7e);
      chk(a.all('hello')[0].session !== b.all('hello')[0].session, '  ↳ A → B(bye 뒤 start) — 두 연결의 session 이 다르다(서버가 «같은 세션 + 다른 사람» 을 4001 로 보지 않게)');
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

  say('── 4-3. 조용함 확인(ready 인 채 15초 못 받으면 ping)');
  {
    const IDLE = 15000;
    const keeps = (e) => e.clock.q.filter((h) => h.f.name === 'onKeep').length;   // 걸려 있는 조용함 타이머 수
    chk(e0KeepConst(S) === IDLE, 'KEEPALIVE_IDLE_MS = 15000 을 내놓는다(PONG_WAIT_MS 옆)');
    { /* 15초 조용 → ping · 5초 안에 pong 없으면 끊고 다시 */
      const e = mk(S); e.hub.start(); const w = await readyOn(e);
      chk(keeps(e) === 1, 'ready 가 되면 조용함 타이머 하나');
      await e.clock.advance(IDLE - 1);
      chk(w.all('ping').length === 0, '  ↳ 15초 전엔 ping 없음');
      await e.clock.advance(1);
      chk(w.all('ping').length === 1 && !w.closed, '  ↳ 15초 아무것도 못 받으면 ping 한 번(checkAlive 길)');
      await e.clock.advance(4999);
      chk(!w.closed && e.hub.isReady(), '  ↳ pong 기다림 5초 전엔 그대로');
      await e.clock.advance(1);
      chk(w.closed && e.hub.state() === 'retrying' && keeps(e) === 0, '  ↳ 5초에 pong 이 없으면 끊고 retrying · 조용함 타이머 없음');
      await waitNewSock(e, 1); const w2 = await readyOn(e);
      chk(e.hub.isReady() && w2 !== w && keeps(e) === 1, '  ↳ 다시 붙으면 타이머 하나 다시');
    }
    { /* pong 이 오면 그대로 · 다음 ping 은 pong 뒤 15초 */
      const e = mk(S); e.hub.start(); const w = await readyOn(e);
      await e.clock.advance(IDLE); w.msg({ t: 'pong' }); await tick();
      await e.clock.advance(IDLE - 1);
      chk(!w.closed && e.hub.isReady() && w.all('ping').length === 1, 'pong 이 오면 그대로 · 다음 15초 전엔 또 안 보냄');
      await e.clock.advance(1);
      chk(w.all('ping').length === 2, '  ↳ pong 뒤 15초 조용하면 다시 ping');
    }
    { /* 받은 메시지가 15초를 다시 센다 */
      const e = mk(S); e.hub.start(); const w = await readyOn(e);
      await e.clock.advance(10000); w.msg({ t: 'announce', text: 'x' }); await tick();
      await e.clock.advance(10000);
      chk(w.all('ping').length === 0, '받은 메시지(announce)가 있으면 그 뒤 15초까지 ping 없음(ready 뒤로는 20초)');
      w.msg({ t: 'notify', kind: 'friends' }); await tick();
      await e.clock.advance(IDLE - 1);
      chk(w.all('ping').length === 0 && keeps(e) === 1, '  ↳ 알림(notify)도 다시 센다 · 타이머는 하나');
      await e.clock.advance(1);
      chk(w.all('ping').length === 1, '  ↳ 마지막 메시지 뒤 15초에 ping');
    }
    { /* 끄면 타이머 없음 */
      const s1 = mk(S); s1.hub.start(); const a = await readyOn(s1);
      s1.hub.stop();
      chk(keeps(s1) === 0, 'stop — 조용함 타이머를 푼다');
      await s1.clock.advance(120000);
      chk(a.all('ping').length === 0 && s1.socks.length === 1, '  ↳ 2분 지나도 ping · 다시 붙기 없음');
      const s2 = mk(S); s2.hub.start(); const b = await readyOn(s2);
      const p = s2.hub.bye('logout'); await tick();
      chk(keeps(s2) === 0, 'bye — 서버 닫힘을 기다리는 동안에도 타이머 없음');
      b.kill(1000); await p; await s2.clock.advance(120000);
      chk(b.all('ping').length === 0, '  ↳ 작별 뒤 ping 없음');
      const s3 = mk(S); s3.hub.start(); const c = await readyOn(s3);
      s3.hub.quit();
      chk(keeps(s3) === 0, 'quit — 타이머를 푼다');
      const s4 = mk(S); s4.hub.start(); const d = await readyOn(s4);
      d.kill(1006); await tick();
      chk(s4.hub.state() === 'retrying' && keeps(s4) === 0, '끊겨 retrying — 타이머를 푼다');
      const s5 = mk(S); s5.hub.start(); const f = await readyOn(s5);
      f.kill(4006); await tick();
      chk(s5.hub.state() === 'maintenance' && keeps(s5) === 0, '멈춤 번호(4006 점검) — 타이머를 푼다');
    }
    { /* 다시 붙기를 여러 번 해도 타이머는 하나 */
      const e = mk(S); e.hub.start(); let w = await readyOn(e);
      for(let i = 0; i < 3; i++){ const n0 = e.socks.length; w.kill(1006); await tick(); await waitNewSock(e, n0); w = await readyOn(e); }
      chk(e.hub.isReady() && keeps(e) === 1, '세 번 다시 붙은 뒤에도 조용함 타이머 하나');
      await e.clock.advance(IDLE);
      chk(w.all('ping').length === 1 && e.socks.slice(0, -1).every((x) => x.all('ping').length === 0), '  ↳ 지금 연결에만 ping 한 번');
    }
    { /* PC 시계가 뒤로 감(시간 동기화 · 사용자가 바꿈) — 타이머는 그대로 · now 만 1시간 뒤로 */
      const e = mk(S); e.hub.start(); const w = await readyOn(e);
      await e.clock.advance(5000); e.clock.skew = -3_600_000;
      await e.clock.advance(IDLE - 5000);
      chk(w.all('ping').length === 1, 'PC 시계가 1시간 뒤로 가도 15초에 ping(남은 때를 믿지 않음)');
      await e.clock.advance(5000);
      chk(w.closed && e.hub.state() === 'retrying', '  ↳ pong 이 없으면 5초에 끊는다');
    }
    { /* 상태 알림을 받은 쪽이 ready 그 자리에서 끔 */
      const e = mk(S);
      e.hub.onState((st) => { if(st === 'ready') e.hub.stop(); });
      e.hub.start(); await readyOn(e);
      chk(e.hub.state() === 'off' && keeps(e) === 0, 'ready 알림 안에서 stop 해도 조용함 타이머가 남지 않는다');
    }
    { /* ready 인 채 주소가 바뀜(dev 앱 tw.realtimeUrl) — link 가 close 하고(onClosed 없음) 새 연결이 ready → onReady 가 한 번 더 */
      let u = 'wss://realtime.together-working.com';
      const e = mk(S, null, () => u); e.hub.start(); const w = await readyOn(e);
      u = 'ws://127.0.0.1:8787';
      e.hub.request({ t: 'presenceGet', ids: ['u2'] }); await tick();
      chk(w.closed && e.socks.length === 2, '  (주소가 바뀌면 link 가 앞 연결을 닫고 새로 연다)');
      await readyOn(e);
      chk(e.hub.isReady() && keeps(e) === 1, '주소가 바뀌어 ready 가 한 번 더 와도 조용함 타이머 하나');
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
    chk(H.realtimeUrlFor('prod', mem({ 'tw.realtimeUrl': 'ws://127.0.0.1:8787' })) === 'wss://realtime.together-working.com/v2', '운영 앱은 늘 운영 주소(시험 주소 무시) — 새 realtime 은 /v2');
    chk(H.DEV_URL_RE.test('wss://realtime-dev.together-working.com/v2') && H.DEV_URL_RE.test('wss://realtime-dev.together-working.com')
      && !H.DEV_URL_RE.test('wss://realtime-dev.together-working.com/v3') && !H.DEV_URL_RE.test('wss://realtime-dev.together-working.com/v2/x'),
      '  ↳ 시험 주소는 묶음 안 wss 에 /v2 를 붙여도 받고 다른 길은 안 받음');
    chk(H.realtimeUrlFor('dev', mem({ 'tw.realtimeUrl': H.REALTIME_URLS.prod })) === H.REALTIME_URLS.dev, '  ↳ dev 앱이 운영 주소를 시험 주소로 넣어도 로컬로');
    chk(!H.DEV_URL_RE.test('wss://rooms-dev.togetherworking.duckdns.org') && H.realtimeUrlFor('dev', mem({ 'tw.realtimeUrl': 'wss://rooms-dev.togetherworking.duckdns.org' })) === H.REALTIME_URLS.dev,
      '  ↳ ★ 옛 임시 도메인(duckdns)을 시험 주소 칸에 넣으면 로컬로 떨어진다(E-6)');
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
    chk(/window\.TwRtHub\.store\.bind\(\{\s*createLink: createRealtimeLink,\s*getToken: \(force\) => window\.firebaseAPI\.getIdToken\(force\),\s*getVersion: \(\) => appVer\.ready,\s*\}\);/.test(strip(S.RB)), 'rt-bind — 연결 공통부 · 토큰 · 버전을 bind');
    chk(!/\.start\(/.test(strip(S.RB).split('window.TwRtHub.store.bind')[1]), '  ↳ 켜기는 여기서 안 한다(로그인 흐름 몫)');
    chk(/<script type="module" src="parts\/firebase-init\.js"><\/script>\s*<script type="module" src="parts\/realtime\/rt-bind\.js"><\/script>/.test(S.HTML), '  ↳ html 이 rt-bind 를 module 로 firebase-init 다음에 싣는다');
  }
}

(async () => {
await judge(SRC0);

say('── 7. mutation test');
const BREAKS = [
  ['HUB', "    started = false; lostAt = null; userCode = null; sessionId = null; clockOff = null;\n    clearPong();\n    if(link) link.close();", "    started = false; lostAt = null; userCode = null; clockOff = null;\n    clearPong();\n    if(link) link.close();", 'stop 이 세션 id 를 안 비움(다음 로그인이 앞 id 를 씀)'],
  ['HUB', "    started = false; lostAt = null; userCode = null; sessionId = null; clockOff = null;\n    clearPong(); clearKeep();", "    started = false; lostAt = null; userCode = null; clockOff = null;\n    clearPong(); clearKeep();", 'bye 가 세션 id 를 안 비움(로그아웃 뒤 같은 id)'],
  ['HUB', "    started = false; sessionId = null; clockOff = null;\n    clearPong();\n    link.send({ t: 'bye', why: BYE_WHY.QUIT });", "    started = false; clockOff = null;\n    clearPong();\n    link.send({ t: 'bye', why: BYE_WHY.QUIT });", 'quit 이 세션 id 를 안 비움'],
  ['HUB', "    if(sessionId === null) sessionId = sessionIdOf(deps.newSession());", "    sessionId = sessionIdOf(deps.newSession());", '시작마다 새 id(다시 붙기 · 여기서 계속도 바뀜)'],
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
  ['HUB', "    if(sawSessionLost){ sawSessionLost = false; stopWith(act === ACTION.DEVICE_REMOVED ? STATE.DEVICE_REMOVED : STATE.SESSION_LOST); return; }", "", '밀려남 메시지 뒤 번호 없이 끊겨도 멈춰야 함'],
  ['HUB', "stopWith(act === ACTION.DEVICE_REMOVED ? STATE.DEVICE_REMOVED : STATE.SESSION_LOST)", "stopWith(STATE.SESSION_LOST)", '지워진 PC 를 «다른 창» 으로 봄(까닭을 안 가름)'],
  ['HUB', "  if(code === CLOSE_CODES.sessionLost && reason === CLOSE_REASONS.deviceRemoved) return ACTION.DEVICE_REMOVED;\n", "", 'closeAction 이 까닭을 안 봄'],
  ['HUB', "const isDeviceOff = (s) => s === STATE.SESSION_LOST || s === STATE.DEVICE_REMOVED;", "const isDeviceOff = (s) => s === STATE.SESSION_LOST;", 'isDeviceOff 가 지워진 PC 를 빠뜨림'],
  ['HUB', "  function stopWith(s){ started = false; clockOff = null; setState(s); }", "  function stopWith(s){ started = false; setState(s); }", '밀려 멈춰도 서버 시계를 들고 있음(밀린 PC 가 폰 시간을 쌓음)'],
  ['HUB', "    session();   // 끝낸 연결 뒤 첫 start", "    sessionId = sessionIdOf(deps.newSession());   // 끝낸 연결 뒤 첫 start", 'start 가 등록한 세션 id 를 버리고 새로 뽑음'],
  ['HUB', "[CLOSE_CODES.protocol]: ACTION.UPDATE,", "  [CLOSE_CODES.protocol]: ACTION.RECONNECT,", '판이 달라도 계속 붙음'],
  ['HUB', "[CLOSE_CODES.maintenance]: ACTION.MAINTENANCE,", "  [CLOSE_CODES.maintenance]: ACTION.RECONNECT,", '점검인데 끝없이 다시 붙음'],
  ['HUB', "[CLOSE_CODES.accountGone]: ACTION.ACCOUNT_GONE,", "", '계정 없음(4007)을 모르는 번호로 봄'],
  ['HUB', "[CLOSE_CODES.restart]: ACTION.RESTART,", "  [CLOSE_CODES.restart]: ACTION.RECONNECT,", '재시작(1001)을 흩지 않고 1초 뒤 몰림'],
  ['HUB', "[CLOSE_CODES.unavailable]: ACTION.UNAVAILABLE,", "[CLOSE_CODES.unavailable]: ACTION.RECONNECT,", '4005 를 1초 백오프로(몰림)'],
  ['HUB', "    if(wasReady && readyAt != null && now() - readyAt >= UNAVAILABLE_STABLE_MS) unavailFails = 0;", "    if(wasReady) unavailFails = 0;", '잠깐 ready 로도 4005 횟수를 놓음(다시 30초로)'],
  ['HUB', "    if(wasReady && readyAt != null && now() - readyAt >= UNAVAILABLE_STABLE_MS) unavailFails = 0;", "", '오래 붙어 있어도 4005 횟수를 안 놓음'],
  ['HUB', "delayMs: unavailableDelayMs(unavailFails++, random())", "delayMs: unavailableDelayMs(unavailFails, random())", '4005 가 이어져도 기다림이 안 늚'],
  ['HUB', "const UNAVAILABLE_SPREAD_MS = 60000;", "const UNAVAILABLE_SPREAD_MS = 30000;", '4005 첫 흩기가 60초가 아님'],
  ['HUB', "const UNAVAILABLE_BACKOFF_MS = Object.freeze([60000, 120000]);", "const UNAVAILABLE_BACKOFF_MS = Object.freeze([60000, 120000, 240000]);", '4005 상한이 120초를 넘음'],
  ['HUB', "  if(n <= 0) return Math.round(r * UNAVAILABLE_SPREAD_MS);", "  if(n <= 0) return UNAVAILABLE_SPREAD_MS;", '4005 첫 시도를 안 흩음(모두 60초에 몰림)'],
  ['HUB', "  return Math.round(base * (1 - 0.5 * r));", "  return base;", '4005 그다음 시도를 안 흩음'],
  ['HUB', "    started = true; authFails = 0; sawSessionLost = false; unavailFails = 0;", "    started = true; authFails = 0; sawSessionLost = false;", '다시 켜도 앞 4005 횟수가 남음'],
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
  ['HUB', "    armKeep(KEEPALIVE_IDLE_MS);   // setState 보다 먼저", "    //", 'ready 가 돼도 조용함 타이머 안 검(서버가 사라져도 ready 로 남음)'],
  ['HUB', "    lastInAt = now();\n    if(m.t === 'notify'){", "    if(m.t === 'notify'){", '받은 메시지가 조용함을 다시 안 셈(쓸데없는 ping)'],
  ['HUB', "    if(idle >= 0 && idle < KEEPALIVE_IDLE_MS)", "    if(idle < KEEPALIVE_IDLE_MS)", 'PC 시계가 뒤로 가면 되감긴 만큼 ping 이 늦음'],
  ['HUB', "    armKeep(KEEPALIVE_IDLE_MS);   // setState 보다 먼저 — 상태 알림을 받은 쪽이 그 자리에서 끄면 setState(OFF) 가 이 타이머를 푼다\n    setState(STATE.READY);", "    setState(STATE.READY);\n    armKeep(KEEPALIVE_IDLE_MS);", 'ready 알림 안에서 끄면 타이머가 남음'],
  ['HUB', "  function armKeep(ms){ clearKeep(); keepTimer", "  function armKeep(ms){ keepTimer", '타이머를 걸 때 앞의 것을 안 풂(주소가 바뀌어 ready 가 또 오면 둘)'],
  ['HUB', "    if(s !== STATE.READY) clearKeep();", "", 'ready 를 벗어나도 타이머가 남음(stop · 끊김 · 멈춤 · 다시 붙을 때마다 늘어남)'],
  ['HUB', "    clearPong(); clearKeep();   //", "    clearPong();   //", 'bye 가 타이머를 안 풂'],
  ['HUB', "    checkAlive();\n    armKeep(KEEPALIVE_IDLE_MS);", "    armKeep(KEEPALIVE_IDLE_MS);", '조용해도 ping 안 보냄'],
  ['HUB', "    checkAlive();\n    armKeep(KEEPALIVE_IDLE_MS);", "    checkAlive();", 'ping 한 번 뒤 조용함 확인이 멈춤'],
  ['HUB', "const KEEPALIVE_IDLE_MS = 15000;", "const KEEPALIVE_IDLE_MS = 30000;", '조용함 기준이 15초가 아님'],
  ['HUB', "    link.reconnectNow();\n  }", "  }", '다시 붙는 중 online 에 기다림 그대로'],
  ['HUB', "  win.addEventListener('beforeunload', () => hub.quit());", "", '앱 끄기에 작별 안 함'],
  ['HUB', "  if(win.companion) win.companion.onWake(() => hub.checkAlive());", "", '깨어남에 확인 안 함'],
  ['LINK', "        closeCode = PRE_READY_ERROR_CLOSE[m.code] || null;", "", 'ready 전 error auth 를 4001 로 안 셈(끝없이 다시)'],
  ['LINK', "    if(want && !ws) open(waitMs);", "    if(want && !ws) open();", '정한 ready 기다림을 안 씀'],
  ['HUB', "    if(!kindFns.has(kind)) throw new Error('[realtime] 모르는 알림 종류 — ' + kind);", "    if(!kindFns.has(kind)) kindFns.set(kind, []);", '모르는 이름을 조용히 받음'],
  ['HUB', "    if(link) link.close();\n    setState(STATE.OFF);", "    setState(STATE.OFF);", 'stop 이 연결을 안 닫음'],
  ['LINK', "const base = { t: 'hello', pv: deps.pv, token: tk, ver: helloVer };", "const base = { t: 'hello', pv: deps.pv, token: tk, userId: 'u1', ver: helloVer };", 'pv 2 hello 에 userId(서버가 모르는 칸 — badRequest)'],
  ['HUB', "const PV = 4;", "const PV = 3;", 'pv 3 으로 붙음(서버가 4003 으로 닫음 — 이름 · 레벨을 앱이 싣던 판)'],
  ['HTML', '<script src="parts/realtime/rt-hub.js"></script>', '', 'html 에 안 실음'],
  ['RB', "  createLink: createRealtimeLink,\n", '', 'rt-bind 가 연결 만들기를 안 건넴'],
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
chk(caught.length === BREAKS.length && !missed.length, 'mutation test ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
