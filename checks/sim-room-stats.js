/*
 * roomStats(서버 방 개수 요약)와 roomIndex 쓰기 검사. 모듈을 그대로 불러 가짜 DB 로 돌린다.
 * 1. functions/room-stats.js  2. room-index.js  3. room-stats.js  4. firebase-init.js 연결 · 규칙
 */
'use strict';
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

    // runRoomStats: 지우기 트랜잭션은 서버 값으로 판정해야 한다
    const mkDb = (idx, server) => {
      const L = { sets: [], tx: {} };
      const db = { ref: (p) => ({
        get: async () => ({ val: () => (p === 'roomIndex' ? idx : null) }),
        transaction: async (fn) => {
          if(p === 'roomStats'){ const v = fn(L.stats); if(v !== undefined){ L.stats = v; L.sets.push([p, v]); } return { committed: v !== undefined }; }
          const code = p.split('/')[1];
          let r = fn(null);                                       // 첫 호출은 로컬 추측값
          if(r === null && server[code] != null) r = fn(server[code]);
          L.tx[code] = r;
          return { committed: r !== undefined };
        },
      }) };
      return { db, L };
    };
    const old = { lastSeen: now - 11 * 60 * 1000 };
    const { db, L } = mkDb({ D1: old, D2: old }, { D1: old, D2: { lastSeen: now - 5000, channel: 'togetherroom' } });
    const sum = await (async () => { const q = console.log; console.log = () => {}; try{ return await f.runRoomStats(db, now); } finally { console.log = q; } })();
    chk(L.sets.length === 1 && L.sets[0][0] === 'roomStats', 'roomStats 를 한 번 쓴다');
    const FX = need('functions/index.js');
    chk(/exports\.roomStatsOnOpen = onValueCreated\(\{ ref: '\/roomIndex\/\{room\}'[\s\S]{0,300}runRoomStats\(getDatabase\(\), Date\.now\(\), \{ drop: false \}\)/.test(FX),
        '방이 열리면(roomIndex 줄 생성) 바로 다시 센다 — 줄 수정(하트비트)에는 반응하지 않는 onValueCreated');
    chk(L.tx.D1 === null && sum.dropped === 1, '서버 값도 낡았으면 지운다');
    chk(L.tx.D2 === undefined && sum.kept === 1, '그새 누가 다시 들어와 lastSeen 이 새로워졌으면 그만둔다');
    {
      const { db: db2, L: L2 } = mkDb({ D1: old }, { D1: old });
      L2.stats = { workingroom: 9, togetherroom: 9, at: now + 5000 };   // 더 늦게 읽은 실행이 먼저 썼다
      const s2 = await f.runRoomStats(db2, now, { drop: false });
      chk(L2.sets.length === 0 && L2.stats.workingroom === 9, '겹친 실행: 더 늦게 읽은 값이 있으면 덮지 않는다');
      chk(Object.keys(L2.tx).length === 0 && s2.dropped === 0, 'drop:false(방 열림 트리거)는 줄을 지우지 않는다');
    }
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
    chk(await mk({ workingroom: '3', togetherroom: 2, at: now }, now).counts() === null, '모양이 틀리면 null');
    chk(await createRoomStats({ db: {}, ref: (_d, p) => p, get: async () => { throw new Error('permission_denied'); }, now: () => now }).counts() === null, '규칙 거부(규칙 배포 전)도 null');
  }

  say('── 4. firebase-init.js 연결 · 규칙');
  {
    chk(/import \{ createRoomIndex \} from "\.\/room-index\.js";/.test(CODE) && /import \{ createRoomStats \} from "\.\/room-stats\.js";/.test(CODE), 'room-index.js · room-stats.js 를 import 한다');
    chk(/createRoomIndex\(\{[\s\S]{0,200}state: \(\) => \(\{ room: _roomCode, meta: _roomMetaVal \}\)/.test(CODE), 'roomIndex 에 방 상태를 «부를 때마다» 읽는 함수로 넘긴다');
    chk(/function _touchRoomIndex\(room, extra\)\{ _roomIndex\.touch\(room, extra\); \}/.test(CODE), '_touchRoomIndex 는 모듈로 넘기기만 한다 (하트비트 · 재접속 · 유령 복구가 모두 이 길)');
    chk(/if\(open === true \|\| open === false\) meta\.open = open;\s*await update\(ref\(db, `rooms\/\$\{room\}\/_meta`\), meta\);/.test(CODE), 'setRoomChannel 이 open 을 _meta 에도 쓴다 (명시한 boolean 일 때만)');
    chk(/createRoomStats\(\{ db, ref, get, now: \(\) => _svNow\(\) \}\)/.test(CODE), 'roomStats 신선도는 서버 기준 시각(_svNow)으로 본다');
    chk(/async getRoomCounts\(opts\)\{\s*if\(opts && opts\.quick\)\{\s*const qc = await _roomStats\.counts\(\);/.test(CODE), 'getRoomCounts 는 quick 일 때만 roomStats 를 본다');
    chk((CODE.match(/_roomStats\./g) || []).length === 1, 'roomStats 를 쓰는 자리는 quick 카운트 하나뿐');
    const fr = CODE.match(/async findRandomRooms\(limit\)\{[\s\S]*?\n    \},/);
    chk(!!fr && !/_roomStats/.test(fr[0]) && /get\(ref\(db, 'roomIndex'\)\)/.test(fr[0]), '랜덤 참여는 roomIndex 를 직접 읽는다 (방금 연 방도 후보에)');
    const gc = CODE.match(/async getRoomCount\([^)]*\)\{[\s\S]*?\n    \},/);
    chk(!!gc && !/_roomStats/.test(gc[0]), '정원 검사(getRoomCount)는 roomStats 를 쓰지 않는다');
    let rr = null; try{ rr = JSON.parse(RULES).rules.roomStats; }catch(_){}
    chk(!!rr && rr['.read'] === true && !('.write' in rr) && Object.keys(rr).length === 1, '규칙: roomStats 는 읽기만 — 쓰기는 서버(Admin SDK)만');
  }

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
