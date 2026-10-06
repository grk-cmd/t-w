/*
 * 방 서버(웹소켓) provider 검사 — room-server-net.js 를 가짜 웹소켓 · 가짜 시계로 그대로 돌린다.
 * 1. 기본 꺼짐 · 주소 · 순수 함수
 * 2. hello → join → welcome → 친구 객체
 * 3. patch · def · chat 나누기 · 바뀐 칸만
 * 4. state 1초 묶기 · exp 는 바뀔 때만
 * 5. 찌르기 all · 받은 찌르기
 * 6. 서버 사건(joined · patch · left · meta · disband · replaced) · def 푸는 순서
 * 7. 끊김 → 재연결(resume) · resumeFailed → 전체 다시 입장
 * 8. 인증 실패 · 시간 초과 · 꺼짐 → Firebase 로 돌아가라는 신호
 * 9. 토큰 갱신 타이머 · 나가기 · stats · random
 * 9-1. 요청 id(rid)로 답 짝짓기 · peek(들어가지 않고 보기) · peek 을 모르는 옛 서버
 * 10. firebase-init.js · app.js · HTML 연결
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('room-server-net.js'), FI = read('firebase-init.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
for(const [n, v] of [['room-server-net.js', SRC], ['firebase-init.js', FI], ['app.js', APP], ['desk-companion-prototype.html', HTML]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

// ESM 파일을 그대로 함수로 — export 만 떼어 낸다
const names = [...SRC.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
const M = new Function('Buffer', SRC.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')(Buffer);

// ── 가짜 시계 · 가짜 웹소켓 ──────────────────────────────────────────────
const tick = async () => { for(let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
function mkClock(){
  const c = { t: 1_800_000_000_000, q: [], id: 0 };
  c.setTimeout = (f, ms) => { const h = { id: ++c.id, at: c.t + Math.max(0, ms | 0), f }; c.q.push(h); return h; };
  c.clearTimeout = (h) => { const i = c.q.indexOf(h); if(i >= 0) c.q.splice(i, 1); };
  c.setInterval = (f, ms) => { const h = { id: ++c.id, at: c.t + ms, f, every: ms }; c.q.push(h); return h; };
  c.clearInterval = c.clearTimeout;
  c.advance = async (ms) => {
    const end = c.t + ms;
    for(;;){
      await tick();
      c.q.sort((a, b) => a.at - b.at || a.id - b.id);
      const h = c.q[0];
      if(!h || h.at > end) break;
      c.t = h.at;
      if(h.every) h.at += h.every; else c.q.shift();
      h.f();
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

function mkNet(o = {}){
  const clock = mkClock();
  const { FakeWS, socks } = mkWS();
  const calls = { token: [] };
  const net = M.createRoomServerNet({
    WebSocket: FakeWS,
    enabled: () => o.enabled !== false,
    url: () => ('url' in o) ? o.url : 'ws://127.0.0.1:8787',
    getToken: async (force) => { calls.token.push(!!force); return o.token ? o.token(force, calls.token.length) : 'tok' + calls.token.length; },
    getUserId: () => ('uid' in o) ? o.uid : 'u1',
    getVersion: async () => '0.11.0',
    now: () => clock.t,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval, clearInterval: clock.clearInterval,
    log: { warn(){} },
  });
  return { net, clock, socks, calls };
}
function mkHooks(o = {}){
  const h = { log: [], frames: [], exp: 3, defCalls: 0 };
  h.hooks = {
    serializeDef: (d) => ({ ser: d }),
    deserializeDef: o.deserializeDef || ((d) => { h.defCalls++; return Promise.resolve({ de: d }); }),
    getExp: () => h.exp,
    onMeta: (m, p) => h.log.push(['meta', m, p]),
    onDisband: () => h.log.push(['disband']),
    onReplaced: () => h.log.push(['replaced']),
    onLost: (c) => h.log.push(['lost', c]),
    onJoined: (r) => h.log.push(['joined', r]),
    onLeft: (r) => h.log.push(['left', r]),
  };
  h.change = (fr) => h.frames.push(fr);
  h.poked = [];
  h.onPoked = (p) => h.poked.push(p);
  h.has = (k) => h.log.some((x) => x[0] === k);
  return h;
}
const ME = { def: { skin: 1 }, name: '철수', state: 'idle', userStatus: null, level: 7, userId: 'u1', lic: false, awayImg: '', bogus: 'x', lastSeen: 5 };
const META = { channel: 'workingroom', host: 'u1', open: true, chatOff: false, secret: false };
const WELCOME = (o = {}) => Object.assign({ t: 'welcome', room: 'WORK-AB12', memberId: 'mME', resume: 'R1', resumed: false,
  members: { mA: { name: 'A', state: 'focus', userId: 'uA', def: { a: 1 }, chat: { text: 'hi', ts: 5 } } }, meta: META }, o);

// 입장까지 마친 상태를 만든다
async function joined(o = {}){
  const env = mkNet(o.net || {});
  const h = mkHooks(o.hooks || {});
  const prov = env.net.makeProvider(h.hooks, { create: o.create || null });
  const jp = prov.join('WORK-AB12', Object.assign({}, ME), h.change, h.onPoked);
  await tick();
  const ws = env.socks[0];
  ws.open();
  ws.msg({ t: 'ready', pv: 1, now: env.clock.t });
  await tick();
  ws.msg(WELCOME(o.welcome || {}));
  const res = await jp;
  await tick();
  return Object.assign(env, { h, prov, ws, res });
}

(async () => {
  say('── 1. 기본 꺼짐 · 주소 · 순수 함수');
  {
    chk(M.ROOM_SERVER_ENABLED === false, '상수 ROOM_SERVER_ENABLED 는 false (기본 꺼짐)');
    chk(M.ROOM_SERVER_URLS.prod === null && M.ROOM_SERVER_URLS.dev === null, '운영 · dev 주소는 아직 null');
    const ls = (o) => ({ getItem: (k) => (k in o ? o[k] : null) });
    chk(M.roomServerUrl('prod', ls({})) === null && M.roomServerUrl('dev', null) === null, '주소가 없으면 null');
    chk(M.roomServerUrl('prod', ls({ 'tw.roomServerUrl': 'ws://127.0.0.1:8787' })) === 'ws://127.0.0.1:8787', 'localStorage tw.roomServerUrl 로 덮어쓴다(로컬 시험)');
    chk(M.roomServerUrl('prod', ls({ 'tw.roomServerUrl': 'http://x' })) === null, '  ↳ ws:// · wss:// 가 아니면 무시');
    chk(M.roomServerFlag(ls({})) === false && M.roomServerFlag(ls({ 'tw.roomServer': '1' })) === true, '켜기 표식 tw.roomServer=1');
    chk(['pet', 'dizzy', 'fly:123', 'bonk:u1'].every(M.isRoomWidePoke) && !M.isRoomWidePoke('dance:sway'), '방 전원 찌르기 = pet · dizzy · fly: · bonk: (dance 는 대상만)');
    const sp = M.splitRoomPayload({ state: 'focus', level: 3, def: { d: 1 }, chat: { text: 'yo', ts: 9, fly: true }, lastSeen: 1, zzz: 2 });
    chk(sp.patch && sp.patch.state === 'focus' && sp.patch.level === 3 && !('lastSeen' in sp.patch) && !('zzz' in sp.patch) && !('def' in sp.patch) && !('chat' in sp.patch),
      'splitRoomPayload — 멤버 칸만 patch(모르는 칸 · def · chat 제외)');
    chk(sp.def && sp.def.d === 1 && sp.chat && sp.chat.text === 'yo' && sp.chat.fly === true && !('ts' in sp.chat), '  ↳ def 따로 · chat 따로(ts 는 서버가 찍으므로 뺀다)');
    const t = jwt(1234);
    chk(M.jwtExpMs(t) === 1234000 && M.jwtExpMs('garbage') === null, 'jwtExpMs — 토큰 만료 읽기');
  }

  say('── 2. hello → join → welcome');
  {
    const e = await joined({ create: { channel: 'workingroom', open: true } });
    const hello = e.ws.sent[0];
    chk(hello && hello.t === 'hello' && hello.pv === 1 && hello.token === 'tok1' && hello.userId === 'u1' && hello.ver === '0.11.0', 'hello{pv,token,userId,ver}');
    const j = e.ws.last('join');
    chk(j && j.room === 'WORK-AB12' && j.me && j.me.name === '철수' && j.me.state === 'idle' && j.me.userId === 'u1', 'ready 뒤 join — me 에 멤버 칸 + userId');
    chk(j.me.def && j.me.def.ser && j.me.def.ser.skin === 1, '  ↳ def 는 serializeDef 를 거쳐 싣는다');
    chk(!('bogus' in j.me) && !('lastSeen' in j.me), '  ↳ 서버가 모르는 칸(bogus · lastSeen)은 싣지 않는다');
    chk(j.me.exp === 3, '  ↳ 경험치 칸(exp)도 입장 때 싣는다(하트비트가 없으므로)');
    chk(j.create && j.create.channel === 'workingroom' && j.create.open === true && !('resume' in j), '  ↳ 만들기면 create{channel,open}');
    chk(e.res.ok === true && e.res.memberId === 'mME' && e.res.others === 1 && e.res.meta.channel === 'workingroom', 'join 결과 { ok, memberId, others, meta }');
    const fr = e.h.frames[e.h.frames.length - 1];
    chk(fr && fr.mA && fr.mA.name === 'A' && fr.mA.userId === 'uA' && fr.mA.def.de.a === 1 && fr.mA.chat.text === 'hi', 'changeCb 친구 객체 — 멤버 칸 + userId + def(복원본) + chat');
    chk(!fr.mME, '  ↳ 나는 친구 목록에 없다');
    const mt = e.h.log.find((x) => x[0] === 'meta');
    chk(mt && mt[1].host === 'u1' && mt[2] == null, 'welcome.meta → onMeta(meta, 이전값 없음)');
    chk(e.h.has('joined'), 'onJoined(방코드) — 친구 목록 접속 정보');
    const e2 = await joined();
    chk(!('create' in e2.ws.last('join')), '참여(만들기 아님)면 create 없음');
  }

  say('── 3. patch · def · chat 나누기');
  {
    const e = await joined();
    const n0 = e.ws.sent.length;
    e.prov.update({ state: 'idle', userStatus: null, level: 7, lic: false, awayImg: '' });
    chk(e.ws.sent.length === n0, '바뀐 칸이 없으면 아무것도 안 보낸다');
    e.prov.update({ state: 'idle', level: 8, userStatus: 'meal', lastSeen: 1, def: { skin: 2 }, chat: { text: 'yo', ts: 77, fly: true, flyColor: '#fff' } });
    const p = e.ws.last('patch'), d = e.ws.last('def'), c = e.ws.last('chat');
    chk(p && p.level === 8 && p.userStatus === 'meal' && !('state' in p) && !('lastSeen' in p) && !('def' in p) && !('chat' in p), 'patch — 바뀐 멤버 칸만(def · chat · 모르는 칸 없음)');
    chk(d && d.def.ser.skin === 2, 'def — 따로 한 통(serializeDef)');
    chk(c && c.text === 'yo' && c.fly === true && c.flyColor === '#fff' && !('ts' in c), 'chat — 따로 한 통 · ts 없음');
    chk(p && Object.keys(p).every((k) => k === 't' || M.MEMBER_FIELDS.includes(k)) && !('fields' in p), 'patch 는 평평하게 — { t:patch, 칸… } (fields 로 감싸지 않음, PROTOCOL.md)');
    e.prov.update({ level: 8 });
    chk(e.ws.all('patch').length === 1, '같은 값을 다시 넣어도 또 보내지 않는다');
    e.prov.update({ customStatus: { emo: '', text: 'a' } });
    e.prov.update({ customStatus: { emo: '', text: 'a' } });
    chk(e.ws.all('patch').length === 2, '객체 칸은 내용으로 비교한다');
    chk(!e.ws.sent.some((x) => 'lastSeen' in x), '30초 하트비트(lastSeen)는 보내지 않는다');
  }

  say('── 4. state 1초 묶기 · exp');
  {
    const e = await joined();
    e.prov.update({ state: 'focus' });
    chk(e.ws.all('patch').length === 1 && e.ws.last('patch').state === 'focus', '첫 state 는 바로 간다');
    await e.clock.advance(100);
    e.prov.update({ state: 'idle' });
    await e.clock.advance(200);
    e.prov.update({ state: 'sleep', level: 9 });
    const ps = e.ws.all('patch');
    chk(ps.length === 2 && ps[1].level === 9 && !('state' in ps[1]), '1초 안의 state 는 미루고 다른 칸은 바로 간다');
    await e.clock.advance(699);
    chk(e.ws.all('patch').length === 2, '  ↳ 1초가 차기 전에는 안 간다');
    await e.clock.advance(1);
    const ps2 = e.ws.all('patch');
    chk(ps2.length === 3 && ps2[2].state === 'sleep' && Object.keys(ps2[2]).length === 2, '  ↳ 1초가 차면 마지막 값(sleep) 하나만');
    e.prov.update({ state: 'focus' });
    await e.clock.advance(300);
    e.prov.update({ state: 'sleep' });
    await e.clock.advance(1000);
    chk(e.ws.all('patch').length === 3, '  ↳ 미루는 사이 처음 값으로 돌아오면 아무것도 안 보낸다');
    const n = e.ws.all('patch').length;
    await e.clock.advance(30000);
    chk(e.ws.all('patch').length === n, 'exp 가 그대로면 30초가 지나도 안 보낸다');
    e.h.exp = 4;
    await e.clock.advance(30000);
    const pe = e.ws.last('patch');
    chk(e.ws.all('patch').length === n + 1 && pe.exp === 4 && Object.keys(pe).length === 2, 'exp 가 바뀌면 patch{exp} 하나만');
  }

  say('── 5. 찌르기');
  {
    const e = await joined();
    for(const t of ['pet', 'dizzy', 'fly:42', 'bonk:u1']) e.prov.poke('mA', t);
    const pk = e.ws.all('poke');
    chk(pk.length === 4 && pk.every((x) => x.to === 'mA' && x.all === true), 'pet · dizzy · fly: · bonk: → all:true (지금처럼 방 전원 화면에서 재생)');
    e.prov.poke('mA', 'dance:sway');
    const pd = e.ws.last('poke');
    chk(pd.type === 'dance:sway' && !('all' in pd), 'dance: → 대상에게만');
    e.prov.pokeSelf('fly:7');
    const ps = e.ws.last('poke');
    chk(ps.to === 'mME' && ps.type === 'fly:7' && !('all' in ps), 'pokeSelf → to=내 memberId(서버가 방 전원에게)');
    e.ws.msg({ t: 'poked', from: 'mA', to: 'mME', type: 'pet', ts: 100 });
    chk(e.h.poked.length === 1 && e.h.poked[0].type === 'pet' && e.h.poked[0].ts === 100 && e.h.poked[0].from === 'mA', '나를 찌르면 onPoked({type,from,ts})');
    e.ws.msg({ t: 'poked', from: 'mME', to: 'mA', type: 'fly:9', ts: 101 });
    await tick();
    const fr = e.h.frames[e.h.frames.length - 1];
    chk(fr.mA.poke && fr.mA.poke.type === 'fly:9' && fr.mA.poke.ts === 101, '남을 찌른 것은 그 친구의 poke 칸으로(Firebase 와 같은 자리)');
  }

  say('── 6. 서버 사건 · 순서');
  {
    const e = await joined();
    e.ws.msg({ t: 'joined', memberId: 'mB', member: { name: 'B', state: 'idle', userId: 'uB', def: { b: 1 } } });
    await tick();
    let fr = e.h.frames[e.h.frames.length - 1];
    chk(fr.mB && fr.mB.def.de.b === 1 && fr.mA, 'joined → 친구 추가(def 복원)');
    e.ws.msg({ t: 'patch', memberId: 'mB', state: 'focus', customStatus: null });
    await tick();
    fr = e.h.frames[e.h.frames.length - 1];
    chk(fr.mB.state === 'focus' && fr.mB.customStatus === null && fr.mB.name === 'B', 'patch → 그 칸만 바뀐다');
    e.ws.msg({ t: 'chat', memberId: 'mB', ts: 200, text: 'hey', fly: true });
    await tick();
    fr = e.h.frames[e.h.frames.length - 1];
    chk(fr.mB.chat && fr.mB.chat.text === 'hey' && fr.mB.chat.ts === 200 && fr.mB.chat.fly === true, 'chat → 그 친구의 chat 칸 {text,ts,fly}');
    e.ws.msg({ t: 'left', memberId: 'mB', reason: 'timeout' });
    await tick();
    fr = e.h.frames[e.h.frames.length - 1];
    chk(!fr.mB && fr.mA, 'left → 친구 제거');
    e.ws.msg({ t: 'meta', meta: Object.assign({}, META, { host: 'uA', chatOff: true }) });
    const mts = e.h.log.filter((x) => x[0] === 'meta');
    chk(mts.length === 2 && mts[1][1].host === 'uA' && mts[1][2].host === 'u1', 'meta → onMeta(새 값, 이전 값)');
    e.ws.msg({ t: 'disband', reason: 'noLicensedHost' });
    chk(e.h.has('disband') && e.h.has('left'), 'disband → onDisband · 접속 정보 비움');
    const nf = e.h.frames.length;
    e.ws.msg({ t: 'patch', memberId: 'mA', state: 'sleep' });
    await tick();
    chk(e.h.frames.length === nf, '  ↳ 해산 뒤의 사건은 화면에 안 그린다');

    const r = await joined();
    r.ws.msg({ t: 'left', memberId: 'mME', reason: 'replaced' });
    chk(r.h.has('replaced') && r.h.has('left'), '내 자리가 replaced → onReplaced(한 계정 한 기기와 같은 처리)');

    // def 를 푸는 동안 더 새 사건이 오면 낡은 것은 버리고 마지막 것만
    let release = null;
    const slow = (d) => (d && d.c === 2) ? new Promise((res) => { release = () => res({ de: d }); }) : Promise.resolve({ de: d });
    const o = await joined({ hooks: { deserializeDef: slow } });
    const before = o.h.frames.length;
    o.ws.msg({ t: 'def', memberId: 'mA', def: { c: 2 } });
    o.ws.msg({ t: 'patch', memberId: 'mA', state: 'sleep' });
    await tick();
    chk(o.h.frames.length === before, 'def 를 푸는 동안은 아무것도 안 그린다');
    release();
    await tick();
    const got = o.h.frames.slice(before);
    chk(got.length === 1 && got[0].mA.def.de.c === 2 && got[0].mA.state === 'sleep', '  ↳ 다 풀리면 마지막 상태 한 번만(낡은 것은 버린다)');
    o.ws.msg({ t: 'patch', memberId: 'mA', state: 'focus' });
    await tick();
    chk(o.h.frames.length === before + 2, '  ↳ def 가 그대로면 다시 풀지 않고 바로 그린다');
  }

  say('── 7. 끊김 → 재연결');
  {
    const e = await joined();
    e.ws.close();   // 서버 쪽에서 끊김
    e.prov.update({ level: 99 });
    chk(!e.ws.sent.some((x) => x.t === 'patch'), '끊긴 동안은 보내지 않는다');
    await e.clock.advance(999);
    chk(e.socks.length === 1, '바로 다시 붙지 않는다(1초 기다림)');
    await e.clock.advance(1);
    chk(e.socks.length === 2, '1초 뒤 새 연결');
    const w2 = e.socks[1];
    w2.open();
    chk(w2.sent[0].t === 'hello', '  ↳ 다시 hello');
    w2.msg({ t: 'ready', pv: 1, now: 0 });
    const j = w2.last('join');
    chk(j && j.resume === 'R1' && !('me' in j), '  ↳ join{room, resume} — me(def)는 다시 안 보낸다');
    w2.msg(WELCOME({ resumed: true, resume: 'R2' }));
    await tick();
    const p = w2.last('patch');
    chk(p && p.level === 99, '  ↳ 이어 붙으면 끊긴 사이 바뀐 칸만 보낸다');
    chk(e.h.defCalls === 1, '  ↳ def 가 그대로면 다시 풀지 않는다(얼굴 그림을 또 받지 않음)');
    w2.close();
    await e.clock.advance(1000);
    const w3 = e.socks[2];
    w3.open(); w3.msg({ t: 'ready', pv: 1, now: 0 });
    chk(w3.last('join').resume === 'R2', '새로 받은 resume 토큰을 쓴다');
    w3.msg({ t: 'error', code: 'resumeFailed', ref: 'join' });
    const full = w3.last('join');
    chk(full && full.me && full.me.def && full.me.def.ser && full.me.level === 99 && !('resume' in full), 'resumeFailed → me 전체(def 포함)로 다시 join');
    w3.msg(WELCOME({ memberId: 'mME2', resume: 'R3', members: {} }));
    await tick();
    const fr = e.h.frames[e.h.frames.length - 1];
    chk(fr && !fr.mA, '  ↳ 새 welcome 으로 친구 목록을 통째로 바꾼다');
    e.prov.pokeSelf('fly:1');
    chk(w3.last('poke').to === 'mME2', '  ↳ 새 memberId 로 이어 간다');
    const nOld = e.socks[0].sent.length;
    e.socks[0].msg && e.socks[0].onmessage && e.socks[0].onmessage({ data: JSON.stringify({ t: 'left', memberId: 'mME2', reason: 'replaced' }) });
    chk(!e.h.has('replaced') && e.socks[0].sent.length === nOld, '옛 연결에서 늦게 온 것은 무시한다');

    // 백오프가 늘어난다
    const b = await joined();
    b.ws.close();
    await b.clock.advance(1000);
    b.socks[1].close();
    await b.clock.advance(1999);
    chk(b.socks.length === 2, '두 번째 실패 뒤에는 2초 기다린다');
    await b.clock.advance(1);
    chk(b.socks.length === 3, '  ↳ 2초 뒤 다시');
  }

  say('── 8. Firebase 로 돌아가라는 신호');
  {
    let e = mkNet();
    const h = mkHooks();
    let prov = e.net.makeProvider(h.hooks, {});
    let jp = prov.join('WORK-AB12', Object.assign({}, ME), h.change, h.onPoked);
    await tick();
    e.socks[0].open();
    e.socks[0].msg({ t: 'error', code: 'auth' });
    let r = await jp;
    chk(r.ok === false && r.code === 'auth', 'hello 가 auth 로 거절 → join 결과 { ok:false, code:auth }');
    chk(e.socks[0].closed && !e.socks[0].sent.some((x) => x.t === 'join'), '  ↳ 연결을 닫고 join 은 안 보냈다');
    await e.clock.advance(20000);
    chk(e.socks.length === 1, '  ↳ 입장 전 실패는 다시 붙지 않는다(부르는 쪽이 Firebase 로)');

    e = mkNet();
    const er = e.net.ensureReady();
    await tick();
    e.socks[0].open();
    e.socks[0].msg({ t: 'error', code: 'version' });
    chk((await er).code === 'version', 'version 거절 → ensureReady { ok:false, code:version }');

    e = mkNet();
    prov = e.net.makeProvider(mkHooks().hooks, {});
    jp = prov.join('WORK-AB12', Object.assign({}, ME), () => {}, () => {});
    await tick();
    await e.clock.advance(5000);   // 소켓이 영영 안 열린다(방화벽 등)
    r = await jp;
    chk(r.ok === false && r.code === 'timeout' && e.socks[0].closed, '5초 안에 ready 가 없으면 timeout · 연결 정리');

    const nS = e.socks.length;
    r = await e.net.ensureReady();
    chk(r.ok === false && r.code === 'timeout' && e.socks.length === nS, '못 붙은 뒤 1분은 다시 시도하지 않고 바로 실패(입장마다 5초씩 안 기다림)');
    await e.clock.advance(60000);
    e.net.ensureReady();
    await tick();
    chk(e.socks.length === nS + 1, '  ↳ 1분 뒤에는 다시 시도');

    e = mkNet({ enabled: false });
    r = await e.net.ensureReady();
    chk(r.ok === false && r.code === 'off' && e.socks.length === 0, '꺼져 있으면 연결 자체를 안 연다');
    e = mkNet({ url: null });
    chk(e.net.enabled() === false, '주소가 null 이면 꺼진 것');
    e = mkNet({ token: () => null });
    r = await e.net.ensureReady();
    chk(r.ok === false && r.code === 'auth' && e.socks.length === 0, '로그인 토큰이 없으면 auth(연결 안 함)');

    // 방 안에서 끊긴 뒤 인증이 계속 실패하면 onLost
    const a = await joined({ net: { token: (f, n) => (n === 1 ? 'tok1' : 'bad') } });
    a.ws.close();
    await a.clock.advance(1000);
    a.socks[1].open(); a.socks[1].msg({ t: 'error', code: 'auth' });
    chk(a.calls.token[a.calls.token.length - 1] === false, '  (첫 재연결은 평소 토큰)');
    await a.clock.advance(2000);
    chk(a.calls.token[a.calls.token.length - 1] === true, '재연결 중 auth 거절 → 새 토큰(force)으로 한 번 더');
    a.socks[2].open(); a.socks[2].msg({ t: 'error', code: 'auth' });
    chk(a.h.log.some((x) => x[0] === 'lost' && x[1] === 'auth'), '  ↳ 또 거절이면 onLost(auth)');
  }

  say('── 9. 토큰 갱신 · 나가기 · stats · random');
  {
    const clock0 = 1_800_000_000_000;
    const e = await joined({ net: { token: (f, n) => jwt(Math.floor((clock0 + 3600 * 1000) / 1000) + n) } });
    const helloN = () => e.ws.all('hello').length;
    await e.clock.advance(55 * 60 * 1000 - 1000);
    chk(helloN() === 1, '만료 5분 전까지는 다시 hello 하지 않는다');
    await e.clock.advance(2000);
    chk(helloN() === 2 && e.calls.token[e.calls.token.length - 1] === true, '만료 5분 전 — 새 토큰(force)으로 같은 연결에 hello');
    const h2 = e.ws.last('hello');
    chk(h2.token !== e.ws.sent[0].token && h2.userId === 'u1' && h2.pv === 1, '  ↳ 새 토큰 · 같은 userId');
    chk(e.socks.length === 1, '  ↳ 연결은 끊지 않는다');

    const lp = e.prov.leave();
    chk(e.ws.last('leave') !== null, 'leave → {t:leave}');
    let left = false; lp.then(() => { left = true; });
    await tick();
    chk(!left, '  ↳ 확인(left)을 기다린다');
    e.ws.msg({ t: 'left', memberId: 'mME', reason: 'leave' });
    await tick();
    chk(left && e.h.has('left'), '  ↳ left 를 받으면 끝 · 접속 정보 비움');
    const nP = e.ws.all('patch').length;
    e.prov.update({ level: 1234 });
    chk(e.ws.all('patch').length === nP, '나간 뒤에는 보내지 않는다');

    const s = await joined();
    const sp = s.net.stats();
    await tick();
    chk(s.ws.last('stats') !== null, 'stats() → {t:stats}');
    s.ws.msg({ t: 'stats', workingroom: 3, togetherroom: 2, total: 5, rid: s.ws.last('stats').rid });
    const st = await sp;
    chk(st && st.workingroom === 3 && st.togetherroom === 2 && st.total === 5, '  ↳ 채널별 개수');
    const rp = s.net.random(12);
    await tick();
    chk(s.ws.last('random').limit === 12, 'random(12) → {t:random, limit:12}');
    s.ws.msg({ t: 'random', rooms: ['WORK-AAAA', 'WORK-BBBB'], rid: s.ws.last('random').rid });
    const rr = await rp;
    chk(Array.isArray(rr) && rr.length === 2 && rr[0] === 'WORK-AAAA', '  ↳ 후보 목록');
    const mp = s.prov.setMeta({ chatOff: true });
    await tick();
    chk(s.ws.last('meta').chatOff === true, 'setMeta → {t:meta, chatOff}');
    s.ws.msg({ t: 'meta', meta: Object.assign({}, META, { chatOff: true }) });
    chk((await mp).ok === true, '  ↳ 서버가 바뀐 meta 를 돌려주면 ok');
    const mp2 = s.prov.setMeta({ chatOff: false });
    await tick();
    s.ws.msg({ t: 'error', code: 'forbidden', ref: 'meta' });
    chk((await mp2).ok === false, '  ↳ forbidden 이면 실패');

    const f = await joined();
    const fp = f.prov.leave();
    await f.clock.advance(1500);
    await fp;
    chk(true, '나가기 확인이 안 와도 1.5초 뒤 끝난다');

    // 입장 실패(정원)
    const g = mkNet();
    const gp = g.net.makeProvider(mkHooks().hooks, {}).join('WORK-AB12', Object.assign({}, ME), () => {}, () => {});
    await tick();
    g.socks[0].open(); g.socks[0].msg({ t: 'ready', pv: 1, now: 0 });
    g.socks[0].msg({ t: 'error', code: 'full', ref: 'join' });
    const gr = await gp;
    chk(gr.ok === false && gr.code === 'full', '정원 초과 → { ok:false, code:full } (앱이 지금 쓰는 «가득 찼어요» 문구로)');
  }

  say('── 9-1. rid · peek');
  {
    const RID = /^[A-Za-z0-9_.:-]{1,16}$/;
    const e = await joined();
    const p1 = e.net.stats(), p2 = e.net.stats(), p3 = e.net.random(5);
    await tick();
    const [q1, q2] = e.ws.all('stats'), q3 = e.ws.last('random');
    chk([q1, q2, q3].every((q) => RID.test(q.rid)) && new Set([q1.rid, q2.rid, q3.rid]).size === 3, 'stats · random 마다 서로 다른 rid(1~16자 · 영숫자 _ . : -)');
    // 답이 보낸 순서와 반대로 와도 rid 로 짝짓는다
    e.ws.msg({ t: 'random', rooms: ['WORK-RRRR'], rid: q3.rid });
    e.ws.msg({ t: 'stats', workingroom: 2, togetherroom: 0, total: 2, rid: q2.rid });
    e.ws.msg({ t: 'stats', workingroom: 1, togetherroom: 0, total: 1, rid: q1.rid });
    const [a1, a2, a3] = await Promise.all([p1, p2, p3]);
    chk(a1.total === 1 && a2.total === 2 && a3[0] === 'WORK-RRRR', '  ↳ 답이 거꾸로 와도 rid 로 제 요청에');
    const p4 = e.net.stats();
    await tick();
    e.ws.msg({ t: 'stats', workingroom: 9, togetherroom: 9, total: 18, rid: 'nope' });
    e.ws.msg({ t: 'random', rooms: [], rid: e.ws.last('stats').rid });
    let got4 = false; p4.then(() => { got4 = true; });
    await tick();
    chk(!got4, '  ↳ 모르는 rid · 종류가 다른 답은 받지 않는다');
    e.ws.msg({ t: 'stats', workingroom: 4, togetherroom: 0, total: 4 });
    chk((await p4).total === 4, '  ↳ rid 없는 답(옛 서버)은 같은 종류 중 먼저 보낸 것에');
    const p5 = e.net.stats();
    await tick();
    e.ws.msg({ t: 'error', code: 'badRequest', ref: 'stats' });
    chk((await p5) === null, '  ↳ stats 가 거절되면 null(4초 기다리지 않음)');

    const pk = e.net.peek('PLAY-AB12');
    await tick();
    const q = e.ws.last('peek');
    chk(q && q.room === 'PLAY-AB12' && RID.test(q.rid) && Object.keys(q).sort().join() === 'rid,room,t', 'peek(code) → {t:peek, room, rid} — 방 안에서도 묻는다');
    e.ws.msg({ t: 'peek', room: 'PLAY-AB12', exists: true, count: 3, channel: 'togetherroom', secret: false, rid: q.rid });
    const pr = await pk;
    chk(pr && pr.exists === true && pr.count === 3 && pr.channel === 'togetherroom' && pr.secret === false, '  ↳ { exists, count, channel, secret }');
    chk(e.ws.all('join').length === 1 && e.ws.all('leave').length === 0 && e.prov.memberId() === 'mME', '  ↳ 들어가거나 나가지 않는다(지금 자리 그대로)');
    const pk2 = e.net.peek('SCRT-ZZ99');
    await tick();
    e.ws.msg({ t: 'peek', room: 'SCRT-ZZ99', exists: false, count: 0, channel: null, secret: true, rid: e.ws.last('peek').rid });
    const pr2 = await pk2;
    chk(pr2 && pr2.exists === false && pr2.channel === null && pr2.secret === true, '  ↳ 없는 방 — exists:false · channel:null');

    // peek 을 모르는 옛 서버 — 모르는 t 라 ref 없는 badRequest
    const o = mkNet();
    const op = o.net.peek('WORK-AB12');
    await tick();
    o.socks[0].open(); o.socks[0].msg({ t: 'ready', pv: 1, now: 0 });
    await tick();
    chk(o.socks[0].last('peek') !== null, '방 밖에서도 peek 하러 붙는다');
    o.socks[0].msg({ t: 'error', code: 'badRequest' });
    chk((await op) === null, '  ↳ 옛 서버(ref 없는 badRequest) → null, 기다리지 않음');
    const tp = o.net.peek('WORK-AB12');
    await tick();
    await o.clock.advance(4000);
    chk((await tp) === null, '  ↳ 답이 없으면 4초 뒤 null');
    const off = mkNet({ enabled: false });
    chk((await off.net.peek('WORK-AB12')) === null && off.socks.length === 0, '꺼져 있으면 peek 은 붙지 않고 null');
  }

  say('── 10. 연결');
  {
    const FC = strip(FI), AC = strip(APP), RC = strip(SRC);
    chk(!/^\s*import\s/m.test(SRC) && !/firebase|gstatic/i.test(RC.replace(/firebase-init|Firebase/g, '')), 'room-server-net.js 는 아무것도 import 하지 않는다(Firebase 직접 호출 없음)');
    chk(/import \{ createRoomServerNet, roomServerFlag, roomServerUrl \} from "\.\/room-server-net\.js";/.test(FC), 'firebase-init.js 가 room-server-net.js 를 import');
    chk(/getToken: _getIdToken/.test(FC) && /auth\.currentUser\.getIdToken\(!!force\)/.test(FC), '  ↳ 토큰은 Firebase Auth getIdToken');
    chk(/roomServerNet\(\)\{ return _roomServer; \}/.test(FC) && /setPresenceRoom\(code\)\{ _syncPresenceRoom\(code \|\| null\); \}/.test(FC) && /getIdToken\(force\)\{/.test(FC),
      '  ↳ firebaseAPI.roomServerNet · setPresenceRoom · getIdToken');
    const sr = AC.indexOf('async function startRoom(code)');
    const body = AC.slice(sr, AC.indexOf('\n}\n', sr));
    const iSrv = body.indexOf('if(_roomServerOn()){'), iFb = body.indexOf('firebaseAPI.setRoomChannel');
    chk(sr > 0 && iSrv > 0 && iFb > iSrv && /const _via = await _startRoomOnServer\(code,[^)]*\);\s*if\(_via !== 'firebase'\) return;/.test(body),
      'startRoom — 서버 갈래는 켜져 있을 때만, Firebase 쓰기(setRoomChannel)보다 먼저');
    chk(/if\(_srv\) provider = _srv;\s*else provider = window\.firebaseAPI \? makeFirebaseProvider\(\) : makeMockProvider\(\);/.test(AC), 'Presence.start — provider 를 안 넘기면 예전 그대로(Firebase · 가짜 방)');
    const fp = AC.slice(AC.indexOf('function makeFirebaseProvider(){'), AC.indexOf('function _roomServerNet(){'));
    chk(/window\.firebaseAPI\.joinRoom\(room, payload,/.test(fp) && /const delta = _diffRoomPayload\(payload\);/.test(fp), 'makeFirebaseProvider 는 그대로');
    chk(/function _roomServerOn\(\)\{ const n = _roomServerNet\(\); return !!\(n && n\.enabled\(\)\); \}/.test(AC), '_roomServerOn — net.enabled()(표식 + 주소)만 본다');
    chk(/onDisband: \(\)=>\{ if\(typeof window\._onRoomDisbanded === 'function'\) window\._onRoomDisbanded\(\); \}/.test(AC), 'disband → _onRoomDisbanded(지금 해산 흐름)');
    chk(/onReplaced: \(\)=>\{ try\{ _onDeviceSessionLost\(\); \}catch\(_\)\{\} \}/.test(AC), 'replaced → _onDeviceSessionLost(한 계정 한 기기)');
    chk(/window\._onRoomMeta\(meta\)/.test(AC.slice(AC.indexOf('function _onServerRoomMeta'))) && /window\._roomMetaCache = meta;/.test(AC), 'meta → _roomMetaCache · _onRoomMeta');
    chk(/if\(code === 'full'\)/.test(AC) && /if\(code === 'channelFull'\)/.test(AC) && /if\(code === 'secretClosed'\)/.test(AC), 'full · channelFull · secretClosed → 안내 문구');
    chk(/const _sp = \(Presence\.serverProvider && Presence\.serverProvider\(\)\) \|\| null;/.test(AC) && /_sp \? await _sp\.setMeta\(\{ chatOff: next \}\)/.test(AC), '채팅 잠금 — 서버 방이면 meta 를 서버로');
    chk(/await _withServerRoomCounts\(await firebaseAPI\.getRoomCounts\(\{ quick: true \}\)\)/.test(AC) && /c = _addServerRoomCounts\(c\);/.test(AC), '방 개수 — 서버 몫을 더한다(켜져 있을 때만)');
    const so = AC.slice(AC.indexOf('async function _startRoomOnServer('), AC.indexOf('/* 방 개수 — 서버 방 몫을 더한다'));
    const iPeek = so.indexOf('await net.peek(code)'), iFbCnt = so.indexOf('firebaseAPI.checkRoomCapacity(code)'), iStart = so.indexOf('await Presence.start(');
    chk(iPeek > 0 && iFbCnt > iPeek && iStart > iFbCnt && /if\(!\(pk && pk\.exists\)\)\{/.test(so) && /if\(typeof fb === 'number' && fb > 0\) return 'firebase';/.test(so),
      '코드로 들어가기 — peek 먼저: 서버에 있으면 서버, 없고 Firebase 에 사람이 있으면 Firebase, 둘 다 없으면 서버');
    chk(!/Presence\.stop\(\);\s*\/\/ 서버에는 없던 방/.test(so) && !/\bprobe\b/.test(so), '  ↳ 들어갔다 나오는 탐색(probe)은 없앴다');
    chk(/const _srv = await _serverRandomRooms\(12\);/.test(AC) && /_serverRandomRooms\(12\)\)\.filter\(c => c !== cur\)/.test(AC), '랜덤 입장 · 갈아타기 — 서버 방 먼저');
    const csp = [...HTML.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/g)].map((m) => m[1]);
    chk(csp.length === 2 && csp.every((c) => /connect-src [^;]*ws:\/\/127\.0\.0\.1:\* ws:\/\/localhost:\*/.test(c)), 'CSP 두 줄 connect-src 에 로컬 방 서버(ws://127.0.0.1 · localhost)');
  }

  done();
})().catch((err) => { chk(false, '실행 오류 — ' + (err && err.stack)); done(); });

function done(){
  say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
  process.exit(fail ? 1 : 0);
}
