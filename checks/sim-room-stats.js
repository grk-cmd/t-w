/*
 * roomStats(서버 방 개수 요약)와 roomIndex 쓰기 검사. 모듈을 그대로 불러 가짜 DB 로 돌린다.
 * 1. functions/room-stats.js  2. room-index.js  3. room-stats.js  4. firebase-init.js 연결 · 규칙
 */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const FI = need('firebase-init.js'), RI = need('room-index.js'), RS = need('room-stats.js');
need('room-channel.js');
const RULES = need('firebase-database-rules.json');
need('functions/room-stats.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);
// ES 모듈을 함수로 불러온다. './x.js' import 는 그 파일 내용을 앞에 붙여 대신한다(한 단계).
const unexport = (src) => src.replace(/^export (function|const) /mg, '$1 ');
const esm = (src, names) => {
  const deps = [...src.matchAll(/^import \{[^}]*\} from '\.\/([\w.-]+\.js)';\n/mg)].map(m => unexport(need(m[1])));
  return new Function(deps.join('\n') + '\n' + unexport(src.replace(/^import [^\n]*\n/mg, '')) + `\nreturn { ${names} };`)();
};
const tick = () => new Promise(r => setTimeout(r, 0));

(async () => {
  say('── 1. functions/room-stats.js (서버 집계)');
  {
    const f = require(path.resolve('functions/room-stats.js'));
    const now = 1e9;
    chk(f.ROOM_LIVE_MS === 90 * 1000, '살아 있는 방 기준 90초 — 앱 getRoomCounts 의 STALE 과 같다');
    chk(/const STALE = 90\*1000;/.test(CODE), '  ↳ 앱 쪽도 아직 90초다 (한쪽만 바꾸면 숫자가 어긋난다)');
    const { stats, drop } = f.roomStatsFrom({
      W1: { lastSeen: now - 1000, channel: 'workingroom', open: true },
      W2: { lastSeen: now - 1000 },                                        // channel 없음 → 워킹룸(앱과 같음)
      T1: { lastSeen: now - 1000, channel: 'togetherroom', open: true },   // 투게더룸은 랜덤 후보 아님
      S1: { lastSeen: now - 100 * 1000, channel: 'workingroom', open: true }, // 90초 넘음 — 안 셈 · 안 지움
      D1: { lastSeen: now - 11 * 60 * 1000, channel: 'togetherroom' },     // 10분 넘음 — 지움
      'SCRT-A': { lastSeen: now - 1000, channel: 'togetherroom' },          // 시크릿룸 — 안 셈
      'SCRT-B': { lastSeen: now - 11 * 60 * 1000 },                         // 낡은 시크릿룸 줄 — 지움
      BAD: 'x', NOTS: { channel: 'workingroom' },
    }, now);
    chk(stats.workingroom === 2 && stats.togetherroom === 1, `채널별 개수 (워킹 ${stats.workingroom} · 투게더 ${stats.togetherroom}) = 2 · 1`);
    chk(stats.at === now, 'at = 센 시각 (앱이 3분 넘게 낡으면 무시)');
    chk(!('open' in stats), '랜덤 후보는 싣지 않는다 (랜덤 참여는 roomIndex 를 직접 읽는다)');
    chk(JSON.stringify(drop.slice().sort()) === '["D1","SCRT-B"]', `지울 줄 = 10분 넘은 것만 (${JSON.stringify(drop)})`);

    // runRoomStats — 가짜 Admin DB. get('roomIndex') 는 읽은 값, 트랜잭션은 경로별 서버 값(srv)으로 판정한다.
    // 실제 SDK 처럼 첫 호출은 로컬 추측값(null)으로 부르고, null 을 돌려주면 서버 값으로 다시 부른다.
    const mkDb = (read, server, stats) => {
      const srv = Object.assign({}, server), L = { sets: [], stats, srv };
      const db = { ref: (p) => ({
        get: async () => ({ val: () => (p === 'roomIndex' ? read : (srv[p] !== undefined ? srv[p] : null)) }),
        transaction: async (fn) => {
          if(p === 'roomStats'){ const v = fn(L.stats); if(v !== undefined){ L.stats = v; L.sets.push([p, v]); } return { committed: v !== undefined }; }
          const cur = srv[p] !== undefined ? srv[p] : null;
          let r = fn(null);
          if(r === null && cur !== null) r = fn(cur);
          if(r !== undefined){ if(r === null) delete srv[p]; else srv[p] = r; }
          return { committed: r !== undefined, snapshot: { val: () => (r !== undefined ? r : cur) } };
        },
      }) };
      return { db, L };
    };
    const quiet = async (fn) => { const q = console.log; console.log = () => {}; try{ return await fn(); } finally { console.log = q; } };
    const old = { lastSeen: now - 11 * 60 * 1000 };
    let { db, L } = mkDb({ D1: old, D2: old }, { 'roomIndex/D1': old, 'roomIndex/D2': { lastSeen: now - 5000, channel: 'togetherroom' } });
    let sum = await quiet(() => f.runRoomStats(db, now));
    chk(L.sets.length === 1 && L.sets[0][0] === 'roomStats', 'roomStats 를 한 번 쓴다');
    chk(!('roomIndex/D1' in L.srv) && sum.dropped === 1, '서버 값도 낡았으면 지운다');
    chk(!!L.srv['roomIndex/D2'] && sum.kept === 1, '그새 누가 다시 들어와 lastSeen 이 새로워졌으면 그만둔다');

    // 지우기 전에 channel · open 을 _meta 로 옮겨 둔다
    const gone = { lastSeen: now - 11 * 60 * 1000, channel: 'workingroom', open: true };
    ({ db, L } = mkDb({ G1: gone, G2: gone }, { 'roomIndex/G1': gone, 'rooms/G1/_meta': { channel: 'workingroom', host: 'u1' }, 'roomIndex/G2': gone }));
    await quiet(() => f.runRoomStats(db, now));
    chk(L.srv['rooms/G1/_meta'] && L.srv['rooms/G1/_meta'].open === true && L.srv['rooms/G1/_meta'].host === 'u1' && !('roomIndex/G1' in L.srv),
        '줄을 지우기 전에 빠진 open 을 _meta 에 옮겨 둔다 (있던 값은 그대로)');
    chk(!('rooms/G2/_meta' in L.srv) && !('roomIndex/G2' in L.srv), '  ↳ _meta 가 없으면(정상 종료된 방) 새로 만들지 않는다');

    // 되살아난 줄에 channel · open 이 빠졌으면 _meta 에서 채운다 (옛 판 앱이 { lastSeen } 만 쓴 경우)
    const bare = { lastSeen: now - 1000 };
    ({ db, L } = mkDb({ R1: bare, R2: bare }, { 'roomIndex/R1': bare, 'rooms/R1/_meta': { channel: 'togetherroom', open: false }, 'roomIndex/R2': bare }));
    sum = await quiet(() => f.runRoomStats(db, now));
    chk(L.srv['roomIndex/R1'].channel === 'togetherroom' && L.srv['roomIndex/R1'].open === false && sum.repaired === 1,
        '되살아난 줄의 channel · open 을 _meta 에서 채운다');
    chk(L.stats.togetherroom === 1 && L.stats.workingroom === 1, '  ↳ 채운 값으로 센다 (투게더룸이 워킹룸으로 세어지지 않는다)');
    chk(!L.srv['roomIndex/R2'].channel, '  ↳ _meta 가 없으면 그대로 둔다');

    {
      ({ db, L } = mkDb({ D1: old, R1: bare }, { 'roomIndex/D1': old, 'roomIndex/R1': bare, 'rooms/R1/_meta': { channel: 'togetherroom' } },
                        { workingroom: 9, togetherroom: 9, at: now + 5000 }));   // 더 늦게 읽은 실행이 먼저 썼다
      const s2 = await f.runRoomStats(db, now, { drop: false });
      chk(L.sets.length === 0 && L.stats.workingroom === 9, '겹친 실행: 더 늦게 읽은 값이 있으면 덮지 않는다');
      chk(('roomIndex/D1' in L.srv) && !L.srv['roomIndex/R1'].channel && s2.dropped === 0 && s2.repaired === 0,
          'drop:false(열림 · 닫힘 트리거)는 세기만 한다 — 지우기 · 채우기 없음');
    }
    // 🛰 방 서버 줄({ lastSeen, channel, srv }) — 세고, 빈 방 청소 · channel 채우기 · _meta 옮기기는 안 하고, 낡으면 줄만 지운다
    {
      const r = f.roomStatsFrom({
        V1: { lastSeen: now - 1000, channel: 'togetherroom', srv: 'realtime-1' },
        V2: { lastSeen: now - 1000, channel: 'workingroom', srv: 'realtime-1' },
        F1: { lastSeen: now - 1000, channel: 'togetherroom' },
        VS: { lastSeen: now - 100 * 1000, channel: 'workingroom', srv: 'realtime-1' },        // 90초 넘음 — 안 셈
        VD: { lastSeen: now - 11 * 60 * 1000, channel: 'workingroom', srv: 'realtime-1' },    // 10분 넘음 — 줄만 지움
        VE: { lastSeen: 0, emptyAt: now - 5 * 60 * 1000, channel: 'workingroom', srv: 'realtime-1' }, // 비었음 모양이어도 빈 방 청소 아님
        VR: { lastSeen: now - 1000, srv: 'realtime-1' },                                      // channel 없어도 _meta 로 채우지 않음
      }, now);
      chk(r.stats.togetherroom === 2 && r.stats.workingroom === 2, `서버 줄도 Firebase 줄과 똑같이 센다 (워킹 ${r.stats.workingroom} · 투게더 ${r.stats.togetherroom}) = 2 · 2`);
      chk(r.stats.server && r.stats.server.togetherroom === 1 && r.stats.server.workingroom === 2, '  ↳ 그중 서버 몫을 stats.server 에 따로 적는다 (이미 합계에 들어 있다)');
      chk(f.isServerRow({ srv: 'realtime-1' }) && !f.isServerRow({ lastSeen: 1 }) && !f.isServerRow({ srv: '' }), 'isServerRow — srv 가 빈 문자열이 아닐 때만');
      chk(r.empty.indexOf('VE') === -1, '서버 줄은 빈 방 청소(_meta · _chatTab · chatLog 지우기) 대상이 아니다');
      chk(r.repair.indexOf('VR') === -1, '서버 줄은 Firebase _meta 로 channel 을 채우지 않는다');
      chk(r.drop.indexOf('VD') !== -1 && r.drop.indexOf('VS') === -1 && r.drop.indexOf('V1') === -1, '낡은 서버 줄(서버가 죽음)은 10분 뒤 지울 대상 — 90초만 넘은 줄은 남긴다');
      const dead = { lastSeen: now - 11 * 60 * 1000, channel: 'workingroom', open: true, srv: 'realtime-1' };
      ({ db, L } = mkDb({ VD: dead }, { 'roomIndex/VD': dead, 'rooms/VD/_meta': { channel: 'togetherroom', host: 'u1' } }));
      sum = await quiet(() => f.runRoomStats(db, now));
      chk(!('roomIndex/VD' in L.srv) && sum.dropped === 1, '낡은 서버 줄은 줄만 지운다');
      chk(L.srv['rooms/VD/_meta'] && !('open' in L.srv['rooms/VD/_meta']) && L.srv['rooms/VD/_meta'].channel === 'togetherroom',
          '  ↳ 같은 코드의 Firebase _meta 는 건드리지 않는다 (서버 줄의 channel · open 을 옮기지 않음)');
      const live = { lastSeen: now - 1000, channel: 'workingroom', srv: 'realtime-1' };
      ({ db, L } = mkDb({ V1: live }, { 'roomIndex/V1': live }));
      sum = await quiet(() => f.runRoomStats(db, now));
      chk(L.srv['roomIndex/V1'] && L.stats.workingroom === 1 && L.stats.server.workingroom === 1 && sum.server === 1,
          'runRoomStats — Firebase rooms 에 사람이 없어도 살아 있는 서버 줄은 지우지 않고 센다');
    }
    const FX = need('functions/index.js');
    chk(/exports\.roomStatsOnOpen = onValueCreated\(\{ ref: '\/roomIndex\/\{room\}'[\s\S]{0,500}runRoomStats\(getDatabase\(\), Date\.now\(\), \{ drop: false \}\)/.test(FX),
        '방이 열리면(roomIndex 줄 생성) 바로 다시 센다 — 줄 수정(하트비트)에는 반응하지 않는 onValueCreated');
    const close = FX.match(/exports\.roomStatsOnClose = onValueDeleted\(\{ ref: '\/roomIndex\/\{room\}'[\s\S]*?\n  \}\);/);
    chk(!!close && /runRoomStats\(getDatabase\(\), Date\.now\(\), \{ drop: false \}\)/.test(close[0]), '마지막 사람이 나가 줄이 지워지면 바로 다시 센다 (onValueDeleted)');
    chk(!!close && /if \(event\.authType === 'admin'\) return;[\s\S]*runRoomStats/.test(close[0]), "  ↳ 서버 청소(authType 'admin')가 지운 건 건너뛴다 — 수백 줄 청소가 수백 번 다시 세기가 되지 않게");
  }

  say('── 2. room-index.js (roomIndex 쓰기)');
  {
    const { createRoomIndex } = esm(RI, 'createRoomIndex');
    const mk = (o) => {
      const env = Object.assign({ room: 'COZY-1', meta: { channel: 'togetherroom' }, writes: [] }, o);
      env.ri = createRoomIndex({
        db: {}, ref: (_d, p) => p, serverTimestamp: () => 'TS',
        update: (p, v) => { env.writes.push([p, v]); return Promise.resolve(); },
        state: () => ({ room: env.room, meta: env.meta }),
      });
      return env;
    };
    const last = (e) => JSON.stringify(e.writes[e.writes.length - 1]);
    let e = mk({});
    e.ri.touch('COZY-1');
    chk(last(e) === '["roomIndex/COZY-1",{"lastSeen":"TS","channel":"togetherroom"}]', '_meta 에 open 이 없으면 lastSeen + channel 만 (false 로 덮지 않는다)');
    e = mk({ meta: { channel: 'workingroom', open: true } }); e.ri.touch('COZY-1');
    chk(last(e) === '["roomIndex/COZY-1",{"lastSeen":"TS","channel":"workingroom","open":true}]', '_meta 의 channel · open 을 같이 싣는다');
    e = mk({ meta: { channel: 'workingroom', open: false } }); e.ri.touch('COZY-1');
    chk(/"open":false/.test(last(e)), '  ↳ open:false 도 싣는다');
    e.ri.touch('COZY-1', { channel: 'togetherroom', open: true });
    chk(last(e) === '["roomIndex/COZY-1",{"lastSeen":"TS","channel":"togetherroom","open":true}]', '명시한 extra 가 이긴다 (setRoomChannel)');
    e.ri.touch('OTHER');
    chk(last(e) === '["roomIndex/OTHER",{"lastSeen":"TS"}]', '지금 방이 아닌 코드에는 아무것도 덧붙이지 않는다');
    const n = e.writes.length; e.ri.touch('SCRT-9');
    chk(e.writes.length === n, '시크릿룸은 쓰지 않는다');
    e = mk({ meta: null }); e.ri.touch('COZY-1');
    chk(last(e) === '["roomIndex/COZY-1",{"lastSeen":"TS"}]', '메타 도착 전 → lastSeen 만');
    e = mk({ meta: { channel: 'evil', open: 'yes' } }); e.ri.touch('COZY-1');
    chk(last(e) === '["roomIndex/COZY-1",{"lastSeen":"TS"}]', '규칙에 없는 값은 싣지 않는다 (쓰기 거부 방지)');
  }

  say('── 3. room-stats.js (roomStats 읽기)');
  {
    const { createRoomStats, ROOM_STATS_FRESH_MS } = esm(RS, 'createRoomStats, ROOM_STATS_FRESH_MS');
    const mk = (val, now) => createRoomStats({ db: {}, ref: (_d, p) => p, get: async () => ({ val: () => val }), now: () => now });
    const now = 1e9;
    chk(ROOM_STATS_FRESH_MS === 3 * 60 * 1000, '신선도 기준 3분 (함수가 1분마다 쓰니 두 번 놓쳐도 버틴다)');
    chk(JSON.stringify(await mk({ workingroom: 3, togetherroom: 2, at: now - 1000 }, now).counts()) === '{"total":5,"workingroom":3,"togetherroom":2}', 'counts = 채널 둘의 합');
    chk(await mk({ workingroom: 3, togetherroom: 2, at: now - ROOM_STATS_FRESH_MS }, now).counts() === null, '3분 낡으면 null → roomIndex 로 물러난다');
    chk(await mk(null, now).counts() === null, '없으면(함수 배포 전) null');
    chk(JSON.stringify(await mk({ workingroom: 3, togetherroom: 2, at: now - 1000, server: { workingroom: 1, togetherroom: 0 } }, now).counts())
        === '{"total":5,"workingroom":3,"togetherroom":2,"inclServer":true}', '🛰 server 몫이 있으면 inclServer — 합계에 이미 서버 방이 들어 있다(더하지 않는다)');
    chk(await mk({ workingroom: '3', togetherroom: 2, at: now }, now).counts() === null, '모양이 틀리면 null');
    chk(await createRoomStats({ db: {}, ref: (_d, p) => p, get: async () => { throw new Error('permission_denied'); }, now: () => now }).counts() === null, '규칙 거부(규칙 배포 전)도 null');
    {
      const W = { cb: null, err: null, off: 0 };
      const rs = createRoomStats({ db: {}, ref: (_d, p) => p, get: async () => null, now: () => now,
        onValue: (p, cb, err) => { W.path = p; W.cb = cb; W.err = err; return () => { W.off++; }; } });
      const got = []; const off = rs.watch(c => got.push(c));
      W.cb({ val: () => ({ workingroom: 1, togetherroom: 2, at: now }) });
      W.cb({ val: () => ({ workingroom: 1, togetherroom: 2, at: now - ROOM_STATS_FRESH_MS }) });
      W.err(new Error('permission_denied'));
      off();
      chk(W.path === 'roomStats' && JSON.stringify(got) === '[{"total":3,"workingroom":1,"togetherroom":2},null,null]',
          'watch — 쓰는 즉시 숫자, 낡음 · 거부는 null');
      chk(W.off === 1, '  ↳ 돌려준 함수로 구독을 끊는다');
    }
  }

  say('── 4. firebase-init.js 연결 · 규칙');
  {
    chk(/import \{ createRoomIndex \} from "\.\/room-index\.js";/.test(CODE) && /import \{ createRoomStats \} from "\.\/room-stats\.js";/.test(CODE), 'room-index.js · room-stats.js 를 import 한다');
    chk(/createRoomIndex\(\{[\s\S]{0,200}state: \(\) => \(\{ room: _roomCode, meta: _roomMetaVal \}\)/.test(CODE), 'roomIndex 에 방 상태를 «부를 때마다» 읽는 함수로 넘긴다');
    chk(/function _touchRoomIndex\(room, extra\)\{ _roomIndex\.touch\(room, extra\); \}/.test(CODE), '_touchRoomIndex 는 모듈로 넘기기만 한다 (하트비트 · 재접속 · 유령 복구가 모두 이 길)');
    chk(/if\(open === true \|\| open === false\) meta\.open = open;\s*await update\(ref\(db, `rooms\/\$\{room\}\/_meta`\), meta\);/.test(CODE), 'setRoomChannel 이 open 을 _meta 에도 쓴다 (명시한 boolean 일 때만)');
    chk(/async getRoomCounts\(opts\)\{\s*if\(opts && opts\.quick\)\{\s*const qc = await _roomStats\.counts\(\);/.test(CODE), 'getRoomCounts 는 quick 일 때만 roomStats 를 본다');
    chk((CODE.match(/_roomStats\./g) || []).length === 2, 'roomStats 를 쓰는 자리는 quick 카운트 · 구독 둘뿐');
    chk(/createRoomStats\(\{ db, ref, get, onValue, now: \(\) => _svNow\(\) \}\)/.test(CODE) && /watchRoomCounts\(cb\)\{ return _roomStats\.watch\(cb\); \}/.test(CODE), 'firebaseAPI.watchRoomCounts 로 구독을 연다 · 신선도는 서버 기준 시각(_svNow)');
    const APP = strip(_joinRenderer(need('app.js')));
    const sw = APP.match(/function startRoomCountWatch\(\)\{[\s\S]*?\n\}/);
    chk(!!sw && /_roomCountUnsub = firebaseAPI\.watchRoomCounts\(_paintRoomCounts\)/.test(sw[0]), '방 창을 열면 구독한다 (startRoomCountWatch)');
    chk(!!sw && /clearInterval\(_roomCountTimer\);[\s\S]{0,80}_roomCountUnsub\(\)/.test(sw[0]), '  ↳ 방 창이 닫히면 구독을 끊는다');
    const fr = CODE.match(/async findRandomRooms\(limit\)\{[\s\S]*?\n    \},/);
    chk(!!fr && !/_roomStats/.test(fr[0]) && /get\(ref\(db, 'roomIndex'\)\)/.test(fr[0]), '랜덤 참여는 roomIndex 를 직접 읽는다 (방금 연 방도 후보에)');
    const gc = CODE.match(/async getRoomCount\([^)]*\)\{[\s\S]*?\n    \},/);
    chk(!!gc && !/_roomStats/.test(gc[0]), '정원 검사(getRoomCount)는 roomStats 를 쓰지 않는다');
    const gcnt = CODE.match(/async getRoomCounts\(opts\)\{[\s\S]*?\n    \},/);
    chk(!!gcnt && /if\(e\.srv\) out\.inclServer = true;/.test(gcnt[0]), '🛰 getRoomCounts — 방 서버 줄이 있으면 inclServer (서버 방이 합계에 들어 있다)');
    chk(/function _addServerRoomCounts\(c\)\{[\s\S]{0,120}if\(!c \|\| c\.inclServer \|\|/.test(APP), '  ↳ app.js 는 inclServer 면 방 서버 stats 를 또 더하지 않는다 (두 번 세기)');
    const cg = CODE.match(/async cleanGhostRooms\(\)\{[\s\S]*?\n    \},/);
    chk(!!cg && /if\(idx\[code\] && idx\[code\]\.srv\) continue;[^\n]*\n\s*if\(!\(code in all\)/.test(cg[0]), '🛰 유령 방 청소는 방 서버 줄을 «rooms 에 없는 고아» 로 지우지 않는다');
    let rr = null; try{ rr = JSON.parse(RULES).rules.roomStats; }catch(_){}
    chk(!!rr && rr['.read'] === true && !('.write' in rr) && Object.keys(rr).length === 1, '규칙: roomStats 는 읽기만 — 쓰기는 서버(Admin SDK)만');
  }

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
