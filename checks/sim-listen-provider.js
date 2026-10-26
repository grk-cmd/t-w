/*
 * 🎧 같이 듣기 곡 칸 provider(room/listen-provider.js) + firebase-init 두 함수 검사 — 가짜 api 로 돌린다.
 * 1. 구독: 불러오는 중(undefined) → 값 | null · 못 받음은 onErr · 방이 없으면 구독 안 함
 * 2. 쓰기 · 지우기 · 서버 시각  2-2. 방 서버 방 — music 메시지(구독 · 쓰기 · 거절 · 서버 시계) · Firebase 를 안 부른다
 * 3. firebase-init: 경로 · setRoomChannel 이 같이 듣기를 정할 때 지난 곡을 지운다  4. 깨 보기
 * 설계: docs/LISTEN_TOGETHER.md 2.2 · 2.4 · 5장
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
const SRC = need('listen-provider.js'), FI = need('firebase-init.js');
const load = (src) => { const w = {}; new Function('window', src)(w); return w.TwListenProvider; };
const MODEL = (() => { const w = {}; new Function('window', need('listen-model.js'))(w); return w.TwListenModel; })();   // 위치 계산 정본

function fakeApi(){
  const log = { subs: [], writes: [], unsubs: 0 };
  const api = {
    subscribeRoomMusic(room, cb, onErr){ log.subs.push({ room, cb, onErr }); return () => { log.unsubs++; }; },
    async setRoomMusic(room, m){ log.writes.push([room, m]); return { ok: room !== 'DENY' }; },
    serverNow(){ return 1234; },
  };
  return { api, log };
}

(async () => {
say('── 1. 구독');
{
  const { api, log } = fakeApi();
  const P = load(SRC).createListenProvider({ api: () => api, server: () => null, model: MODEL });
  const got = [];
  const un = P.subscribe('PLAY-AB12', (v) => got.push(v), (e) => got.push('ERR:' + e));
  chk(got.length === 1 && got[0] === undefined, '★ 부르자마자 undefined — 불러오는 중(«틀 곡 없음» 과 다르게 그린다)');
  log.subs[0].cb(null);
  log.subs[0].cb({ id: 'aaaaaaaaaaa', seq: 1 });
  chk(got[1] === null && got[2].id === 'aaaaaaaaaaa', '  그다음 칸 없음 null · 값');
  log.subs[0].onErr('denied');
  chk(got[3] === 'ERR:denied', '  거부는 onErr 로(없음과 따로)');
  un();
  chk(log.subs[0].room === 'PLAY-AB12' && log.unsubs === 1, '  끊는 함수가 api 구독을 끊는다');
  const got2 = [];
  P.subscribe(null, (v) => got2.push(v));
  chk(log.subs.length === 1 && got2.length === 0, '  방 코드가 없으면 구독하지 않는다');
}

say('── 2. 쓰기 · 서버 시각');
{
  const { api, log } = fakeApi();
  const P = load(SRC).createListenProvider({ api: () => api, server: () => null, model: MODEL });
  const r1 = await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa' });
  const r2 = await P.write('PLAY-AB12', null);
  const r3 = await P.write('DENY', { id: 'aaaaaaaaaaa' });
  const r4 = await P.write('', { id: 'aaaaaaaaaaa' });
  chk(r1.ok && r2.ok && log.writes[1][1] === null, '쓰기 · 지우기(null — 틀 곡 없음)');
  chk(r3.ok === false && r4.ok === false && log.writes.length === 3, '  실패는 { ok:false } 그대로 · 방이 없으면 안 쓴다');
  chk(P.now() === 1234, '★ 시각은 서버 시각(firebaseAPI.serverNow) — 기기 시계가 아니다');
}

say('── 2-2. 방 서버 방');
{
  const { api, log } = fakeApi();
  const sl = { fns: [], sent: [], pos: [], reply: { ok: true } };
  const sp = {
    onMusic(fn){ sl.fns.push(fn); return () => { sl.fns = sl.fns.filter(f => f !== fn); }; },
    async sendMusic(m, pos){ sl.sent.push(m); sl.pos.push(pos); return sl.reply; },
    serverNow(){ return 9999; },
    lastMusicSeq(){ return 6; },
  };
  let srv = sp;
  const P = load(SRC).createListenProvider({ api: () => api, server: () => srv, model: MODEL });
  const got = [];
  const un = P.subscribe('PLAY-AB12', (v) => got.push(v), () => got.push('ERR'));
  chk(got.length === 1 && got[0] === undefined && sl.fns.length === 1 && log.subs.length === 0, '★ 방 서버 방은 서버 music 을 듣는다 — Firebase _music 은 구독하지 않는다 · 처음은 불러오는 중');
  sl.fns[0](null); sl.fns[0]({ id: 'aaaaaaaaaaa', seq: 2 });
  chk(got[1] === null && got[2].seq === 2, '  서버가 준 곡 · 없음(null)을 그대로');
  un(); chk(sl.fns.length === 0, '  끊는 함수가 서버 듣기를 끊는다');
  const r1 = await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', at: 9999 - 30000, paused: false, pos: 0, seq: 3 });
  const r2 = await P.write('PLAY-AB12', null);
  chk(r1.ok && r2.ok && sl.sent.length === 2 && sl.sent[1] === null && log.writes.length === 0, '★ 쓰기 · 지우기도 서버로 — Firebase 에 안 쓴다');
  chk(sl.pos[0] === 30 && sl.pos[0] === MODEL.posOf(sl.sent[0], 9999), '★ 지금 위치는 listen-model posOf(서버 시계)로 재서 넘긴다 — 위치 계산은 한 곳');
  await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', at: 0, paused: true, pos: 12, seq: 4 });
  chk(sl.pos[2] === 12, '  멈춘 곡은 멈춘 위치');
  await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', at: 9999 - 200000 * 1000, paused: false, pos: 0, seq: 5 });
  await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', at: 0, paused: true, pos: 99999, seq: 6 });
  chk(sl.pos[3] === MODEL.MUSIC_POS_MAX && sl.pos[4] === 86400 && MODEL.MUSIC_POS_MAX === 86400, '★ 보내는 위치는 0~86400 으로 자른다 — 방 서버가 그 밖이면 badRequest 로 통째로 거절');
  chk(P.lastSeq() === 6, '★ 칸이 비었을 때 새 곡의 앞 차례 — 방 서버가 기억하는 마지막 차례');
  sl.reply = { ok: false, code: 'stale' };
  const r3 = await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', seq: 1 });
  chk(r3.ok === false && r3.err === 'stale', '  서버 거절은 { ok:false, err: 까닭 } — 화면이 E-ROOM-05 로');
  chk(P.now() === 9999, '★ 시각은 방 서버 시계(welcome · music 의 now) — Firebase 보정 시각이 아니다');
  srv = null;
  chk(P.now() === 1234, '  방 서버 방이 아니면 다시 Firebase 시각');
  chk(P.lastSeq() === -1, '  Firebase 방은 -1(칸을 지우면 차례도 없다)');
}

say('── 3. firebase-init');
{
  chk(/subscribeRoomMusic\(room, cb, onErr\)\{ const unsub = onValue\(ref\(db, `rooms\/\$\{room\}\/_music`\), snap => cb\(snap\.val\(\) \|\| null\), onErr\);/.test(FI), '구독은 rooms/{방}/_music 한 칸만(방 전체를 받지 않는다) · 거부는 onErr');
  chk(/async setRoomMusic\(room, music\)\{ try\{ await set\(ref\(db, `rooms\/\$\{room\}\/_music`\), music \|\| null\); return \{ ok:true \}; \}catch\(e\)\{ return \{ ok:false, err:e \}; \} \}/.test(FI), '쓰기는 같은 칸에 set · 실패는 { ok:false, err }');
  const sc = (FI.match(/async setRoomChannel\(room, channel, hostUserId, open, fields\)\{[\s\S]*?\n    \},/) || [''])[0];
  const RM = "if(fields && 'music' in fields) try{ await remove(ref(db, `rooms/${room}/_music`)); }catch(_){}";
  const iRm = sc.indexOf(RM);
  const iUp = sc.indexOf('await update(ref(db, `rooms/${room}/_meta`), meta);');
  chk(iUp > 0 && iRm > iUp, '★ 방을 열며 같이 듣기를 정하면(music 칸) 지난 곡을 지운다 — 방은 통째로 안 지워진다 · _meta 를 먼저 써서 지우기가 막혀도 방은 열린다');
  chk(!/music/.test(sc.replace(RM, '').replace(/\/\/.*$/gm, '')), '  music 칸이 없는 쓰기(하트비트 · 빈 방 선점)는 곡을 건드리지 않는다');
}

say('── 4. 깨 보기');
{
  const { api } = fakeApi();
  const B = load(SRC.replace('  cb(undefined);\n', '')).createListenProvider({ api: () => api, server: () => null, model: MODEL });
  const got = [];
  B.subscribe('PLAY-AB12', (v) => got.push(v));
  chk(got.length === 0, '«불러오는 중» 을 빼면 1절이 빨강');
  const sp = { onMusic(){ return () => {}; }, async sendMusic(){ return { ok: true }; }, serverNow(){ return 9999; }, lastMusicSeq(){ return 6; } };
  const B2 = load(SRC.replace('if(sp) return sp.onMusic(', 'if(false) return sp.onMusic(')).createListenProvider({ api: () => api, server: () => sp, model: MODEL });
  const before = api.subscribeRoomMusic;
  let fbSubs = 0; api.subscribeRoomMusic = () => { fbSubs++; return () => {}; };
  B2.subscribe('PLAY-AB12', () => {});
  api.subscribeRoomMusic = before;
  chk(fbSubs === 1, '방 서버 고르기를 빼면 Firebase 를 구독한다 — 2-2절이 빨강');
  const B3 = load(SRC.replace('return sp ? sp.lastMusicSeq() : -1;', 'return -1;')).createListenProvider({ api: () => api, server: () => sp, model: MODEL });
  chk(B3.lastSeq() !== 6, '서버 마지막 차례를 안 내놓으면 2-2절 «앞 차례» 가 빨강');
  const MB = (() => { const w = {}; new Function('window', need('listen-model.js').replace('return Math.min(MUSIC_POS_MAX, posOf(m, now));', 'return posOf(m, now);'))(w); return w.TwListenModel; })();
  chk(MB.wirePos({ paused: true, pos: 99999 }, 0) > 86400, '위치 상한을 빼면 2-2절 «0~86400 으로 자른다» 가 빨강');
}

say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
})();
