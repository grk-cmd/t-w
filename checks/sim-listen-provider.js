/*
 * 🎧 같이 듣기 곡 칸 provider(room/listen-provider.js) + firebase-init 두 함수 검사 — 가짜 api 로 돌린다.
 * 1. 구독: 불러오는 중(undefined) → 값 | null · 못 받음은 onErr · 방이 없으면 구독 안 함
 * 2. 쓰기 · 지우기 · 서버 시각  3. firebase-init: 경로 · setRoomChannel 이 같이 듣기를 정할 때 지난 곡을 지운다  4. 깨 보기
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
  const P = load(SRC).createListenProvider({ api: () => api });
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
  const P = load(SRC).createListenProvider({ api: () => api });
  const r1 = await P.write('PLAY-AB12', { id: 'aaaaaaaaaaa' });
  const r2 = await P.write('PLAY-AB12', null);
  const r3 = await P.write('DENY', { id: 'aaaaaaaaaaa' });
  const r4 = await P.write('', { id: 'aaaaaaaaaaa' });
  chk(r1.ok && r2.ok && log.writes[1][1] === null, '쓰기 · 지우기(null — 틀 곡 없음)');
  chk(r3.ok === false && r4.ok === false && log.writes.length === 3, '  실패는 { ok:false } 그대로 · 방이 없으면 안 쓴다');
  chk(P.now() === 1234, '★ 시각은 서버 시각(firebaseAPI.serverNow) — 기기 시계가 아니다');
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
  const B = load(SRC.replace('  cb(undefined);\n', '')).createListenProvider({ api: () => api });
  const got = [];
  B.subscribe('PLAY-AB12', (v) => got.push(v));
  chk(got.length === 0, '«불러오는 중» 을 빼면 1절이 빨강');
}

say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
})();
