/* ═══ 👥 sim-friends-presence-rt.js — 친구 접속 상태 realtime provider(friends/friends-presence-rt.js) · 내 접속 표시(friends/presence-self.js) ═══
   [왜] 친구 접속 상태를 Firebase 친구별 구독(n개)에서 realtime 연결 하나로 옮겼다 — 한 번 읽기는 presenceGet(100명씩 나눠), 듣기는 watch 하나.
     진짜 rt-hub + 진짜 realtime-link 위에 가짜 웹소켓 · 가짜 시계로 그대로 돌린다(rid 짝짓기 · 다시 붙기까지).
   ・1절: 순수 — presenceOf(온라인이 아니면 방 없음 · lastSeen 모르면 0) · chunk(상한 100 · 0 · 빈 목록) · usersOf
   ・2절: readPresence — 250명이면 100 · 100 · 50 세 요청 · 겹침 하나로 · 빈 목록은 요청 0 · 답에 없는 id 는 없는 채로 · 한 조각이라도 못 받으면 던진다(빈 값과 다르다)
   ・3절: watchPresence — ready 면 watch 하나 · 처음 전체 → LIVE · 바뀐 친구만 · 듣는 친구만 넘김 · rid 붙은(늦은 presenceGet 답) 건 버림 ·
          끊겼다 붙으면 watch 를 다시 · 풀면 unwatch · 새로 걸면 앞의 것을 풀고 하나만 · 듣기 상태는 WAITING · LIVE 둘 —
          연결이 멈춰도(다른 기기 · 업데이트 · 점검 · 계정 없음 · 모르는 4000번대) WAITING(멈춤 판단은 rt-hub 한 곳 · 화면은 끊김 정책 몫)
   ・4절: presence-self — 시작 전엔 안 보냄 · start 하면 status · 붙을 때마다 다시 · 값이 바뀌면 바로 · 타이머 없음 ·
          reset(계정 놓기 — onUnload 에 걸림) 뒤엔 붙어도 안 보냄 · 다시 start 하면 새 값 하나만
   ・5절: 배선 — html 차례 · smoke PRELOAD · app.js 가 realtime 연결 하나를 넘김
   ・6절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  PRT: pick(at('friends-presence-rt.js', 'friends')),
  SELF: pick(at('presence-self.js', 'friends')),
  HUB: pick(at('rt-hub.js', 'realtime')),
  LINK: pick(at('realtime-link.js', 'realtime')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  SMOKE: pick(['smoke.js', 'checks/smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadLink = (src) => {
  const names = [...src.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
  return new Function('Buffer', src.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')(Buffer);
};
const loadMod = (src, name) => { const win = {}; new Function('window', 'module', src)(win, undefined); return win[name]; };

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
    kill(code){ this.closed = true; if(this.onclose) this.onclose({ code }); }
    open(){ if(this.onopen) this.onopen(); }
    msg(m){ if(this.onmessage) this.onmessage({ data: JSON.stringify(m) }); }
    all(t){ return this.sent.filter((x) => x.t === t); }
  }
  return { FakeWS, socks };
}
function mkHub(S){
  const L = loadLink(S.LINK), H = (() => { const m = { exports: {} }; new Function('module', 'window', S.HUB)(m, undefined); return m.exports; })();
  const clock = mkClock();
  const { FakeWS, socks } = mkWS();
  const hub = H.createRtHub({
    createLink: L.createRealtimeLink, WebSocket: FakeWS, url: () => 'wss://realtime.together-working.com',
    getToken: async () => 'tok', getVersion: async () => '0.13.0', deviceId: () => 'dev-0001', session: 'sess01',
    now: () => clock.t, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, random: () => 0.5, log: { warn(){} },
  });
  return { H, hub, clock, socks, last: () => socks[socks.length - 1] };
}
async function readyOn(e){
  await tick();
  const ws = e.last();
  ws.open(); await tick();
  ws.msg({ t: 'ready', pv: 2, now: e.clock.t, userCode: 'me' });
  await tick();
  return ws;
}
/* 서버 realtime/src/protocol/parse.ts(origin/dev)의 status 판정을 그대로 흉내 — 칸은 t · visible 뿐, visible 은 불리언. 어긋나면 서버는 badRequest 로 거절한다. */
const serverAcceptsStatus = (m) => !!m && m.t === 'status' && Object.keys(m).every((k) => k === 't' || k === 'visible') && typeof m.visible === 'boolean';
const ids = (n, p) => Array.from({ length: n }, (_, i) => (p || 'u') + i);

