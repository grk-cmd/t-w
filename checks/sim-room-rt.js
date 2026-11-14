/* sim-room-rt.js — 🛰 방 포트(room/room-rt.js) 검사 — 진짜 연결 공통부(realtime-link.js) · 진짜 rt-hub.js · 가짜 웹소켓 · 가짜 시계로 그대로 돌린다
   ・1절: 입장 — join.me 에 userId · lic 없음 · 탭 s1 → S1 · create 그대로 · welcome → 친구 객체(userId = userCode · 탭 · 말풍선 자리) · meta 탭 키
   ・2절: 연결 전 입장 — 붙으면 그때 join · 연결이 꺼져 있으면 바로 'off' · 안 붙으면 시간 초과
   ・3절: 보내기 — 바뀐 칸만 · 집중 상태 1초에 한 번 · def 따로 · 탭 말풍선 tab:'S1' · 받은 patch 의 탭은 앱 id
   ・4절: 찌르기 — 방 전원 찌르기 all · 나 찌르기 · 끊긴 동안 들고 있다가 다시 붙으면 보냄(15초 넘은 것은 버림)
   ・5절: 끊김 — 다시 붙으면 resume · resumed 면 전체 다시 · 15초 알림 · 돌아오면 거둠 · 90초 포기(onLost unreachable)
   ・6절: 서버 판정 — 정원 거절 · resumeFailed → 전체 join · meta 기다리기(된 · 거절 · 이미 그 값) · music stale · 밀려남 · 관리자 종료 · 해산
   ・7절: 방 밖 — random(rid) · peek · 못 물으면 null · 배선(html 차례 · TwRoomRt.store)
   ・8절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  RT: pick(at('room-rt.js', 'room')),
  HUB: pick(at('rt-hub.js', 'realtime')),
  LINK: pick(at('realtime-link.js', 'realtime')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadLink = (src) => {
  const names = [...src.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
  return new Function('Buffer', src.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')(Buffer);
};
const loadCls = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };

const tick = async () => { for(let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
function mkClock(){
  const c = { t: 1_800_000_000_000, q: [], id: 0 };
  c.setTimeout = (f, ms) => { const h = { id: ++c.id, at: c.t + Math.max(0, ms | 0), f }; c.q.push(h); return h; };
  c.clearTimeout = (h) => { const i = c.q.indexOf(h); if(i >= 0) c.q.splice(i, 1); };
  c.setInterval = () => ({ iv: true });
  c.clearInterval = () => {};
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
    lastOf(t){ const a = this.all(t); return a[a.length - 1]; }
  }
  return { FakeWS, socks };
}

function mk(S){
  const L = loadLink(S.LINK), H = loadCls(S.HUB), R = loadCls(S.RT);
  const clock = mkClock();
  const { FakeWS, socks } = mkWS();
  const hub = H.createRtHub({
    createLink: L.createRealtimeLink, WebSocket: FakeWS, url: () => 'wss://realtime.together-working.com',
    getToken: async () => 'tok', getVersion: async () => '0.13.0', deviceId: () => 'dev-0001', session: 'sess01',
    now: () => clock.t, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, random: () => 0.5, log: { warn(){} },
  });
  const rt = R.createRoomRt({ hub, STATE: H.STATE, timing: () => null,
    now: () => clock.t, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, setInterval: clock.setInterval, clearInterval: clock.clearInterval, log: { warn(){} } });
  return { H, R, hub, rt, clock, socks, last: () => socks[socks.length - 1] };
}
async function readyOn(e, code){
  await tick();
  const ws = e.last();
  ws.open(); await tick();
  ws.msg({ t: 'ready', pv: 2, now: e.clock.t, userCode: code || 'u1' });
  await tick();
  return ws;
}
/* 기다리는 약속 — 가짜 시계를 조금씩 돌려 시간 초과도 끝나게(깨 본 판이 영영 안 끝나 node 가 조용히 빠지지 않게) */
async function settle(p, clock){
  let done = false, val;
  p.then((v) => { done = true; val = v; }, () => { done = true; });
  for(let i = 0; i < 40 && !done; i++) await clock.advance(500);
  return done ? val : '__hang';
}
const ME = { def: { skin: 1 }, name: '나', state: 'focus', level: 3, userId: 'oldUid', lic: true, tab: 's1', awaySz: 0 };
const MEMBERS = { m2: { userCode: 'u2', name: '친구', state: 'idle', level: 5, tab: 'S2', def: { skin: 2 }, chat: { text: '안녕', ts: 5, tab: 'S1' } } };
const META = { channel: 'togetherroom', host: 'u2', open: false, chatOff: false, secret: false, tabs: { S1: { name: '공부', ts: 10 }, S2: { name: '영화', ts: 20 } }, since: 1 };
const hooksLog = () => { const L = []; return { L, h: {
  onMeta: (m) => L.push('meta'), onDisband: () => L.push('disband'), onReplaced: () => L.push('replaced'),
  onLost: (c) => L.push('lost:' + c), onReconnecting: (on) => L.push('re:' + on), onJoined: (r) => L.push('joined:' + r), onLeft: (r) => L.push('left:' + r),
} }; };
/* 붙은 연결에서 입장까지 — { e, p, ws, res, friends, hl } */
async function joined(S, o){
  const e = mk(S);
  e.hub.start();
  const ws = await readyOn(e, 'u1');
  const hl = hooksLog();
  const p = e.rt.makeProvider(hl.h, { create: (o && o.create) || null });
  let friends = null;
  const jp = p.join('PLAY-AB12', Object.assign({}, ME), (f) => { friends = f; }, (pk) => { hl.L.push('poked:' + pk.type); });
  await tick();
  ws.msg({ t: 'welcome', room: 'PLAY-AB12', memberId: 'm1', resume: 'R1', resumed: false, members: MEMBERS, meta: META, music: null, musicSeq: -1, now: e.clock.t + 500 });
  const res = await settle(jp, e.clock);
  await tick();
  return { e, p, ws, res, hl, get friends(){ return friends; } };
}

