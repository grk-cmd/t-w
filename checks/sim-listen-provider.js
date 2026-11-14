/*
 * 🎧 같이 듣기 곡 칸 provider(room/listen-provider.js) 검사 — 가짜 방 provider 로 돌린다.
 * 1. 방 안 — music 메시지 구독(불러오는 중 undefined → 값 | null) · 쓰기 · 지우기 · 거절 · 서버 시계 · 앞 차례
 * 2. 방 밖 — 구독 · 쓰기 안 함 · 시각은 기기 시계 · 앞 차례 -1
 * 3. 깨 보기
 * 설계: docs/LISTEN_TOGETHER.md 2.2 · 2.4 · 5장(0.13 — 곡 칸은 realtime 서버 music 메시지 하나. Firebase _music 칸은 걷었다)
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
const SRC = need('listen-provider.js');
const load = (src) => { const w = {}; new Function('window', src)(w); return w.TwListenProvider; };
const MODEL = (() => { const w = {}; new Function('window', need('listen-model.js'))(w); return w.TwListenModel; })();   // 위치 계산 정본

function fakeServer(){
  const sl = { fns: [], sent: [], pos: [], reply: { ok: true } };
  const sp = {
    onMusic(fn){ sl.fns.push(fn); return () => { sl.fns = sl.fns.filter(f => f !== fn); }; },
    async sendMusic(m, pos){ sl.sent.push(m); sl.pos.push(pos); return sl.reply; },
    serverNow(){ return 9999; },
    lastMusicSeq(){ return 6; },
  };
  return { sp, sl };
}

(async () => {
say('── 1. 방 안');
{
  const { sp, sl } = fakeServer();
  let srv = sp;
  const P = load(SRC).createListenProvider({ server: () => srv, model: MODEL });
  const got = [];
  const un = P.subscribe('PLAY-AB12', (v) => got.push(v));
  chk(got.length === 1 && got[0] === undefined && sl.fns.length === 1, '★ 부르자마자 undefined — 불러오는 중(«틀 곡 없음» 과 다르게 그린다) · 방 포트 music 을 듣는다');
  sl.fns[0](null); sl.fns[0]({ id: 'aaaaaaaaaaa', seq: 2 });
  chk(got[1] === null && got[2].seq === 2, '  서버가 준 곡 · 없음(null)을 그대로');
  un(); chk(sl.fns.length === 0, '  끊는 함수가 듣기를 끊는다');
  const r1 = await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', at: 9999 - 30000, paused: false, pos: 0, seq: 3 });
  const r2 = await P.write('PLAY-AB12', null);
  chk(r1.ok && r2.ok && sl.sent.length === 2 && sl.sent[1] === null, '쓰기 · 지우기(null — 틀 곡 없음)');
  chk(sl.pos[0] === 30 && sl.pos[0] === MODEL.posOf(sl.sent[0], 9999), '★ 지금 위치는 listen-model posOf(서버 시계)로 재서 넘긴다 — 위치 계산은 한 곳');
  await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', at: 0, paused: true, pos: 12, seq: 4 });
  chk(sl.pos[2] === 12, '  멈춘 곡은 멈춘 위치');
  await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', at: 9999 - 200000 * 1000, paused: false, pos: 0, seq: 5 });
  await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', at: 0, paused: true, pos: 99999, seq: 6 });
  chk(sl.pos[3] === MODEL.MUSIC_POS_MAX && sl.pos[4] === 86400 && MODEL.MUSIC_POS_MAX === 86400, '★ 보내는 위치는 0~86400 으로 자른다 — 서버가 그 밖이면 badRequest 로 통째로 거절');
  chk(P.lastSeq() === 6, '★ 칸이 비었을 때 새 곡의 앞 차례 — 서버가 기억하는 마지막 차례');
  sl.reply = { ok: false, code: 'stale' };
  const r3 = await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', seq: 1 });
  chk(r3.ok === false && r3.err === 'stale', '  서버 거절은 { ok:false, err: 까닭 } — 화면이 E-ROOM-05 로');
  chk(P.now() === 9999, '★ 시각은 방 포트 시계(welcome · music 의 now)');
  const got2 = [];
  P.subscribe(null, (v) => got2.push(v));
  chk(got2.length === 0, '  방 코드가 없으면 구독하지 않는다');
}

say('── 2. 방 밖');
{
  const P = load(SRC).createListenProvider({ server: () => null, model: MODEL });
  const got = [];
  P.subscribe('PLAY-AB12', (v) => got.push(v));
  const w = await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa', seq: 1 });
  const t0 = Date.now(), t = P.now();
  chk(got.length === 0 && w.ok === false && w.err === 'notInRoom', '구독 · 쓰기 안 함 · 쓰기는 { ok:false, err:notInRoom }');
  chk(Math.abs(t - t0) < 1000 && P.lastSeq() === -1, '  시각은 기기 시계 · 앞 차례 -1');
}

say('── 3. 깨 보기');
{
  const { sp } = fakeServer();
  const B = load(SRC.replace('  cb(undefined);\n', '')).createListenProvider({ server: () => sp, model: MODEL });
  const got = [];
  B.subscribe('PLAY-AB12', (v) => got.push(v));
  chk(got.length === 0, '«불러오는 중» 을 빼면 1절이 빨강');
  const B3 = load(SRC.replace('return sp ? sp.lastMusicSeq() : -1;', 'return -1;')).createListenProvider({ server: () => sp, model: MODEL });
  chk(B3.lastSeq() !== 6, '서버 마지막 차례를 안 내놓으면 1절 «앞 차례» 가 빨강');
  const MB = (() => { const w = {}; new Function('window', need('listen-model.js').replace('return Math.min(MUSIC_POS_MAX, posOf(m, now));', 'return posOf(m, now);'))(w); return w.TwListenModel; })();
  chk(MB.wirePos({ paused: true, pos: 99999 }, 0) > 86400, '위치 상한을 빼면 1절 «0~86400 으로 자른다» 가 빨강');
}

say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
})();