async function judge(S){
  let M;
  try{ M = loadMod(S.PRT, 'TwFriendsPresenceRt'); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  chk(M && typeof M.createFriendsPresenceRt === 'function', '전역 이름 TwFriendsPresenceRt');
  if(!M) return;

  say('── 1. 순수');
  {
    const a = M.presenceOf({ online: true, lastSeen: 9, room: 'PLAY-1', inRoom: true }), b = M.presenceOf({ online: true, room: null, inRoom: false });
    const c = M.presenceOf({ online: false, lastSeen: 5, room: 'PLAY-1', inRoom: true }), d = M.presenceOf(null), f = M.presenceOf({ online: 'yes', lastSeen: -3 });
    chk(a.online && a.lastSeen === 9 && a.room === 'PLAY-1' && a.inRoom === true && b.room === null && b.inRoom === false && b.lastSeen === 0, 'presenceOf — 온라인 · 마지막 · 방 · 방에 있음(시크릿룸은 방 null 이어도 inRoom true 가 올 수 있다)');
    chk(!c.online && c.room === null && c.inRoom === false && c.lastSeen === 5 && !d.online && d.lastSeen === 0 && !f.online && f.lastSeen === 0, '  ↳ 오프라인이면 방 없음 · 모양이 틀리면 오프라인 · lastSeen 모르면 0');
    chk(M.PRESENCE_IDS_MAX === 100, '상수(모듈 위) — 한 번에 100명(서버 상한 · 친구 상한)');
    chk(JSON.stringify(M.chunk([], 100)) === '[]' && M.chunk(ids(1), 100).length === 1 && M.chunk(ids(100), 100).length === 1 && M.chunk(ids(101), 100).map((x) => x.length).join() === '100,1'
      && M.chunk(ids(250), 100).map((x) => x.length).join() === '100,100,50', 'chunk — 0 · 1 · 100 · 101 · 250 (경계)');
    chk(M.usersOf(null) === null && M.usersOf({ users: [] }) === null && M.usersOf({ users: 'x' }) === null && Object.keys(M.usersOf({ users: {} })).length === 0
      && Object.keys(M.usersOf({ users: { a: {}, b: {} } }, new Set(['a']))).join() === 'a', 'usersOf — 틀린 모양은 null · 빈 답은 빈 값 · 원하는 id 만');
  }

  say('── 2. readPresence — presenceGet 을 100명씩 나눠');
  {
    const e = mkHub(S);
    const prt = M.createFriendsPresenceRt({ rt: e.hub });
    e.hub.start();
    const ws = await readyOn(e);
    const want = ids(250);
    const p = prt.readPresence(want.concat(['u3', '', null]));
    await tick();
    const reqs = ws.all('presenceGet');
    chk(reqs.length === 3 && reqs.map((r) => r.ids.length).join() === '100,100,50' && new Set(reqs.map((r) => r.rid)).size === 3, '★ 친구 250명 → presenceGet 3번(100 · 100 · 50) · 요청마다 rid · 겹침 · 빈 값은 뺌');
    chk(reqs.every((r) => r.ids.every((x) => /^u\d+$/.test(x))) && new Set(reqs.flatMap((r) => r.ids)).size === 250, '  ↳ 한 명도 빠지거나 겹치지 않는다');
    for(const r of reqs){
      const users = {}; r.ids.forEach((x) => { if(x !== 'u7') users[x] = { online: x === 'u1', room: x === 'u1' ? 'PLAY-1' : null, inRoom: x === 'u1', lastSeen: 5 }; });
      if(r === reqs[0]) users.zzz = { online: true };
      ws.msg({ t: 'presence', users, full: true, rid: r.rid });
    }
    const out = await p;
    chk(Object.keys(out).length === 249 && out.u1.online === true && out.u1.room === 'PLAY-1' && out.u2.online === false && !('u7' in out) && !('zzz' in out),
      '  ↳ 답을 합친다 · 답에 없는 친구는 없는 채로(오프라인으로 꾸미지 않음) · 묻지 않은 id 는 버림');
    const n0 = ws.sent.length;
    chk(Object.keys(await prt.readPresence([])).length === 0 && Object.keys(await prt.readPresence(null)).length === 0 && ws.sent.length === n0, '빈 목록 · null — 요청 0 · 빈 값');
    const p2 = prt.readPresence(['a', 'b']);
    p2.catch(() => {});
    await tick();
    const q = ws.all('presenceGet')[3];
    ws.msg({ t: 'error', code: 'badRequest', ref: 'presenceGet' });
    let threw = null; try{ await p2; }catch(err){ threw = err; }
    chk(q && threw, '★ 서버가 거절하면 던진다(빈 값이 아니다 — 실패와 «없음» 을 가른다)');
    const p3 = prt.readPresence(ids(150, 'v')).catch((err) => { throw err; });
    p3.catch(() => {});
    await tick();
    const r3 = ws.all('presenceGet').slice(4);
    ws.msg({ t: 'presence', users: {}, full: true, rid: r3[0].rid });
    await e.clock.advance(4100);
    let threw3 = null; try{ await p3; }catch(err){ threw3 = err; }
    chk(r3.length === 2 && threw3, '  ↳ 두 조각 중 하나만 오고 하나가 시간 초과면 던진다(반쪽 값으로 «받음» 이라 하지 않음)');
    const off = mkHub(S);
    const prt2 = M.createFriendsPresenceRt({ rt: off.hub });
    let threw4 = null; try{ await prt2.readPresence(['a']); }catch(err){ threw4 = err; }
    chk(threw4 && off.socks.length === 0, '  ↳ 연결을 켜지 않았으면(로그인 전) 던진다 · 연결을 새로 열지 않는다');
  }

  say('── 3. watchPresence — watch 하나 · 바뀐 친구만');
  {
    const e = mkHub(S);
    const prt = M.createFriendsPresenceRt({ rt: e.hub });
    e.hub.start();
    const ws = await readyOn(e);
    const got = [], st = [];
    const off = prt.watchPresence(['f1', 'f2'], (u) => got.push(u), (s) => st.push(s));
    chk(ws.all('watch').length === 1 && !('rid' in ws.all('watch')[0]) && ws.all('presenceGet').length === 0, '★ 연결이 준비돼 있으면 watch 하나(친구마다 요청 없음 · 친구 목록은 서버가 안다)');
    ws.msg({ t: 'presence', users: { f1: { online: true, room: 'PLAY-1', inRoom: true, lastSeen: 3 }, f2: { online: false, lastSeen: 4 }, f9: { online: true } }, full: true });
    chk(got.length === 1 && Object.keys(got[0]).join() === 'f1,f2' && got[0].f1.room === 'PLAY-1' && st.join() === 'waiting,live', '  ↳ 보내면 waiting(처음 전체를 기다림) · 처음 전체 — 듣는 친구만 넘김 · live');
    ws.msg({ t: 'presence', users: { f2: { online: true, room: null, inRoom: false, lastSeen: 6 } } });
    chk(got.length === 2 && got[1].f2.online === true && !('f1' in got[1]) && st.join() === 'waiting,live', '  ↳ 바뀐 친구만 — 그 친구만 넘김');
    ws.msg({ t: 'presence', users: { f9: { online: true } } });
    chk(got.length === 2, '  ↳ 듣지 않는 친구의 소식은 넘기지 않음(빈 넘기기도 없음)');
    ws.msg({ t: 'presence', users: { f1: { online: false } }, rid: 'q99' });
    chk(got.length === 2, '★ rid 가 붙은 presence(시간 초과 뒤 늦게 온 presenceGet 답)는 듣기 값이 아니라 버린다');
    // 끊겼다 붙음 — 서버의 듣기는 연결에 묶여 있어 다시 보낸다
    ws.kill(1006); await tick();
    chk(st.join() === 'waiting,live,waiting', '★ 끊기면 waiting(연결을 스스로 다시 붙이는 중) — 오류 아님');
    await e.clock.advance(1000);
    const ws2 = await readyOn(e);
    chk(ws2.all('watch').length === 1 && !ws2.all('presenceGet').length, '★ 다시 붙으면 watch 를 다시 보낸다(혼자 되풀이하는 타이머는 없다)');
    ws2.msg({ t: 'presence', users: { f1: { online: true, lastSeen: 1 } }, full: true });
    chk(st.join() === 'waiting,live,waiting,live' && got.length === 3, '  ↳ 처음 전체를 받으면 다시 live');
    off();
    chk(ws2.all('unwatch').length === 1, '풀면 unwatch');
    ws2.msg({ t: 'presence', users: { f1: { online: false } } });
    off();
    chk(got.length === 3 && ws2.all('unwatch').length === 1, '  ↳ 풀린 뒤 소식은 버림 · 두 번 풀어도 탈 없음');
    const o1 = prt.watchPresence(['a'], () => {}, () => {}); const o2 = prt.watchPresence(['b'], () => {}, () => {});
    chk(ws2.all('watch').length === 3 && ws2.all('unwatch').length === 2, '새로 걸면 앞의 것을 풀고 하나만(watch 2번 · unwatch 1번 더)');
    o1(); chk(ws2.all('unwatch').length === 2, '  ↳ 이미 풀린 앞의 해제 함수는 아무 일 없음(새 듣기를 풀지 않는다)');
    o2();
  }
  {
    const e = mkHub(S);
    const prt = M.createFriendsPresenceRt({ rt: e.hub });
    const st = [];
    const offW = prt.watchPresence(['f1'], () => {}, (s) => st.push(s));
    chk(st.join() === 'waiting' && e.socks.length === 0, '★ 연결을 켜기 전(꺼짐)이면 waiting — 알리지 않는다(켜지면 그때 watch) · 요청 0');
    offW();
    e.hub.start();
    await tick();
    chk(e.hub.state() === 'connecting', '  (켬 — connecting)');
    const st2 = [];
    prt.watchPresence(['f1'], () => {}, (s) => st2.push(s));
    chk(st2.join() === 'waiting', '붙이는 중이면 waiting(알리지 않을 상태)');
    const ws = await readyOn(e);
    chk(ws.all('watch').length === 1, '  ↳ 붙으면 그때 watch 를 보낸다');
    ws.msg({ t: 'presence', users: { f1: { online: true } }, full: true });
    ws.msg({ t: 'sessionLost' }); ws.kill(4004); await tick();
    chk(e.hub.state() === 'sessionLost' && st2.join() === 'waiting,live,waiting', '★ 다른 기기가 차지해 멈춰도 waiting — 멈춤 화면은 끊김 정책 몫(이 모듈은 멈춤 상태를 따로 들지 않는다)');
  }
  for(const [code, want] of [[4003, 'update'], [4006, 'maintenance'], [4007, 'accountGone'], [4099, 'closed']]){
    const e = mkHub(S);
    const prt = M.createFriendsPresenceRt({ rt: e.hub });
    e.hub.start();
    const ws = await readyOn(e);
    const st = [];
    prt.watchPresence(['f1'], () => {}, (s) => st.push(s));
    ws.msg({ t: 'presence', users: {}, full: true });
    ws.kill(code); await tick();
    chk(e.hub.state() === want && st.join() === 'waiting,live,waiting', '  ↳ 닫힘 ' + code + '(rt-hub ' + want + ') — 듣기 상태는 waiting 하나');
  }

  say('── 4. presence-self — 내 접속 표시');
  {
    let SM = null;
    try{ SM = loadMod(S.SELF, 'TwPresenceSelf'); }catch(e){ chk(false, 'presence-self 싣다 던짐 — ' + e.message); return; }
    const e = mkHub(S);
    const unloads = [];
    const me = SM.createPresenceSelf({ rt: e.hub, onUnload: (fn) => unloads.push(fn) });
    e.hub.start();
    const ws = await readyOn(e);
    me.setVisible(false);
    chk(ws.all('status').length === 0, '★ 시작(start) 전엔 아무것도 안 보낸다(계정 확인 전에는 접속 표시를 알리지 않음)');
    me.start(false);
    chk(ws.all('status').every(serverAcceptsStatus) && ws.all('status').length === 1, '★ 보낸 status 는 서버 파서(칸 t · visible 뿐 · 불리언)가 받는 모양');
    chk(JSON.stringify(ws.all('status')) === '[{"t":"status","visible":false}]', 'start(false) — 오프라인 고정으로 시작하면 처음부터 visible:false');
    me.setVisible(true);
    chk(ws.all('status').length === 2 && ws.all('status')[1].visible === true, '값이 바뀌면 바로');
    ws.kill(1006); await tick();
    await e.clock.advance(1000);
    const ws2 = await readyOn(e);
    chk(ws2.all('status').every(serverAcceptsStatus) && JSON.stringify(ws2.all('status')) === '[{"t":"status","visible":true}]', '★ 다시 붙으면 지금 값을 다시 알린다(서버의 내 상태는 연결에 묶여 있다)');
    me.start(undefined);
    chk(ws2.all('status').length === 2 && ws2.all('status')[1].visible === true, '  ↳ start 를 또 불러도 구독은 하나 · 값이 없으면 보이기');
    ws2.kill(1006); await tick();
    chk(true, '  (끊긴 동안은 보내지 않는다 — send 가 false)');
    me.setVisible(false);
    await e.clock.advance(1000);
    const ws3 = await readyOn(e);
    chk(ws3.all('status').length === 1 && ws3.all('status')[0].visible === false && e.clock.q.filter((h) => h.f && /status/.test(String(h.f))).length === 0, '  ↳ 끊긴 동안 바뀐 값은 붙을 때 한 번 · 타이머로 되풀이하지 않는다');
    // 계정 놓기 — 🔒 오프라인 고정(false) 계정을 놓고 다음 계정이 붙는다
    chk(unloads.length === 1 && unloads[0] === me.reset, '★ reset 은 onUnload(계정을 놓을 때 · friends-sub stop 과 같은 자리)에 걸린다');
    const n3 = ws3.all('status').length;
    unloads[0]();
    me.setVisible(true);
    chk(ws3.all('status').length === n3, '★ reset 뒤 setVisible 은 시작 전처럼 아무 일 없음(앞 계정 값으로 보내지 않는다)');
    ws3.kill(1006); await tick();
    await e.clock.advance(1000);
    const ws4 = await readyOn(e);
    chk(ws4.all('status').length === 0, '★ reset 뒤 다음 연결이 붙어도 앞 계정의 보이기 값을 보내지 않는다');
    me.start(true);
    chk(JSON.stringify(ws4.all('status')) === '[{"t":"status","visible":true}]', '  ↳ 다음 계정이 start 하면 그 값 하나');
    ws4.kill(1006); await tick();
    await e.clock.advance(1000);
    const ws5 = await readyOn(e);
    chk(ws5.all('status').length === 1, '  ↳ 다시 붙을 때 한 번(reset 이 앞 구독을 풀어 겹치지 않는다)');
  }

  say('── 5. 배선');
  {
    const h = S.HTML, i = (x) => h.indexOf('<script src="parts/' + x + '"></script>');
    chk(i('realtime/rt-hub.js') > 0 && i('friends/friends-presence-rt.js') > i('realtime/rt-hub.js') && i('friends/presence-self.js') > 0
      && i('friends/friends-port.js') > i('friends/friends-presence-rt.js') && i('app.js') > i('friends/presence-self.js') && i('app.js') > i('friends/friends-port.js'),
      'html — rt-hub.js → friends-presence-rt.js → friends-port.js → app.js · presence-self.js 는 app.js 보다 먼저');
    chk(S.SMOKE.indexOf("PRELOAD.push('friends-presence-rt.js');") > 0 && S.SMOKE.indexOf("PRELOAD.push('presence-self.js');") > 0, 'smoke PRELOAD 에 둘');
    chk(/const friendsPresenceRtMod = TwFriendsPresenceRt\.createFriendsPresenceRt\(\{ rt: TwRtHub\.store \}\);/.test(S.APP)
      && /const presenceSelfMod = TwPresenceSelf\.createPresenceSelf\(\{[^\n]*\n  rt: TwRtHub\.store,\n  onUnload: \(fn\)=>window\.addEventListener\('beforeunload', fn\),/.test(S.APP), 'app.js — 둘 다 realtime 연결 하나(TwRtHub.store)를 받는다');
    chk(!/firebaseAPI|firebase-init|\bref\(db|onValue\(|setInterval|setTimeout/.test(S.PRT.replace(/\/\*[\s\S]*?\*\//g, '')) && !/firebaseAPI|\bref\(db|setInterval|setTimeout/.test(S.SELF.replace(/\/\*[\s\S]*?\*\//g, '')),
      '두 파일은 Firebase 를 모르고 타이머를 쓰지 않는다(되풀이 요청 없음)');
  }
}

(async () => {
await judge(SRC0);

say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['PRT', 'chunk(want, PRESENCE_IDS_MAX).map(', '[want].map(', '100명을 넘겨도 나누지 않음'],
  ['PRT', 'const want = Array.from(new Set((ids || []).filter(Boolean)));', 'const want = (ids || []);', '겹침 · 빈 값을 안 거름'],
  ['PRT', "if(!u) throw new Error('접속 상태를 받지 못했어요');", 'if(!u) continue;', '못 받아도 빈 값으로 «받음»'],
  ['PRT', 'if(w.dead || m.rid !== undefined) return;', 'if(w.dead) return;', '늦게 온 presenceGet 답을 듣기 값으로 씀'],
  ['PRT', 'w.offs.push(rt.onState(() => { if(!w.dead) w.ask(); }));', '', '다시 붙어도 watch 를 안 보냄'],
  ['PRT', 'if(m.full === true) status(LIVE);', '', '처음 전체를 받아도 live 가 안 됨'],
  ['PRT', "if(rt.isReady()) rt.send({ t: 'unwatch' });", '', '풀어도 unwatch 를 안 보냄'],
  ['PRT', 'if(_cur) _stop(_cur);\n', '', '새로 걸어도 앞의 듣기가 남음'],
  ['PRT', 'for(const id of Object.keys(u)) if(!want || want.has(id)) out[id]', 'for(const id of Object.keys(u)) out[id]', '묻지 않은 id 를 넘김'],
  ['PRT', "const online = p.online === true;", "const online = !!p.online;", '온라인 판정이 느슨함'],
  ['PRT', "room: (online && typeof p.room === 'string' && p.room) ? p.room : null,", "room: (typeof p.room === 'string' && p.room) ? p.room : null,", '오프라인인데 방이 남음'],
  ['SELF', "if(!_off) _off = rt.onState(_send);", "", '다시 붙어도 안 알림'],
  ['SELF', "    if(_visible === null) return;\n    _visible = visible !== false;", "    _visible = visible !== false;", 'start 전 setVisible 이 시작시킴'],
  ['SELF', "rt.send({ t: 'status', visible: _visible });", "rt.send({ t: 'status', visible: _visible, inRoom: false });", '서버가 모르는 칸을 실어 보냄'],
  ['PRT', "      status(WAITING);\n    };", "      status(rt.state() === 'sessionLost' ? 'down' : WAITING);\n    };", '멈춤 상태 사본을 다시 듦'],
  ['PRT', "      if(rt.isReady()) rt.send({ t: 'watch' });\n      status(WAITING);", "      if(rt.isReady() && rt.send({ t: 'watch' })) return;\n      status(WAITING);", '보낸 뒤 처음 전체를 기다리는 동안을 알리지 않음'],
  ['SELF', "_visible = visible !== false;\n    if(!_off)", "_visible = !!visible;\n    if(!_off)", '값 없이 시작하면 숨김'],
  ['SELF', "    const off = _off; _off = null;\n    if(off) off();", "", 'reset 이 구독을 안 풂'],
  ['SELF', "    _visible = null;\n    const off", "    const off", 'reset 뒤에도 옛 값 보냄'],
  ['SELF', "  onUnload(reset);\n", "", 'reset 을 계정 놓을 때 걸지 않음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  let _hung = false;
  try{ await Promise.race([judge(S), new Promise((r) => setTimeout(() => { _hung = true; r(); }, 5000))]); }catch(_){ qfail++; }
  if(_hung) qfail++;
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