async function judge(S){
  say('── 1. 입장');
  try{
    const J = await joined(S, { create: { channel: 'togetherroom', open: true, title: '방' } });
    const jm = J.ws.all('join')[0];
    chk(jm && jm.room === 'PLAY-AB12' && jm.me && !('userId' in jm.me) && !('lic' in jm.me) && jm.me.tab === 'S1' && jm.me.name === '나' && jm.me.def && jm.me.def.skin === 1,
      'join.me — userId · lic 없음 · 탭 s1 → S1 · def 실음');
    chk(jm && jm.create && jm.create.channel === 'togetherroom' && jm.create.title === '방', '  ↳ create 그대로');
    chk(J.res && J.res.ok === true && J.res.memberId === 'm1' && J.res.others === 1 && J.res.meta && J.res.meta.tabs.s1 && J.res.meta.tabs.s1.name === '공부' && !J.res.meta.tabs.S1,
      'welcome → { ok, memberId, others, meta } · meta.tabs 키는 앱 id(s1)');
    const f = J.friends && J.friends.m2;
    chk(f && f.userId === 'u2' && f.userCode === 'u2' && f.tab === 's2' && f.chatTab && f.chatTab.tab === 's1' && f.chatTab.text === '안녕' && !('chat' in f),
      '  ↳ 친구 객체 — userId = userCode · 탭 s2 · 탭 말풍선은 chatTab(s1)');
    chk(J.hl.L.indexOf('joined:PLAY-AB12') >= 0 && J.e.rt.roomCode() === 'PLAY-AB12' && J.e.rt.myCode() === 'u1', '  ↳ onJoined · roomCode · myCode(ready.userCode)');
    chk(Math.abs(J.p.serverNow() - (J.e.clock.t + 500)) <= 1, '  ↳ welcome.now 로 서버 시계를 맞춘다');
  }catch(err){ chk(false, '1절 던짐 — ' + err.message); }

  say('── 2. 연결 전 입장');
  try{
    const e = mk(S);
    const p0 = e.rt.makeProvider({}, null);
    const r0 = await settle(p0.join('WORK-AB12', Object.assign({}, ME), () => {}), e.clock);
    chk(r0 && r0.ok === false && r0.code === 'off' && e.socks.length === 0, '연결이 꺼져 있으면(로그인 전) 바로 { ok:false, code:off }');
    e.hub.start();
    const p = e.rt.makeProvider({}, null);
    const jp = p.join('WORK-AB12', Object.assign({}, ME), () => {});
    await tick();
    chk(e.last().all('join').length === 0, '  ↳ 붙는 중에는 join 을 안 보낸다');
    const ws = await readyOn(e);
    chk(ws.all('join').length === 1, '  ↳ ready 가 오면 그때 join');
    ws.msg({ t: 'welcome', room: 'WORK-AB12', memberId: 'm9', resume: 'R', resumed: false, members: {}, meta: Object.assign({}, META, { channel: 'workingroom' }), music: null, musicSeq: -1, now: e.clock.t });
    const r = await settle(jp, e.clock);
    chk(r && r.ok === true, '  ↳ welcome 으로 끝남');
    const e2 = mk(S);
    e2.hub.start();
    const p2 = e2.rt.makeProvider({}, null);
    let r2 = null; p2.join('WORK-AB12', Object.assign({}, ME), () => {}).then((x) => { r2 = x; });
    await e2.clock.advance(e2.R.TIMING_DEFAULTS.joinWaitMs + 100);
    chk(r2 && r2.ok === false && r2.code === 'timeout', '  ↳ 끝내 안 붙으면 joinWaitMs 뒤 timeout');
  }catch(err){ chk(false, '2절 던짐 — ' + err.message); }

  say('── 3. 보내기');
  try{
    const J = await joined(S);
    const { p, ws, e } = J;
    p.update({ state: 'focus', level: 3, name: '나', tab: 's1', awaySz: 0 });
    chk(ws.all('patch').length === 0, '안 바뀐 칸은 안 보낸다');
    p.update({ state: 'idle', tab: 's2' });
    const pt = ws.lastOf('patch');
    chk(pt && pt.state === 'idle' && pt.tab === 'S2' && !('level' in pt), '바뀐 칸만 · 탭은 S2');
    p.update({ state: 'sleep' });
    chk(ws.all('patch').length === 1, '  ↳ 집중 상태는 1초에 한 번');
    await e.clock.advance(1000);
    chk(ws.all('patch').length === 2 && ws.lastOf('patch').state === 'sleep', '  ↳ 1초 뒤 마지막 값');
    p.update({ tab: null });
    chk(ws.lastOf('patch').tab === null, '  ↳ #일반은 tab:null(칸을 비움)');
    p.update({ def: { skin: 7 } });
    chk(ws.lastOf('def') && ws.lastOf('def').def.skin === 7, 'def 는 따로');
    p.update({ chatTab: { tab: 's1', text: '안녕', ts: 1 } });
    const cm = ws.lastOf('chat');
    chk(cm && cm.text === '안녕' && cm.tab === 'S1' && !('ts' in cm), '탭 말풍선 → chat{ tab:S1 } · ts 는 서버가');
    p.update({ chat: { text: '일반', fly: true } });
    chk(ws.lastOf('chat').text === '일반' && !('tab' in ws.lastOf('chat')) && ws.lastOf('chat').fly === true, '  ↳ #일반 말풍선은 tab 없음');
    ws.msg({ t: 'patch', memberId: 'm2', tab: 'S1', state: 'focus' });
    await tick();
    chk(J.friends.m2.tab === 's1' && J.friends.m2.state === 'focus', '받은 patch 의 탭은 앱 id');
  }catch(err){ chk(false, '3절 던짐 — ' + err.message); }

  say('── 4. 찌르기');
  try{
    const J = await joined(S);
    const { p, ws, e } = J;
    p.poke('m2', 'pet');
    p.poke('m2', 'dance:wave');
    p.pokeSelf('bonk:1');
    const pk = ws.all('poke');
    chk(pk.length === 3 && pk[0].all === true && !('all' in pk[1]) && pk[2].to === 'm1', '방 전원 찌르기 all · 나머지는 대상만 · 나 찌르기 to = 내 자리');
    ws.msg({ t: 'poked', from: 'm2', to: 'm1', type: 'pet', ts: 9 });
    await tick();
    chk(J.hl.L.indexOf('poked:pet') >= 0, '  ↳ 내게 온 찌르기 → onPoked');
    ws.kill(1006); await tick();
    p.pokeSelf('dizzy');
    p.update({ chat: { text: '끊긴 동안' } });
    await e.clock.advance(1000);
    const ws2 = await readyOn(e);
    const rj = ws2.all('join')[0];
    chk(rj && rj.resume === 'R1' && !rj.me, '다시 붙으면 resume 으로');
    ws2.msg({ t: 'welcome', room: 'PLAY-AB12', memberId: 'm1b', resume: 'R2', resumed: true, members: MEMBERS, meta: META, music: null, musicSeq: -1, now: e.clock.t });
    await tick();
    const held = ws2.all('poke');
    chk(held.length === 1 && held[0].to === 'm1b' && ws2.all('chat').length === 1, '  ↳ 들고 있던 찌르기 · 말풍선을 보낸다(나 찌르기는 새 자리로)');
    chk(ws2.all('patch').length === 1 && ws2.all('def').length === 1, '  ↳ resumed — 지금 상태 전체 · def 를 한 번 다시');
  }catch(err){ chk(false, '4절 던짐 — ' + err.message); }

  say('── 5. 끊김');
  try{
    const J = await joined(S);
    const { ws, e, hl } = J;
    ws.kill(1006); await tick();
    await e.clock.advance(14000);
    chk(hl.L.indexOf('re:true') < 0, '15초 전엔 조용히');
    await e.clock.advance(1500);
    chk(hl.L.indexOf('re:true') >= 0, '15초 넘게 못 돌아오면 «다시 연결 중» 알림');
    let ws2 = null;
    for(let i = 0; i < 10 && !ws2; i++){ await e.clock.advance(1000); if(e.socks.length > 1 && !e.last().closed) ws2 = e.last(); }
    ws2 = await readyOn(e);
    chk(hl.L.indexOf('re:false') >= 0 && ws2.all('join')[0] && ws2.all('join')[0].resume === 'R1', '  ↳ 돌아오면 거두고 resume');
    ws2.msg({ t: 'welcome', room: 'PLAY-AB12', memberId: 'm1', resume: 'R1', resumed: true, members: MEMBERS, meta: META, music: null, musicSeq: -1, now: e.clock.t });
    await tick();
    const J2 = await joined(S);
    J2.ws.kill(1006); await tick();
    // 다시 붙지 못하게 — 소켓을 계속 끊는다
    for(let i = 0; i < 120; i++){ await J2.e.clock.advance(1000); const w = J2.e.last(); if(w && !w.closed) w.kill(1006); }
    chk(J2.hl.L.indexOf('lost:unreachable') >= 0 && J2.e.rt.inRoom() === false, '90초 못 돌아오면 포기(onLost unreachable) · 방 밖');
  }catch(err){ chk(false, '5절 던짐 — ' + err.message); }

  say('── 6. 서버 판정');
  try{
    const e = mk(S);
    e.hub.start();
    const ws = await readyOn(e);
    const p = e.rt.makeProvider({}, null);
    const jp = p.join('WORK-AB12', Object.assign({}, ME), () => {});
    await tick();
    ws.msg({ t: 'error', code: 'full', ref: 'join' });
    const r = await settle(jp, e.clock);
    chk(r && r.ok === false && r.code === 'full' && e.rt.inRoom() === false, '정원 거절 → { ok:false, code:full } · 방 밖');
    const J = await joined(S);
    J.ws.kill(1006); await tick(); await J.e.clock.advance(1000);
    const w2 = await readyOn(J.e);
    w2.msg({ t: 'error', code: 'resumeFailed', ref: 'join' });
    await tick();
    const rj = w2.all('join');
    chk(rj.length === 2 && rj[0].resume === 'R1' && rj[1].me && !rj[1].resume, 'resumeFailed → me 를 실어 전체 join');
    w2.msg({ t: 'welcome', room: 'PLAY-AB12', memberId: 'm1', resume: 'R3', resumed: false, members: MEMBERS, meta: META, music: null, musicSeq: 4, now: J.e.clock.t });
    await tick();
    const mp = J.p.setMeta({ tabs: { s1: { name: '새이름' } }, title: '제목' });
    await tick();
    const mm = w2.lastOf('meta');
    chk(mm && mm.tabs && mm.tabs.S1 && mm.tabs.S1.name === '새이름' && !mm.tabs.s1 && mm.title === '제목', 'setMeta → meta{ tabs:{ S1 } · title }');
    w2.msg({ t: 'meta', meta: Object.assign({}, META, { title: '제목', tabs: { S1: { name: '새이름', ts: 10 }, S2: META.tabs.S2 } }) });
    const mr = await settle(mp, J.e.clock);
    chk(mr && mr.ok === true, '  ↳ 바뀐 meta 가 오면 ok');
    const same = await settle(J.p.setMeta({ title: '제목' }), J.e.clock);
    chk(same.ok === true && w2.all('meta').length === 1, '  ↳ 이미 그 값이면 보내지 않고 ok');
    const fp = J.p.setMeta({ open: true });
    await tick();
    w2.msg({ t: 'error', code: 'forbidden', ref: 'meta' });
    const fr = await settle(fp, J.e.clock);
    chk(fr && fr.ok === false && fr.code === 'forbidden', '  ↳ 거절은 { ok:false, code }');
    const sp = J.p.sendMusic({ id: 'abcdefghijk', title: '곡', paused: false, seq: 3 }, 12);
    await tick();
    w2.msg({ t: 'error', code: 'stale', ref: 'music' });
    const sr = await settle(sp, J.e.clock);
    chk(sr && sr.ok === false && sr.code === 'stale' && J.p.lastMusicSeq() === 4, 'music stale 거절 · lastMusicSeq = welcome.musicSeq');
    w2.msg({ t: 'left', memberId: 'm1', reason: 'closed' });
    await tick();
    chk(J.hl.L.indexOf('lost:closed') >= 0, '관리자 종료(left closed) → onLost closed');
    const K = await joined(S);
    K.ws.msg({ t: 'left', memberId: 'm1', reason: 'replaced' });
    await tick();
    chk(K.hl.L.indexOf('replaced') >= 0 && !K.e.rt.inRoom(), '내 자리 replaced → onReplaced');
    const D = await joined(S);
    D.ws.msg({ t: 'disband', reason: 'noLicensedHost' });
    await tick();
    chk(D.hl.L.indexOf('disband') >= 0 && !D.e.rt.inRoom(), '해산 → onDisband');
    const X = await joined(S);
    X.ws.msg({ t: 'sessionLost' }); X.ws.kill(4004);
    await tick();
    chk(X.hl.L.indexOf('replaced') >= 0 && !X.e.rt.inRoom(), '다른 기기가 차지(4004) → onReplaced');
    const Y = await joined(S);
    Y.ws.msg({ t: 'error', code: 'CHAT_OFF', ref: 'chatSay', requestId: 'abcdefgh' });
    await tick();
    chk(Y.e.rt.inRoom() && Y.hl.L.indexOf('lost:CHAT_OFF') < 0, '대화 · 사진 오류(ref chatSay)는 방 포트가 받지 않는다');
  }catch(err){ chk(false, '6절 던짐 — ' + err.message); }

  say('── 7. 방 밖');
  try{
    const e = mk(S);
    e.hub.start();
    const ws = await readyOn(e);
    const rp = e.rt.random(12, 'togetherroom');
    await tick();
    const q = ws.lastOf('random');
    chk(q && q.limit === 12 && q.channel === 'togetherroom' && typeof q.rid === 'string', 'random{ limit · channel · rid }');
    ws.msg({ t: 'random', rooms: ['PLAY-AAAA', 3, 'PLAY-BBBB'], rid: q && q.rid });
    const rs = await settle(rp, e.clock);
    chk(Array.isArray(rs) && rs.join() === 'PLAY-AAAA,PLAY-BBBB', '  ↳ 글자만 남긴 목록');
    const pp = e.rt.peek('SCRT-AB12');
    await tick();
    const pq = ws.lastOf('peek');
    ws.msg({ t: 'peek', room: 'SCRT-AB12', exists: true, count: 3, channel: 'togetherroom', secret: true, rid: pq && pq.rid });
    const pv = await settle(pp, e.clock);
    chk(pv && pv.exists === true && pv.count === 3 && pv.channel === 'togetherroom' && pv.secret === true, 'peek → { exists, count, channel, secret }');
    const e2 = mk(S);
    const nr = await settle(e2.rt.random(5), e2.clock);
    const np = await settle(e2.rt.peek('WORK-AB12'), e2.clock);
    chk(nr === null && np === null, '  ↳ 못 물으면 null(빈 목록과 다르게)');
    const h = S.HTML, i = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
    chk(i('room/room-rt.js') > i('realtime/rt-hub.js') && i('room/room-rt.js') > i('shared/remote-config.js') && i('app.js') > i('room/room-rt.js'), 'html — rt-hub.js · remote-config.js → room-rt.js → app.js 차례');
    const R = loadCls(S.RT);
    chk(R.tabToWire('s1') === 'S1' && R.tabToWire('general') === null && R.tabFromWire('S2') === 's2' && R.tabFromWire('GENERAL') === null && R.historyTabOf('general') === 'GENERAL' && R.historyTabOf('s2') === 'S2',
      '탭 바꾸기 한 곳 — s1 ↔ S1 · #일반은 칸 없음 / 기록은 GENERAL');
    chk(R.MEMBER_FIELDS.indexOf('lic') < 0 && R.MEMBER_FIELDS.indexOf('userId') < 0, '  ↳ 멤버 칸에 lic · userId 없음');
  }catch(err){ chk(false, '7절 던짐 — ' + err.message); }
}

(async () => {
await judge(SRC0);

say('── 8. 일부러 깨 보기');
const BREAKS = [
  ['RT', "    out[k] = (k === 'tab') ? tabToWire(o[k]) : o[k];", "    out[k] = o[k];", '탭을 앱 id 그대로 보냄(서버 badRequest)'],
  ['RT', "  if(typeof v.userCode === 'string') v.userId = v.userCode;", "", '친구 객체에 userId 없음(올라타기 · 벤치가 사람을 못 찾음)'],
  ['RT', "const MEMBER_FIELDS = Object.freeze(['name',", "const MEMBER_FIELDS = Object.freeze(['lic', 'name',", 'lic 를 실음(서버 badRequest)'],
  ['RT', "        if(P.joined) sendJoin(P, !P.resume);   // 다시 붙음 — resume 먼저", "        if(P.joined) sendJoin(P, true);", '다시 붙을 때 resume 없이(남에게 나갔다 들어온 것처럼 보임)'],
  ['RT', "      if(m.code === 'resumeFailed'){ sendJoin(P, true); return; }", "", 'resumeFailed 뒤 다시 안 들어감'],
  ['RT', "        lost(P, 'unreachable');", "", '오래 끊겨도 포기 안 함'],
  ['RT', "      if(k === 'state' && now() - P.lastStateAt < STATE_MIN_GAP_MS){ scheduleState(P); continue; }", "", '집중 상태를 매번 보냄'],
  ['RT', "    if(isRoomWidePoke(type)) msg.all = true;", "", '방 전원 찌르기가 대상에게만'],
  ['RT', "          if(m.reason === 'replaced'){", "          if(false){", '같은 계정이 자리를 가져가도 모름'],
  ['RT', "    if(id && src[w] && typeof src[w].name === 'string') tabs[id] = { name: src[w].name, ts: Number(src[w].ts) || 0 };", "    tabs[w] = src[w];", 'meta 탭 키를 서버 이름 그대로(앱 탭 목록이 빔)'],
  ['RT', "          }else if(m.reason === 'closed'){", "          }else if(false){", '관리자 종료를 모름'],
  ['HTML', '<script src="parts/room/room-rt.js"></script>', '', 'html 에 안 실음'],
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
